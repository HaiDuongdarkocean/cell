import type { SrtCue, SrtSubtitle } from '@/entities/media';
import { stripSubtitleTags } from './srtNormalizer';
import { parseTtmlTime } from './ttmlTime';

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

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`TTML XML parse error: ${parseError.textContent?.slice(0, 200) ?? 'unknown'}`);
  }

  const tt = doc.documentElement;
  if (tt.tagName.toLowerCase() !== 'tt') {
    throw new Error(`TTML root element is <${tt.tagName}>, expected <tt>`);
  }

  const tickRate = parseRate(tt.getAttribute('ttp:tickRate')) ?? 1;
  const frameRate = parseRate(tt.getAttribute('ttp:frameRate')) ?? 30;

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

    const rawText = extractTextWithBr(p);
    const text = stripSubtitleTags(rawText).trim();
    if (text.length === 0) continue;

    cues.push({ index: cues.length + 1, start, end, text });
  }

  return { cues };
}

function parseRate(attr: string | null): number | null {
  if (!attr) return null;
  const n = parseFloat(attr);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractTextWithBr(p: Element): string {
  const clone = p.cloneNode(true) as Element;

  const brs = clone.getElementsByTagName('br');
  while (brs.length > 0) {
    const br = brs[0];
    br.replaceWith(document.createTextNode('\n'));
  }

  return clone.textContent ?? '';
}
