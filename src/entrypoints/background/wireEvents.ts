/**
 * Background event wiring — connects building blocks' event streams.
 * Extracted from BackgroundService.wireEvents().
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
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
} from './helpers';
import type {
  DetectedVideo,
  DetectedSubtitle,
  DownloadItem,
  DownloadProgress,
} from '@/types/media';
import type {
  ConvertResult,
} from '@/features/download/downloader';
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
} from '@/types/message';

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
        void pushAutoLoadSubtitles(ctx, tabId, subtitles);
      }
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
  chrome.downloads.onDeterminingFilename.addListener(
    (downloadItem, suggest) => {
      if (downloadItem.byExtensionId !== chrome.runtime.id) {
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

      const response = (await chrome.runtime.sendMessage(
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

      const createResponse = (await chrome.runtime.sendMessage(
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
      const chromeDownloadId = await chrome.downloads.download({
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
          chrome.downloads.onChanged.removeListener(revokeListener);
          const revokeRequest: MessageRequest = {
            type: MESSAGE_TYPES.REVOKE_OPFS_BLOB_URL,
            payload: { url: blobUrl } satisfies RevokeOpfsBlobUrlPayload,
          };
          void chrome.runtime.sendMessage(revokeRequest).catch((err) => {
            console.warn('[background] Failed to revoke Blob URL:', err);
          });
        }
      };
      chrome.downloads.onChanged.addListener(revokeListener);
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

  unsubscribers.push(unsubMedia, unsubProgress);

  // 8. Tab navigation clear (loading)
  const onTabUpdated = (
    tabId: number,
    changeInfo: chrome.tabs.OnUpdatedInfo,
    _tab: chrome.tabs.Tab,
  ): void => {
    if (changeInfo.status === 'loading') {
      ctx.autoDownloadedTabs.delete(tabId);
      ctx.networkInterceptor.clearTab(tabId);
      clearSessionMedia(ctx, tabId);
      ctx.lastCuesByTab.delete(tabId);
      updateBadgeForTab(ctx, tabId);
    }
  };
  chrome.tabs.onUpdated.addListener(onTabUpdated);

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
  chrome.tabs.onRemoved.addListener(onTabRemoved);

  unsubscribers.push(
    () => chrome.tabs.onUpdated.removeListener(onTabUpdated),
    () => chrome.tabs.onRemoved.removeListener(onTabRemoved),
  );

  // 10. Tab activation → badge + activeTabIdForPanel tracking
  const onTabActivated = (activeInfo: { tabId: number; windowId: number }): void => {
    updateBadgeForTab(ctx, activeInfo.tabId);
    void chrome.tabs.get(activeInfo.tabId).then((tab) => {
      if (!tab.url || (!tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('edge://'))) {
        ctx.activeTabIdForPanel = activeInfo.tabId;
      }
    }).catch(() => { /* tab may be gone — leave previous value */ });
  };
  chrome.tabs.onActivated.addListener(onTabActivated);

  // 11. Window focus change → badge
  const onWindowFocusChanged = (windowId: number): void => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      clearBadge(ctx);
      return;
    }
    void updateBadgeForActiveTab(ctx);
  };
  chrome.windows.onFocusChanged.addListener(onWindowFocusChanged);

  unsubscribers.push(
    () => chrome.tabs.onActivated.removeListener(onTabActivated),
    () => chrome.windows.onFocusChanged.removeListener(onWindowFocusChanged),
  );

  return unsubscribers;
}
