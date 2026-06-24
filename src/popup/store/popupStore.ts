import { create } from 'zustand';
import type {
  DetectedVideo,
  DetectedSubtitle,
  DownloadItem,
  DownloadStatus,
  Settings,
} from '@/types/media';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/constants/config';

const STATUS_ADVANCEMENT: Record<DownloadStatus, number> = {
  queued: 0,
  cancelled: 1,
  paused: 2,
  downloading: 3,
  converting: 4,
  done: 5,
  error: 5,
};

function chooseStatus(a: DownloadStatus, b: DownloadStatus): DownloadStatus {
  return STATUS_ADVANCEMENT[a] >= STATUS_ADVANCEMENT[b] ? a : b;
}

function mergeDownloadItems(existing: DownloadItem, incoming: DownloadItem): DownloadItem {
  // Prefer metadata from the item that has a real URL (the response from the
  // background has complete metadata; the progress-stub has url: '').
  const useIncomingMetadata = incoming.url.length > 0;

  return {
    id: incoming.id,
    mediaType: incoming.mediaType,
    url: useIncomingMetadata ? incoming.url : existing.url,
    title: useIncomingMetadata ? incoming.title : existing.title,
    status: chooseStatus(existing.status, incoming.status),
    progress: Math.max(existing.progress, incoming.progress),
    error: existing.error ?? incoming.error,
    startedAt: Math.min(
      existing.startedAt ?? Number.POSITIVE_INFINITY,
      incoming.startedAt ?? Number.POSITIVE_INFINITY,
    ),
    completedAt: Math.max(
      existing.completedAt ?? 0,
      incoming.completedAt ?? 0,
    ),
    savedFilename: incoming.savedFilename ?? existing.savedFilename,
    videoId: incoming.videoId ?? existing.videoId,
    // Conversion detail fields — prefer incoming (most recent) values
    fileSize: incoming.fileSize ?? existing.fileSize,
    downloadedBytes: incoming.downloadedBytes ?? existing.downloadedBytes,
    processedBytes: incoming.processedBytes ?? existing.processedBytes,
    conversionPhase: incoming.conversionPhase ?? existing.conversionPhase,
    workerCount: incoming.workerCount ?? existing.workerCount,
    usedWorkers: incoming.usedWorkers ?? existing.usedWorkers,
  };
}

export interface PopupState {
  // State
  videos: DetectedVideo[];
  subtitles: DetectedSubtitle[];
  downloads: DownloadItem[];
  settings: Settings;
  extensionActive: boolean;
  isLoading: boolean;
  error: string | null;
  isSettingsLoaded: boolean;

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
  loadPersistedSettings: () => Promise<void>;
  loadExtensionStatus: () => Promise<void>;
}

const initialState = {
  videos: [] as DetectedVideo[],
  subtitles: [] as DetectedSubtitle[],
  downloads: [] as DownloadItem[],
  settings: DEFAULT_SETTINGS,
  extensionActive: true,
  isLoading: false,
  error: null as string | null,
  isSettingsLoaded: false,
};

export const usePopupStore = create<PopupState>((set) => ({
  ...initialState,

  setVideos: (videos) => set({ videos }),

  setSubtitles: (subtitles) => set({ subtitles }),

  addDownload: (item) =>
    set((state) => {
      const existingIndex = state.downloads.findIndex((d) => d.id === item.id);
      if (existingIndex === -1) {
        return { downloads: [...state.downloads, item] };
      }
      const nextDownloads = [...state.downloads];
      nextDownloads[existingIndex] = mergeDownloadItems(
        state.downloads[existingIndex],
        item,
      );
      return { downloads: nextDownloads };
    }),

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

  loadPersistedSettings: async () => {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
      const settings = data[STORAGE_KEYS.SETTINGS] as Settings | undefined;
      if (settings) {
        set({ settings, isSettingsLoaded: true });
      } else {
        set({ isSettingsLoaded: true });
      }
    } catch (error) {
      console.error('Failed to load settings from storage:', error);
      set({ isSettingsLoaded: true });
    }
  },

  loadExtensionStatus: async () => {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEYS.EXTENSION_STATUS);
      const status = data[STORAGE_KEYS.EXTENSION_STATUS];
      if (typeof status === 'boolean') {
        set({ extensionActive: status });
      }
    } catch (error) {
      console.error('Failed to load extension status from storage:', error);
    }
  },
}));
