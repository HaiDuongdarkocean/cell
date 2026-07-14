/**
 * Background event wiring — connects building blocks' event streams.
 * Extracted from BackgroundService.wireEvents().
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import {
  sendMessage,
  getExtensionId,
  download,
  addOnDeterminingFilenameListener,
  addOnDownloadsChangedListener,
  removeOnDownloadsChangedListener,
  addOnTabUpdatedListener,
  addOnTabRemovedListener,
  addOnTabActivatedListener,
  getTab,
  addOnWindowFocusChangedListener,
  getWindowIdNone,
} from '@/shared/lib/chrome-apis';
import type { BackgroundContext } from './context';
import {
  enrichVideo,
  enrichM3u8Variants,
  updateBadgeForTab,
  updateBadgeForActiveTab,
  clearBadge,
  saveSessionMedia,
  saveSessionDownloads,
  clearSessionMedia,
  clearSessionDownloads,
  loadSettings,
  maybeAutoDownload,
  pushAutoLoadSubtitles,
  resolveUnknownSubtitleLanguages,
  resolveStremioSubtitleListing,
} from './helpers';
import type {
  DetectedVideo,
  DetectedSubtitle,
  DownloadItem,
  DownloadProgress,
} from '@/entities/media';
import type {
  ConvertResult,
} from '@/features/download';
import type {
  MessageRequest,
  MessageResponse,
  DetectedMediaUpdatePayload,
  DownloadProgressUpdatePayload,
  ConvertTsToMp4V2Payload,
  ConvertTsToMp4V2ResultPayload,
  CreateOpfsBlobUrlPayload,
  CreateOpfsBlobUrlResultPayload,
  RevokeOpfsBlobUrlPayload,
} from '@/entities/message';

/**
 * Connect the event streams of the building blocks:
 *  - networkInterceptor.onMediaDetected → broadcast DETECTED_MEDIA_UPDATE
 *  - downloadQueue.onProgress → broadcast DOWNLOAD_PROGRESS_UPDATE
 *  - downloader.onProgress → downloadQueue.updateProgress
 *  - downloader.setConvertCallback → offscreen ffmpeg conversion
 *  - downloader.setSaveOpfsFileCallback → offscreen Blob URL
 *  - chrome.tabs.onUpdated/onRemoved/onActivated → clear + badge
 *  - chrome.windows.onFocusChanged → badge
 *  - chrome.downloads.onDeterminingFilename → filename override
 *
 * Returns an array of unsubscribe functions.
 */
export function wireEvents(ctx: BackgroundContext): Array<() => void> {
  const unsubscribers: Array<() => void> = [];

  // 1. Network interceptor → media detection pipeline
  const unsubMedia = ctx.networkInterceptor.onMediaDetected(
    (videos, subtitles) => {
      const enrichedVideos = videos.map((v) => {
        if (v.tabUrl !== v.url && v.title !== 'index') {
          return v;
        }
        return enrichVideo(ctx, v);
      });
      for (const video of enrichedVideos) {
        enrichM3u8Variants(ctx, video);
      }
      const firstVideo = enrichedVideos[0] ?? subtitles[0];
      if (firstVideo) {
        updateBadgeForTab(ctx, firstVideo.tabId);
      }

      ctx.messageBus.broadcast({
        type: MESSAGE_TYPES.DETECTED_MEDIA_UPDATE,
        payload: {
          videos: enrichedVideos,
          subtitles,
          tabId: firstVideo?.tabId ?? 0,
        } satisfies DetectedMediaUpdatePayload,
      });

      const tabId = firstVideo?.tabId ?? 0;
      if (tabId !== 0) {
        saveSessionMedia(ctx, tabId, enrichedVideos, subtitles);
      }

      if (tabId !== 0) {
        void maybeAutoDownload(ctx, tabId);
      }

      if (tabId !== 0 && subtitles.length > 0) {
        // Resolve unknown languages FIRST (independent of auto-load match
        // result). Previously this only ran when findSubtitlesForOverlay
        // returned null — so if target matched, unknown subs were never
        // resolved and stayed 'unknown' in the popup/manager. Running it
        // unconditionally here means every newly-detected unknown subtitle
        // gets its language resolved via content detection. After resolve,
        // updateSubtitle → notifyListeners → this callback fires again →
        // pushAutoLoadSubtitles sees the resolved language.
        void resolveUnknownSubtitleLanguages(ctx, tabId, subtitles);
        void pushAutoLoadSubtitles(ctx, tabId, subtitles);
      }
    },
  );

  // 1b. Stremio addon subtitle listing → fetch JSON → re-inject real subtitle URLs
  const unsubListing = ctx.networkInterceptor.onListingDetected(
    (url, tabId, initiator) => {
      void resolveStremioSubtitleListing(ctx, url, tabId, initiator);
    },
  );

  // 2. Download queue progress → broadcast + persist
  const unsubProgress = ctx.downloadQueue.onProgress((progress) => {
    const item = ctx.downloadQueue.getById(progress.itemId);
    ctx.messageBus.broadcast({
      type: MESSAGE_TYPES.DOWNLOAD_PROGRESS_UPDATE,
      payload: {
        progress,
        tabId: item?.tabId ?? 0,
      } satisfies DownloadProgressUpdatePayload,
    });
    if (item) {
      saveSessionDownloads(ctx, item.tabId);
    }
  });

  // 3. Downloader progress → queue progress tracking
  ctx.downloader.onProgress((progress: DownloadProgress) => {
    ctx.downloadQueue.updateProgress(progress);
  });

  // 4. Chrome downloads filename override
  addOnDeterminingFilenameListener(
    (downloadItem, suggest) => {
      if (downloadItem.byExtensionId !== getExtensionId()) {
        return;
      }
      const desired = ctx.downloader.getPendingFilename();
      if (desired) {
        suggest({ filename: desired, conflictAction: 'uniquify' });
        ctx.downloader.clearPendingFilename();
      }
    },
  );

  // 5. Convert callback → offscreen mux.js transmuxer (V2: OPFS-based)
  ctx.downloader.setConvertCallback(
    async (
      _dirHandle: FileSystemDirectoryHandle,
      downloadId: string,
    ): Promise<ConvertResult> => {
      await ctx.offscreenManager.ensureOffscreenReady();

      const currentSettings = await loadSettings();

      const request: MessageRequest = {
        type: MESSAGE_TYPES.CONVERT_TS_TO_MP4_V2,
        payload: {
          downloadId,
          parallelConversion: currentSettings.parallelConversion,
          manualWorkerCount: currentSettings.manualWorkerCount,
          parallelFallback: currentSettings.parallelFallback,
        } satisfies ConvertTsToMp4V2Payload,
      };

      const response = (await sendMessage(
        request,
      )) as MessageResponse<ConvertTsToMp4V2ResultPayload> | undefined;

      if (!response) {
        throw new Error(
          'Offscreen document did not respond to CONVERT_TS_TO_MP4_V2. ' +
            'The offscreen listener may not have registered.',
        );
      }
      if (!response.success || !response.data) {
        throw new Error(response.error ?? 'transmux conversion failed');
      }

      return {
        outputName: response.data.outputName,
        mimeType: response.data.mimeType,
      };
    },
  );

  // 6. Save-OPFS-file callback → offscreen-owned Blob URL
  ctx.downloader.setSaveOpfsFileCallback(
    async (
      downloadId: string,
      opfsFilename: string,
      downloadFilename: string,
      mimeType: string,
    ): Promise<void> => {
      await ctx.offscreenManager.ensureOffscreenReady();

      const createRequest: MessageRequest = {
        type: MESSAGE_TYPES.CREATE_OPFS_BLOB_URL,
        payload: {
          downloadId,
          opfsFilename,
          mimeType,
        } satisfies CreateOpfsBlobUrlPayload,
      };

      const createResponse = (await sendMessage(
        createRequest,
      )) as MessageResponse<CreateOpfsBlobUrlResultPayload> | undefined;

      if (!createResponse) {
        throw new Error(
          'Offscreen document did not respond to CREATE_OPFS_BLOB_URL. ' +
            'The offscreen listener may not have registered.',
        );
      }
      if (!createResponse.success || !createResponse.data) {
        throw new Error(
          createResponse.error ?? 'Failed to create Blob URL for save',
        );
      }

      const blobUrl = createResponse.data.url;
      const chromeDownloadId = await download({
        url: blobUrl,
        filename: downloadFilename,
        saveAs: false,
      });

      const revokeListener = (
        delta: chrome.downloads.DownloadDelta,
      ): void => {
        if (delta.id !== chromeDownloadId) return;
        if (
          delta.state?.current === 'complete' ||
          delta.state?.current === 'interrupted'
        ) {
          removeOnDownloadsChangedListener(revokeListener);
          const revokeRequest: MessageRequest = {
            type: MESSAGE_TYPES.REVOKE_OPFS_BLOB_URL,
            payload: { url: blobUrl } satisfies RevokeOpfsBlobUrlPayload,
          };
          void sendMessage(revokeRequest).catch((err) => {
            console.warn('[background] Failed to revoke Blob URL:', err);
          });
        }
      };
      addOnDownloadsChangedListener(revokeListener);
    },
  );

  // 7. Queue executor: dispatch each item to the downloader
  ctx.downloadQueue.setExecutor(async (item: DownloadItem) => {
    const media = ctx.mediaMap.get(item.id);
    if (!media) {
      throw new Error(`No media found for download ${item.id}`);
    }

    try {
      if (item.mediaType === 'video') {
        await ctx.downloader.downloadVideo(
          media as DetectedVideo,
          item.id,
        );
      } else {
        const subtitle = media as DetectedSubtitle;
        const tabVideos = ctx.networkInterceptor.getVideos(subtitle.tabId);
        const linkedVideo = tabVideos.length > 0 ? tabVideos[0] : undefined;
        const videoContext = linkedVideo
          ? { videoTitle: linkedVideo.title, videoTabUrl: linkedVideo.tabUrl }
          : undefined;
        await ctx.downloader.downloadSubtitle(
          subtitle,
          item.id,
          videoContext,
        );
      }
    } catch (err: unknown) {
      console.error(
        `[background] Download ${item.id} (${item.mediaType}) failed:`,
        err instanceof Error ? err.message : err,
      );
      throw err;
    }
  });

  unsubscribers.push(unsubMedia, unsubListing, unsubProgress);

  // 8. Tab navigation clear (loading)
  const onTabUpdated = (
    tabId: number,
    changeInfo: chrome.tabs.OnUpdatedInfo,
    _tab: chrome.tabs.Tab,
  ): void => {
    // Clear on full page load (status: 'loading'). SPA navigations
    // (history.pushState/replaceState) do NOT trigger status: 'loading' —
    // they are caught by webNavigation.onHistoryStateUpdated below.
    if (changeInfo.status === 'loading') {
      ctx.autoDownloadedTabs.delete(tabId);
      ctx.networkInterceptor.clearTab(tabId);
      clearSessionMedia(ctx, tabId);
      ctx.lastCuesByTab.delete(tabId);
      updateBadgeForTab(ctx, tabId);
    }
  };

  // SPA navigation clear: sites like aniwatch.co.at use history.pushState
  // when switching between sub/dub episodes (no full page reload).
  // chrome.tabs.onUpdated with status:'loading' does NOT fire for these —
  // only webNavigation.onHistoryStateUpdated catches them. Without this,
  // old subtitles from the previous episode persist into the new one.
  const onHistoryStateUpdated = (
    details: chrome.webNavigation.WebNavigationFramedCallbackDetails,
  ): void => {
    // Only handle top-frame navigations (frameId === 0).
    if (details.frameId !== 0) return;
    ctx.autoDownloadedTabs.delete(details.tabId);
    ctx.networkInterceptor.clearTab(details.tabId);
    clearSessionMedia(ctx, details.tabId);
    ctx.lastCuesByTab.delete(details.tabId);
    updateBadgeForTab(ctx, details.tabId);
  };
  chrome.webNavigation.onHistoryStateUpdated.addListener(onHistoryStateUpdated);
  unsubscribers.push(() => chrome.webNavigation.onHistoryStateUpdated.removeListener(onHistoryStateUpdated));

  // 9. Tab removal clear
  const onTabRemoved = (tabId: number): void => {
    ctx.networkInterceptor.clearTab(tabId);
    ctx.downloadQueue.removeByTab(tabId);
    clearSessionMedia(ctx, tabId);
    clearSessionDownloads(ctx, tabId);
    updateBadgeForTab(ctx, tabId);
    ctx.autoDownloadedTabs.delete(tabId);
    ctx.lastCuesByTab.delete(tabId);
  };

  unsubscribers.push(
    addOnTabUpdatedListener(onTabUpdated),
    addOnTabRemovedListener(onTabRemoved),
  );

  // 10. Tab activation → badge + activeTabIdForPanel tracking
  const onTabActivated = (activeInfo: { tabId: number; windowId: number }): void => {
    updateBadgeForTab(ctx, activeInfo.tabId);
    // ADR-011 v3: optimistically set the active tab id for panel relay filtering
    // *synchronously* so SUBTITLE_CUES_LOADED from the newly-active tab is not
    // dropped while we asynchronously verify the URL. Without this, a content
    // script that auto-loads subtitles quickly after activation can race the
    // getTab() promise and its message gets filtered out (sidepanel stays empty
    // until the user closes/reopens it).
    ctx.activeTabIdForPanel = activeInfo.tabId;
    void getTab(activeInfo.tabId).then((tab) => {
      if (tab.url?.startsWith('chrome-extension://') || tab.url?.startsWith('edge://')) {
        ctx.activeTabIdForPanel = undefined;
      }
    }).catch(() => { /* tab may be gone — leave previous value */ });
  };

  // 11. Window focus change → badge
  const onWindowFocusChanged = (windowId: number): void => {
    if (windowId === getWindowIdNone()) {
      clearBadge(ctx);
      return;
    }
    void updateBadgeForActiveTab(ctx);
  };

  unsubscribers.push(
    addOnTabActivatedListener(onTabActivated),
    addOnWindowFocusChangedListener(onWindowFocusChanged),
  );

  return unsubscribers;
}
