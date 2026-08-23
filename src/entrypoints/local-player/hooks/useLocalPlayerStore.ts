import { create } from 'zustand';
import type { VideoRecord, SubtitleRecord } from '@/features/local-player/services/mediaLibraryRepository';
import type { SubtitleMatch } from '@/features/local-player/logic/subtitleMatch';

export type LibrarySort = 'recent' | 'title' | 'added';

export type SubtitleStatus = 'idle' | 'searching' | 'loaded' | 'not-found' | 'error';

export interface SubtitlesState {
  target: SubtitleMatch | null;
  native: SubtitleMatch | null;
  others: SubtitleMatch[];
}

export interface PlaybackPatch {
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
  volume?: number;
  muted?: boolean;
  playbackRate?: number;
}

export interface LocalPlayerState {
  currentVideo: VideoRecord | null;
  videoFile: File | null;
  subtitles: SubtitlesState;
  subtitleStatus: SubtitleStatus;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  library: VideoRecord[];
  subtitlesLibrary: SubtitleRecord[];
  librarySort: LibrarySort;
  showLibrary: boolean;

  setVideo: (video: VideoRecord, file: File) => void;
  setSubtitles: (subs: SubtitlesState) => void;
  setSubtitleStatus: (status: SubtitleStatus) => void;
  updatePlayback: (patch: PlaybackPatch) => void;
  setLibrary: (videos: VideoRecord[]) => void;
  setSubtitlesLibrary: (subtitles: SubtitleRecord[]) => void;
  setLibrarySort: (sortBy: LibrarySort) => void;
  toggleLibrary: () => void;
  reset: () => void;
}

const initialState = {
  currentVideo: null as VideoRecord | null,
  videoFile: null as File | null,
  subtitles: { target: null, native: null, others: [] } as SubtitlesState,
  subtitleStatus: 'idle' as SubtitleStatus,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  muted: false,
  playbackRate: 1,
  library: [] as VideoRecord[],
  subtitlesLibrary: [] as SubtitleRecord[],
  librarySort: 'recent' as LibrarySort,
  showLibrary: false,
};

export const useLocalPlayerStore = create<LocalPlayerState>((set) => ({
  ...initialState,

  setVideo: (video, file) => set({ currentVideo: video, videoFile: file }),

  setSubtitles: (subs) => set({ subtitles: subs }),

  setSubtitleStatus: (status) => set({ subtitleStatus: status }),

  updatePlayback: (patch) => set(patch),

  setLibrary: (videos) => set({ library: videos }),

  setSubtitlesLibrary: (subs) => set({ subtitlesLibrary: subs }),

  setLibrarySort: (sortBy) => set({ librarySort: sortBy }),

  toggleLibrary: () => set((s) => ({ showLibrary: !s.showLibrary })),

  reset: () => set({ ...initialState }),
}));
