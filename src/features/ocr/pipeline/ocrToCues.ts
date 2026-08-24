import type { SrtCue } from '@/entities/media/types';

export interface OcrDetection {
  readonly text: string;
  readonly timeMs: number;
}

export const CUE_TAIL_MS = 500;
export const CUE_MERGE_GAP_MS = 700;
export const LAST_CUE_TAIL_MS = 3000;

export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/'/g, '')
    .replace(/[.!?,;:]+$/g, '')
    .replace(/\s+\w$/, '')
    .replace(/[.!?,;:]+$/g, '')
    .trim();
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  let prev = Array.from({ length: lb + 1 }, (_, i) => i);
  let curr = new Array(lb + 1);
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[lb];
}

export function fuzzyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length >= 15 && longer.startsWith(shorter)) return true;
  if (a.length < 25 || b.length < 25) return false;
  const dist = editDistance(a, b);
  const threshold = Math.min(3, Math.max(1, Math.floor(Math.max(a.length, b.length) / 20)));
  return dist <= threshold;
}

export function ocrTextToCues(detections: readonly OcrDetection[]): SrtCue[] {
  const sorted = [...detections].sort((a, b) => a.timeMs - b.timeMs);
  const cues: SrtCue[] = [];
  let open: { text: string; norm: string; start: number; lastTime: number } | null = null;
  let openIndex = -1;
  let prevEnd: number | null = null;
  const close = (): void => {
    if (!open) return;
    const end = open.lastTime + CUE_TAIL_MS;
    prevEnd = end;
    const cue: SrtCue = { index: openIndex >= 0 ? openIndex : cues.length, start: open.start, end, text: open.text };
    if (openIndex >= 0) cues[openIndex] = cue;
    else cues.push(cue);
    open = null;
    openIndex = -1;
  };
  for (const d of sorted) {
    if (!d.text) { close(); continue; }
    const norm = normalizeText(d.text);
    if (open && fuzzyMatch(open.norm, norm) && d.timeMs - (open.lastTime + CUE_TAIL_MS) <= CUE_MERGE_GAP_MS) {
      open.lastTime = d.timeMs;
      continue;
    }
    const last = cues.at(-1);
    const lastIndex = cues.length - 1;
    const mergeable = !!last && fuzzyMatch(normalizeText(last.text), norm) && d.timeMs - last.end <= CUE_MERGE_GAP_MS;
    close();
    if (last && mergeable) {
      open = { text: last.text, norm, start: last.start, lastTime: d.timeMs };
      openIndex = lastIndex;
      continue;
    }
    const start = prevEnd === null
      ? d.timeMs
      : d.timeMs - prevEnd <= CUE_TAIL_MS ? prevEnd
      : Math.max(prevEnd, d.timeMs - CUE_TAIL_MS);
    open = { text: d.text, norm, start, lastTime: d.timeMs };
  }
  close();
  const deduped: SrtCue[] = [];
  for (const cue of cues) {
    const prev = deduped.at(-1);
    if (prev && fuzzyMatch(normalizeText(prev.text), normalizeText(cue.text))) {
      deduped[deduped.length - 1] = { ...prev, end: Math.max(prev.end, cue.end) };
    } else {
      deduped.push(cue);
    }
  }
  for (let i = 0; i < deduped.length - 1; i++) {
    if (deduped[i].end < deduped[i + 1].start) deduped[i] = { ...deduped[i], end: deduped[i + 1].start };
  }
  if (deduped.length > 0) {
    const last = deduped[deduped.length - 1]!;
    deduped[deduped.length - 1] = { ...last, end: last.start + LAST_CUE_TAIL_MS };
  }
  return deduped.map((c, i) => ({ ...c, index: i }));
}
