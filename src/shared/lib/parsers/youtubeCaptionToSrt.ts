/**
 * Convert YouTube timedtext response bodies (srv3 XML or json3) to SRT text.
 *
 * The YouTube player fetches `/api/timedtext` with the format it prefers
 * (srv3 or json3 for ASR, vtt for manual tracks). When the extension captures
 * the player's own response, the body is in that raw format — these
 * converters normalize it to SRT so the existing pipeline can parse it.
 *
 * srv3 shape:  <timedtext><body><p t="startMs" d="durMs">text|<s>w</s></p></body></timedtext>
 * json3 shape: { events: [{ tStartMs, dDurationMs, segs: [{ utf8 }] }] }
 */

function msToSrtTime(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const rem = Math.floor(ms % 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(rem, 3)}`;
}

function cuesToSrt(cues: { startMs: number; endMs: number; text: string }[]): string {
  return cues
    .map((c, i) => `${i + 1}\n${msToSrtTime(c.startMs)} --> ${msToSrtTime(c.endMs)}\n${c.text.trim()}`)
    .join('\n\n');
}

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

/**
 * Convert a captured YouTube timedtext body to SRT text.
 * Returns `null` when the body is neither srv3 XML nor json3 (e.g. already
 * WebVTT — callers should use it as-is).
 */
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
  return cuesToSrt(cues);
}
