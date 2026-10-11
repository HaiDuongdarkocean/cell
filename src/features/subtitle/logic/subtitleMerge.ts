import type { SrtCue, BilingualCue } from '@/entities/media';

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
  if (isSortedByStart(targetCues) && isSortedByStart(nativeCues)) {
    return mergeSortedCues(targetCues, nativeCues);
  }
  return targetCues.map((target) =>
    toBilingualCue(target, findBestNativeAt(target.start, nativeCues)),
  );
}

function toBilingualCue(target: SrtCue, native: SrtCue | null): BilingualCue {
  return {
    index: target.index,
    start: target.start,
    end: target.end,
    targetText: target.text,
    nativeText: native?.text ?? '',
    ...(target.rawText !== undefined ? { rawTargetText: target.rawText } : {}),
  };
}

function isSortedByStart(cues: readonly SrtCue[]): boolean {
  for (let i = 1; i < cues.length; i++) {
    if (cues[i]!.start < cues[i - 1]!.start) return false;
  }
  return true;
}

function mergeSortedCues(
  targetCues: readonly SrtCue[],
  nativeCues: readonly SrtCue[],
): BilingualCue[] {
  const window: SrtCue[] = [];
  let nativeIndex = 0;
  return targetCues.map((target) => {
    const t = target.start;
    while (nativeIndex < nativeCues.length && nativeCues[nativeIndex]!.start < t + 1) {
      window.push(nativeCues[nativeIndex]!);
      nativeIndex += 1;
    }
    let write = 0;
    for (let read = 0; read < window.length; read++) {
      if (window[read]!.end > t) {
        window[write] = window[read]!;
        write += 1;
      }
    }
    window.length = write;
    let best: SrtCue | null = null;
    let bestOverlap = 0;
    for (const cue of window) {
      const overlap = Math.min(cue.end, t + 1) - Math.max(cue.start, t);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = cue;
        if (bestOverlap >= 1) break;
      }
    }
    return toBilingualCue(target, best);
  });
}

/**
 * Find the native cue with the largest overlap at the given time.
 * Fallback for unsorted input; sorted cues go through mergeSortedCues.
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
