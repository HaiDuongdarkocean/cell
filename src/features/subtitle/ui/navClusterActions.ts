// Nav cluster pure action helpers (ADR-018 D3, spec §F5-F8).
// ponytail: pure functions — no side effects beyond video.currentTime assignment
// (the intended side effect of seek). Cue source = target primary, native fallback.

import { findCurrentLine } from '../logic/subtitleSync';
import type { SrtCue } from '@/entities/media';

/** Result of looking up the active cue for the current playback time. */
export interface ActiveCueResult {
  readonly cues: readonly SrtCue[];
  readonly index: number;
}

/**
 * Find the active cue index for the current playback time.
 * Cue source: target cues primary, native fallback when target empty (ADR-018 D3).
 *
 * @param targetCues - Target language cues (primary)
 * @param nativeCues - Native language cues (fallback)
 * @param currentTimeMs - Current video time in milliseconds
 */
export function findActiveCueIndex(
  targetCues: readonly SrtCue[],
  nativeCues: readonly SrtCue[],
  currentTimeMs: number,
): ActiveCueResult {
  if (targetCues.length > 0) {
    return { cues: targetCues, index: findCurrentLine(targetCues as SrtCue[], currentTimeMs) };
  }
  if (nativeCues.length > 0) {
    return { cues: nativeCues, index: findCurrentLine(nativeCues as SrtCue[], currentTimeMs) };
  }
  return { cues: [], index: -1 };
}

/**
 * Seek to the previous subtitle sentence (spec §F5).
 * - index > 0 → seek cues[index-1].start/1000
 * - index === -1 (in gap) → seek nearest previous cue start
 * - index === 0 (first cue) → no-op
 * - no cues → no-op
 */
export function prevSentence(
  video: HTMLVideoElement,
  targetCues: readonly SrtCue[],
  nativeCues: readonly SrtCue[],
): void {
  const currentMs = video.currentTime * 1000;
  const { cues, index } = findActiveCueIndex(targetCues, nativeCues, currentMs);
  if (cues.length === 0) return;
  if (index > 0) {
    video.currentTime = cues[index - 1].start / 1000;
    return;
  }
  if (index === -1) {
    // In gap — find nearest previous cue (end < currentMs)
    const prevCue = [...cues].reverse().find((c) => c.end < currentMs);
    if (prevCue) video.currentTime = prevCue.start / 1000;
    return;
  }
  // index === 0 → no-op (first cue)
}

/**
 * Seek to the next subtitle sentence (spec §F6).
 * - index < length-1 → seek cues[index+1].start/1000
 * - index === -1 (in gap) → seek nearest next cue start
 * - index === length-1 (last cue) → no-op
 * - no cues → no-op
 */
export function nextSentence(
  video: HTMLVideoElement,
  targetCues: readonly SrtCue[],
  nativeCues: readonly SrtCue[],
): void {
  const currentMs = video.currentTime * 1000;
  const { cues, index } = findActiveCueIndex(targetCues, nativeCues, currentMs);
  if (cues.length === 0) return;
  if (index === -1) {
    // In gap — find nearest next cue (start > currentMs)
    const nextCue = cues.find((c) => c.start > currentMs);
    if (nextCue) video.currentTime = nextCue.start / 1000;
    return;
  }
  if (index < cues.length - 1) {
    video.currentTime = cues[index + 1].start / 1000;
  }
  // index === length-1 → no-op (last cue)
}

/**
 * Seek by a fixed number of seconds (spec §F8).
 * Clamps to [0, duration] when duration is finite.
 * When duration is NaN/Infinity (live stream), clamps lower bound only.
 */
export function seekBy(video: HTMLVideoElement, seconds: number): void {
  const target = video.currentTime + seconds;
  const lower = Math.max(0, target);
  if (!Number.isFinite(video.duration)) {
    video.currentTime = lower;
    return;
  }
  video.currentTime = Math.min(lower, video.duration);
}
