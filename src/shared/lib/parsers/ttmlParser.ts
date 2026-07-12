import type { SrtCue, SrtSubtitle } from '@/entities/media';
import { stripSubtitleTags } from './srtNormalizer';

/**
 * Parse TTML (IMSC1.1 / TTML2) subtitle content into SrtSubtitle.
 *
 * Netflix serves IMSC1.1 TTML XML for all subtitle tracks. The format uses:
 *   <tt ttp:tickRate="10000000" ttp:timeBase="media">
 *     <body><div><p begin="162245417t" end="203119584t"><span>text</span></p></div></body>
 *   </tt>
 *
 * Time formats supported:
 *  - `Nt` (ticks) — requires `ttp:tickRate` on root `<tt>` (Netflix default)
 *  - `HH:MM:SS.mmm` (clock) — standard TTML time expression
 *  - `Ns` (seconds with optional fraction) — e.g. `12.5s`
 *  - `Nf` (frames) — requires `ttp:frameRate` (fallback, not seen on Netflix)
 *
 * Edge cases:
 *  - BOM stripped
 *  - `<br>` inside `<p>` → newline in cue text
 *  - Nested `<span>` tags stripped, inner text preserved
 *  - Empty content → throws Error
 *  - DOMParser unavailable (Node test env) → throws with clear message
 *
 * Source: stress test 2026-07-13 via edge-devtools MCP (movie 81947712,
 * zh-Hans track, 735 cues, tickRate=10000000).
 */
export function parseTtml(content: string): SrtSubtitle {
  const stripped = content.replace(/^\uFEFF/, '');
  if (stripped.trim().length === 0) {
    throw new Error('Cannot parse empty TTML content');
  }

  if (typeof DOMParser === 'undefined') {
    throw new Error('DOMParser unavailable — TTML parser requires a DOM environment');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(stripped, 'application/xml');

  // Check for parse errors (DOMParser returns <parsererror> for malformed XML)
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`TTML XML parse error: ${parseError.textContent?.slice(0, 200) ?? 'unknown'}`);
  }

  const tt = doc.documentElement;
  if (tt.tagName.toLowerCase() !== 'tt') {
    throw new Error(`TTML root element is <${tt.tagName}>, expected <tt>`);
  }

  // Extract tickRate and frameRate from root element attributes.
  // Default tickRate per TTML spec is 1 (but Netflix always sets 10000000).
  const tickRate = parseRate(tt.getAttribute('ttp:tickRate')) ?? 1;
  const frameRate = parseRate(tt.getAttribute('ttp:frameRate')) ?? 30;

  // Query all <p> elements (cues) — they may be nested in <div> inside <body>.
  const pElements = doc.getElementsByTagName('p');
  const cues: SrtCue[] = [];

  for (let i = 0; i < pElements.length; i++) {
    const p = pElements[i];
    const beginAttr = p.getAttribute('begin');
    const endAttr = p.getAttribute('end');
    if (!beginAttr || !endAttr) continue;

    const start = parseTtmlTime(beginAttr, tickRate, frameRate);
    const end = parseTtmlTime(endAttr, tickRate, frameRate);
    if (start === null || end === null) continue;

    // Extract text: convert <br> to newline, strip other tags, keep inner text.
    const rawText = extractTextWithBr(p);
    const text = stripSubtitleTags(rawText).trim();
    if (text.length === 0) continue;

    cues.push({ index: cues.length + 1, start, end, text });
  }

  return { cues };
}

/** Parse a rate attribute (tickRate or frameRate) as a number. */
function parseRate(attr: string | null): number | null {
  if (!attr) return null;
  const n = parseFloat(attr);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Parse a TTML time expression into milliseconds.
 *
 * Formats:
 *  - `Nt` → ticks: `N / tickRate * 1000`
 *  - `Nf` → frames: `N / frameRate * 1000`
 *  - `Ns` → seconds: `N * 1000`
 *  - `HH:MM:SS` or `HH:MM:SS.mmm` → clock
 *  - `HH:MM:SS:ff` (SMPTE frame-based) → clock + frames
 */
function parseTtmlTime(expr: string, tickRate: number, frameRate: number): number | null {
  const trimmed = expr.trim();

  // Tick format: "162245417t"
  if (trimmed.endsWith('t')) {
    const ticks = parseFloat(trimmed.slice(0, -1));
    if (!Number.isFinite(ticks)) return null;
    return (ticks / tickRate) * 1000;
  }

  // Frame format: "24f"
  if (trimmed.endsWith('f')) {
    const frames = parseFloat(trimmed.slice(0, -1));
    if (!Number.isFinite(frames)) return null;
    return (frames / frameRate) * 1000;
  }

  // Seconds format: "12.5s"
  if (trimmed.endsWith('s')) {
    const seconds = parseFloat(trimmed.slice(0, -1));
    if (!Number.isFinite(seconds)) return null;
    return seconds * 1000;
  }

  // Clock format: "HH:MM:SS.mmm" or "HH:MM:SS" or "HH:MM:SS:ff"
  const clockMatch = trimmed.match(/^(\d+):(\d{2}):(\d{2})(?:[.:](\d+))?$/);
  if (clockMatch) {
    const hours = parseInt(clockMatch[1], 10);
    const minutes = parseInt(clockMatch[2], 10);
    const seconds = parseInt(clockMatch[3], 10);
    const fraction = clockMatch[4];

    let ms = hours * 3_600_000 + minutes * 60_000 + seconds * 1_000;
    if (fraction) {
      // If fraction is 3 digits → milliseconds. If 1-2 digits → centiseconds.
      // If >3 digits (frame count in SMPTE HH:MM:SS:ff) → frames.
      if (fraction.length === 3) {
        ms += parseInt(fraction, 10);
      } else if (fraction.length < 3) {
        // Centiseconds: 1 digit = 100ms units, 2 digits = 10ms units
        ms += parseInt(fraction, 10) * Math.pow(10, 3 - fraction.length);
      } else {
        // Frame count (SMPTE): fraction / frameRate * 1000
        ms += (parseInt(fraction, 10) / frameRate) * 1000;
      }
    }
    return ms;
  }

  return null;
}

/**
 * Extract text from a `<p>` element, converting `<br>` to newlines
 * and stripping all other tags (keeping inner text).
 */
function extractTextWithBr(p: Element): string {
  // Clone to avoid modifying the original document.
  const clone = p.cloneNode(true) as Element;

  // Replace <br> elements with newline text nodes.
  const brs = clone.getElementsByTagName('br');
  while (brs.length > 0) {
    const br = brs[0];
    br.replaceWith(document.createTextNode('\n'));
  }

  // Get textContent — this strips all remaining tags and returns inner text.
  return clone.textContent ?? '';
}
