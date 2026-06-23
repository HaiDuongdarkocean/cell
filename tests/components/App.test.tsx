import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { DetectedVideo, DetectedSubtitle, DownloadItem, Settings } from '@/types/media';
import type { MessageRequest } from '@/types/message';

// --- Hook + store mocks ---------------------------------------------------

const mockVideos: DetectedVideo[] = [
  {
    id: 'video-1',
    url: 'https://example.com/video.m3u8',
    format: 'm3u8',
    title: 'Test Video',
    tabId: 1,
    tabUrl: 'https://example.com',
    detectedAt: 1000,
    variants: [{ url: 'https://example.com/1080.m3u8', quality: '1080p' }],
  },
];

const mockSubtitles: DetectedSubtitle[] = [
  {
    id: 'sub-1',
    url: 'https://example.com/sub.vtt',
    format: 'vtt',
    language: 'en',
    tabId: 1,
    detectedAt: 1000,
  },
];

const mockDownloads: DownloadItem[] = [
  {
    id: 'dl-1',
    mediaType: 'video',
    url: 'https://example.com/video.m3u8',
    title: 'Downloading Video',
    status: 'downloading',
    progress: 42,
    startedAt: 1000,
  },
];

const mockSettings: Settings = {
  concurrentDownloads: 3,
  defaultQuality: 'highest',
  defaultSubtitleLanguage: 'en',
  theme: 'light',
};

const mockUpdateSettings = jest.fn();
const mockToggle = jest.fn();

interface StoreState {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;
}

const storeState: StoreState = {
  settings: mockSettings,
  updateSettings: mockUpdateSettings,
};

jest.mock('@/popup/store/popupStore', () => ({
  usePopupStore: (selector: (state: StoreState) => unknown) => selector(storeState),
}));

const useDetectedMediaMock = jest.fn();
const useDownloadProgressMock = jest.fn();
const useExtensionStatusMock = jest.fn();

jest.mock('@/popup/hooks/useDetectedMedia', () => ({
  useDetectedMedia: (...args: unknown[]) => useDetectedMediaMock(...args),
}));

jest.mock('@/popup/hooks/useDownloadProgress', () => ({
  useDownloadProgress: (...args: unknown[]) => useDownloadProgressMock(...args),
}));

jest.mock('@/popup/hooks/useExtensionStatus', () => ({
  useExtensionStatus: (...args: unknown[]) => useExtensionStatusMock(...args),
}));

// --- chrome runtime mock --------------------------------------------------

interface ChromeRuntimeMock {
  sendMessage: jest.Mock;
  onMessage: {
    addListener: jest.Mock;
    removeListener: jest.Mock;
  };
}

let chromeMock: ChromeRuntimeMock;

beforeEach(() => {
  chromeMock = {
    sendMessage: jest.fn().mockResolvedValue({ success: true }),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  };

  (global as unknown as { chrome: unknown }).chrome = {
    runtime: chromeMock,
    storage: {
      local: {
        set: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue({}),
      },
    },
  };

  // Reset document theme between tests.
  delete document.documentElement.dataset.theme;

  // Reset hook mocks to sensible defaults.
  useDetectedMediaMock.mockReturnValue({ videos: [], subtitles: [] });
  useDownloadProgressMock.mockReturnValue({ downloads: [], totalProgress: 0 });
  useExtensionStatusMock.mockReturnValue({ isActive: true, toggle: mockToggle });

  jest.clearAllMocks();

  // Re-apply defaults after clearAllMocks.
  useDetectedMediaMock.mockReturnValue({ videos: [], subtitles: [] });
  useDownloadProgressMock.mockReturnValue({ downloads: [], totalProgress: 0 });
  useExtensionStatusMock.mockReturnValue({ isActive: true, toggle: mockToggle });
});

// --- Tests ----------------------------------------------------------------

import { App } from '@/popup/App';

describe('App', () => {
  it('renders the app root and header', () => {
    render(<App />);

    expect(screen.getByTestId('app-root')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByText('Video Downloader')).toBeInTheDocument();
  });

  it('shows the empty media state when no videos or subtitles are detected', () => {
    render(<App />);

    expect(screen.getByTestId('empty-media')).toHaveTextContent(
      'No media detected. Visit a video page.',
    );
    expect(screen.queryByTestId('video-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('subtitle-item')).not.toBeInTheDocument();
  });

  it('shows the empty downloads state when there are no downloads', () => {
    render(<App />);

    expect(screen.getByTestId('empty-downloads')).toHaveTextContent(
      'No downloads yet.',
    );
    expect(screen.queryByTestId('progress-bar')).not.toBeInTheDocument();
  });

  it('renders a VideoCard for each detected video', () => {
    useDetectedMediaMock.mockReturnValue({
      videos: mockVideos,
      subtitles: [],
    });

    render(<App />);

    expect(screen.getByTestId('video-card')).toBeInTheDocument();
    expect(screen.getByTestId('video-title')).toHaveTextContent('Test Video');
  });

  it('renders a SubtitleItem for each detected subtitle', () => {
    useDetectedMediaMock.mockReturnValue({
      videos: [],
      subtitles: mockSubtitles,
    });

    render(<App />);

    expect(screen.getByTestId('subtitle-item')).toBeInTheDocument();
    expect(screen.getByTestId('subtitle-language')).toHaveTextContent('en');
  });

  it('renders a ProgressBar and StatusBadge for each active download', () => {
    useDownloadProgressMock.mockReturnValue({
      downloads: mockDownloads,
      totalProgress: 42,
    });

    render(<App />);

    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
    expect(screen.getByTestId('status-badge')).toBeInTheDocument();
    expect(screen.getByText('Downloading Video')).toBeInTheDocument();
  });

  it('toggles the settings panel visibility via the settings toggle button', () => {
    render(<App />);

    expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('settings-toggle'));
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('settings-toggle'));
    expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument();
  });

  it('sends a DOWNLOAD_ALL message when the Download All button is clicked', () => {
    render(<App />);

    fireEvent.click(screen.getByTestId('download-all-button'));

    const request: MessageRequest = { type: 'DOWNLOAD_ALL' };
    expect(chromeMock.sendMessage).toHaveBeenCalledWith(request);
  });

  it('calls the extension toggle (which sends a TOGGLE_EXTENSION message) when the extension toggle is clicked', () => {
    const toggleThatMessages = jest.fn(() => {
      void chromeMock.sendMessage({ type: 'TOGGLE_EXTENSION' });
    });
    useExtensionStatusMock.mockReturnValue({
      isActive: true,
      toggle: toggleThatMessages,
    });

    render(<App />);

    fireEvent.click(screen.getByTestId('extension-toggle'));

    expect(toggleThatMessages).toHaveBeenCalledTimes(1);
    expect(chromeMock.sendMessage).toHaveBeenCalledWith({
      type: 'TOGGLE_EXTENSION',
    });
  });

  it('switches the data-theme attribute and updates settings when the theme toggle is clicked', () => {
    render(<App />);

    // Initial theme applied on mount.
    expect(document.documentElement.dataset.theme).toBe('light');

    fireEvent.click(screen.getByTestId('theme-toggle'));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(mockUpdateSettings).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('sends a DOWNLOAD_VIDEO message when a video download button is clicked', () => {
    useDetectedMediaMock.mockReturnValue({
      videos: mockVideos,
      subtitles: [],
    });

    render(<App />);

    fireEvent.click(screen.getByTestId('download-button'));

    expect(chromeMock.sendMessage).toHaveBeenCalledWith({
      type: 'DOWNLOAD_VIDEO',
      payload: { videoId: 'video-1' },
    });
  });
});
