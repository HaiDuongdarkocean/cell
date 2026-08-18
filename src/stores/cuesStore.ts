import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { SrtCue } from '@/entities/media/types';
import { CELL_CUES_UPDATED, type CuesUpdatedEvent } from '@/features/subtitle/events';

export type LoadState = 'idle' | 'loading' | 'loaded' | 'error' | 'none' | 'translating';

/** Source of the subtitle — shown in success message to distinguish origins. */
export type SubtitleSource = 'auto' | 'imported' | 'search' | 'translated';

/** Error type for more specific, user-friendly error messages. */
export type LoadErrorType = 'timeout' | 'offline' | 'not-found' | 'invalid' | 'empty' | 'unknown';

export interface LoadStatus {
  state: LoadState;
  /** Human-readable language label (e.g. "English") for inline status messages. */
  languageLabel?: string;
  /** Source of the subtitle — shown in success message (e.g. "Loaded English (imported)"). */
  source?: SubtitleSource;
  /** Track index (1-based) when multiple tracks share the same language. */
  trackIndex?: number;
  /** Progress for 'translating' state: { current, total } cues translated. */
  progress?: { current: number; total: number };
  /** Error type for more specific error messages. */
  errorType?: LoadErrorType;
}

interface CuesState {
  /** Target language cues for the active video. */
  targetCues: SrtCue[];
  /** Native language cues for the active video. */
  nativeCues: SrtCue[];
  /** Active target cue index by playback time. */
  targetActiveIndex: number;
  /** Active native cue index by playback time. */
  nativeActiveIndex: number;
  /** Inline load status for the target subtitle block (replaces toast). */
  targetLoadStatus: LoadStatus;
  /** Inline load status for the native subtitle block (replaces toast). */
  nativeLoadStatus: LoadStatus;
  /** Replace the full cue list and reset active index. Clears load status
   *  for any role that received non-empty cues (subtitle appearing = success). */
  setCues(targetCues: SrtCue[], nativeCues: SrtCue[]): void;
  /** Update the active cue indices. */
  setActiveIndex(targetActiveIndex: number, nativeActiveIndex: number): void;
  /** Set the inline load status for a role (target or native). */
  setLoadStatus(role: 'target' | 'native', status: LoadStatus): void;
}

const IDLE_STATUS: LoadStatus = { state: 'idle' };

export const useCuesStore = create<CuesState>()(
  subscribeWithSelector((set) => ({
    targetCues: [],
    nativeCues: [],
    targetActiveIndex: -1,
    nativeActiveIndex: -1,
    targetLoadStatus: IDLE_STATUS,
    nativeLoadStatus: IDLE_STATUS,
    setCues: (targetCues, nativeCues) =>
      set((prev) => ({
        targetCues,
        nativeCues,
        targetActiveIndex: -1,
        nativeActiveIndex: -1,
        // Only transition → 'loaded' when the previous state was an active
        // operation ('loading' or 'translating'). setCues fires on EVERY
        // timeupdate (via CELL_CUES_UPDATED), so transitioning from 'idle'
        // (after auto-clear) would re-show "Subtitle loaded" every time the
        // video enters a cue gap. Once auto-clear sets 'idle', stay 'idle'.
        // ponytail: this guard is the single fix for the "status flickers on
        // every gap" bug — one check here beats N guards in every caller.
        targetLoadStatus: targetCues.length > 0 && (prev.targetLoadStatus.state === 'loading' || prev.targetLoadStatus.state === 'translating')
          ? { state: 'loaded', languageLabel: prev.targetLoadStatus.languageLabel, source: prev.targetLoadStatus.source, trackIndex: prev.targetLoadStatus.trackIndex }
          : prev.targetLoadStatus,
        nativeLoadStatus: nativeCues.length > 0 && (prev.nativeLoadStatus.state === 'loading' || prev.nativeLoadStatus.state === 'translating')
          ? { state: 'loaded', languageLabel: prev.nativeLoadStatus.languageLabel, source: prev.nativeLoadStatus.source, trackIndex: prev.nativeLoadStatus.trackIndex }
          : prev.nativeLoadStatus,
      })),
    setActiveIndex: (targetActiveIndex, nativeActiveIndex) =>
      set({ targetActiveIndex, nativeActiveIndex }),
    setLoadStatus: (role, status) =>
      set(role === 'target'
        ? { targetLoadStatus: status }
        : { nativeLoadStatus: status }),
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
