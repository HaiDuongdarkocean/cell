import { create } from 'zustand';
import type { BilingualCue } from '@/entities/media';

interface SidePanelState {
  cues: BilingualCue[];
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  // ADR-019 sync: offset received from content script via VIDEO_TIME_UPDATE.
  // CueList highlights cue at effective = currentTimeMs + offsetMs so the
  // highlighted cue matches the overlay (which uses the same offset).
  offsetMs: number;
  setCues: (cues: BilingualCue[]) => void;
  setCurrentTime: (currentTimeMs: number, durationMs: number, offsetMs?: number) => void;
  setPlaying: (isPlaying: boolean) => void;
  /** Find the index of the cue active at effective time (currentTimeMs + offsetMs). */
  currentCueIndex: () => number;
}

export const useSidePanelStore = create<SidePanelState>((set, get) => ({
  cues: [],
  currentTimeMs: 0,
  durationMs: 0,
  isPlaying: false,
  offsetMs: 0,
  setCues: (cues) => set({ cues }),
  setCurrentTime: (currentTimeMs, durationMs, offsetMs) =>
    set(offsetMs !== undefined ? { currentTimeMs, durationMs, offsetMs } : { currentTimeMs, durationMs }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  currentCueIndex: () => {
    const { cues, currentTimeMs, offsetMs } = get();
    const effective = currentTimeMs + offsetMs;
    // Half-open [start, end) — see CueList.tsx for rationale.
    return cues.findIndex((c) => c.start <= effective && c.end > effective);
  },
}));
