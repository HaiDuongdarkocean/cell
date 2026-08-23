// ocrToCues — OCR detection stream → SrtCue[] (spec ocr-split-dual-stream).
// O(n) single pass. Flicker merge: same text quay lại trong CUE_MERGE_GAP_MS → extend cue cũ.
// Timeline continuity: cue.end = start của cue kế tiếp (text stay on screen cho đến detection mới).
// Normalized merge: text so sánh qua normalizeText (trim + collapse ws + lowercase + strip trailing punct)
// để chống OCR noise (trailing space, case, punctuation) tạo duplicate cue.
import type { SrtCue } from '@/entities/media/types';

export interface OcrDetection {
  readonly text: string;
  readonly timeMs: number;
}

export const CUE_TAIL_MS = 500;
export const CUE_MERGE_GAP_MS = 700;
/** Last cue tail — OCR detection has ~1-2s delay, so the last cue's end must
 *  extend beyond currentTime to stay visible until the next detection arrives. */
export const LAST_CUE_TAIL_MS = 3000;

/** Normalize text for comparison: trim, collapse whitespace, lowercase, strip
 *  trailing punctuation + trailing single-char tokens (OCR garbage like " 4", " A").
 *  OCR engines return slightly different text across frames (trailing space, case,
 *  punctuation noise, misread trailing characters) — without normalization, each
 *  variation creates a new cue (user-visible duplicate).
 *  Internal punctuation (e.g. "don't") is preserved — only TRAILING noise is stripped. */
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')        // collapse internal whitespace
    .toLowerCase()
    .replace(/[.!?,;:]+$/g, '')  // strip trailing punctuation
    .replace(/\s+\w$/, '')       // strip trailing single-char token (OCR garbage: " 4", " A")
    .replace(/[.!?,;:]+$/g, '')  // strip punct again after garbage removal
    .trim();
}

/** Levenshtein edit distance — O(L1*L2) but L is bounded (~100 chars for subtitles),
 *  so O(1) per comparison. Used for OCR typo tolerance (e.g. "stll" vs "still"). */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  // Rolling array — O(lb) space.
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

/** Fuzzy match: same text, OR prefix match (OCR appended garbage), OR edit distance
 *  ≤ threshold (OCR typo). Prefix match: if the shorter string is a prefix of the
 *  longer one (≥ 15 chars), OCR likely appended garbage to the end — common when
 *  engine misreads adjacent pixels as extra characters.
 *  Edit distance applies when both strings are ≥ 25 chars — below that, even 1-char
 *  differences are likely real content changes (e.g. "Sentence 1" vs "Sentence 2" at
 *  20 chars). 25+ chars is short enough for real subtitle lines like "Will you still
 *  take me back" (28 chars) where OCR drops a letter ("Wll" vs "Will"). */
function fuzzyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  // Prefix match: shorter is prefix of longer (OCR trailing garbage).
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length >= 15 && longer.startsWith(shorter)) return true;
  // Edit distance: OCR typo tolerance (e.g. "stll" vs "still", "IM" vs "I'll").
  if (a.length < 25 || b.length < 25) return false;
  const dist = editDistance(a, b);
  // 1 edit per 20 chars, capped at 3 — catches "stll"→"still" (1), "IM"→"I'll" (2),
  // but not "Sentence 1"→"Sentence 2" (excluded by length gate).
  const threshold = Math.min(3, Math.max(1, Math.floor(Math.max(a.length, b.length) / 20)));
  return dist <= threshold;
}

export function ocrTextToCues(detections: readonly OcrDetection[]): SrtCue[] {
  const cues: SrtCue[] = [];
  let open: { text: string; norm: string; start: number; lastTime: number } | null = null;
  // Index trong `cues` khi cue đang mở là cue được merge-reopen (flicker); -1 = chưa có trong mảng.
  // Ghi lại TẠI CHỖ lúc close — khác pop-then-repush (sai thứ tự mảng khi có cue xen giữa).
  let openIndex = -1;
  const close = (): void => {
    if (!open) return;
    const cue: SrtCue = { index: openIndex >= 0 ? openIndex : cues.length, start: open.start, end: open.lastTime + CUE_TAIL_MS, text: open.text };
    if (openIndex >= 0) cues[openIndex] = cue;
    else cues.push(cue);
    open = null;
    openIndex = -1;
  };
  for (const d of detections) {
    if (!d.text) { close(); continue; }
    const norm = normalizeText(d.text);
    if (open && fuzzyMatch(open.norm, norm) && d.timeMs - (open.lastTime + CUE_TAIL_MS) <= CUE_MERGE_GAP_MS) {
      open.lastTime = d.timeMs; // extend
      continue;
    }
    // Text đổi (hoặc cùng text vượt gap) → thử merge với cue VỪA đóng nếu fuzzy match + trong merge gap (chống flicker duplicate).
    const last = cues.at(-1);
    const lastIndex = cues.length - 1;
    const mergeable = !!last && fuzzyMatch(normalizeText(last.text), norm) && d.timeMs - last.end <= CUE_MERGE_GAP_MS;
    close();
    if (last && mergeable) {
      open = { text: last.text, norm, start: last.start, lastTime: d.timeMs };
      openIndex = lastIndex;
      continue;
    }
    open = { text: d.text, norm, start: d.timeMs, lastTime: d.timeMs };
  }
  close();
  // Post-dedup pass: merge consecutive cues with same normalized text, regardless
  // of gap. Timeline continuity makes consecutive cues temporally adjacent (cue[i].end
  // = cue[i+1].start), so same-text consecutive cues are always the SAME subtitle line
  // split by OCR noise (leading space, case, punctuation, detection interval gaps of
  // 3-4s). The single-pass 700ms gap only catches rapid flicker; this pass catches
  // the real-world case where OCR detects the same subtitle every 3-4s, each beyond
  // the 700ms gap, creating duplicate cues that look identical to the user.
  const deduped: SrtCue[] = [];
  for (const cue of cues) {
    const prev = deduped.at(-1);
    if (prev && fuzzyMatch(normalizeText(prev.text), normalizeText(cue.text))) {
      // Merge: extend prev's end, keep prev's start + text (first occurrence wins).
      deduped[deduped.length - 1] = { ...prev, end: Math.max(prev.end, cue.end) };
    } else {
      deduped.push(cue);
    }
  }
  // Timeline continuity: extend each cue's end to the start of the next cue
  // so text stays on screen until the next detection (user requirement: cue
  // spans from its scan frame to the next scan frame). Last cue gets a longer
  // tail (3s) to bridge the OCR detection delay until the next frame arrives.
  for (let i = 0; i < deduped.length - 1; i++) {
    if (deduped[i].end < deduped[i + 1].start) deduped[i] = { ...deduped[i], end: deduped[i + 1].start };
  }
  if (deduped.length > 0) {
    const last = deduped[deduped.length - 1]!;
    deduped[deduped.length - 1] = { ...last, end: last.start + LAST_CUE_TAIL_MS };
  }
  // Re-index after dedup (indices may have gaps from merged cues).
  return deduped.map((c, i) => ({ ...c, index: i }));
}
