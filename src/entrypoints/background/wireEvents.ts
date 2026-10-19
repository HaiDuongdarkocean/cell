/**
 * Background event wiring — connects building blocks' event streams.
 * Extracted from BackgroundService.wireEvents().
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { STORAGE_KEYS } from '@/shared/config/config';
import { t } from '@/shared/i18n';
import {
  getExtensionId,
  download,
  searchDownloads,
  addOnDeterminingFilenameListener,
  addOnDownloadsChangedListener,
  removeOnDownloadsChangedListener,
  addOnTabUpdatedListener,
  addOnTabRemovedListener,
  addOnTabActivatedListener,
  getTab,
  queryTabs,
  addOnWindowFocusChangedListener,
  getWindowIdNone,
  onStorageChanged,
  removeOnStorageChangedListener,
  sendMessageToAllFramesInTab,
} from '@/shared/lib/chrome-apis';
import { clearDictionaryProbeCache } from '@/features/dictionaryPopup/logic/lookupOrchestrator';
import type { BackgroundContext } from './context';
import {
  enrichVideo,
  enrichM3u8Variants,
  updateBadgeForTab,
  updateBadgeForActiveTab,
  clearBadge,
  saveSessionMedia,
  saveSessionDownloads,
  clearSessionDownloads,
  loadSettings,
  maybeAutoDownload,
  pushAutoLoadSubtitles,
  resolveUnknownSubtitleLanguages,
  findMediaForDownloadItem,
  isMediaRelevantUrlChange,
} from './helpers';
import { broadcastDetectedMedia, clearTabState, clearTabStateKeepingFreshSubtitles } from './helpers/broadcast';
import { sleep } from '@/shared/lib/async';
// SubtitleDiscoveryService is exposed on BackgroundContext; see subtitleDiscoveryService.ts.
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
  AutoLoadSubtitlesPayload,
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

      const tabId = firstVideo?.tabId ?? 0;
      broadcastDetectedMedia(ctx, tabId, { videos: enrichedVideos, subtitles });
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

  // 1b. Subtitle-list discovery service (Stremio + generic adapters)
  const subtitleDiscovery = ctx.subtitleDiscoveryService;
  const unsubListingMatcher = ctx.networkInterceptor.setListingMatcher((url) =>
    subtitleDiscovery.isListingUrl(url),
  );
  const unsubListing = ctx.networkInterceptor.onListingDetected(
    (url, tabId, initiator) => {
      void subtitleDiscovery.resolveListing(url, tabId, initiator);
    },
  );
  const unsubTabCleared = ctx.networkInterceptor.onTabCleared((tabId) =>
    subtitleDiscovery.clearTab(tabId),
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
      const desired = ctx.downloader.consumePendingFilename(downloadItem.url);
      if (desired) {
        suggest({ filename: desired, conflictAction: 'uniquify' });
      }
    },
  );

  // 5. Convert callback → offscreen mux.js transmuxer (V2: OPFS-based)
  ctx.downloader.setConvertCallback(
    async (
      _dirHandle: FileSystemDirectoryHandle,
      downloadId: string,
    ): Promise<ConvertResult> => {
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

      const response = await ctx.offscreenManager.sendToOffscreen<
        MessageResponse<ConvertTsToMp4V2ResultPayload> | undefined
      >(request);

      if (!response) {
        console.error('[offscreen] No response for', request.type);
        throw new Error(t('ui.error.offscreenNoResponse'));
      }
      if (!response.success || !response.data) {
        throw new Error(response.error ?? t('downloads.error.conversionFailed'));
      }

      return {
        outputName: response.data.outputName,
        mimeType: response.data.mimeType,
      };
    },
  );

  const inFlightDownloadFilenames = new Set<string>();
  const pendingDownloads = new Map<string, Promise<void>>();

  // 6. Save-OPFS-file callback → offscreen-owned Blob URL
  ctx.downloader.setSaveOpfsFileCallback(
    async (
      downloadId: string,
      opfsFilename: string,
      downloadFilename: string,
      mimeType: string,
    ): Promise<void> => {
      const createRequest: MessageRequest = {
        type: MESSAGE_TYPES.CREATE_OPFS_BLOB_URL,
        payload: {
          downloadId,
          opfsFilename,
          mimeType,
        } satisfies CreateOpfsBlobUrlPayload,
      };

      const createResponse = await ctx.offscreenManager.sendToOffscreen<
        MessageResponse<CreateOpfsBlobUrlResultPayload> | undefined
      >(createRequest);

      if (!createResponse) {
        console.error('[offscreen] No response for', createRequest.type);
        throw new Error(t('ui.error.offscreenNoResponse'));
      }
      if (!createResponse.success || !createResponse.data) {
        throw new Error(createResponse.error ?? t('downloads.error.blobUrlFailed'));
      }

      const blobUrl = createResponse.data.url;
      // Hold the event-page keep-alive until the download reaches a terminal
      // state — on Firefox the blob: URL lives in this page and dies with it.
      const releaseKeepAlive = ctx.offscreenManager.acquireKeepAlive();
      // Firefox resolves same-name conflicts inside downloads.download via an
      // async disk uniquify pass — two concurrent calls both pick the same
      // free slot and one lands FILE_FAILED. It also strips our (N) suffixes
      // before re-uniquifying, so no requested-name strategy closes the race;
      // serialize same-base calls until the first file is actually written,
      // pick names free in history + in-flight reservations, and retry with a
      // fresh name if the disk pass still fails.
      const gateKey = downloadFilename
        .toLowerCase()
        .replace(/\(\d+\)(\.[^.]+)?$/, '$1');
      const prior = pendingDownloads.get(gateKey) ?? Promise.resolve();
      let releaseGate: () => void = () => {};
      const mine = prior.then(
        () =>
          new Promise<void>((resolve) => {
            releaseGate = resolve;
          }),
      );
      pendingDownloads.set(gateKey, mine);
      void mine.finally(() => {
        if (pendingDownloads.get(gateKey) === mine) {
          pendingDownloads.delete(gateKey);
        }
      });
      let gateOpen = false;
      const openGate = (): void => {
        if (gateOpen) return;
        gateOpen = true;
        releaseGate();
      };
      await prior;
      const gateTimer = setTimeout(openGate, 10000);
      const openGateOnce = (): void => {
        clearTimeout(gateTimer);
        openGate();
      };

      const revokeBlobUrl = (): void => {
        if (ctx.offscreenManager.hasDocument()) {
          const revokeRequest: MessageRequest = {
            type: MESSAGE_TYPES.REVOKE_OPFS_BLOB_URL,
            payload: { url: blobUrl } satisfies RevokeOpfsBlobUrlPayload,
          };
          void ctx.offscreenManager.sendToOffscreen(revokeRequest).catch((err) => {
            console.warn('[background] Failed to revoke Blob URL:', err);
          });
        }
      };

      const pickFreeFilename = async (): Promise<string> => {
        let takenNames: string[] = [];
        try {
          const items = await searchDownloads({ orderBy: ['-startTime'], limit: 200 });
          takenNames = items
            .map((item) => item.filename?.split(/[\\/]/).pop()?.toLowerCase())
            .filter((name): name is string => !!name);
        } catch {
          // History lookup is best-effort; in-flight names still apply.
        }
        // Seed after the await so a concurrent save's reservation is visible —
        // seed → pick → reserve must be one synchronous block.
        const taken = new Set<string>([...inFlightDownloadFilenames, ...takenNames]);
        let name = downloadFilename;
        if (taken.has(name.toLowerCase())) {
          const dot = downloadFilename.lastIndexOf('.');
          const base = dot > 0 ? downloadFilename.slice(0, dot) : downloadFilename;
          const ext = dot > 0 ? downloadFilename.slice(dot) : '';
          for (let n = 2; taken.has(name.toLowerCase()); n++) {
            name = `${base}(${n})${ext}`;
          }
        }
        inFlightDownloadFilenames.add(name.toLowerCase());
        return name;
      };

      // This callback must not resolve until the download is terminal: the
      // caller deletes the OPFS backing right after, and Firefox lazily reads
      // the OPFS-backed blob — resolving early lets cleanup win that race
      // (interrupted FILE_FAILED). Same hazard exists on Chrome.
      try {
        for (let attempts = 0; ; attempts++) {
          const resolvedFilename = await pickFreeFilename();
          let chromeDownloadId: number;
          try {
            chromeDownloadId = await download({
              url: blobUrl,
              filename: resolvedFilename,
              saveAs: false,
            });
          } catch (err) {
            inFlightDownloadFilenames.delete(resolvedFilename.toLowerCase());
            throw err;
          }

          void (async () => {
            // The file is visible to later uniquify passes once bytes land —
            // poll the item since onChanged deltas don't carry byte counts.
            while (!gateOpen) {
              const item = (
                await searchDownloads({ id: chromeDownloadId }).catch(() => [])
              )[0];
              if (!item || item.bytesReceived > 0 || item.state === 'complete') {
                openGateOnce();
                return;
              }
              await sleep(250);
            }
          })();

          const terminalState = await new Promise<'complete' | 'interrupted'>(
            (resolve) => {
              const onDelta = (delta: chrome.downloads.DownloadDelta): void => {
                if (delta.id !== chromeDownloadId) return;
                const state = delta.state?.current;
                if (state === 'complete' || state === 'interrupted') {
                  removeOnDownloadsChangedListener(onDelta);
                  resolve(state);
                }
              };
              addOnDownloadsChangedListener(onDelta);
              void searchDownloads({ id: chromeDownloadId })
                .then((items) => {
                  const state = items[0]?.state;
                  if (state === 'complete' || state === 'interrupted') {
                    removeOnDownloadsChangedListener(onDelta);
                    resolve(state);
                  }
                })
                .catch(() => {});
            },
          );
          inFlightDownloadFilenames.delete(resolvedFilename.toLowerCase());
          if (terminalState === 'complete') break;
          const item = (
            await searchDownloads({ id: chromeDownloadId }).catch(() => [])
          )[0];
          const interruptReason = item?.error ?? 'interrupted';
          if (interruptReason !== 'FILE_FAILED' || attempts >= 2) {
            throw new Error(t('downloads.error.downloadInterrupted'));
          }
          // FILE_FAILED on a same-name collision is recoverable — the sibling's
          // slot is committed by now, so a fresh free name lands cleanly.
        }
      } finally {
        openGateOnce();
        releaseKeepAlive();
        revokeBlobUrl();
      }
    },
  );

  // 7. Queue executor: dispatch each item to the downloader
  ctx.downloadQueue.setExecutor(async (item: DownloadItem, signal: AbortSignal) => {
    const media =
      ctx.mediaMap.get(item.id) ?? findMediaForDownloadItem(ctx, item);
    if (!media) {
      throw new Error(t('downloads.error.mediaUnavailable'));
    }

    try {
      if (item.mediaType === 'video') {
        await ctx.downloader.downloadVideo(
          media as DetectedVideo,
          item.id,
          signal,
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
          signal,
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

  unsubscribers.push(unsubMedia, unsubListingMatcher, unsubListing, unsubTabCleared, unsubProgress);

  // 8. Tab navigation clear (loading)
  // lastCommittedTopUrl tracks the top-frame URL so onHistoryStateUpdated can
  // tell a real media switch apart from a cosmetic history rewrite — YouTube
  // appends `&t=<seconds>` via replaceState during playback, and clearing on
  // that wipes detection with no re-detect trigger (verified on Firefox).
  const lastCommittedTopUrl = new Map<number, string>();
  void queryTabs({}).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id !== undefined && tab.url) lastCommittedTopUrl.set(tab.id, tab.url);
    }
  });
  const onTabUpdated = (
    tabId: number,
    changeInfo: chrome.tabs.OnUpdatedInfo,
    tab: chrome.tabs.Tab,
  ): void => {
    // Clear on full page load (status: 'loading'). SPA navigations
    // (history.pushState/replaceState) do NOT trigger status: 'loading' —
    // they are caught by webNavigation.onHistoryStateUpdated below.
    if (changeInfo.status === 'loading') {
      if (tab?.url) lastCommittedTopUrl.set(tabId, tab.url);
      clearTabState(ctx, tabId);
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
    const prevUrl = lastCommittedTopUrl.get(details.tabId);
    lastCommittedTopUrl.set(details.tabId, details.url);
    if (!isMediaRelevantUrlChange(prevUrl, details.url)) return;
    clearTabStateKeepingFreshSubtitles(ctx, details.tabId, Date.now());
    // Tell every frame's content-script the media switched — without this the
    // overlay keeps showing the previous video's cues on sites whose detection
    // arrives late or finds no tracks (generic, non-YouTube SPAs).
    void sendMessageToAllFramesInTab(details.tabId, {
      type: MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
      payload: {
        tabId: details.tabId,
        target: null,
        native: null,
        pageUrl: details.url,
        targetMatches: [],
        nativeMatches: [],
      } satisfies AutoLoadSubtitlesPayload,
    });
  };
  chrome.webNavigation.onHistoryStateUpdated.addListener(onHistoryStateUpdated);
  unsubscribers.push(() => chrome.webNavigation.onHistoryStateUpdated.removeListener(onHistoryStateUpdated));

  // 9. Tab removal clear
  const onTabRemoved = (tabId: number): void => {
    lastCommittedTopUrl.delete(tabId);
    ctx.downloadQueue.removeByTab(tabId);
    clearTabState(ctx, tabId);
    clearSessionDownloads(ctx, tabId);
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

  // 12. Theme change → re-tint badge to the new primary
  const onThemeStorageChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    if (area !== 'local') return;
    if (!changes[STORAGE_KEYS.THEME_MODE] && !changes[STORAGE_KEYS.THEME_CONFIG]) return;
    void updateBadgeForActiveTab(ctx);
  };
  onStorageChanged(onThemeStorageChanged);

  // Settings writes (UPDATE_SETTINGS, direct saves, sync-applied) must drop
  // the lookup context cache — the complete seam is storage.onChanged.
  const onSettingsStorageChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    if (area !== 'local' || !changes[STORAGE_KEYS.SETTINGS]) return;
    clearDictionaryProbeCache();
  };
  onStorageChanged(onSettingsStorageChanged);

  unsubscribers.push(
    addOnTabActivatedListener(onTabActivated),
    addOnWindowFocusChangedListener(onWindowFocusChanged),
    () => removeOnStorageChangedListener(onThemeStorageChanged),
    () => removeOnStorageChangedListener(onSettingsStorageChanged),
  );

  return unsubscribers;
}
