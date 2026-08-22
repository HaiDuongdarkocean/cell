// ocrToCues — OCR detection stream → SrtCue[] (spec ocr-split-dual-stream).
// O(n) single pass. Flicker merge: same text quay lại trong CUE_MERGE_GAP_MS → extend cue cũ.
// Timeline continuity: cue.end = start của cue kế tiếp (text stay on screen cho đến detection mới).
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

export function ocrTextToCues(detections: readonly OcrDetection[]): SrtCue[] {
  const cues: SrtCue[] = [];
  let open: { text: string; start: number; lastTime: number } | null = null;
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
    if (open && open.text === d.text && d.timeMs - (open.lastTime + CUE_TAIL_MS) <= CUE_MERGE_GAP_MS) {
      open.lastTime = d.timeMs; // extend
      continue;
    }
    // Text đổi (hoặc cùng text vượt gap) → thử merge với cue VỪA đóng nếu cùng text + trong merge gap (chống flicker duplicate).
    const last = cues.at(-1);
    const lastIndex = cues.length - 1;
    const mergeable = !!last && last.text === d.text && d.timeMs - last.end <= CUE_MERGE_GAP_MS;
    close();
    if (last && mergeable) {
      open = { text: d.text, start: last.start, lastTime: d.timeMs };
      openIndex = lastIndex;
      continue;
    }
    open = { text: d.text, start: d.timeMs, lastTime: d.timeMs };
  }
  close();
  // Timeline continuity: extend each cue's end to the start of the next cue
  // so text stays on screen until the next detection (user requirement: cue
  // spans from its scan frame to the next scan frame). Last cue gets a longer
  // tail (3s) to bridge the OCR detection delay until the next frame arrives.
  for (let i = 0; i < cues.length - 1; i++) {
    if (cues[i].end < cues[i + 1].start) cues[i].end = cues[i + 1].start;
  }
  if (cues.length > 0) {
    const last = cues[cues.length - 1]!;
    last.end = last.start + LAST_CUE_TAIL_MS;
  }
  return cues;
}
