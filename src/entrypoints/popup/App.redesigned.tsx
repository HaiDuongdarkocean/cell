import { useEffect, useState, useMemo } from 'react';
import { usePopupStore } from '@/entrypoints/popup/store/popupStore';
import { useThemeStore } from '@/stores/themeStore';
import { resolveMode } from '@/features/theme/logic/themeManager';
import { useDetectedMedia } from '@/entrypoints/popup/hooks/useDetectedMedia';
import { useDownloadProgress } from '@/entrypoints/popup/hooks/useDownloadProgress';
import { useExtensionStatus } from '@/entrypoints/popup/hooks/useExtensionStatus';
import { useMediaDisplayTitle } from '@/entrypoints/popup/hooks/useMediaDisplayTitle';
import { useSubtitleLanguage } from '@/entrypoints/popup/hooks/useSubtitleLanguage';
import { Header } from './components/layout/Header';
import { VideoCard } from './components/media/VideoCard';
import { SubtitleCard } from './components/media/SubtitleCard';
import { MediaEmpty } from './components/media/MediaEmpty';
import { DownloadCard } from './components/media/DownloadCard';
import { SettingsDialog } from '@/features/settings';
import { sendMessage } from '@/shared/lib/chrome-apis';
import type { VideoQuality, Settings, DownloadItem } from '@/entities/media';
import type { MessageRequest, MessageResponse } from '@/entities/message';
import { selectBestMedia } from '@/features/download';
import { isWhitelisted, addToWhitelist, removeFromWhitelist } from '@/features/whitelist';
import { getActiveContentTab } from '@/entrypoints/popup/utils/getActiveContentTab';
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

  // ADR-022: theme mode từ themeStore (source of truth tách riêng khỏi settings).
  const themeMode = useThemeStore((state) => state.mode);
  const switchThemeMode = useThemeStore((state) => state.switchMode);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAutoDownloadActive, setIsAutoDownloadActive] = useState(false);

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

  // ADR-022: theme áp dụng qua ThemeProvider (wraps popup in main.tsx).
  // Removed duplicate dataset.theme effect — ThemeProvider handles :root CSS vars.

  // Check if current tab URL is in auto-download whitelist
  useEffect(() => {
    const check = async (): Promise<void> => {
      try {
        // Resolve the active content tab (skips chrome-extension app-windows
        // such as Edge's dictionary sidebar — see getActiveContentTab).
        const tab = await getActiveContentTab();
        const tabUrl = tab?.url;
        if (tabUrl) {
          const active = await isWhitelisted(tabUrl);
          setIsAutoDownloadActive(active);
        }
      } catch (err) {
        console.warn('[popup] Failed to check whitelist:', err);
      }
    };
    void check();
  }, []);

  // Auto-select: when autoSelectEnabled is ON and media is loaded, auto-check best match
  useEffect(() => {
    if (!isSettingsLoaded) return;
    if (!settings.autoSelectEnabled) return;
    if (videos.length === 0 && subtitles.length === 0) return;

    const result = selectBestMedia(videos, subtitles, settings);
    if (result) {
      setSelectedIds(new Set([result.videoId, ...result.subtitleIds]));
    }
  }, [settings.autoSelectEnabled, settings.preferredVideoFormat, settings.defaultQuality, settings.selectedSubtitleLanguages, isSettingsLoaded, videos, subtitles]);

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

  const handleDownload = (): void => {
    if (selectionCount > 0) {
      // Download selected items
      selectedIds.forEach((id) => {
        const video = videos.find((v) => v.id === id);
        const subtitle = subtitles.find((s) => s.id === id);
        if (video) handleVideoDownload(video.id);
        else if (subtitle) handleSubtitleDownload(subtitle.id);
      });
    } else {
      // Download all available items
      videos.forEach((video) => handleVideoDownload(video.id));
      subtitles.forEach((subtitle) => handleSubtitleDownload(subtitle.id));
    }
    setSelectedIds(new Set());
  };

  const handleToggleAutoDownload = async (): Promise<void> => {
    try {
      const tab = await getActiveContentTab();
      const tabUrl = tab?.url;
      if (!tabUrl) return;

      if (isAutoDownloadActive) {
        await removeFromWhitelist(tabUrl);
        setIsAutoDownloadActive(false);
      } else {
        await addToWhitelist(tabUrl, tab.id);
        setIsAutoDownloadActive(true);
        // Turning AD ON for the current tab also triggers an immediate
        // auto-select + download of the best-matching media already detected
        // on this tab (not just whitelisting for future revisits). AD implies
        // auto-select for the purpose of downloading, so this runs regardless
        // of the `autoSelectEnabled` setting.
        if (isSettingsLoaded && (videos.length > 0 || subtitles.length > 0)) {
          const result = selectBestMedia(videos, subtitles, settings);
          if (result) {
            setSelectedIds(new Set([result.videoId, ...result.subtitleIds]));
            const video = videos.find((v) => v.id === result.videoId);
            if (video) handleVideoDownload(video.id);
            for (const subId of result.subtitleIds) {
              if (subtitles.find((s) => s.id === subId)) {
                handleSubtitleDownload(subId);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[popup] Failed to toggle auto-download:', err);
    }
  };

  const handleVideoDownload = (videoId: string): void => {
    const request: MessageRequest = { type: 'DOWNLOAD_VIDEO', payload: { videoId } };
    void sendMessage(request).then((response) => {
      const res = response as MessageResponse<DownloadItem> | undefined;
      if (res?.success && res.data) addDownload(res.data);
      else if (res && !res.success) setError(res.error ?? 'Failed to start video download');
    });
  };

  const handleQualitySelect = (videoId: string, quality: VideoQuality): void => {
    const request: MessageRequest = { type: 'DOWNLOAD_VIDEO', payload: { videoId, quality } };
    void sendMessage(request).then((response) => {
      const res = response as MessageResponse<DownloadItem> | undefined;
      if (res?.success && res.data) addDownload(res.data);
      else if (res && !res.success) setError(res.error ?? 'Failed to start video download');
    });
  };

  const handleSubtitleDownload = (subtitleId: string): void => {
    const request: MessageRequest = { type: 'DOWNLOAD_SUBTITLE', payload: { subtitleId } };
    void sendMessage(request).then((response) => {
      const res = response as MessageResponse<DownloadItem> | undefined;
      if (res?.success && res.data) addDownload(res.data);
      else if (res && !res.success) setError(res.error ?? 'Failed to start subtitle download');
    });
  };

  const handleThemeToggle = (): void => {
    // ADR-022: toggle qua themeStore (source of truth). Cycle light → dark → system → light.
    const cycle: Record<string, 'light' | 'dark' | 'system'> = {
      light: 'dark',
      dark: 'system',
      system: 'light',
    };
    switchThemeMode(cycle[themeMode] ?? 'dark');
  };

  const handleSettingsChange = (nextSettings: Settings): void => {
    updateSettings(nextSettings);
    const request: MessageRequest = { type: 'UPDATE_SETTINGS', payload: { settings: nextSettings } };
    void sendMessage(request);
  };

  // === Download control handlers ===

  const handlePauseDownload = (downloadId: string): void => {
    const request: MessageRequest = { type: 'PAUSE_DOWNLOAD', payload: { downloadId } };
    void sendMessage(request);
  };

  const handleResumeDownload = (downloadId: string): void => {
    const request: MessageRequest = { type: 'RESUME_DOWNLOAD', payload: { downloadId } };
    void sendMessage(request);
  };

  const handleCancelDownload = (downloadId: string): void => {
    const request: MessageRequest = { type: 'CANCEL_DOWNLOAD', payload: { downloadId } };
    void sendMessage(request);
    // Optimistic UI: remove from store immediately
    removeDownload(downloadId);
  };

  const handleRetryDownload = (downloadId: string): void => {
    const request: MessageRequest = { type: 'RETRY_DOWNLOAD', payload: { downloadId } };
    void sendMessage(request);
  };

  const handleRemoveDownload = (downloadId: string): void => {
    const request: MessageRequest = { type: 'REMOVE_DOWNLOAD', payload: { downloadId } };
    void sendMessage(request);
    // Optimistic UI: remove from store immediately
    removeDownload(downloadId);
  };

  const hasMedia = videos.length > 0 || subtitles.length > 0;
  const selectionCount = selectedIds.size;

  return (
    <div className={styles.popup} data-testid="app-root" data-theme={resolveMode(themeMode)}>
      <Header
        isActive={isActive}
        onToggleExtension={toggle}
        onToggleTheme={handleThemeToggle}
        onOpenSettings={() => setIsSettingsOpen(true)}
        currentTheme={resolveMode(themeMode)}
        isAutoDownloadActive={isAutoDownloadActive}
        onToggleAutoDownload={handleToggleAutoDownload}
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
                  onClick={handleDownload}
                  data-testid="download-button"
                >
                  {selectionCount > 0 ? `Download (${selectionCount})` : 'Download All'}
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

      <SettingsDialog
        isOpen={isSettingsOpen}
        settings={settings}
        onChange={handleSettingsChange}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
