import { useEffect, useState } from 'react';
import { usePopupStore } from '@/popup/store/popupStore';
import { useDetectedMedia } from '@/popup/hooks/useDetectedMedia';
import { useDownloadProgress } from '@/popup/hooks/useDownloadProgress';
import { useExtensionStatus } from '@/popup/hooks/useExtensionStatus';
import { VideoCard } from '@/popup/components/VideoCard';
import { SubtitleItem } from '@/popup/components/SubtitleItem';
import { ProgressBar } from '@/popup/components/ProgressBar';
import { StatusBadge } from '@/popup/components/StatusBadge';
import { SettingsPanel } from '@/popup/components/SettingsPanel';
import type { Settings, VideoQuality } from '@/types/media';
import type { MessageRequest } from '@/types/message';
import styles from './App.module.css';

/**
 * Root popup component for the Chrome extension video downloader.
 *
 * Composes the detected-media list, active downloads, extension/theme toggles,
 * and a collapsible settings panel. All side effects (message passing, theme
 * application) are coordinated here while state is sourced from the hooks and
 * the Zustand store.
 */
export function App(): React.JSX.Element {
  const { videos, subtitles } = useDetectedMedia();
  const { downloads } = useDownloadProgress();
  const { isActive, toggle } = useExtensionStatus();

  const settings = usePopupStore((state) => state.settings);
  const updateSettings = usePopupStore((state) => state.updateSettings);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Apply the configured theme on mount and whenever it changes.
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  const handleDownloadAll = (): void => {
    const request: MessageRequest = { type: 'DOWNLOAD_ALL' };
    void chrome.runtime.sendMessage(request);
  };

  const handleVideoDownload = (videoId: string): void => {
    const request: MessageRequest = {
      type: 'DOWNLOAD_VIDEO',
      payload: { videoId },
    };
    void chrome.runtime.sendMessage(request);
  };

  const handleQualitySelect = (videoId: string, quality: VideoQuality): void => {
    const request: MessageRequest = {
      type: 'DOWNLOAD_VIDEO',
      payload: { videoId, quality },
    };
    void chrome.runtime.sendMessage(request);
  };

  const handleSubtitleDownload = (subtitleId: string): void => {
    const request: MessageRequest = {
      type: 'DOWNLOAD_SUBTITLE',
      payload: { subtitleId },
    };
    void chrome.runtime.sendMessage(request);
  };

  const handleThemeToggle = (): void => {
    const nextTheme = settings.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    updateSettings({ theme: nextTheme });
  };

  const handleSettingsChange = (nextSettings: Settings): void => {
    updateSettings(nextSettings);
  };

  const hasMedia = videos.length > 0 || subtitles.length > 0;

  return (
    <div className={styles.root} data-testid="app-root">
      <header className={styles.header} data-testid="header">
        <h1 className={styles.title}>Video Downloader</h1>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.toggleButton}
            data-testid="extension-toggle"
            onClick={toggle}
            aria-pressed={isActive}
          >
            {isActive ? 'Active' : 'Inactive'}
          </button>
          <button
            type="button"
            className={styles.toggleButton}
            data-testid="theme-toggle"
            onClick={handleThemeToggle}
            aria-label="Toggle theme"
          >
            {settings.theme === 'light' ? 'Dark' : 'Light'}
          </button>
        </div>
      </header>

      <button
        type="button"
        className={styles.downloadAllButton}
        data-testid="download-all-button"
        onClick={handleDownloadAll}
      >
        Download All
      </button>

      <section className={styles.section} data-testid="media-section">
        <h2 className={styles.sectionTitle}>Detected Media</h2>
        {hasMedia ? (
          <>
            {videos.length > 0 && (
              <div className={styles.list}>
                {videos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    onDownload={handleVideoDownload}
                    onSelectQuality={handleQualitySelect}
                  />
                ))}
              </div>
            )}
            {subtitles.length > 0 && (
              <div className={styles.list}>
                {subtitles.map((subtitle) => (
                  <SubtitleItem
                    key={subtitle.id}
                    subtitle={subtitle}
                    onDownload={handleSubtitleDownload}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <p className={styles.empty} data-testid="empty-media">
            No media detected. Visit a video page.
          </p>
        )}
      </section>

      <section className={styles.section} data-testid="downloads-section">
        <h2 className={styles.sectionTitle}>Downloads</h2>
        {downloads.length > 0 ? (
          <div className={styles.list}>
            {downloads.map((download) => (
              <div className={styles.downloadItem} key={download.id}>
                <span className={styles.downloadTitle}>{download.title}</span>
                <ProgressBar progress={download.progress} status={download.status} />
                <StatusBadge status={download.status} />
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.empty} data-testid="empty-downloads">
            No downloads yet.
          </p>
        )}
      </section>

      <section className={styles.section} data-testid="settings-section">
        <button
          type="button"
          className={styles.toggleButton}
          data-testid="settings-toggle"
          onClick={() => setIsSettingsOpen((open) => !open)}
          aria-expanded={isSettingsOpen}
        >
          {isSettingsOpen ? 'Hide Settings' : 'Show Settings'}
        </button>
        {isSettingsOpen && (
          <SettingsPanel settings={settings} onChange={handleSettingsChange} />
        )}
      </section>
    </div>
  );
}
