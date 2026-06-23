import { create } from 'zustand';
import type {
  DetectedVideo,
  DetectedSubtitle,
  DownloadItem,
  Settings,
} from '@/types/media';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/constants/config';

export interface PopupState {
  // State
  videos: DetectedVideo[];
  subtitles: DetectedSubtitle[];
  downloads: DownloadItem[];
  settings: Settings;
  extensionActive: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setVideos: (videos: DetectedVideo[]) => void;
  setSubtitles: (subtitles: DetectedSubtitle[]) => void;
  addDownload: (item: DownloadItem) => void;
  updateDownload: (id: string, updates: Partial<DownloadItem>) => void;
  removeDownload: (id: string) => void;
  clearDownloads: () => void;
  updateSettings: (settings: Partial<Settings>) => void;
  setExtensionActive: (active: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  videos: [] as DetectedVideo[],
  subtitles: [] as DetectedSubtitle[],
  downloads: [] as DownloadItem[],
  settings: DEFAULT_SETTINGS,
  extensionActive: true,
  isLoading: false,
  error: null as string | null,
};

export const usePopupStore = create<PopupState>((set) => ({
  ...initialState,

  setVideos: (videos) => set({ videos }),

  setSubtitles: (subtitles) => set({ subtitles }),

  addDownload: (item) =>
    set((state) => ({ downloads: [...state.downloads, item] })),

  updateDownload: (id, updates) =>
    set((state) => ({
      downloads: state.downloads.map((d) =>
        d.id === id ? { ...d, ...updates } : d,
      ),
    })),

  removeDownload: (id) =>
    set((state) => ({
      downloads: state.downloads.filter((d) => d.id !== id),
    })),

  clearDownloads: () => set({ downloads: [] }),

  updateSettings: (partial) =>
    set((state) => {
      const settings: Settings = { ...state.settings, ...partial };
      void chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
      return { settings };
    }),

  setExtensionActive: (active) => {
    void chrome.storage.local.set({ [STORAGE_KEYS.EXTENSION_STATUS]: active });
    set({ extensionActive: active });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set({ ...initialState }),
}));
