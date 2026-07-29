import type { BilingualCue } from '@/entities/media/types';

export const CELL_CUES_UPDATED = 'cell:cues:updated' as const;

export interface CuesUpdatedDetail {
  /** Bilingual cues (target + native) for the active video. */
  cues: BilingualCue[];
  /** Index of the cue currently active by playback time. */
  activeIndex: number;
  /** Optional subtitle track identifier. */
  trackId?: string;
}

/** CustomEvent fired by content-script controllers when cues are loaded or the active cue changes. */
export type CuesUpdatedEvent = CustomEvent<CuesUpdatedDetail>;

/**
 * Helper to dispatch a `cell:cues:updated` event from any target.
 */
export function dispatchCuesUpdated(
  target: EventTarget,
  detail: CuesUpdatedDetail,
): void {
  target.dispatchEvent(new CustomEvent<CuesUpdatedDetail>(CELL_CUES_UPDATED, { detail }));
}
