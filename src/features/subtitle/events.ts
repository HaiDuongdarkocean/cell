import type { SrtCue } from '@/entities/media/types';

export const CELL_CUES_UPDATED = 'cell:cues:updated' as const;

export interface CuesUpdatedDetail {
  /** Target language cues for the active video. */
  targetCues: SrtCue[];
  /** Native language cues for the active video. */
  nativeCues: SrtCue[];
  /** Index of the active target cue by playback time. */
  targetActiveIndex: number;
  /** Index of the active native cue by playback time. */
  nativeActiveIndex: number;
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
