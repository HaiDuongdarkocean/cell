import { emitSrtBlocks } from './srtNormalizer';

function srv3ToCues(body: string): { startMs: number; endMs: number; text: string }[] {
  if (typeof DOMParser === 'undefined') {
    throw new Error('DOMParser unavailable — srv3 parser requires a DOM environment');
  }
  const doc = new DOMParser().parseFromString(body, 'text/xml');
  if (doc.querySelector('parsererror')) return [];
  const out: { startMs: number; endMs: number; text: string }[] = [];
  for (const p of Array.from(doc.querySelectorAll('p'))) {
    const t = Number(p.getAttribute('t') ?? NaN);
    const d = Number(p.getAttribute('d') ?? NaN);
    if (!Number.isFinite(t) || !Number.isFinite(d)) continue;
    const text = (p.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    out.push({ startMs: t, endMs: t + d, text });
  }
  return out;
}

interface Json3Event {
  readonly tStartMs?: number;
  readonly dDurationMs?: number;
  readonly segs?: readonly { readonly utf8?: string }[];
}

function json3ToCues(body: string): { startMs: number; endMs: number; text: string }[] {
  const parsed = JSON.parse(body) as { events?: Json3Event[] };
  if (!Array.isArray(parsed.events)) return [];
  const out: { startMs: number; endMs: number; text: string }[] = [];
  for (const ev of parsed.events) {
    if (typeof ev.tStartMs !== 'number' || typeof ev.dDurationMs !== 'number') continue;
    if (!Array.isArray(ev.segs)) continue;
    const text = ev.segs
      .map((s) => s.utf8 ?? '')
      .join('')
      .replace(/\u00a0/g, ' ')
      .trim();
    if (!text) continue;
    out.push({ startMs: ev.tStartMs, endMs: ev.tStartMs + ev.dDurationMs, text });
  }
  return out;
}

export function youtubeTimedtextBodyToSrt(body: string): string | null {
  const head = body.replace(/^\uFEFF/, '').trimStart().slice(0, 200);
  let cues: { startMs: number; endMs: number; text: string }[];
  if (head.startsWith('{')) {
    try {
      cues = json3ToCues(body);
    } catch {
      return null;
    }
  } else if (/<\s*timedtext[\s>]/i.test(head) || head.startsWith('<?xml')) {
    try {
      cues = srv3ToCues(body);
    } catch {
      return null;
    }
  } else {
    return null;
  }
  if (cues.length === 0) return null;
  return emitSrtBlocks(
    cues.map((c) => ({ start: c.startMs, end: c.endMs, text: c.text.trim() })),
  );
}
