// Nav cluster pure action helpers (ADR-018 D3, spec §F5-F8).
// ponytail: pure functions — no side effects beyond seek (the intended side
// effect). Cue source = target primary, native fallback.
// ADR-030: seek routes through seekVideo to avoid Netflix M7375.

import { findCurrentLine } from '../logic/subtitleSync';
import { seekVideo, SEEK_LANDING_EPS_MS } from '@/shared/lib/dom/netflixPlayback';
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
 * @param offsetMs - Time offset in ms (ADR-019, default 0). Applied at search level.
 */
export function findActiveCueIndex(
  targetCues: readonly SrtCue[],
  nativeCues: readonly SrtCue[],
  currentTimeMs: number,
  offsetMs: number = 0,
): ActiveCueResult {
  if (targetCues.length > 0) {
    return { cues: targetCues, index: findCurrentLine(targetCues as SrtCue[], currentTimeMs, offsetMs) };
  }
  if (nativeCues.length > 0) {
    return { cues: nativeCues, index: findCurrentLine(nativeCues as SrtCue[], currentTimeMs, offsetMs) };
  }
  return { cues: [], index: -1 };
}

/**
 * Find the nearest cue index by temporal distance when no cue is active (in gap).
 * Distance = min(|start - t|, |end - t|) — picks the closest cue boundary.
 * Tie-break: earlier cue wins (first match in array).
 *
 * @param cues - Sorted cue array (by start time)
 * @param currentTimeMs - Current video time in milliseconds
 * @returns Index of nearest cue, or -1 if cues empty
 */
export function findNearestCueIndex(cues: readonly SrtCue[], currentTimeMs: number): number {
  if (cues.length === 0) return -1;
  let bestIndex = 0;
  let bestDist = Math.min(
    Math.abs(cues[0].start - currentTimeMs),
    Math.abs(cues[0].end - currentTimeMs),
  );
  for (let i = 1; i < cues.length; i++) {
    const dist = Math.min(
      Math.abs(cues[i].start - currentTimeMs),
      Math.abs(cues[i].end - currentTimeMs),
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/**
 * Rightmost index of a cue containing effectiveMs (start <= t <= end).
 * findCurrentLine's binary search returns an arbitrary match among
 * overlapping cues; navigation needs the latest-started one so seeks keep
 * making progress instead of landing back inside an earlier overlap.
 */
function lastContainingCueIndex(cues: readonly SrtCue[], effectiveMs: number): number {
  let index = -1;
  for (let i = 0; i < cues.length && cues[i].start <= effectiveMs; i++) {
    if (cues[i].end >= effectiveMs) index = i;
  }
  return index;
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
  offsetMs: number = 0,
): void {
  const currentMs = video.currentTime * 1000;
  // ADR-019 sync: gap-fill search must use effective time (currentMs + offset),
  // same as findActiveCueIndex. Without this, offset shifted the active-cue
  // lookup but gap-fill used raw time → jumped to wrong cue in gaps.
  const effectiveMs = currentMs + offsetMs;
  const { cues } = findActiveCueIndex(targetCues, nativeCues, currentMs, offsetMs);
  if (cues.length === 0) return;
  const index = lastContainingCueIndex(cues, effectiveMs);
  if (index === -1) {
    // In gap — find nearest previous cue (end < effectiveMs)
    const prevCue = [...cues].reverse().find((c) => c.end < effectiveMs);
    if (prevCue) seekVideo(video, (prevCue.start - offsetMs + SEEK_LANDING_EPS_MS) / 1000);
    return;
  }
  // Skip same-start siblings — seeking to an identical start lands at the
  // same position and would wedge repeated presses on duplicate cues.
  let prevIndex = index - 1;
  while (prevIndex >= 0 && cues[prevIndex].start >= cues[index].start) prevIndex--;
  // ADR-019 sync: seek so overlay DISPLAYS cues[prevIndex] → shift by -offsetMs.
  if (prevIndex >= 0) {
    seekVideo(video, (cues[prevIndex].start - offsetMs + SEEK_LANDING_EPS_MS) / 1000);
  }
}

/**
 * Seek to the next subtitle sentence (spec §F6): the first cue that starts
 * after the current effective time. Uniform for in-cue, in-gap and
 * overlapping cues — the target is always strictly ahead, so repeated
 * presses can never wedge on an earlier overlapping cue.
 * - no later cue (last cue / past end) → no-op
 * - no cues → no-op
 */
export function nextSentence(
  video: HTMLVideoElement,
  targetCues: readonly SrtCue[],
  nativeCues: readonly SrtCue[],
  offsetMs: number = 0,
): void {
  const currentMs = video.currentTime * 1000;
  const effectiveMs = currentMs + offsetMs;
  const { cues } = findActiveCueIndex(targetCues, nativeCues, currentMs, offsetMs);
  const nextCue = cues.find((c) => c.start > effectiveMs + SEEK_LANDING_EPS_MS);
  // ADR-019 sync: seek so overlay DISPLAYS nextCue → shift by -offsetMs.
  // +SEEK_LANDING_EPS_MS lands inside the cue even when the browser resolves
  // the seek to a frame just before the requested time.
  if (nextCue) seekVideo(video, (nextCue.start - offsetMs + SEEK_LANDING_EPS_MS) / 1000);
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
    seekVideo(video, lower);
    return;
  }
  seekVideo(video, Math.min(lower, video.duration));
}
