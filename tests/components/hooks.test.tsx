import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { usePopupStore } from '@/popup/store/popupStore';
import { useDetectedMedia } from '@/popup/hooks/useDetectedMedia';
import { useDownloadProgress } from '@/popup/hooks/useDownloadProgress';
import { useExtensionStatus } from '@/popup/hooks/useExtensionStatus';
import type {
  DetectedVideo,
  DetectedSubtitle,
  DownloadItem,
  DownloadProgress,
} from '@/types/media';
import type {
  MessageRequest,
  MessageResponse,
  DetectedMediaUpdatePayload,
  DownloadProgressUpdatePayload,
} from '@/types/message';

// --- chrome runtime mock -------------------------------------------------

type MessageListener = (
  request: MessageRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void,
) => boolean;

interface ChromeRuntimeMock {
  sendMessage: jest.Mock;
  onMessage: {
    addListener: jest.Mock;
    removeListener: jest.Mock;
    listeners: MessageListener[];
  };
}

function createChromeMock(): ChromeRuntimeMock {
  const listeners: MessageListener[] = [];
  const onMessage = {
    addListener: jest.fn((l: MessageListener) => {
      listeners.push(l);
    }),
    removeListener: jest.fn((l: MessageListener) => {
      const idx = listeners.indexOf(l);
      if (idx !== -1) {
        listeners.splice(idx, 1);
      }
    }),
    listeners,
  };
  return {
    // Default to a resolved empty-success response so hooks that call
    // `.then()` on mount don't blow up when a test doesn't care about it.
    sendMessage: jest.fn().mockResolvedValue({ success: true }),
    onMessage,
  };
}

let chromeMock: ChromeRuntimeMock;

beforeEach(() => {
  chromeMock = createChromeMock();
  (global as unknown as {
    chrome: {
      runtime: ChromeRuntimeMock;
      storage: { local: { set: jest.Mock; get: jest.Mock } };
    };
  }).chrome = {
    runtime: chromeMock,
    storage: {
      local: {
        set: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue({}),
      },
    },
  };
  // Reset the zustand store between tests.
  usePopupStore.getState().reset();
  jest.clearAllMocks();
});

// --- fixtures -------------------------------------------------------------

const mockVideo: DetectedVideo = {
  id: 'video-1',
  url: 'https://example.com/video.m3u8',
  format: 'm3u8',
  title: 'Test Video',
  tabId: 1,
  tabUrl: 'https://example.com',
  detectedAt: 1000,
  variants: [{ url: 'https://example.com/1080.m3u8', quality: '1080p' }],
};

const mockSubtitle: DetectedSubtitle = {
  id: 'sub-1',
  url: 'https://example.com/sub.vtt',
  format: 'vtt',
  language: 'en',
  tabId: 1,
  detectedAt: 1000,
};

const mockDownload: DownloadItem = {
  id: 'dl-1',
  mediaType: 'video',
  url: 'https://example.com/video.m3u8',
  title: 'Test Video',
  status: 'downloading',
  progress: 50,
  startedAt: 1000,
};

// --- useDetectedMedia -----------------------------------------------------

describe('useDetectedMedia', () => {
  it('returns videos + subtitles from the store', () => {
    usePopupStore.getState().setVideos([mockVideo]);
    usePopupStore.getState().setSubtitles([mockSubtitle]);

    const { result } = renderHook(() => useDetectedMedia());

    expect(result.current.videos).toEqual([mockVideo]);
    expect(result.current.subtitles).toEqual([mockSubtitle]);
  });

  it('sends GET_DETECTED_MEDIA on mount and updates the store with the response', async () => {
    const mediaPayload: DetectedMediaUpdatePayload = {
      videos: [mockVideo],
      subtitles: [mockSubtitle],
    };
    const response: MessageResponse<DetectedMediaUpdatePayload> = {
      success: true,
      data: mediaPayload,
    };
    chromeMock.sendMessage.mockResolvedValue(response);

    renderHook(() => useDetectedMedia());

    // Wait for the sendMessage promise to resolve.
    await Promise.resolve();
    await Promise.resolve();

    expect(chromeMock.sendMessage).toHaveBeenCalledWith({
      type: 'GET_DETECTED_MEDIA',
    });
    expect(usePopupStore.getState().videos).toEqual([mockVideo]);
    expect(usePopupStore.getState().subtitles).toEqual([mockSubtitle]);
  });

  it('subscribes to DETECTED_MEDIA_UPDATE messages and updates the store', () => {
    chromeMock.sendMessage.mockResolvedValue({ success: true });

    renderHook(() => useDetectedMedia());

    expect(chromeMock.onMessage.addListener).toHaveBeenCalledTimes(1);
    const listener = chromeMock.onMessage.listeners[0];

    const updatePayload: DetectedMediaUpdatePayload = {
      videos: [mockVideo],
      subtitles: [mockSubtitle],
    };
    const message: MessageRequest = {
      type: 'DETECTED_MEDIA_UPDATE',
      payload: updatePayload,
    };

    act(() => {
      listener(message, {} as chrome.runtime.MessageSender, jest.fn());
    });

    expect(usePopupStore.getState().videos).toEqual([mockVideo]);
    expect(usePopupStore.getState().subtitles).toEqual([mockSubtitle]);
  });

  it('removes the listener on unmount', () => {
    chromeMock.sendMessage.mockResolvedValue({ success: true });

    const { unmount } = renderHook(() => useDetectedMedia());

    const listener = chromeMock.onMessage.listeners[0];
    unmount();

    expect(chromeMock.onMessage.removeListener).toHaveBeenCalledWith(listener);
  });
});

// --- useDownloadProgress --------------------------------------------------

describe('useDownloadProgress', () => {
  it('returns downloads + totalProgress from the store', () => {
    usePopupStore.getState().addDownload(mockDownload);

    const { result } = renderHook(() => useDownloadProgress());

    expect(result.current.downloads).toEqual([mockDownload]);
    expect(result.current.totalProgress).toBe(50);
  });

  it('totalProgress = 0 when there are no downloads', () => {
    const { result } = renderHook(() => useDownloadProgress());

    expect(result.current.downloads).toEqual([]);
    expect(result.current.totalProgress).toBe(0);
  });

  it('totalProgress = average of all download progress values', () => {
    usePopupStore.getState().addDownload({
      ...mockDownload,
      id: 'dl-1',
      progress: 40,
    });
    usePopupStore.getState().addDownload({
      ...mockDownload,
      id: 'dl-2',
      progress: 60,
    });

    const { result } = renderHook(() => useDownloadProgress());

    expect(result.current.totalProgress).toBe(50);
  });

  it('subscribes to DOWNLOAD_PROGRESS_UPDATE messages and updates the store', () => {
    usePopupStore.getState().addDownload(mockDownload);

    renderHook(() => useDownloadProgress());

    const listener = chromeMock.onMessage.listeners[0];

    const progress: DownloadProgress = {
      itemId: 'dl-1',
      status: 'downloading',
      progress: 75,
    };
    const payload: DownloadProgressUpdatePayload = { progress };
    const message: MessageRequest = {
      type: 'DOWNLOAD_PROGRESS_UPDATE',
      payload,
    };

    act(() => {
      listener(message, {} as chrome.runtime.MessageSender, jest.fn());
    });

    const updated = usePopupStore
      .getState()
      .downloads.find((d) => d.id === 'dl-1');
    expect(updated?.progress).toBe(75);
  });

  it('removes the listener on unmount', () => {
    const { unmount } = renderHook(() => useDownloadProgress());

    const listener = chromeMock.onMessage.listeners[0];
    unmount();

    expect(chromeMock.onMessage.removeListener).toHaveBeenCalledWith(listener);
  });
});

// --- useExtensionStatus ---------------------------------------------------

describe('useExtensionStatus', () => {
  it('returns isActive + toggle', () => {
    const { result } = renderHook(() => useExtensionStatus());

    expect(typeof result.current.isActive).toBe('boolean');
    expect(typeof result.current.toggle).toBe('function');
    expect(result.current.isActive).toBe(true);
  });

  it('toggle sends a TOGGLE_EXTENSION message and updates the store', () => {
    chromeMock.sendMessage.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useExtensionStatus());

    act(() => {
      result.current.toggle();
    });

    expect(chromeMock.sendMessage).toHaveBeenCalledWith({
      type: 'TOGGLE_EXTENSION',
    });
    expect(usePopupStore.getState().extensionActive).toBe(false);
  });

  it('toggle flips the active state back to true when already inactive', () => {
    usePopupStore.getState().setExtensionActive(false);
    chromeMock.sendMessage.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useExtensionStatus());

    act(() => {
      result.current.toggle();
    });

    expect(chromeMock.sendMessage).toHaveBeenCalledWith({
      type: 'TOGGLE_EXTENSION',
    });
    expect(usePopupStore.getState().extensionActive).toBe(true);
  });
});
