import { useEffect, useState, useMemo } from 'react';
import { usePopupStore } from '@/popup/store/popupStore';
import { useDetectedMedia } from '@/popup/hooks/useDetectedMedia';
import { useDownloadProgress } from '@/popup/hooks/useDownloadProgress';
import { useExtensionStatus } from '@/popup/hooks/useExtensionStatus';
import { useMediaDisplayTitle } from '@/popup/hooks/useMediaDisplayTitle';
import { useSubtitleLanguage } from '@/popup/hooks/useSubtitleLanguage';
import { Header } from './components/layout/Header';
import { VideoCard } from './components/media/VideoCard';
import { SubtitleCard } from './components/media/SubtitleCard';
import { MediaEmpty } from './components/media/MediaEmpty';
import { DownloadCard } from './components/media/DownloadCard';
import { SelectionBar } from './components/SelectionBar';
import { SettingsDialog } from './components/settings/SettingsDialog';
import type { VideoQuality, Settings, DownloadItem } from '@/types/media';
import type { MessageRequest, MessageResponse } from '@/types/message';
import styles from './App.redesigned.module.css';

export function AppRedesigned(): React.JSX.Element {
  const { videos, subtitles } = useDetectedMedia();
  const { downloads } = useDownloadProgress();
  const { isActive, toggle } = useExtensionStatus();
  const resolveDisplayTitle = useMediaDisplayTitle();
  const subtitleLanguages = useSubtitleLanguage(subtitles);

  const settings = usePopupStore((state) => state.settings);
  const updateSettings = usePopupStore((state) => state.updateSettings);
  const addDownload = usePopupStore((state) => state.addDownload);
  const removeDownload = usePopupStore((state) => state.removeDownload);
  const setVideos = usePopupStore((state) => state.setVideos);
  const setError = usePopupStore((state) => state.setError);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadPersistedSettings = usePopupStore((state) => state.loadPersistedSettings);
  const loadExtensionStatus = usePopupStore((state) => state.loadExtensionStatus);
  const isSettingsLoaded = usePopupStore((state) => state.isSettingsLoaded);

  useEffect(() => {
    const load = async (): Promise<void> => {
      await loadPersistedSettings();
      await loadExtensionStatus();
    };
    void load();
  }, [loadPersistedSettings, loadExtensionStatus]);

  useEffect(() => {
    if (isSettingsLoaded) {
      document.documentElement.dataset.theme = settings.theme;
    }
  }, [settings.theme, isSettingsLoaded]);

  // Default quality auto-apply: when user changes defaultQuality in settings,
  // update all video cards' first variant to match (if the quality exists).
  useEffect(() => {
    if (!isSettingsLoaded) return;
    if (settings.defaultQuality === 'auto' || settings.defaultQuality === 'highest') return;
    if (videos.length === 0) return;
    let changed = false;
    const updated = videos.map((v) => {
      const matchIdx = v.variants.findIndex((varr) => varr.quality === settings.defaultQuality);
      if (matchIdx < 0) return v;
      // VideoCard currently uses variants[0] as selected — reorder so the
      // matched quality is first. Only do this if not already first.
      if (matchIdx === 0) return v;
      changed = true;
      const reordered = [...v.variants];
      const [matched] = reordered.splice(matchIdx, 1);
      reordered.unshift(matched);
      return { ...v, variants: reordered };
    });
    if (changed) setVideos(updated);
  }, [settings.defaultQuality, isSettingsLoaded, videos, setVideos]);

  // IDs of media currently being downloaded
  const downloadingIds = useMemo((): Set<string> => {
    const ids = new Set<string>();
    downloads.forEach((d) => {
      if (d.status === 'downloading' || d.status === 'converting' || d.status === 'queued') {
        if (d.videoId) ids.add(d.videoId);
        // Also match by URL since subtitle downloads don't have videoId
        ids.add(d.url);
      }
    });
    return ids;
  }, [downloads]);

  const allMedia = useMemo(() => [
    ...videos.map((v) => ({ id: v.id, type: 'video' as const, ref: v })),
    ...subtitles.map((s) => ({ id: s.id, type: 'subtitle' as const, ref: s })),
  ], [videos, subtitles]);

  const availableMedia = useMemo(
    () => allMedia.filter((m) => !downloadingIds.has(m.id)),
    [allMedia, downloadingIds],
  );

  const allSelected = availableMedia.length > 0 && availableMedia.every((m) => selectedIds.has(m.id));

  const handleToggleSelect = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (): void => {
    if (allSelected) {
      // Deselect all available
      setSelectedIds((prev) => {
        const next = new Set(prev);
        availableMedia.forEach((m) => next.delete(m.id));
        return next;
      });
    } else {
      // Select all available
      setSelectedIds((prev) => {
        const next = new Set(prev);
        availableMedia.forEach((m) => next.add(m.id));
        return next;
      });
    }
  };

  const handleClearSelection = (): void => {
    setSelectedIds(new Set());
  };

  const handleDownloadSelected = (): void => {
    selectedIds.forEach((id) => {
      const video = videos.find((v) => v.id === id);
      const subtitle = subtitles.find((s) => s.id === id);
      if (video) handleVideoDownload(video.id);
      else if (subtitle) handleSubtitleDownload(subtitle.id);
    });
    setSelectedIds(new Set());
  };

  /**
   * Unified download handler:
   * - Nothing selected → download ALL media (via DOWNLOAD_ALL background message)
   * - All selected     → download ALL media (same as nothing selected)
   * - Partial selected → download only the selected items (individual messages)
   */
  const handleDownloadAll = async (): Promise<void> => {
    const hasPartialSelection = selectionCount > 0 && !allSelected;

    if (hasPartialSelection) {
      // Download only selected items.
      handleDownloadSelected();
      return;
    }

    // Nothing selected or all selected → download everything.
    // Query the active tab in the browser window (not the popup window).
    // Use `currentWindow: false` to target the browser window, since the
    // popup's own window would return the popup's tab (which has no media).
    let tabId: number | undefined;
    try {
      // First try: query active tab in a normal browser window.
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: false,
      });
      tabId = tabs[0]?.id;
      // Fallback: if no tab found (e.g. only popup window), try lastFocusedWindow.
      if (tabId === undefined) {
        const [tab] = await chrome.tabs.query({
          active: true,
          lastFocusedWindow: true,
        });
        tabId = tab?.id;
      }
    } catch (err) {
      console.warn('[popup] Failed to query active tab:', err);
    }

    const request: MessageRequest = {
      type: 'DOWNLOAD_ALL',
      payload: tabId !== undefined ? { tabId } : undefined,
    };
    void chrome.runtime.sendMessage(request).then((response) => {
      const res = response as MessageResponse<{ downloads: DownloadItem[] }> | undefined;
      if (res?.success && res.data?.downloads) {
        res.data.downloads.forEach((item) => addDownload(item));
      } else if (res && !res.success) {
        setError(res.error ?? 'Failed to start downloads');
      }
    });
    // Clear selection after downloading all.
    setSelectedIds(new Set());
  };

  const handleVideoDownload = (videoId: string): void => {
    const request: MessageRequest = { type: 'DOWNLOAD_VIDEO', payload: { videoId } };
    void chrome.runtime.sendMessage(request).then((response) => {
      const res = response as MessageResponse<DownloadItem> | undefined;
      if (res?.success && res.data) addDownload(res.data);
      else if (res && !res.success) setError(res.error ?? 'Failed to start video download');
    });
  };

  const handleQualitySelect = (videoId: string, quality: VideoQuality): void => {
    const request: MessageRequest = { type: 'DOWNLOAD_VIDEO', payload: { videoId, quality } };
    void chrome.runtime.sendMessage(request).then((response) => {
      const res = response as MessageResponse<DownloadItem> | undefined;
      if (res?.success && res.data) addDownload(res.data);
      else if (res && !res.success) setError(res.error ?? 'Failed to start video download');
    });
  };

  const handleSubtitleDownload = (subtitleId: string): void => {
    const request: MessageRequest = { type: 'DOWNLOAD_SUBTITLE', payload: { subtitleId } };
    void chrome.runtime.sendMessage(request).then((response) => {
      const res = response as MessageResponse<DownloadItem> | undefined;
      if (res?.success && res.data) addDownload(res.data);
      else if (res && !res.success) setError(res.error ?? 'Failed to start subtitle download');
    });
  };

  const handleThemeToggle = (): void => {
    const nextTheme = settings.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    updateSettings({ theme: nextTheme });
  };

  const handleSettingsChange = (nextSettings: Settings): void => {
    updateSettings(nextSettings);
    const request: MessageRequest = { type: 'UPDATE_SETTINGS', payload: { settings: nextSettings } };
    void chrome.runtime.sendMessage(request);
  };

  // === Download control handlers ===

  const handlePauseDownload = (downloadId: string): void => {
    const request: MessageRequest = { type: 'PAUSE_DOWNLOAD', payload: { downloadId } };
    void chrome.runtime.sendMessage(request);
  };

  const handleResumeDownload = (downloadId: string): void => {
    const request: MessageRequest = { type: 'RESUME_DOWNLOAD', payload: { downloadId } };
    void chrome.runtime.sendMessage(request);
  };

  const handleCancelDownload = (downloadId: string): void => {
    const request: MessageRequest = { type: 'CANCEL_DOWNLOAD', payload: { downloadId } };
    void chrome.runtime.sendMessage(request);
    // Optimistic UI: remove from store immediately
    removeDownload(downloadId);
  };

  const handleRetryDownload = (downloadId: string): void => {
    const request: MessageRequest = { type: 'RETRY_DOWNLOAD', payload: { downloadId } };
    void chrome.runtime.sendMessage(request);
  };

  const handleRemoveDownload = (downloadId: string): void => {
    const request: MessageRequest = { type: 'REMOVE_DOWNLOAD', payload: { downloadId } };
    void chrome.runtime.sendMessage(request);
    // Optimistic UI: remove from store immediately
    removeDownload(downloadId);
  };

  const hasMedia = videos.length > 0 || subtitles.length > 0;
  const selectionCount = selectedIds.size;

  return (
    <div className={styles.popup} data-testid="app-root" data-theme={settings.theme}>
      <Header
        isActive={isActive}
        onToggleExtension={toggle}
        onToggleTheme={handleThemeToggle}
        onOpenSettings={() => setIsSettingsOpen(true)}
        currentTheme={settings.theme}
      />

      <main className={styles.content}>
        {/* Media section */}
        <section className={styles.section} data-testid="media-section">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Media</h2>
            {hasMedia && (
              <div className={styles.sectionActions}>
                <button
                  type="button"
                  className={styles.btnText}
                  onClick={handleSelectAll}
                  data-testid="select-all-btn"
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  type="button"
                  className={styles.btnText}
                  onClick={handleDownloadAll}
                  data-testid="download-all-button"
                >
                  {selectionCount > 0 && !allSelected
                    ? `Download Selected (${selectionCount})`
                    : 'Download All'}
                </button>
              </div>
            )}
          </div>
          <div className={styles.mediaList}>
            {hasMedia ? (
              <>
                {videos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    displayTitle={resolveDisplayTitle(video)}
                    selected={selectedIds.has(video.id)}
                    downloading={downloadingIds.has(video.id)}
                    onToggleSelect={handleToggleSelect}
                    onDownload={handleVideoDownload}
                    onSelectQuality={handleQualitySelect}
                  />
                ))}
                {subtitles.map((subtitle) => (
                  <SubtitleCard
                    key={subtitle.id}
                    subtitle={subtitle}
                    displayTitle={resolveDisplayTitle(subtitle)}
                    languageLabel={subtitleLanguages.get(subtitle.id)}
                    selected={selectedIds.has(subtitle.id)}
                    downloading={downloadingIds.has(subtitle.id)}
                    onToggleSelect={handleToggleSelect}
                    onDownload={handleSubtitleDownload}
                  />
                ))}
              </>
            ) : (
              <MediaEmpty type="videos" />
            )}
          </div>
        </section>

        {/* Downloads section */}
        <section className={styles.section} data-testid="downloads-section">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Downloads</h2>
          </div>
          <div className={styles.downloadsList}>
            {downloads.length > 0 ? (
              downloads.map((download) => (
                <DownloadCard
                  key={download.id}
                  download={download}
                  onPause={handlePauseDownload}
                  onResume={handleResumeDownload}
                  onCancel={handleCancelDownload}
                  onRetry={handleRetryDownload}
                  onRemove={handleRemoveDownload}
                />
              ))
            ) : (
              <MediaEmpty type="downloads" />
            )}
          </div>
        </section>
      </main>

      {/* Selection bar — slides up from bottom */}
      <SelectionBar
        selectionCount={selectionCount}
        onClear={handleClearSelection}
        onDownload={handleDownloadSelected}
      />

      <SettingsDialog
        isOpen={isSettingsOpen}
        settings={settings}
        onChange={handleSettingsChange}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
