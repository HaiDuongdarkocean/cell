import { msToSrtTime } from '@/shared/utils/timeUtils';

/**
 * Convert TTML (IMSC1.1) subtitle content to SRT format using regex.
 *
 * Regex-based (not DOMParser) so it works in the service worker (MV3 SW has
 * no DOM API). The auto-load path uses `parseTtml` (DOMParser) in the content
 * script; this converter is for the download path which runs in the SW.
 *
 * Netflix IMSC1.1 structure:
 *   <tt ttp:tickRate="10000000" ...>
 *     <body><div><p begin="162245417t" end="203119584t"><span>text</span></p></div></body>
 *
 * Time formats: `Nt` (ticks), `HH:MM:SS.mmm` (clock), `Ns` (seconds).
 * `<br/>` → newline. All other tags (`<span>`, `<p>`) stripped, inner text kept.
 *
 * ponytail ceiling: regex-based XML parsing is fragile for deeply nested or
 * malformed TTML. Netflix TTML is well-formed and flat (single `<div>`), so
 * this is safe. Upgrade path: route through offscreen document with DOMParser
 * if a complex TTML variant appears.
 *
 * @param ttmlContent - Raw TTML (.ttml / .xml) file content.
 * @returns SRT-formatted subtitle string.
 */
export function convertTtmlToSrt(ttmlContent: string): string {
  const stripped = ttmlContent.replace(/^\uFEFF/, '');
  if (stripped.trim().length === 0) {
    throw new Error('Cannot convert empty TTML content');
  }

  // Extract tickRate (default 1 per TTML spec; Netflix uses 10000000).
  const tickRateMatch = stripped.match(/ttp:tickRate="(\d+)"/);
  const tickRate = tickRateMatch ? parseInt(tickRateMatch[1], 10) : 1;

  // Extract frameRate (fallback for frame-based timing; default 30).
  const frameRateMatch = stripped.match(/ttp:frameRate="(\d+)"/);
  const frameRate = frameRateMatch ? parseInt(frameRateMatch[1], 10) : 30;

  // Match all <p begin="..." end="...">...</p> blocks.
  // Attribute order may vary, so match begin/end separately within the <p> tag.
  const pRegex = /<p\b[^>]*\bbegin="([^"]+)"[^>]*\bend="([^"]+)"[^>]*>([\s\S]*?)<\/p>/g;
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pRegex.exec(stripped)) !== null) {
    const begin = match[1];
    const end = match[2];
    const rawText = match[3];

    const startMs = parseTtmlTime(begin, tickRate, frameRate);
    const endMs = parseTtmlTime(end, tickRate, frameRate);
    if (startMs === null || endMs === null) continue;

    // Convert <br/> and <br> to newline, then strip all other tags.
    const text = stripTtmlTags(rawText).trim();
    if (text.length === 0) continue;

    index += 1;
    const timing = `${msToSrtTime(startMs)} --> ${msToSrtTime(endMs)}`;
    blocks.push([String(index), timing, text].join('\n'));
  }

  if (blocks.length === 0) {
    throw new Error('No cues found in TTML content');
  }

  return `${blocks.join('\n\n')}\n`;
}

/**
 * Parse a TTML time expression into milliseconds.
 * Formats: `Nt` (ticks), `Nf` (frames), `Ns` (seconds), `HH:MM:SS.mmm` (clock).
 */
function parseTtmlTime(expr: string, tickRate: number, frameRate: number): number | null {
  const trimmed = expr.trim();

  if (trimmed.endsWith('t')) {
    const ticks = parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(ticks) ? (ticks / tickRate) * 1000 : null;
  }
  if (trimmed.endsWith('f')) {
    const frames = parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(frames) ? (frames / frameRate) * 1000 : null;
  }
  if (trimmed.endsWith('s')) {
    const seconds = parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(seconds) ? seconds * 1000 : null;
  }

  // Clock: HH:MM:SS.mmm or HH:MM:SS
  const clockMatch = trimmed.match(/^(\d+):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (clockMatch) {
    const h = parseInt(clockMatch[1], 10);
    const m = parseInt(clockMatch[2], 10);
    const s = parseInt(clockMatch[3], 10);
    let ms = h * 3_600_000 + m * 60_000 + s * 1_000;
    if (clockMatch[4]) {
      const frac = clockMatch[4];
      ms += frac.length === 3
        ? parseInt(frac, 10)
        : parseInt(frac, 10) * Math.pow(10, 3 - frac.length);
    }
    return ms;
  }
  return null;
}

/**
 * Strip TTML inline tags, converting `<br>` to newline first.
 * Keeps only inner text of `<span>`, `<i>`, `<b>`, etc.
 */
function stripTtmlTags(text: string): string {
  // Convert <br/> and <br> to newline (case-insensitive, self-closing or not).
  let result = text.replace(/<br\s*\/?>/gi, '\n');
  // Strip all remaining tags, keeping inner text.
  result = result.replace(/<[^>]*>/g, '');
  // Decode common XML entities.
  result = result
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
  // Trim each line; drop empty lines within a cue.
  return result
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}
