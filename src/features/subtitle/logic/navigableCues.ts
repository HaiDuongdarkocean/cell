import type { BilingualCue } from '@/entities/media';

// Single source of truth for the cue set all nav CTAs operate on.
// CueList publishes the set it actually renders (non-empty + active filter);
// nav/condense consumers read it. null → no rendered list, callers fall back
// to the unfiltered merged set.
let navigableCues: readonly BilingualCue[] | null = null;

export function publishNavigableCues(cues: readonly BilingualCue[] | null): void {
  navigableCues = cues;
}

export function readNavigableCues(): readonly BilingualCue[] | null {
  return navigableCues;
}
