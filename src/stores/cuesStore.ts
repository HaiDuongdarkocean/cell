import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { SrtCue } from '@/entities/media/types';
import { CELL_CUES_UPDATED, type CuesUpdatedEvent } from '@/features/subtitle/events';

interface CuesState {
  /** Target language cues for the active video. */
  targetCues: SrtCue[];
  /** Native language cues for the active video. */
  nativeCues: SrtCue[];
  /** Active target cue index by playback time. */
  targetActiveIndex: number;
  /** Active native cue index by playback time. */
  nativeActiveIndex: number;
  /** Replace the full cue list and reset active index. */
  setCues(targetCues: SrtCue[], nativeCues: SrtCue[]): void;
  /** Update the active cue indices. */
  setActiveIndex(targetActiveIndex: number, nativeActiveIndex: number): void;
}

export const useCuesStore = create<CuesState>()(
  subscribeWithSelector((set) => ({
    targetCues: [],
    nativeCues: [],
    targetActiveIndex: -1,
    nativeActiveIndex: -1,
    setCues: (targetCues, nativeCues) =>
      set({ targetCues, nativeCues, targetActiveIndex: -1, nativeActiveIndex: -1 }),
    setActiveIndex: (targetActiveIndex, nativeActiveIndex) =>
      set({ targetActiveIndex, nativeActiveIndex }),
  })),
);

if (typeof document !== 'undefined') {
  document.addEventListener(CELL_CUES_UPDATED, (event) => {
    const { targetCues, nativeCues, targetActiveIndex, nativeActiveIndex } = (
      event as CuesUpdatedEvent
    ).detail;
    useCuesStore.getState().setCues(targetCues, nativeCues);
    useCuesStore.getState().setActiveIndex(targetActiveIndex, nativeActiveIndex);
  });
}
