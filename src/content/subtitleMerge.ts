import type { SrtCue, BilingualCue } from '@/types/media';

/**
 * Merge 2 sets of cues into `BilingualCue[]` for the floating panel.
 *
 * Target is the skeleton; each target cue → find the native cue with the
 * largest overlap at `target.start`. Target cues with no overlapping native
 * get `nativeText = ''`.
 *
 * When target is empty → fallback to native as the skeleton (panel still
 * lists native cues so the user can click-seek — ADR-007 D1, spec F6).
 * When both are empty → returns `[]`.
 *
 * @param targetCues - Target language cues (skeleton)
 * @param nativeCues - Native language cues (best-effort overlap)
 */
export function mergeCuesForPanel(
  targetCues: readonly SrtCue[],
  nativeCues: readonly SrtCue[],
): BilingualCue[] {
  if (targetCues.length === 0 && nativeCues.length === 0) return [];

  // Target rỗng → fallback native xương (panel list để click seek native).
  if (targetCues.length === 0) {
    return nativeCues.map((native) => ({
      index: native.index,
      start: native.start,
      end: native.end,
      targetText: '',
      nativeText: native.text,
    }));
  }

  // Target làm xương + native best-effort overlap tại cue.start.
  return targetCues.map((target) => {
    const native = findBestNativeAt(target.start, nativeCues);
    return {
      index: target.index,
      start: target.start,
      end: target.end,
      targetText: target.text,
      nativeText: native?.text ?? '',
    };
  });
}

/**
 * Find the native cue with the largest overlap at the given time.
 * ponytail: linear scan (n ~ 1000 cues, runs once per panel render — not hot path).
 */
function findBestNativeAt(
  timeMs: number,
  nativeCues: readonly SrtCue[],
): SrtCue | null {
  let best: SrtCue | null = null;
  let bestOverlap = 0;
  for (const cue of nativeCues) {
    const overlap = Math.min(cue.end, timeMs + 1) - Math.max(cue.start, timeMs);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = cue;
    }
  }
  return best;
}
