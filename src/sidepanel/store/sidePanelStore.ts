import { create } from 'zustand';
import type { BilingualCue } from '@/types/media';

interface SidePanelState {
  cues: BilingualCue[];
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  setCues: (cues: BilingualCue[]) => void;
  setCurrentTime: (currentTimeMs: number, durationMs: number) => void;
  setPlaying: (isPlaying: boolean) => void;
  /** Find the index of the cue active at currentTimeMs. */
  currentCueIndex: () => number;
}

export const useSidePanelStore = create<SidePanelState>((set, get) => ({
  cues: [],
  currentTimeMs: 0,
  durationMs: 0,
  isPlaying: false,
  setCues: (cues) => set({ cues }),
  setCurrentTime: (currentTimeMs, durationMs) => set({ currentTimeMs, durationMs }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  currentCueIndex: () => {
    const { cues, currentTimeMs } = get();
    return cues.findIndex((c) => c.start <= currentTimeMs && c.end >= currentTimeMs);
  },
}));
