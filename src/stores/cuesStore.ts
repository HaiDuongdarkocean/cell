import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { BilingualCue } from '@/entities/media/types';

interface CuesState {
  /** Bilingual cues (target + native) currently loaded for the active video. */
  cues: BilingualCue[];
  /** Index of the cue that is currently active by playback time. */
  activeIndex: number;
  /** Replace the full cue list and reset active index. */
  setCues(cues: BilingualCue[]): void;
  /** Update the active cue index. */
  setActiveIndex(index: number): void;
}

export const useCuesStore = create<CuesState>()(
  subscribeWithSelector((set) => ({
    cues: [],
    activeIndex: 0,
    setCues: (cues) => set({ cues, activeIndex: 0 }),
    setActiveIndex: (activeIndex) => set({ activeIndex }),
  })),
);
