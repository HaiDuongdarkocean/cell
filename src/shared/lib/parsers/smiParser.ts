import type { SrtCue } from '@/entities/media';
import { stripSubtitleTags } from './srtNormalizer';

/**
 * # SMI / SAMI Format
 *
 * Synchronized Accessible Media Interchange (SAMI) is a Microsoft-developed
 * caption format with HTML-like structure. Spec: SAMI 1.0
 * (https://learn.microsoft.com/en-us/previous-versions/windows/desktop/dnacc/understanding-sami-1.0).
 * Media Foundation SAMI media source reference:
 * https://learn.microsoft.com/en-us/windows/win32/medfound/sami-media-source
 *
 * Structure:
 *   <SAMI>
 *     <HEAD>
 *       <STYLE TYPE="text/css"> <!-- CSS wrapped in HTML comments --> </STYLE>
 *     </HEAD>
 *     <BODY>
 *       <SYNC Start=0><P Class=ENUSCC>caption text</P>
 *       <SYNC Start=3000><P Class=ENUSCC>next caption</P>
 *     </BODY>
 *   </SAMI>
 *
 * Format quirks (verified against Microsoft docs + 12 real-world samples):
 *  - `Start` attribute = integer milliseconds (not timecode).
 *  - No explicit end time — duration implied by next SYNC block's Start.
 *  - `</SYNC>` closing tags OPTIONAL — a new `<SYNC>` implicitly closes previous.
 *  - `<HEAD>` section OPTIONAL — minimal files only need `<SAMI>`, `<BODY>`,
 *    `<SYNC>`, `<P>`.
 *  - `&nbsp;` used for empty/silent cues (Microsoft docs: "To blank a
 *    paragraph, a non-breaking space is used").
 *  - CSS in `<STYLE>` wrapped in `<!-- ... -->` HTML comments.
 *  - Multi-language via CSS class names following `[LANG][REGION][TYPE]`
 *    pattern (e.g., `ENUSCC`, `KRCC`, `JPCC`).
 *  - Font color formats vary: named (`blue`), hex (`#0000ff`), with/without
 *    quotes.
 */

/** Default duration (ms) for the last cue, which has no following SYNC. */
const DEFAULT_LAST_CUE_DURATION_MS = 2000;

/** Default preferred language class when none is requested. */
const DEFAULT_PREFERRED_CLASS = 'ENUSCC';

interface PBlock {
  readonly className: string;
  readonly inner: string;
}

/**
 * Extract all `<P>` blocks from a single SYNC block's content.
 *
 * Handles unclosed `<P>` tags (a new `<P>` or `<SYNC>` implicitly closes the
 * previous one) as well as explicitly closed `</P>` tags.
 */
function extractPBlocks(syncContent: string): PBlock[] {
  const openRe = /<P\s+([^>]*)>/gi;
  const opens: { attrs: string; openStart: number; openEnd: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(syncContent)) !== null) {
    opens.push({
      attrs: m[1],
      openStart: m.index,
      openEnd: m.index + m[0].length,
    });
  }

  const blocks: PBlock[] = [];
  for (let i = 0; i < opens.length; i++) {
    const startIdx = opens[i].openEnd;
    const nextOpenIdx =
      i + 1 < opens.length ? opens[i + 1].openStart : syncContent.length;

    // Look for a </P> between this open and the next <P>.
    const slice = syncContent.slice(startIdx, nextOpenIdx);
    const closeMatch = slice.match(/<\/P>\s*/i);
    const endIdx = closeMatch
      ? startIdx + (closeMatch.index ?? 0)
      : nextOpenIdx;

    const inner = syncContent.slice(startIdx, endIdx);
    const classMatch = opens[i].attrs.match(/Class\s*=\s*["']?([^\s"'>]+)/i);
    const className = classMatch ? classMatch[1] : '';
    blocks.push({ className, inner });
  }
  return blocks;
}

/**
 * Clean the inner HTML of a `<P>` tag into plain cue text.
 *
 * - `<BR>` → newline
 * - `&nbsp;` → space (then trimmed → empty for silent cues)
 * - All other HTML tags stripped (reuses `stripSubtitleTags`)
 */
function cleanSmiText(inner: string): string {
  const withBreaks = inner.replace(/<BR\s*\/?>/gi, '\n');
  const withEntities = withBreaks.replace(/&nbsp;/gi, ' ');
  const stripped = stripSubtitleTags(withEntities);
  return stripped.trim();
}

/**
 * Parse SMI/SAMI caption content into an array of {@link SrtCue}.
 *
 * Multi-language files contain multiple `<P>` tags per `<SYNC>` (one per
 * language class). The `preferredClass` selects which language track to
 * extract; if it is absent, the first `<P>` class in the first SYNC block is
 * used as fallback.
 *
 * End time for each cue is computed from the next SYNC block's Start. The
 * last cue (no following SYNC) gets `start + DEFAULT_LAST_CUE_DURATION_MS`.
 *
 * @param content - Raw SMI/SAMI file content.
 * @param preferredClass - CSS class name of the language track to extract
 *   (default `ENUSCC`). Falls back to the first available class if absent.
 */
export function parseSmi(
  content: string,
  preferredClass: string = DEFAULT_PREFERRED_CLASS,
): SrtCue[] {
  const stripped = content.replace(/^\uFEFF/, '');
  if (stripped.trim().length === 0) {
    throw new Error('Cannot parse empty SMI content');
  }

  // Extract BODY section. If no <BODY>, parse the whole document (some
  // malformed files omit it). Stop at </BODY>, </SAMI>, or EOF.
  const bodyMatch = stripped.match(
    /<BODY[^>]*>([\s\S]*?)(?:<\/BODY>|<\/SAMI>|$)/i,
  );
  const body = bodyMatch ? bodyMatch[1] : stripped;

  // Locate every <SYNC Start=ms> tag and its content span.
  const syncRe = /<SYNC\s+Start\s*=\s*(\d+)\s*>/gi;
  const syncs: { start: number; content: string }[] = [];
  const positions: { start: number; tagStart: number; contentBegin: number }[] =
    [];
  let m: RegExpExecArray | null;
  while ((m = syncRe.exec(body)) !== null) {
    positions.push({
      start: Number.parseInt(m[1], 10),
      tagStart: m.index,
      contentBegin: m.index + m[0].length,
    });
  }

  if (positions.length === 0) {
    return [];
  }

  for (let i = 0; i < positions.length; i++) {
    // Content spans from after this SYNC tag to the start of the next SYNC
    // tag (or end of body) — a new <SYNC> implicitly closes the previous.
    const contentEnd =
      i + 1 < positions.length ? positions[i + 1].tagStart : body.length;
    syncs.push({
      start: positions[i].start,
      content: body.slice(positions[i].contentBegin, contentEnd),
    });
  }

  // Determine target class: use preferredClass if any SYNC has it, else the
  // first P class found in the first SYNC block.
  const firstSyncBlocks = extractPBlocks(syncs[0].content);
  const hasPreferred = firstSyncBlocks.some(
    (b) => b.className.toUpperCase() === preferredClass.toUpperCase(),
  );
  const targetClass = hasPreferred
    ? preferredClass
    : (firstSyncBlocks[0]?.className ?? preferredClass);

  const cues: SrtCue[] = [];
  for (let i = 0; i < syncs.length; i++) {
    const end =
      i + 1 < syncs.length
        ? syncs[i + 1].start
        : syncs[i].start + DEFAULT_LAST_CUE_DURATION_MS;

    const pBlocks = extractPBlocks(syncs[i].content);
    const matchBlock =
      pBlocks.find(
        (b) => b.className.toUpperCase() === targetClass.toUpperCase(),
      ) ?? pBlocks[0];

    const text = matchBlock ? cleanSmiText(matchBlock.inner) : '';
    cues.push({ index: i + 1, start: syncs[i].start, end, text });
  }

  return cues;
}
