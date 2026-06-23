import { useEffect, useState } from 'react';
import { usePopupStore } from '@/popup/store/popupStore';
import { useDetectedMedia } from '@/popup/hooks/useDetectedMedia';
import { useDownloadProgress } from '@/popup/hooks/useDownloadProgress';
import { useExtensionStatus } from '@/popup/hooks/useExtensionStatus';
import { Header } from './components/layout/Header';
import { TabBar } from './components/layout/TabBar';
import { VideoCard } from './components/media/VideoCard';
import { SubtitleCard } from './components/media/SubtitleCard';
import { MediaEmpty } from './components/media/MediaEmpty';
import { MediaList } from './components/media/MediaList';
import { SettingsDialog } from './components/settings/SettingsDialog';
import { Button } from './components/ui/Button';
import { Skeleton } from './components/ui/Skeleton';
import type { VideoQuality, Settings, DownloadItem } from '@/types/media';
import type { MessageRequest, MessageResponse } from '@/types/message';
import styles from './App.redesigned.module.css';

type TabId = 'videos' | 'subtitles' | 'downloads';

export function AppRedesigned(): React.JSX.Element {
  const { videos, subtitles } = useDetectedMedia();
  const { downloads } = useDownloadProgress();
  const { isActive, toggle } = useExtensionStatus();

  const settings = usePopupStore((state) => state.settings);
  const updateSettings = usePopupStore((state) => state.updateSettings);
  const addDownload = usePopupStore((state) => state.addDownload);
  const setError = usePopupStore((state) => state.setError);

  const [activeTab, setActiveTab] = useState<TabId>('videos');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadPersistedSettings = usePopupStore((state) => state.loadPersistedSettings);
  const loadExtensionStatus = usePopupStore((state) => state.loadExtensionStatus);
  const isSettingsLoaded = usePopupStore((state) => state.isSettingsLoaded);

  // Load persisted settings and extension status on mount.
  useEffect(() => {
    const load = async (): Promise<void> => {
      await loadPersistedSettings();
      await loadExtensionStatus();
      setIsLoading(false);
    };
    void load();
  }, [loadPersistedSettings, loadExtensionStatus]);

  // Apply the configured theme whenever settings are loaded or theme changes.
  useEffect(() => {
    if (isSettingsLoaded) {
      document.documentElement.dataset.theme = settings.theme;
    }
  }, [settings.theme, isSettingsLoaded]);

  const handleDownloadAll = (): void => {
    const request: MessageRequest = { type: 'DOWNLOAD_ALL' };
    void chrome.runtime.sendMessage(request);
  };

  const handleVideoDownload = (videoId: string): void => {
    const request: MessageRequest = {
      type: 'DOWNLOAD_VIDEO',
      payload: { videoId },
    };
    void chrome.runtime.sendMessage(request).then((response) => {
      const res = response as MessageResponse<DownloadItem> | undefined;
      if (res?.success && res.data) {
        addDownload(res.data);
      } else if (res && !res.success) {
        setError(res.error ?? 'Failed to start video download');
      }
    });
  };

  const handleQualitySelect = (videoId: string, quality: VideoQuality): void => {
    const request: MessageRequest = {
      type: 'DOWNLOAD_VIDEO',
      payload: { videoId, quality },
    };
    void chrome.runtime.sendMessage(request).then((response) => {
      const res = response as MessageResponse<DownloadItem> | undefined;
      if (res?.success && res.data) {
        addDownload(res.data);
      } else if (res && !res.success) {
        setError(res.error ?? 'Failed to start video download');
      }
    });
  };

  const handleSubtitleDownload = (subtitleId: string): void => {
    const request: MessageRequest = {
      type: 'DOWNLOAD_SUBTITLE',
      payload: { subtitleId },
    };
    void chrome.runtime.sendMessage(request).then((response) => {
      const res = response as MessageResponse<DownloadItem> | undefined;
      if (res?.success && res.data) {
        addDownload(res.data);
      } else if (res && !res.success) {
        setError(res.error ?? 'Failed to start subtitle download');
      }
    });
  };

  const handleThemeToggle = (): void => {
    const nextTheme = settings.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    updateSettings({ theme: nextTheme });
  };

  const handleSettingsChange = (nextSettings: Settings): void => {
    updateSettings(nextSettings);

    // Notify the background service worker so it can apply settings that
    // affect download behavior (e.g. concurrentDownloads).
    const request: MessageRequest = {
      type: 'UPDATE_SETTINGS',
      payload: { settings: nextSettings },
    };
    void chrome.runtime.sendMessage(request);
  };

  const tabs = [
    { id: 'videos' as TabId, label: 'Videos', count: videos.length },
    { id: 'subtitles' as TabId, label: 'Subtitles', count: subtitles.length },
    { id: 'downloads' as TabId, label: 'Downloads', count: downloads.length },
  ];

  const renderContent = (): React.JSX.Element => {
    if (isLoading) {
      return (
        <div className={styles.list} aria-live="polite" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <Skeleton variant="rectangular" height={80} />
            </div>
          ))}
        </div>
      );
    }

    switch (activeTab) {
      case 'videos':
        if (videos.length === 0) {
          return <MediaEmpty type="videos" />;
        }
        return (
          <MediaList ariaLabel="Detected videos">
            {videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onDownload={handleVideoDownload}
                onSelectQuality={handleQualitySelect}
              />
            ))}
          </MediaList>
        );

      case 'subtitles':
        if (subtitles.length === 0) {
          return <MediaEmpty type="subtitles" />;
        }
        return (
          <MediaList ariaLabel="Detected subtitles">
            {subtitles.map((subtitle) => (
              <SubtitleCard
                key={subtitle.id}
                subtitle={subtitle}
                onDownload={handleSubtitleDownload}
              />
            ))}
          </MediaList>
        );

      case 'downloads':
        if (downloads.length === 0) {
          return <MediaEmpty type="downloads" />;
        }
        return (
          <div data-testid="downloads-section">
            <MediaList ariaLabel="Active downloads">
              {downloads.map((download) => (
                <div key={download.id} className={styles.downloadItem} data-testid="download-item">
                  <div className={styles.downloadHeader}>
                    <h4 className={styles.downloadTitle}>{download.title}</h4>
                    <span className={styles.downloadStatus}>{download.status}</span>
                  </div>
                  {download.error && (
                    <div className={styles.downloadError}>{download.error}</div>
                  )}
                  <div className={styles.downloadProgress}>
                    <div className={styles.progressBar} data-testid="progress-bar">
                      <div
                        className={styles.progressFill}
                        style={{ width: `${download.progress}%` }}
                        role="progressbar"
                        aria-valuenow={download.progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Download progress: ${download.progress}%`}
                      />
                    </div>
                    <span className={styles.progressText}>{download.progress}%</span>
                  </div>
                </div>
              ))}
            </MediaList>
          </div>
        );

      default:
        return <div />;
    }
  };

  return (
    <div className={styles.root} data-testid="app-root">
      <Header
        isActive={isActive}
        onToggleExtension={toggle}
        onToggleTheme={handleThemeToggle}
        onOpenSettings={() => setIsSettingsOpen(true)}
        currentTheme={settings.theme}
      />

      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={(tabId) => setActiveTab(tabId as TabId)} />

      <main className={styles.content} role="tabpanel" id={`panel-${activeTab}`} data-testid="media-section">
        {renderContent()}
      </main>

      {(videos.length > 0 || subtitles.length > 0) && (
        <div className={styles.actions}>
          <Button
            variant="primary"
            size="md"
            onClick={handleDownloadAll}
            className={styles.downloadAllButton}
            data-testid="download-all-button"
          >
            Download All
          </Button>
        </div>
      )}

      <SettingsDialog
        isOpen={isSettingsOpen}
        settings={settings}
        onChange={handleSettingsChange}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}