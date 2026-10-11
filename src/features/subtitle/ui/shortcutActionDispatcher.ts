import { seekToCue, resumeIfPaused } from '@/shared/lib/dom/netflixPlayback';
import type { BilingualCue } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';

/**
 * Navigate to prev/next/replay cue.
 *
 * Extracted from 2 identical switch blocks in contentScriptController.ts
 * (onKeydown + onRuntimeMessage SHORTCUT_ACTION handler).
 *
 * Side effect: calls seekToCue (video.currentTime assignment).
 */
export function navigateCue(
  action: 'prev-cue' | 'next-cue' | 'replay-cue',
  video: HTMLVideoElement,
  cues: readonly BilingualCue[],
  effectiveMs: number,
  offsetMs: number,
  anchor?: { start: number; end: number },
): void {
  const anchorCue = video.paused ? (anchor ?? undefined) : undefined;
  switch (action) {
    case 'prev-cue': {
      const prevCue = anchorCue
        ? [...cues].reverse().find((c) => c.end <= anchorCue.start)
        : [...cues].reverse().find((c) => c.end < effectiveMs);
      if (prevCue) seekToCue(video, prevCue, offsetMs);
      break;
    }
    case 'next-cue': {
      const nextCue = anchorCue
        ? cues.find((c) => c.start > anchorCue.start)
        : cues.find((c) => c.start > effectiveMs + 100);
      if (nextCue) seekToCue(video, nextCue, offsetMs);
      break;
    }
    case 'replay-cue': {
      // Half-open [start, end) — at boundary t = cue[i].end = cue[i+1].start,
      // match the NEXT cue, not the previous one (replay-cue "jump back" bug).
      const currentCue = anchorCue
        ?? cues.find((c) => c.start <= effectiveMs && c.end > effectiveMs)
        ?? [...cues].reverse().find((c) => c.start < effectiveMs);
      if (currentCue) {
        seekToCue(video, currentCue, offsetMs);
        resumeIfPaused(video);
      }
      break;
    }
  }
}

/**
 * Compute new overlay visibility state after toggle.
 *
 * Extracted from 2 identical toggle-overlay blocks in contentScriptController.ts.
 * Pure — returns new state, caller applies it.
 */
export function toggleOverlayState(
  overlayVisible: boolean,
  targetStyle: OverlayStyleConfig,
  nativeStyle: OverlayStyleConfig,
): {
  overlayVisible: boolean;
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;
} {
  const newVisible = !overlayVisible;
  return {
    overlayVisible: newVisible,
    targetStyle: { ...targetStyle, visible: newVisible },
    nativeStyle: { ...nativeStyle, visible: newVisible },
  };
}
