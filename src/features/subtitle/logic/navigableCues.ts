import type { BilingualCue } from '@/entities/media';

// Single source of truth for the cue set all nav CTAs operate on.
// CueList publishes the set it actually renders (non-empty + active filter);
// nav/condense consumers read it. null → no rendered list, callers fall back
// to the unfiltered merged set.
let navigableCues: readonly BilingualCue[] | null = null;
const listeners = new Set<() => void>();

export function publishNavigableCues(cues: readonly BilingualCue[] | null): void {
  navigableCues = cues;
  for (const listener of listeners) listener();
}

export function readNavigableCues(): readonly BilingualCue[] | null {
  return navigableCues;
}

export function onNavigableCuesChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
