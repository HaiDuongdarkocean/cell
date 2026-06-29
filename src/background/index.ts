/**
 * Background service worker entry point.
 *
 * Wires together all building blocks:
 *  - NetworkInterceptor  (chrome.webRequest media detection)
 *  - MessageBus          (chrome.runtime messaging)
 *  - DownloadQueue       (concurrent download scheduling)
 *  - Downloader          (fetch → merge → convert → save)
 *  - OffscreenManager    (ffmpeg.wasm offscreen document lifecycle)
 *
 * Registers typed handlers for every message type defined in
 * {@link MESSAGE_TYPES} and bridges background ↔ popup, background ↔ offscreen,
 * and content script ↔ background communication.
 */

import { NetworkInterceptor } from './networkInterceptor';
import { MessageBus } from './messageBus';
import { DownloadQueue } from './downloadQueue';
import { tryAutoDownload } from './autoDownload';
import { Downloader, type ConvertResult } from './downloader';
import { OffscreenManager } from './offscreenManager';
import { findSubtitlesForOverlay, type SubtitlePreference } from './subtitleService';
import { MESSAGE_TYPES } from '@/constants/messages';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/constants/config';
import { cleanupOrphanedDownloads } from '@/lib/storage/opfsStorage';
import { detectVideo } from '@/lib/detectors/videoDetector';
import { detectSubtitle } from '@/lib/detectors/subtitleDetector';
import { detectLanguage, labelToIsoCode } from '@/lib/detectors/languageDetector';
import { parseM3u8 } from '@/lib/parsers/m3u8Parser';
import type {
  DetectedVideo,
  DetectedSubtitle,
  DownloadItem,
  DownloadProgress,
  Settings,
  NetworkRequest,
  MediaType,
  VideoVariant,
  BilingualCue,
} from '@/types/media';
import type {
  MessageRequest,
  MessageResponse,
  MessageHandler,
  GetDetectedMediaPayload,
  DetectedMediaUpdatePayload,
  DownloadVideoPayload,
  DownloadSubtitlePayload,
  UpdateSubtitleLanguagePayload,
  DownloadAllPayload,
  GetDownloadProgressPayload,
  CancelDownloadPayload,
  DownloadProgressUpdatePayload,
  ConversionProgressUpdatePayload,
  UpdateSettingsPayload,
  PageScanResultPayload,
  AutoLoadSubtitlesPayload,
  RequestAutoLoadSubtitlesPayload,
  FetchSubtitleContentPayload,
  FetchSubtitleContentResult,
  DownloadListResponse,
  ConvertTsToMp4V2Payload,
  ConvertTsToMp4V2ResultPayload,
  CreateOpfsBlobUrlPayload,
  CreateOpfsBlobUrlResultPayload,
  RevokeOpfsBlobUrlPayload,
  OpenSidePanelPayload,
  SubtitleCuesLoadedPayload,
  RequestSubtitleCuesPayload,
  VideoTimeUpdatePayload,
  VideoPlayStatePayload,
  SeekToPayload,
  ShortcutActionPayload,
  VideoEpisodeChangedPayload,
  DetectedSubtitleUrlPayload,
} from '@/types/message';

/** Optional dependency overrides (used for testing). */
export interface BackgroundServiceOptions {
  readonly networkInterceptor?: NetworkInterceptor;
  readonly messageBus?: MessageBus;
  readonly downloadQueue?: DownloadQueue;
  readonly downloader?: Downloader;
  readonly offscreenManager?: OffscreenManager;
}

/**
 * Generate a unique identifier, preferring `crypto.randomUUID` and falling back
 * to a timestamp + random combination.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Orchestrates the background service worker: creates the core building blocks,
 * wires their event streams together, and registers message handlers on the
 * {@link MessageBus}.
 */
export class BackgroundService {
  readonly networkInterceptor: NetworkInterceptor;
  readonly messageBus: MessageBus;
  readonly downloadQueue: DownloadQueue;
  readonly downloader: Downloader;
  readonly offscreenManager: OffscreenManager;

  /** Maps a download id to the detected media it was created from. */
  private readonly mediaMap: Map<string, DetectedVideo | DetectedSubtitle> =
    new Map();

  /**
   * Per-tab auto-download state for the current page load. Maps a tab id to
   * the exact tab URL that was auto-downloaded plus the set of media ids that
   * have already been enqueued for that URL.
   *
   * Media detection is incremental (`onMediaDetected` fires first for the
   * m3u8, then again when subtitles are discovered). The URL is used to detect
   * navigation to a different page (cleared by `tabs.onUpdated` loading), and
   * the enqueued-id set lets follow-up detections catch up newly discovered
   * subtitles without re-downloading the video. When the tab navigates, the
   * entry is cleared and the new URL can auto-download again, even if it
   * normalizes to the same whitelist category (e.g. another episode).
   */
  private readonly autoDownloadedTabs: Map<number, {
    url: string;
    enqueuedIds: Set<string>;
  }> = new Map();

  /**
   * Last bilingual cues relayed via SUBTITLE_CUES_LOADED, keyed by tabId.
   * Survives in-memory across SW idle restarts only briefly — for true
   * persistence across SW restart, also mirrored to chrome.storage.session
   * (see handleSubtitleCuesLoaded). The side panel requests this via
   * REQUEST_SUBTITLE_CUES when it opens after cues were already sent.
   * ponytail: in-memory Map is enough for the common case (panel opened
   * shortly after cues load, same SW lifecycle); upgrade path = session
   * storage mirror if SW restarts prove to drop cues in practice.
   */
  private readonly lastCuesByTab: Map<number, BilingualCue[]> = new Map();

  /**
   * Active content tab id for side-panel relay filtering (ADR-011 v3).
   * Background tracks this via chrome.tabs.onActivated (filtering out
   * chrome-extension:// tabs) so the 3 relay handlers (SUBTITLE_CUES_LOADED,
   * VIDEO_TIME_UPDATE, VIDEO_PLAY_STATE) only forward messages from the
   * active tab — the side panel never receives messages from background tabs,
   * eliminating highlight flicker when multiple tabs play simultaneously.
   * Ground truth = sender.tab.id (Chrome-set) compared against this field.
   */
  private activeTabIdForPanel: number | undefined = undefined;

  /** Unsubscribe functions for event subscriptions. */
  private unsubscribers: Array<() => void> = [];

  /** Cached active-state flag mirrored from storage. */
  private extensionActive = true;

  /**
   * Resolves when session media + downloads have been restored from
   * `chrome.storage.session`. GET handlers await this so they don't return
   * empty data during the brief window between SW restart and session
   * restore completion.
   */
  private sessionReady: Promise<void> = Promise.resolve();

  constructor(options?: BackgroundServiceOptions) {
    this.networkInterceptor = options?.networkInterceptor ?? new NetworkInterceptor();
    this.messageBus = options?.messageBus ?? new MessageBus();
    this.downloadQueue = options?.downloadQueue ?? new DownloadQueue();
    this.downloader = options?.downloader ?? new Downloader();
    this.offscreenManager = options?.offscreenManager ?? new OffscreenManager();
  }

  /**
   * Initialise the background service: register message handlers
   * synchronously first (so the popup never hits "receiving end does not
   * exist"), then load persisted settings and wire event streams.
   */
  async init(): Promise<void> {
    // 1. Register message handlers + start the message bus IMMEDIATELY
    //    (synchronous) so that any message from the popup is handled even
    //    if the service worker was just woken up.
    this.registerHandlers();
    this.messageBus.start();

    // 1b. Start session restore IMMEDIATELY (before any await) so that GET
    //     handlers can await `sessionReady` even if the popup sends a
    //     message while init() is still running. Without this, there's a
    //     race condition where the handler returns empty data because
    //     `sessionReady` hasn't been assigned yet.
    this.sessionReady = this.performSessionRestore();

    // 2. Load persisted settings and apply to the download queue.
    const settings = await this.loadSettings();
    this.downloadQueue.setMaxConcurrent(settings.concurrentDownloads);
    this.downloader.setConvertMode(settings.convertToMp4);
    this.downloader.setSegmentConcurrency(settings.segmentConcurrency);
    this.downloader.setFilenameSource(settings.filenameSource);
    this.downloader.setParallelSettings({
      parallelConversion: settings.parallelConversion,
      manualWorkerCount: settings.manualWorkerCount,
    });

    // 3. Load persisted extension active state.
    const status = await this.loadExtensionStatus();
    this.extensionActive = status;

    // 4. Wire event streams (network → broadcast, queue → broadcast, etc.)
    this.wireEvents();

    // 4b. Wait for session restore to complete. The promise was created in
    //     step 1b so GET handlers can await it; here we just ensure init()
    //     doesn't complete until restore is done.
    await this.sessionReady;

    // 5. Start the network interceptor if the extension is active.
    if (this.extensionActive) {
      this.networkInterceptor.start();
    }

    // 6. Clean up orphaned OPFS temp files from crashed sessions.
    void cleanupOrphanedDownloads().catch((err: unknown) => {
      console.warn('[background] OPFS orphan cleanup failed:', err);
    });

    // 7. Update the toolbar badge for the currently active tab.
    if (this.extensionActive) {
      void this.updateBadgeForActiveTab();
    } else {
      this.clearBadge();
    }

    // 8. Resolve the initial active content tab for side-panel relay
    //    filtering (ADR-011 v3). onActivated only fires on tab switches,
    //    so we need to seed activeTabIdForPanel at startup. Filter out
    //    chrome-extension:// and edge:// tabs (same logic as onActivated).
    //    Awaited so handlers see the correct value immediately after init.
    try {
      const tabs = await chrome.tabs.query({ active: true });
      // Same filter as getActiveContentTab: accept tabs with no URL
      // (loading/restricted), reject chrome-extension:// and edge:// tabs.
      const contentTab = tabs.find(
        (t) => !t.url || (!t.url.startsWith('chrome-extension://') && !t.url.startsWith('edge://')),
      );
      if (contentTab?.id !== undefined) {
        this.activeTabIdForPanel = contentTab.id;
      }
    } catch {
      // SW may be shutting down — leave previous value
    }
  }

  /**
   * Tear down the background service: stop listeners and unsubscribe events.
   */
  stop(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.networkInterceptor.stop();
    this.messageBus.stop();
  }

  // --- event wiring ---

  /**
   * Connect the event streams of the building blocks:
   *  - networkInterceptor.onMediaDetected → broadcast DETECTED_MEDIA_UPDATE
   *  - downloadQueue.onProgress → broadcast DOWNLOAD_PROGRESS_UPDATE
   *  - downloader.onProgress → downloadQueue.updateProgress
   *  - downloader.setConvertCallback → offscreen ffmpeg conversion
   */
  private wireEvents(): void {
    // New media detected via network interception → enrich with real tab URL
    // and page title, then notify popup.
    const unsubMedia = this.networkInterceptor.onMediaDetected(
      (videos, subtitles) => {
        // Enrich videos with the actual page URL and title (the detector
        // only has the stream URL, which is useless for filename resolution).
        const enrichedVideos = videos.map((v) => {
          if (v.tabUrl !== v.url && v.title !== 'index') {
            return v; // already enriched
          }
          return this.enrichVideo(v);
        });
        // For m3u8 videos, fetch and parse the master playlist so the popup
        // can show quality tags for each variant. Fire-and-forget.
        for (const video of enrichedVideos) {
          this.enrichM3u8Variants(video);
        }
        // Update toolbar badge for the tab that produced the detection.
        const firstVideo = enrichedVideos[0] ?? subtitles[0];
        if (firstVideo) {
          this.updateBadgeForTab(firstVideo.tabId);
        }

        this.messageBus.broadcast({
          type: MESSAGE_TYPES.DETECTED_MEDIA_UPDATE,
          payload: {
            videos: enrichedVideos,
            subtitles,
            tabId: firstVideo?.tabId ?? 0,
          } satisfies DetectedMediaUpdatePayload,
        });

        // Persist to session storage so media survives SW restarts.
        const tabId = firstVideo?.tabId ?? 0;
        if (tabId !== 0) {
          this.saveSessionMedia(tabId, enrichedVideos, subtitles);
        }

        // Auto-download for whitelisted tabs. Media detection is the correct
        // trigger point (NOT `tabs.onUpdated` complete, which fires before
        // network interception captures the m3u8/subtitle requests). The guard
        // set ensures we only fire once per page load even though
        // `onMediaDetected` fires incrementally as more media is discovered.
        if (tabId !== 0) {
          void this.maybeAutoDownload(tabId);
        }

        // Bilingual subtitle auto-load: push matching subtitles to the
        // content-script when autoLoad is on (ADR-007 D2). Network-detected
        // subtitles may arrive after the initial PAGE_SCAN_RESULT, so we also
        // push here. Content-script dedups via URL cache (Task 7).
        if (tabId !== 0 && subtitles.length > 0) {
          void this.pushAutoLoadSubtitles(tabId, subtitles);
        }
      },
    );

    // Download progress changes → notify popup + persist to session storage.
    const unsubProgress = this.downloadQueue.onProgress((progress) => {
      const item = this.downloadQueue.getById(progress.itemId);
      this.messageBus.broadcast({
        type: MESSAGE_TYPES.DOWNLOAD_PROGRESS_UPDATE,
        payload: {
          progress,
          tabId: item?.tabId ?? 0,
        } satisfies DownloadProgressUpdatePayload,
      });
      // Persist so downloads survive SW restarts.
      if (item) {
        this.saveSessionDownloads(item.tabId);
      }
    });

    // Downloader progress → queue progress tracking.
    this.downloader.onProgress((progress: DownloadProgress) => {
      this.downloadQueue.updateProgress(progress);
    });

    // Force filename for extension-initiated downloads.
    //
    // Edge (and some Chrome versions) ignore the `filename` parameter of
    // `chrome.downloads.download` when the URL is a `data:` URL — there is no
    // Content-Disposition header and no URL path to derive a name from, so
    // the browser falls back to the generic name "download" with no
    // extension. `chrome.downloads.onDeterminingFilename` is the only way to
    // force the filename in that case.
    // Source: https://developer.chrome.com/docs/extensions/reference/api/downloads#event-onDeterminingFilename
    chrome.downloads.onDeterminingFilename.addListener(
      (downloadItem, suggest) => {
        // Only override downloads initiated by THIS extension.
        if (downloadItem.byExtensionId !== chrome.runtime.id) {
          return; // let other extensions / browser decide
        }
        const desired = this.downloader.getPendingFilename();
        if (desired) {
          suggest({ filename: desired, conflictAction: 'uniquify' });
          this.downloader.clearPendingFilename();
        }
        // If no pending filename, fall through (browser uses its own guess).
      },
    );

    // Convert callback → offscreen mux.js transmuxer (V2: OPFS-based).
    // The callback receives the OPFS directory handle; the offscreen document
    // reads `input.ts` from the same OPFS and writes `output.mp4` there.
    // Only the downloadId is sent via message (no large ArrayBuffer payloads).
    this.downloader.setConvertCallback(
      async (
        _dirHandle: FileSystemDirectoryHandle,
        downloadId: string,
      ): Promise<ConvertResult> => {
        await this.offscreenManager.ensureOffscreenReady();

        // Load current settings to pass parallel conversion config to offscreen
        const currentSettings = await this.loadSettings();

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

    // Save-OPFS-file callback → offscreen-owned Blob URL.
    //
    // MV3 service workers cannot use `URL.createObjectURL` (per MDN, it is
    // unavailable in Service Workers). The offscreen document reads the OPFS
    // file directly, creates a Blob URL (tied to the offscreen document's
    // lifetime), and returns the URL string. The background then calls
    // `chrome.downloads.download` with that URL and revokes it via
    // `chrome.downloads.onChanged` when the download completes or is
    // interrupted — no `setTimeout` (which is unreliable in a SW that may be
    // killed).
    this.downloader.setSaveOpfsFileCallback(
      async (
        downloadId: string,
        opfsFilename: string,
        downloadFilename: string,
        mimeType: string,
      ): Promise<void> => {
        await this.offscreenManager.ensureOffscreenReady();

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

        // Revoke the Blob URL when the download reaches a terminal state.
        // Using `onChanged` (not `setTimeout`) because the SW may be killed
        // before a timer fires.
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

    // Set the queue executor: dispatches each item to the downloader.
    this.downloadQueue.setExecutor(async (item: DownloadItem) => {
      const media = this.mediaMap.get(item.id);
      if (!media) {
        throw new Error(`No media found for download ${item.id}`);
      }

      try {
        if (item.mediaType === 'video') {
          await this.downloader.downloadVideo(
            media as DetectedVideo,
            item.id,
          );
        } else {
          const subtitle = media as DetectedSubtitle;
          // Find a video on the same tab to use its title/URL as the subtitle
          // filename base (so subtitle filenames match video filenames,
          // e.g. "Movie Title.en.srt" instead of "sub-<hash>.srt").
          // `subtitle.videoId` is currently never set by the detector, so we
          // look up by tabId as the primary linking strategy.
          const tabVideos = this.networkInterceptor.getVideos(subtitle.tabId);
          const linkedVideo = tabVideos.length > 0 ? tabVideos[0] : undefined;
          const videoContext = linkedVideo
            ? { videoTitle: linkedVideo.title, videoTabUrl: linkedVideo.tabUrl }
            : undefined;
          await this.downloader.downloadSubtitle(
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

    this.unsubscribers.push(unsubMedia, unsubProgress);

    // Clear detected media when a tab navigates to a new URL (reload or
    // link click). Without this, stale media from a previous page accumulates
    // and shows up every time the popup is reopened.
    //
    // NOTE: Per user requirement, media should persist across tab navigation
    // and only be cleared when the tab is closed. This allows users to switch
    // between tabs and back without losing detected media.
    const onTabUpdated = (
      tabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
      _tab: chrome.tabs.Tab,
    ): void => {
      if (changeInfo.status === 'loading') {
        // Reset the auto-download guard so a fresh page load can trigger
        // auto-download again when media is re-detected.
        this.autoDownloadedTabs.delete(tabId);
        // Clear media from the previous page (e.g. previous episode) so
        // each page load starts fresh — media should NOT accumulate across
        // navigations within the same tab.
        this.networkInterceptor.clearTab(tabId);
        this.clearSessionMedia(tabId);
        this.lastCuesByTab.delete(tabId);
        this.updateBadgeForTab(tabId);
      }
    };
    chrome.tabs.onUpdated.addListener(onTabUpdated);

    // Clear detected media AND downloads when a tab is closed.
    const onTabRemoved = (tabId: number): void => {
      this.networkInterceptor.clearTab(tabId);
      this.downloadQueue.removeByTab(tabId);
      this.clearSessionMedia(tabId);
      this.clearSessionDownloads(tabId);
      this.updateBadgeForTab(tabId);
      this.autoDownloadedTabs.delete(tabId);
      this.lastCuesByTab.delete(tabId);
    };
    chrome.tabs.onRemoved.addListener(onTabRemoved);

    this.unsubscribers.push(
      () => chrome.tabs.onUpdated.removeListener(onTabUpdated),
      () => chrome.tabs.onRemoved.removeListener(onTabRemoved),
    );

    // Update toolbar badge when the active tab changes.
    // Also track activeTabIdForPanel (ADR-011 v3): filter out
    // chrome-extension:// tabs so the side-panel relay only forwards
    // messages from real content tabs. This is the ground truth the 3
    // relay handlers check before forwarding to the side panel.
    const onTabActivated = (activeInfo: { tabId: number; windowId: number }): void => {
      this.updateBadgeForTab(activeInfo.tabId);
      void chrome.tabs.get(activeInfo.tabId).then((tab) => {
        // Same filter as getActiveContentTab: accept tabs with no URL,
        // reject chrome-extension:// and edge:// tabs.
        if (!tab.url || (!tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('edge://'))) {
          this.activeTabIdForPanel = activeInfo.tabId;
        }
      }).catch(() => { /* tab may be gone — leave previous value */ });
    };
    chrome.tabs.onActivated.addListener(onTabActivated);

    // Update toolbar badge when the focused window changes.
    const onWindowFocusChanged = (windowId: number): void => {
      if (windowId === chrome.windows.WINDOW_ID_NONE) {
        this.clearBadge();
        return;
      }
      void this.updateBadgeForActiveTab();
    };
    chrome.windows.onFocusChanged.addListener(onWindowFocusChanged);

    this.unsubscribers.push(
      () => chrome.tabs.onActivated.removeListener(onTabActivated),
      () => chrome.windows.onFocusChanged.removeListener(onWindowFocusChanged),
    );
  }

  // --- toolbar badge ---

  /**
   * Update the extension toolbar badge to show the number of detected media
   * items for the given tab. The badge is cleared when the tab has no media.
   */
  private updateBadgeForTab(tabId: number): void {
    if (!this.extensionActive) {
      this.clearBadge();
      return;
    }
    const { videos, subtitles } = this.networkInterceptor.getMedia(tabId);
    const count = videos.length + subtitles.length;
    const text = count > 0 ? String(count) : '';
    try {
      void chrome.action.setBadgeText({ text, tabId });
      void chrome.action.setBadgeBackgroundColor({ color: '#2563eb', tabId });
      void chrome.action.setBadgeTextColor({ color: '#ffffff', tabId });
    } catch (err: unknown) {
      console.warn('[background] Failed to update badge:', err);
    }
  }

  /**
   * Update the badge for the currently active tab.
   */
  private async updateBadgeForActiveTab(): Promise<void> {
    const tabId = await this.getActiveTabId();
    if (tabId !== undefined) {
      this.updateBadgeForTab(tabId);
    } else {
      this.clearBadge();
    }
  }

  /**
   * Clear the toolbar badge across all tabs.
   */
  private clearBadge(): void {
    try {
      void chrome.action.setBadgeText({ text: '' });
    } catch (err: unknown) {
      console.warn('[background] Failed to clear badge:', err);
    }
  }

  // --- message handler registration ---

  private registerHandlers(): void {
    this.on(MESSAGE_TYPES.GET_DETECTED_MEDIA, this.handleGetDetectedMedia);
    this.on(MESSAGE_TYPES.DOWNLOAD_VIDEO, this.handleDownloadVideo);
    this.on(MESSAGE_TYPES.DOWNLOAD_SUBTITLE, this.handleDownloadSubtitle);
    this.on(MESSAGE_TYPES.DOWNLOAD_ALL, this.handleDownloadAll);
    this.on(MESSAGE_TYPES.CANCEL_DOWNLOAD, this.handleCancelDownload);
    this.on(MESSAGE_TYPES.PAUSE_DOWNLOAD, this.handlePauseDownload);
    this.on(MESSAGE_TYPES.RESUME_DOWNLOAD, this.handleResumeDownload);
    this.on(MESSAGE_TYPES.RETRY_DOWNLOAD, this.handleRetryDownload);
    this.on(MESSAGE_TYPES.REMOVE_DOWNLOAD, this.handleRemoveDownload);
    this.on(MESSAGE_TYPES.GET_DOWNLOAD_PROGRESS, this.handleGetDownloadProgress);
    this.on(MESSAGE_TYPES.GET_SETTINGS, this.handleGetSettings);
    this.on(MESSAGE_TYPES.UPDATE_SETTINGS, this.handleUpdateSettings);
    this.on(MESSAGE_TYPES.GET_EXTENSION_STATUS, this.handleGetExtensionStatus);
    this.on(MESSAGE_TYPES.TOGGLE_EXTENSION, this.handleToggleExtension);
    this.on(MESSAGE_TYPES.UPDATE_SUBTITLE_LANGUAGE, this.handleUpdateSubtitleLanguage);
    this.on(MESSAGE_TYPES.PAGE_SCAN_RESULT, this.handlePageScanResult);
    this.on(MESSAGE_TYPES.REQUEST_AUTO_LOAD_SUBTITLES, this.handleRequestAutoLoadSubtitles);
    this.on(MESSAGE_TYPES.FETCH_SUBTITLE_CONTENT, this.handleFetchSubtitleContent);
    this.on(MESSAGE_TYPES.CONVERSION_PROGRESS_UPDATE, this.handleConversionProgressUpdate);
    // Side Panel relay handlers (ADR-008 D4)
    this.on(MESSAGE_TYPES.OPEN_SIDE_PANEL, this.handleOpenSidePanel);
    this.on(MESSAGE_TYPES.SUBTITLE_CUES_LOADED, this.handleSubtitleCuesLoaded);
    this.on(MESSAGE_TYPES.REQUEST_SUBTITLE_CUES, this.handleRequestSubtitleCues);
    this.on(MESSAGE_TYPES.VIDEO_TIME_UPDATE, this.handleVideoTimeUpdate);
    this.on(MESSAGE_TYPES.VIDEO_PLAY_STATE, this.handleVideoPlayState);
    this.on(MESSAGE_TYPES.SEEK_TO, this.handleSeekTo);
    this.on(MESSAGE_TYPES.TOGGLE_PLAY, this.handleTogglePlay);
    this.on(MESSAGE_TYPES.SHORTCUT_ACTION, this.handleShortcutAction);
    this.on(MESSAGE_TYPES.VIDEO_EPISODE_CHANGED, this.handleVideoEpisodeChanged);
    this.on(MESSAGE_TYPES.DETECTED_SUBTITLE_URL, this.handleDetectedSubtitleUrl);
  }

  /** Type-safe wrapper around messageBus.on. */
  private on(type: string, handler: MessageHandler): void {
    this.messageBus.on(type as MessageRequest['type'], handler);
  }

  // --- helpers ---

  /**
   * Get the active tab id via `chrome.tabs.query`.
   * Returns `undefined` when no active tab is found.
   */
  private async getActiveTabId(): Promise<number | undefined> {
    // Query active tab in a normal browser window (not the popup window).
    // Using currentWindow: false to skip the popup's own window.
    let tabs = await chrome.tabs.query({
      active: true,
      currentWindow: false,
    });
    if (tabs.length > 0) return tabs[0].id;

    // Fallback: lastFocusedWindow (covers cases where there's no popup window).
    tabs = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    return tabs[0]?.id;
  }

  /**
   * Reload the active tab so the content script re-injects and re-scans
   * the page. Used when the extension is re-enabled, so media detection
   * starts fresh instead of relying on stale state from before disable.
   *
   * Silently skips chrome:// and other restricted URLs where `tabs.reload`
   * is not permitted.
   */
  private async reloadActiveTab(): Promise<void> {
    const tabId = await this.getActiveTabId();
    if (tabId === undefined) return;
    try {
      const tab = await chrome.tabs.get(tabId);
      // Skip restricted URLs that cannot be reloaded.
      if (tab.url && /^(chrome|edge|about|chrome-extension):/i.test(tab.url)) {
        return;
      }
      await chrome.tabs.reload(tabId);
    } catch {
      // Tab may have been closed or be restricted; ignore.
    }
  }

  /**
   * Enrich a detected video with the actual page URL and title from the tab
   * it was detected on. The video detector only has the stream URL (e.g.
   * `https://cdn.example.com/index.m3u8`), which is useless for filename
   * resolution. This method queries `chrome.tabs.get` to fill in `tabUrl`
   * (the page URL) and `title` (the page title), so the downloader and popup
   * can produce meaningful filenames.
   *
   * This is synchronous-safe: if the tab query fails, the original video is
   * returned unchanged (no crash).
   */
  private enrichVideo(video: DetectedVideo): DetectedVideo {
    // Fire-and-forget: we can't await in the broadcast callback. Instead,
    // we update the stored video in the interceptor's map and re-broadcast.
    void chrome.tabs.get(video.tabId).then((tab) => {
      const enriched: DetectedVideo = {
        ...video,
        tabUrl: tab.url ?? video.tabUrl,
        title: tab.title && tab.title.length > 0 ? tab.title : video.title,
      };
      // Update the interceptor's stored copy so future broadcasts include it.
      this.networkInterceptor.updateVideo(video.id, enriched);
      // Re-broadcast so the popup picks up the enriched metadata.
      this.messageBus.broadcast({
        type: MESSAGE_TYPES.DETECTED_MEDIA_UPDATE,
        payload: {
          videos: this.networkInterceptor.getVideos(video.tabId),
          subtitles: this.networkInterceptor.getSubtitles(video.tabId),
          tabId: video.tabId,
        } satisfies DetectedMediaUpdatePayload,
      });
      this.updateBadgeForTab(video.tabId);
    }).catch((err: unknown) => {
      console.warn(`[background] Failed to enrich video for tab ${video.tabId}:`, err);
    });
    // Return the original for now; the enriched version will arrive via
    // the re-broadcast shortly after.
    return video;
  }

  /**
   * Fetch and parse an m3u8 master playlist so the popup can display a quality
   * tag for each variant (e.g. "1080p", "720p"). Fire-and-forget: when
   * variants are found, the stored video is updated in-place and a
   * DETECTED_MEDIA_UPDATE is re-broadcast.
   *
   * Silently ignores fetch/parse failures so detection stays robust on pages
   * with CORS-restricted or auth-protected playlists.
   */
  private enrichM3u8Variants(video: DetectedVideo): void {
    if (video.format !== 'm3u8' || video.variants.length > 0) {
      return;
    }

    void (async () => {
      try {
        const response = await fetch(video.url, {
          credentials: 'same-origin',
          headers: { Accept: 'application/vnd.apple.mpegurl' },
        });
        if (!response.ok) {
          return;
        }
        const content = await response.text();
        const playlist = parseM3u8(content, video.url);

        if (!playlist.isMasterPlaylist || playlist.variants.length === 0) {
          return;
        }

        const variants: VideoVariant[] = playlist.variants.map((variant) => ({
          url: variant.url,
          quality: variant.quality,
          resolution: variant.resolution,
          bandwidth: variant.bandwidth,
          playlistUrl: video.url,
        }));

        const enriched: DetectedVideo = {
          ...video,
          variants,
        };

        this.networkInterceptor.updateVideo(video.id, enriched);
        this.saveSessionMedia(video.tabId, this.networkInterceptor.getVideos(video.tabId), this.networkInterceptor.getSubtitles(video.tabId));
        this.messageBus.broadcast({
          type: MESSAGE_TYPES.DETECTED_MEDIA_UPDATE,
          payload: {
            videos: this.networkInterceptor.getVideos(video.tabId),
            subtitles: this.networkInterceptor.getSubtitles(video.tabId),
            tabId: video.tabId,
          } satisfies DetectedMediaUpdatePayload,
        });
      } catch {
        // Network/CORS errors are expected for some playlists; ignore.
      }
    })();
  }

  /**
   * Find a detected video by its id, searching the active tab first then all
   * known tabs.
   */
  private async findVideoById(videoId: string): Promise<DetectedVideo | undefined> {
    const tabId = await this.getActiveTabId();
    if (tabId !== undefined) {
      const match = this.networkInterceptor
        .getVideos(tabId)
        .find((v) => v.id === videoId);
      if (match) {
        return match;
      }
    }
    // Fall back to scanning every tab the interceptor knows about.
    return this.findAllVideos().find((v) => v.id === videoId);
  }

  /**
   * Find a detected subtitle by its id, searching the active tab first then all
   * known tabs.
   */
  private async findSubtitleById(
    subtitleId: string,
  ): Promise<DetectedSubtitle | undefined> {
    const tabId = await this.getActiveTabId();
    if (tabId !== undefined) {
      const match = this.networkInterceptor
        .getSubtitles(tabId)
        .find((s) => s.id === subtitleId);
      if (match) {
        return match;
      }
    }
    return this.findAllSubtitles().find((s) => s.id === subtitleId);
  }

  /**
   * Collect every detected video across all tabs.
   *
   * `NetworkInterceptor` does not expose a "get all" method, so we rely on the
   * fact that `getVideos` filters an internal map. We scan a generous range of
   * tab ids that have been observed; in practice the active tab covers the
   * popup's use case. This fallback is a best-effort safety net.
   */
  private findAllVideos(): DetectedVideo[] {
    return this.networkInterceptor.getAllVideos();
  }

  private findAllSubtitles(): DetectedSubtitle[] {
    return this.networkInterceptor.getAllSubtitles();
  }

  /**
   * Build a {@link DownloadItem} from detected media and register the media in
   * the internal media map so the queue executor can look it up.
   */
  private createDownloadItem(
    media: DetectedVideo | DetectedSubtitle,
    mediaType: MediaType,
  ): DownloadItem {
    const id = generateId();
    this.mediaMap.set(id, media);

    const title =
      mediaType === 'video'
        ? (media as DetectedVideo).title
        : extractBaseName((media as DetectedSubtitle).url);

    // Extract quality from the video's first variant (if available) for the
    // quality badge in the download card.
    const quality =
      mediaType === 'video'
        ? (media as DetectedVideo).variants[0]?.quality
        : undefined;

    return {
      id,
      mediaType,
      url: media.url,
      title,
      tabId: media.tabId,
      status: 'queued',
      progress: 0,
      videoId: mediaType === 'video' ? (media as DetectedVideo).id : undefined,
      ...(quality !== undefined ? { quality } : {}),
    };
  }

  // --- storage helpers ---

  private async loadSettings(): Promise<Settings> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const stored = result[STORAGE_KEYS.SETTINGS] as Partial<Settings> | undefined;
    // Merge with defaults so that settings saved before new fields were added
    // (e.g. parallelConversion, manualWorkerCount, parallelFallback) get
    // sensible default values instead of `undefined`.
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  private async saveSettings(settings: Settings): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
  }

  private async loadExtensionStatus(): Promise<boolean> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.EXTENSION_STATUS);
    const stored = result[STORAGE_KEYS.EXTENSION_STATUS] as
      | boolean
      | undefined;
    return stored ?? true;
  }

  private async saveExtensionStatus(active: boolean): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.EXTENSION_STATUS]: active,
    });
  }

  // --- session persistence (survives SW restarts) ---

  /**
   * Restore media + downloads from `chrome.storage.session`. Called early
   * in `init()` (before settings load) so the `sessionReady` promise
   * resolves as soon as possible. GET handlers await `sessionReady` to
   * avoid returning empty data during SW restart.
   */
  private async performSessionRestore(): Promise<void> {
    await this.loadSessionMedia();
    await this.loadSessionDownloads();
  }

  /**
   * Save detected media for a tab to `chrome.storage.session`. Fire-and-forget
   * so detection is not blocked. Called whenever new media is detected.
   */
  private saveSessionMedia(
    tabId: number,
    videos: DetectedVideo[],
    subtitles: DetectedSubtitle[],
  ): void {
    void chrome.storage.session.get(STORAGE_KEYS.SESSION_MEDIA).then((data) => {
      const all = (data[STORAGE_KEYS.SESSION_MEDIA] as
        | Record<string, { videos: DetectedVideo[]; subtitles: DetectedSubtitle[] }>
        | undefined) ?? {};
      all[String(tabId)] = { videos, subtitles };
      void chrome.storage.session.set({
        [STORAGE_KEYS.SESSION_MEDIA]: all,
      });
    });
  }

  /**
   * Restore detected media from `chrome.storage.session` into the
   * NetworkInterceptor. Called on `init()` so media survives SW restarts.
   * Uses `restoreMedia` to preserve original IDs and enriched metadata.
   */
  private async loadSessionMedia(): Promise<void> {
    try {
      const data = await chrome.storage.session.get(STORAGE_KEYS.SESSION_MEDIA);
      const all = data[STORAGE_KEYS.SESSION_MEDIA] as
        | Record<string, { videos: DetectedVideo[]; subtitles: DetectedSubtitle[] }>
        | undefined;
      if (!all) return;
      for (const [, entry] of Object.entries(all)) {
        this.networkInterceptor.restoreMedia(entry.videos, entry.subtitles);
      }
    } catch {
      // Session storage may not be available; ignore.
    }
  }

  /**
   * Clear saved media for a tab from session storage. Called on tab close
   * and on tab navigation (loading).
   */
  private clearSessionMedia(tabId: number): void {
    void chrome.storage.session.get(STORAGE_KEYS.SESSION_MEDIA).then((data) => {
      const all = data[STORAGE_KEYS.SESSION_MEDIA] as
        | Record<string, unknown>
        | undefined;
      if (!all) return;
      delete all[String(tabId)];
      void chrome.storage.session.set({
        [STORAGE_KEYS.SESSION_MEDIA]: all,
      });
    });
  }

  /**
   * Save all downloads for a tab to `chrome.storage.session`. Fire-and-forget.
   * Called whenever download progress changes.
   */
  private saveSessionDownloads(tabId: number): void {
    void chrome.storage.session.get(STORAGE_KEYS.SESSION_DOWNLOADS).then((data) => {
      const all = (data[STORAGE_KEYS.SESSION_DOWNLOADS] as
        | Record<string, DownloadItem[]>
        | undefined) ?? {};
      all[String(tabId)] = this.downloadQueue.getByTab(tabId);
      void chrome.storage.session.set({
        [STORAGE_KEYS.SESSION_DOWNLOADS]: all,
      });
    });
  }

  /**
   * Restore downloads from `chrome.storage.session` into the DownloadQueue.
   * Called on `init()` so downloads survive SW restarts. Uses `restore` to
   * preserve original status/progress — does NOT re-queue completed downloads.
   * Active downloads (downloading/converting) are marked as error since the
   * fetch/convert pipeline cannot be resumed after SW restart.
   */
  private async loadSessionDownloads(): Promise<void> {
    try {
      const data = await chrome.storage.session.get(
        STORAGE_KEYS.SESSION_DOWNLOADS,
      );
      const all = data[STORAGE_KEYS.SESSION_DOWNLOADS] as
        | Record<string, DownloadItem[]>
        | undefined;
      if (!all) return;
      for (const [, items] of Object.entries(all)) {
        for (const item of items) {
          if (item.status === 'downloading' || item.status === 'converting') {
            this.downloadQueue.restore({
              ...item,
              status: 'error',
              error: 'Interrupted (service worker restarted)',
            });
          } else {
            this.downloadQueue.restore(item);
          }
        }
      }
    } catch {
      // Session storage may not be available; ignore.
    }
  }

  /**
   * Clear saved downloads for a tab from session storage. Called on tab close.
   */
  private clearSessionDownloads(tabId: number): void {
    void chrome.storage.session.get(STORAGE_KEYS.SESSION_DOWNLOADS).then((data) => {
      const all = data[STORAGE_KEYS.SESSION_DOWNLOADS] as
        | Record<string, unknown>
        | undefined;
      if (!all) return;
      delete all[String(tabId)];
      void chrome.storage.session.set({
        [STORAGE_KEYS.SESSION_DOWNLOADS]: all,
      });
    });
  }

  // --- message handlers ---

  /** GET_DETECTED_MEDIA: return videos + subtitles for the requested tab only. */
  private handleGetDetectedMedia = async (
    request: MessageRequest,
  ): Promise<MessageResponse<DetectedMediaUpdatePayload>> => {
    // Wait for session restore to complete so we don't return empty data
    // during the brief window after SW restart.
    await this.sessionReady;
    const payload = request.payload as GetDetectedMediaPayload | undefined;
    const tabId = payload?.tabId ?? (await this.getActiveTabId());

    if (tabId === undefined) {
      return { success: true, data: { videos: [], subtitles: [], tabId: 0 } };
    }

    const { videos, subtitles } = this.networkInterceptor.getMedia(tabId);
    return { success: true, data: { videos, subtitles, tabId } };
  };

  /** DOWNLOAD_VIDEO: create a download item for the requested video. */
  private handleDownloadVideo = async (
    request: MessageRequest,
  ): Promise<MessageResponse<DownloadItem>> => {
    const payload = request.payload as DownloadVideoPayload;
    const video = await this.findVideoById(payload.videoId);

    if (!video) {
      return { success: false, error: `Video not found: ${payload.videoId}` };
    }

    const item = this.createDownloadItem(video, 'video');
    this.downloadQueue.add(item);

    return { success: true, data: item };
  };

  /** DOWNLOAD_SUBTITLE: create a download item for the requested subtitle. */
  private handleDownloadSubtitle = async (
    request: MessageRequest,
  ): Promise<MessageResponse<DownloadItem>> => {
    const payload = request.payload as DownloadSubtitlePayload;
    const subtitle = await this.findSubtitleById(payload.subtitleId);

    if (!subtitle) {
      console.error(
        `[background] Subtitle not found: ${payload.subtitleId}`,
      );
      return {
        success: false,
        error: `Subtitle not found: ${payload.subtitleId}`,
      };
    }

    const item = this.createDownloadItem(subtitle, 'subtitle');
    this.downloadQueue.add(item);

    return { success: true, data: item };
  };

  /** DOWNLOAD_ALL: download every detected video + subtitle for a tab. */
  private handleDownloadAll = async (
    request: MessageRequest,
  ): Promise<MessageResponse<DownloadListResponse>> => {
    const payload = request.payload as DownloadAllPayload;
    const tabId = payload.tabId ?? (await this.getActiveTabId());

    if (tabId === undefined) {
      return { success: false, error: 'No active tab found' };
    }

    const { videos, subtitles } = this.networkInterceptor.getMedia(tabId);

    if (videos.length === 0 && subtitles.length === 0) {
      return { success: false, error: 'No media found for this tab' };
    }

    const items: DownloadItem[] = [];

    for (const video of videos) {
      items.push(this.createDownloadItem(video, 'video'));
    }
    for (const subtitle of subtitles) {
      items.push(this.createDownloadItem(subtitle, 'subtitle'));
    }

    this.downloadQueue.addAll(items);

    return { success: true, data: { downloads: items } };
  };

  /**
   * Auto-download entry point fired when media is detected for a tab
   * (`onMediaDetected`). Media detection is incremental — the m3u8 is captured
   * first, then subtitles arrive later — so this handles two cases:
   *
   * 1. **First detection for a page load** (no state, or the tab navigated to a
   *    new URL): run {@link tryAutoDownload} fresh and record the enqueued media
   *    ids against the tab URL.
   * 2. **Follow-up detection for the same page load** (state exists and URL
   *    matches): run {@link tryAutoDownload} with the already-enqueued id set so
   *    only newly discovered subtitles are queued — the video is not
   *    re-downloaded.
   *
   * {@link tryAutoDownload} silently no-ops for non-whitelisted URLs or when no
   * matching media is found.
   */
  private async maybeAutoDownload(tabId: number): Promise<void> {
    let tabUrl: string | undefined;
    try {
      const tab = await chrome.tabs.get(tabId);
      tabUrl = tab.url;
    } catch {
      return; // tab may already be gone
    }
    if (!tabUrl) return;

    const state = this.autoDownloadedTabs.get(tabId);
    const deps = {
      getMedia: (id: number) => this.networkInterceptor.getMedia(id),
      createDownloadItem: (media: DetectedVideo | DetectedSubtitle, type: 'video' | 'subtitle') =>
        this.createDownloadItem(media, type),
      addToQueue: (items: DownloadItem[]) => this.downloadQueue.addAll(items),
    };

    if (state && state.url === tabUrl) {
      // Same page load: catch up newly discovered subtitles without
      // re-downloading the video.
      const newIds = await tryAutoDownload(tabId, tabUrl, deps, state.enqueuedIds);
      for (const id of newIds) state.enqueuedIds.add(id);
      return;
    }

    // Fresh page load (or first detection): enqueue everything selected.
    const newIds = await tryAutoDownload(tabId, tabUrl, deps);
    if (newIds.length > 0) {
      this.autoDownloadedTabs.set(tabId, { url: tabUrl, enqueuedIds: new Set(newIds) });
    }
  }

  /** CANCEL_DOWNLOAD: cancel a download by id. */
  private handleCancelDownload = async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    const payload = request.payload as CancelDownloadPayload;
    this.downloadQueue.cancel(payload.downloadId);
    this.downloader.cancel(payload.downloadId);
    return { success: true };
  };

  /** PAUSE_DOWNLOAD: pause a download by id. */
  private handlePauseDownload = async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    const payload = request.payload as CancelDownloadPayload;
    this.downloader.pause(payload.downloadId);
    this.downloadQueue.pause(payload.downloadId);
    return { success: true };
  };

  /** RESUME_DOWNLOAD: resume a paused download by id. */
  private handleResumeDownload = async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    const payload = request.payload as CancelDownloadPayload;
    this.downloadQueue.resume(payload.downloadId);
    this.downloader.resume(payload.downloadId);
    return { success: true };
  };

  /** RETRY_DOWNLOAD: retry a failed/cancelled download by id. */
  private handleRetryDownload = async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    const payload = request.payload as CancelDownloadPayload;
    this.downloader.retry(payload.downloadId);
    this.downloadQueue.retry(payload.downloadId);
    return { success: true };
  };

  /** REMOVE_DOWNLOAD: remove a download item from the queue entirely. */
  private handleRemoveDownload = async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    const payload = request.payload as CancelDownloadPayload;
    // If the item is still active, cancel it first to stop any in-flight work.
    const item = this.downloadQueue.getById(payload.downloadId);
    if (item && (item.status === 'downloading' || item.status === 'converting')) {
      this.downloader.cancel(payload.downloadId);
    }
    this.downloadQueue.remove(payload.downloadId);
    return { success: true };
  };

  /** GET_DOWNLOAD_PROGRESS: return download items for the requested tab. */
  private handleGetDownloadProgress = async (
    request: MessageRequest,
  ): Promise<MessageResponse<DownloadListResponse>> => {
    // Wait for session restore to complete so we don't return empty data
    // during the brief window after SW restart.
    await this.sessionReady;
    const payload = request.payload as GetDownloadProgressPayload | undefined;
    const downloads =
      payload?.tabId !== undefined
        ? this.downloadQueue.getByTab(payload.tabId)
        : this.downloadQueue.getAll();
    return { success: true, data: { downloads } };
  };

  /** GET_SETTINGS: return persisted settings (or defaults). */
  private handleGetSettings = async (): Promise<MessageResponse<Settings>> => {
    const settings = await this.loadSettings();
    return { success: true, data: settings };
  };

  /** UPDATE_SETTINGS: persist settings and apply to the download queue. */
  private handleUpdateSettings = async (
    request: MessageRequest,
  ): Promise<MessageResponse<Settings>> => {
    const payload = request.payload as UpdateSettingsPayload;
    const current = await this.loadSettings();
    const merged: Settings = { ...current, ...payload.settings };

    await this.saveSettings(merged);

    if (payload.settings.concurrentDownloads !== undefined) {
      this.downloadQueue.setMaxConcurrent(payload.settings.concurrentDownloads);
    }
    if (payload.settings.convertToMp4 !== undefined) {
      this.downloader.setConvertMode(payload.settings.convertToMp4);
    }
    if (payload.settings.segmentConcurrency !== undefined) {
      this.downloader.setSegmentConcurrency(payload.settings.segmentConcurrency);
    }
    if (payload.settings.filenameSource !== undefined) {
      this.downloader.setFilenameSource(payload.settings.filenameSource);
    }
    if (
      payload.settings.parallelConversion !== undefined ||
      payload.settings.manualWorkerCount !== undefined
    ) {
      this.downloader.setParallelSettings({
        parallelConversion: merged.parallelConversion,
        manualWorkerCount: merged.manualWorkerCount,
      });
    }
    // parallelFallback is read by the offscreen conversion path when a
    // conversion starts; no immediate side-effect to apply here.

    return { success: true, data: merged };
  };

  /** GET_EXTENSION_STATUS: return the active state. */
  private handleGetExtensionStatus = async (): Promise<
    MessageResponse<{ active: boolean }>
  > => {
    return { success: true, data: { active: this.extensionActive } };
  };

  /** TOGGLE_EXTENSION: toggle, persist, and start/stop the interceptor. */
  private handleToggleExtension = async (): Promise<
    MessageResponse<{ active: boolean }>
  > => {
    this.extensionActive = !this.extensionActive;
    await this.saveExtensionStatus(this.extensionActive);

    if (this.extensionActive) {
      this.networkInterceptor.start();
      void this.updateBadgeForActiveTab();
      // Reload the active tab so the content script re-scans the page with
      // the network interceptor active. Without this, media detected before
      // the extension was disabled stays stale until the next navigation.
      await this.reloadActiveTab();
    } else {
      this.networkInterceptor.stop();
      this.clearBadge();
    }

    return { success: true, data: { active: this.extensionActive } };
  };

  /**
   * UPDATE_SUBTITLE_LANGUAGE: update a subtitle's detected language code in
   * both the mediaMap and the networkInterceptor. The popup's
   * `useSubtitleLanguage` hook detects the language from subtitle content
   * (frequency-based) and sends the resolved ISO 639-1 code here so that the
   * background has the correct language for download filenames.
   */
  private handleUpdateSubtitleLanguage = async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    const payload = request.payload as UpdateSubtitleLanguagePayload;
    if (!payload?.subtitleId || !payload?.language) {
      return { success: false, error: 'Missing subtitleId or language' };
    }

    // Update the networkInterceptor's stored subtitle.
    const existingSub = this.networkInterceptor.getAllSubtitles().find((s) => s.id === payload.subtitleId);
    if (existingSub) {
      this.networkInterceptor.updateSubtitle(payload.subtitleId, {
        ...existingSub,
        language: payload.language,
      });
    }

    // Update the mediaMap if the subtitle is already enqueued.
    const existing = this.mediaMap.get(payload.subtitleId);
    if (existing && (existing.format === 'ass' || existing.format === 'vtt' || existing.format === 'srt')) {
      this.mediaMap.set(payload.subtitleId, {
        ...(existing as DetectedSubtitle),
        language: payload.language,
      });
    }

    // Re-trigger auto-load push: the popup just resolved a subtitle's language
    // (content-based detection). If auto-load was previously skipped because
    // all subtitles were 'unknown', this re-push fires it now that a match is
    // possible. No-op when auto-load is off or still no match (ADR-007 A6).
    if (existingSub) {
      void this.pushAutoLoadSubtitles(existingSub.tabId, this.networkInterceptor.getSubtitles(existingSub.tabId));
    }

    return { success: true };
  };

  /**
   * PAGE_SCAN_RESULT: receive scanned URLs from the content script, convert
   * them to DetectedVideo/DetectedSubtitle, merge with network-interceptor
   * results (deduplicating by URL), and broadcast an update to the popup.
   */
  private handlePageScanResult = async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    const payload = request.payload as PageScanResultPayload;
    const tabId = payload.tabId;

    // Guard against missing tabId
    if (tabId === undefined) {
      console.error('PAGE_SCAN_RESULT received without tabId');
      return { success: false, error: 'Missing tabId in PAGE_SCAN_RESULT payload' };
    }

    const existingVideos = this.networkInterceptor.getVideos(tabId);
    const existingSubtitles = this.networkInterceptor.getSubtitles(tabId);
    const existingVideoUrls = new Set(existingVideos.map((v) => v.url));
    const existingSubtitleUrls = new Set(existingSubtitles.map((s) => s.url));

    const now = Date.now();
    let addedNew = false;

    for (const url of payload.videoUrls) {
      if (existingVideoUrls.has(url)) {
        continue;
      }
      // Detect + inject into the interceptor's store by replaying the request.
      const networkRequest: NetworkRequest = {
        url,
        method: 'GET',
        tabId,
        type: 'media',
        timeStamp: now,
      };
      if (detectVideo(networkRequest)) {
        this.networkInterceptor.handleRequest(
          buildDetails(url, tabId, now),
        );
        addedNew = true;
      }
    }

    for (const url of payload.subtitleUrls) {
      if (existingSubtitleUrls.has(url)) {
        continue;
      }
      const networkRequest: NetworkRequest = {
        url,
        method: 'GET',
        tabId,
        type: 'media',
        timeStamp: now,
      };
      if (detectSubtitle(networkRequest)) {
        this.networkInterceptor.handleRequest(
          buildDetails(url, tabId, now),
        );
        addedNew = true;
      }
    }

    if (addedNew) {
      const videos = this.networkInterceptor.getVideos(tabId);
      const subtitles = this.networkInterceptor.getSubtitles(tabId);
      this.messageBus.broadcast({
        type: MESSAGE_TYPES.DETECTED_MEDIA_UPDATE,
        payload: { videos, subtitles, tabId } satisfies DetectedMediaUpdatePayload,
      });
      this.updateBadgeForTab(tabId);
    }

    // Bilingual subtitle auto-load: push matching subtitles to the
    // content-script (ADR-007 D2). Subtitles may have been detected via
    // network interception before this scan, so check the full set.
    const allSubtitles = this.networkInterceptor.getSubtitles(tabId);
    console.log('[bg PAGE_SCAN_RESULT] subtitles detected', {
      tabId,
      subtitleCount: allSubtitles.length,
      subtitleLanguages: allSubtitles.map((s) => s.language),
    });
    if (allSubtitles.length > 0) {
      void this.pushAutoLoadSubtitles(tabId, allSubtitles);
    }

    return { success: true };
  };

  /**
   * Find subtitles matching the user's overlay target/native languages and
   * push `AUTO_LOAD_SUBTITLES` to the content-script in the given tab.
   * Skipped silently when auto-load is off, no languages set, or no match.
   * Errors (content-script not yet injected) are logged but not re-thrown —
   * the content-script will request a re-push via `REQUEST_AUTO_LOAD_SUBTITLES`
   * once it is ready (ADR-007 D2 race-condition handling).
   */
  private async pushAutoLoadSubtitles(
    tabId: number,
    subtitles: DetectedSubtitle[],
  ): Promise<void> {
    try {
      const settings = await this.loadSettings();
      // ADR-014 D5: read per-site subtitle preference (origin → lang → subIndex).
      // Origin extracted from tab URL hostname. Fallback first-match when no pref.
      let preferences: SubtitlePreference | undefined;
      let tabUrl: string | undefined;
      try {
        const tab = await chrome.tabs.get(tabId);
        tabUrl = tab.url;
      } catch {
        // tab may be gone — skip preference, use first-match
      }
      if (tabUrl && settings.subtitlePreference) {
        const origin = this.extractOrigin(tabUrl);
        const sitePref = settings.subtitlePreference[origin];
        if (sitePref) {
          preferences = {
            target: sitePref[settings.subtitleOverlayTargetLanguage],
            native: sitePref[settings.subtitleOverlayNativeLanguage],
          };
        }
      }
      console.log('[bg pushAutoLoadSubtitles]', {
        tabId,
        autoLoad: settings.subtitleOverlayAutoLoad,
        targetLang: settings.subtitleOverlayTargetLanguage,
        nativeLang: settings.subtitleOverlayNativeLanguage,
        subtitleCount: subtitles.length,
        subtitleLanguages: subtitles.map((s) => s.language),
        preferences,
      });
      let result = findSubtitlesForOverlay(subtitles, settings, preferences);
      console.log('[bg pushAutoLoadSubtitles] result', result);

      // Content-based language resolution fallback (ADR-007 A6): when no match
      // and some subtitles have language='unknown' (URL hash-based filenames
      // like themoviebox's /subtitle/<md5>.srt), fetch each unknown subtitle's
      // content in the SW (cross-origin allowed with host permission), run
      // `detectLanguage` + `labelToIsoCode`, persist via `updateSubtitle`, then
      // re-run `findSubtitlesForOverlay`. Reuses the same pure detection logic
      // as the popup's `useSubtitleLanguage` hook — no new dependency.
      if (!result && subtitles.some((s) => s.language === 'unknown')) {
        console.log('[bg pushAutoLoadSubtitles] resolving unknown languages via content detection');
        const resolved = await this.resolveUnknownSubtitleLanguages(tabId, subtitles);
        if (resolved.length > 0) {
          const refreshed = this.networkInterceptor.getSubtitles(tabId);
          result = findSubtitlesForOverlay(refreshed, settings, preferences);
          console.log('[bg pushAutoLoadSubtitles] result after resolve', {
            resolvedCount: resolved.length,
            result,
          });
        }
      }

      if (!result) return;
      const payload: AutoLoadSubtitlesPayload = {
        tabId,
        target: result.target,
        native: result.native,
        targetMatches: result.targetMatches,
        nativeMatches: result.nativeMatches,
      };
      await chrome.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
        payload,
      });
      console.log('[bg pushAutoLoadSubtitles] sent AUTO_LOAD_SUBTITLES');
    } catch (error) {
      // Content-script may not be injected yet (receiving end does not exist).
      // The content-script will request a re-push on init. Log only language +
      // cue count, never the full URL (ADR-007 D8).
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`AUTO_LOAD_SUBTITLES push failed for tab ${tabId}: ${msg}`);
    }
  }

  /**
   * Extract origin hostname from tab URL for subtitle preference lookup
   * (ADR-014 D5). `new URL(tabUrl).hostname` → e.g. 'themoviebox.org'.
   * Returns '' on invalid URL (preference lookup skipped, first-match fallback).
   */
  private extractOrigin(tabUrl: string): string {
    try {
      return new URL(tabUrl).hostname;
    } catch {
      return '';
    }
  }

  /**
   * Resolve `language: 'unknown'` subtitles by fetching their content in the
   * service worker and running frequency-based language detection. Mutates the
   * networkInterceptor's stored subtitles via `updateSubtitle` so subsequent
   * `findSubtitlesForOverlay` calls see the resolved ISO 639-1 code.
   *
   * Reuses `detectLanguage` + `labelToIsoCode` (same pure functions as the
   * popup's `useSubtitleLanguage` hook). SW fetch is cross-origin allowed with
   * host permission but has no page cookie context — sites requiring cookies
   * for subtitle fetch will fail silently (ponytail V1, ADR-007 A7 ceiling).
   *
   * @returns Array of subtitles that were successfully resolved (for logging).
   */
  private async resolveUnknownSubtitleLanguages(
    tabId: number,
    subtitles: DetectedSubtitle[],
  ): Promise<DetectedSubtitle[]> {
    const unknowns = subtitles.filter((s) => s.language === 'unknown');
    if (unknowns.length === 0) return [];

    const resolved: DetectedSubtitle[] = [];
    const results = await Promise.all(
      unknowns.map(async (sub) => {
        try {
          const response = await fetch(sub.url);
          if (!response.ok) return null;
          const content = await response.text();
          const label = detectLanguage(content, sub.format);
          if (!label) return null;
          const isoCode = labelToIsoCode(label);
          if (!isoCode) return null;
          this.networkInterceptor.updateSubtitle(sub.id, { ...sub, language: isoCode });
          return { ...sub, language: isoCode };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[bg resolveUnknownSubtitleLanguages] fetch failed for sub ${sub.id}: ${msg}`);
          return null;
        }
      }),
    );

    for (const r of results) {
      if (r) resolved.push(r);
    }

    // Persist updated languages to session storage so they survive SW restart
    // and the popup sees the resolved codes immediately.
    if (resolved.length > 0) {
      this.saveSessionMedia(tabId, this.networkInterceptor.getVideos(tabId), this.networkInterceptor.getSubtitles(tabId));
    }

    return resolved;
  }

  /**
   * REQUEST_AUTO_LOAD_SUBTITLES: content-script asks background to re-push
   * AUTO_LOAD_SUBTITLES if subtitles were already detected (handles race:
   * background pushed before content-script was ready). Reads from
   * `chrome.storage.session` (survives SW restart) — not in-memory store.
   */
  private handleRequestAutoLoadSubtitles = async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    const payload = request.payload as RequestAutoLoadSubtitlesPayload;
    const tabId = payload?.tabId;
    console.log('[bg REQUEST_AUTO_LOAD_SUBTITLES]', { tabId });
    if (tabId === undefined) {
      return { success: false, error: 'Missing tabId in REQUEST_AUTO_LOAD_SUBTITLES' };
    }

    try {
      const data = await chrome.storage.session.get(STORAGE_KEYS.SESSION_MEDIA);
      const all = data[STORAGE_KEYS.SESSION_MEDIA] as
        | Record<string, { videos: DetectedVideo[]; subtitles: DetectedSubtitle[] }>
        | undefined;
      const entry = all?.[String(tabId)];
      console.log('[bg REQUEST_AUTO_LOAD_SUBTITLES] session media', {
        tabId,
        hasEntry: !!entry,
        subtitleCount: entry?.subtitles?.length ?? 0,
        subtitleLanguages: entry?.subtitles?.map((s) => s.language),
      });
      if (!entry || entry.subtitles.length === 0) {
        return { success: true };
      }
      await this.pushAutoLoadSubtitles(tabId, entry.subtitles);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`REQUEST_AUTO_LOAD_SUBTITLES failed for tab ${tabId}: ${msg}`);
    }
    return { success: true };
  };

  /**
   * FETCH_SUBTITLE_CONTENT: content-script asks background to fetch a subtitle
   * URL it could not fetch itself (CORS/403). Background resolves relative URLs
   * from `tabUrl` first, then fetches in the SW (cross-origin allowed with host
   * permission, but no page cookie context — ponytail V1, ADR-007 A7).
   * Returns the text content + final resolved URL.
   */
  private handleFetchSubtitleContent = async (
    request: MessageRequest,
  ): Promise<MessageResponse<FetchSubtitleContentResult>> => {
    const payload = request.payload as FetchSubtitleContentPayload;
    const rawUrl = payload?.url;
    if (!rawUrl) {
      return { success: false, error: 'Missing url in FETCH_SUBTITLE_CONTENT' };
    }

    // Resolve relative URL against the page URL (tabUrl) if provided.
    let finalUrl = rawUrl;
    const tabUrl = payload.tabUrl;
    if (tabUrl) {
      try {
        finalUrl = new URL(rawUrl, tabUrl).href;
      } catch {
        // If URL() throws, try the raw URL as-is.
        finalUrl = rawUrl;
      }
    }

    try {
      const response = await fetch(finalUrl);
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      const content = await response.text();
      return { success: true, data: { content, finalUrl } };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Background fetch failed: ${msg}` };
    }
  };

  /**
   * Handle conversion progress updates from the offscreen document.
   *
   * The offscreen ffmpegRunner broadcasts `CONVERSION_PROGRESS_UPDATE` during
   * TS→MP4 conversion. This handler converts it into a `DownloadProgress`
   * update with status `converting` and the conversion detail fields, then
   * broadcasts it to the popup via the standard progress channel.
   */
  private handleConversionProgressUpdate = async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    const payload = request.payload as ConversionProgressUpdatePayload;
    if (!payload?.downloadId) {
      return { success: false, error: 'Missing downloadId in conversion progress' };
    }

    const progress: DownloadProgress = {
      itemId: payload.downloadId,
      status: 'converting',
      progress: payload.percent,
      fileSize: payload.fileSize,
      processedBytes: payload.processedBytes,
      conversionPhase: payload.phase,
      workerCount: payload.workerCount,
      usedWorkers: payload.usedWorkers,
      // Two-phase: download is complete (100%), convert is in progress
      downloadProgress: 100,
      convertProgress: payload.percent,
    };

    // Update the download queue's tracking
    this.downloadQueue.updateProgress(progress);

    // Broadcast to the popup
    const item = this.downloadQueue.getById(payload.downloadId);
    this.messageBus.broadcast({
      type: MESSAGE_TYPES.DOWNLOAD_PROGRESS_UPDATE,
      payload: {
        progress,
        tabId: item?.tabId ?? 0,
      } satisfies DownloadProgressUpdatePayload,
    });

    return { success: true };
  };

  // === Side Panel handlers (ADR-008 D4) ===

  /**
   * OPEN_SIDE_PANEL: content-script asks background to open the side panel
   * for the current tab. Requires Chrome 116+ (`sidePanel.open`).
   * ponytail: sidePanel.open requires user gesture — toggle button click
   * satisfies this (the click happens in the page, message relays the intent).
   */
  private handleOpenSidePanel = async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    const payload = request.payload as OpenSidePanelPayload;
    const tabId = payload?.tabId;
    if (tabId === undefined) {
      return { success: false, error: 'Missing tabId in OPEN_SIDE_PANEL' };
    }
    try {
      await chrome.sidePanel.open({ tabId });
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`OPEN_SIDE_PANEL failed for tab ${tabId}: ${msg}`);
      return { success: false, error: msg };
    }
  };

  /**
   * SUBTITLE_CUES_LOADED: relay bilingual cues from content-script to the
   * side panel. Background broadcasts to all extension pages; the side panel
   * is the only listener for this type. Cues are also cached per-tab so a
   * side panel opened AFTER the relay can request them back via
   * REQUEST_SUBTITLE_CUES (handles the "panel opened late" race).
   */
  private handleSubtitleCuesLoaded = async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    const payload = request.payload as SubtitleCuesLoadedPayload;
    if (!payload?.cues) {
      return { success: false, error: 'Missing cues in SUBTITLE_CUES_LOADED' };
    }
    // Cache per-tab so a late-opening side panel can fetch via REQUEST_SUBTITLE_CUES
    if (payload.tabId !== undefined) {
      this.lastCuesByTab.set(payload.tabId, payload.cues);
    }
    // Relay to side panel ONLY for the active content tab (ADR-011 v3).
    // Background filters at the relay point so the side panel never
    // receives messages from background tabs — eliminating highlight
    // flicker when multiple tabs play simultaneously. SUBTITLE_CUES_LOADED
    // is cached above for all tabs (for REQUEST_SUBTITLE_CUES), but only
    // relayed to the panel for the active tab.
    if (payload.tabId !== undefined && payload.tabId !== this.activeTabIdForPanel) {
      return { success: true };
    }
    try {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
        payload: { tabId: payload.tabId, cues: payload.cues },
      });
    } catch {
      // Side panel may not be open — silently ignore; cues are cached above
    }
    return { success: true };
  };

  /**
   * REQUEST_SUBTITLE_CUES: side panel asks background for the last cached
   * cues for a tab. Used when the panel opens AFTER cues were already
   * relayed (and dropped because no listener was registered yet).
   * Returns `{ success: true, data: { cues } }` — `cues` is `[]` if none
   * cached for the tab yet (panel should then show "No subtitles loaded").
   */
  private handleRequestSubtitleCues = async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    const payload = request.payload as RequestSubtitleCuesPayload;
    const tabId = payload?.tabId;
    if (tabId === undefined) {
      return { success: false, error: 'Missing tabId in REQUEST_SUBTITLE_CUES' };
    }
    const cues = this.lastCuesByTab.get(tabId) ?? [];
    return { success: true, data: { cues } };
  };

  /**
   * VIDEO_TIME_UPDATE: relay current playback time from content-script to
   * the side panel for cue highlight + auto-scroll.
   */
  private handleVideoTimeUpdate = async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    const payload = request.payload as VideoTimeUpdatePayload;
    if (payload?.currentTimeMs === undefined) {
      return { success: false, error: 'Missing currentTimeMs' };
    }
    // Relay to side panel ONLY for the active content tab (ADR-011 v3).
    // Background tab time updates are dropped at the relay point so the
    // panel's currentTimeMs doesn't jump between simultaneously-playing tabs.
    if (payload.tabId !== undefined && payload.tabId !== this.activeTabIdForPanel) {
      return { success: true };
    }
    try {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.VIDEO_TIME_UPDATE,
        payload: {
          tabId: payload.tabId,
          currentTimeMs: payload.currentTimeMs,
          durationMs: payload.durationMs,
        },
      });
    } catch {
      // Side panel may not be open — silently ignore
    }
    return { success: true };
  };

  /**
   * VIDEO_PLAY_STATE: relay play/pause state from content-script to side panel.
   */
  private handleVideoPlayState = async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    const payload = request.payload as VideoPlayStatePayload;
    if (payload?.isPlaying === undefined) {
      return { success: false, error: 'Missing isPlaying' };
    }
    // Relay to side panel ONLY for the active content tab (ADR-011 v3).
    if (payload.tabId !== undefined && payload.tabId !== this.activeTabIdForPanel) {
      return { success: true };
    }
    try {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.VIDEO_PLAY_STATE,
        payload: { tabId: payload.tabId, isPlaying: payload.isPlaying },
      });
    } catch {
      // Side panel may not be open — silently ignore
    }
    return { success: true };
  };

  /**
   * SEEK_TO: side panel asks background to seek the video in the content
   * script of the given tab. Background relays via chrome.tabs.sendMessage.
   */
  private handleSeekTo = async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    const payload = request.payload as SeekToPayload;
    let tabId = payload?.tabId;
    const timeMs = payload?.timeMs;
    if (timeMs === undefined) {
      return { success: false, error: 'Missing timeMs in SEEK_TO' };
    }
    // Side Panel doesn't know tabId — resolve from active tab
    if (tabId === undefined) {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab?.id) {
          return { success: false, error: 'No active tab found for SEEK_TO' };
        }
        tabId = activeTab.id;
      } catch {
        return { success: false, error: 'Failed to query active tab for SEEK_TO' };
      }
    }
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.SEEK_TO,
        payload: { timeMs },
      });
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`SEEK_TO relay failed for tab ${tabId}: ${msg}`);
      return { success: false, error: msg };
    }
  };

  /**
   * TOGGLE_PLAY: side panel asks background to toggle play/pause on the
   * video in the content script of the active tab. Background relays via
   * chrome.tabs.sendMessage. Reuses the SEEK_TO active-tab resolution.
   */
  private handleTogglePlay = async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    let tabId = (request.payload as { tabId?: number })?.tabId;
    if (tabId === undefined) {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab?.id) {
          return { success: false, error: 'No active tab found for TOGGLE_PLAY' };
        }
        tabId = activeTab.id;
      } catch {
        return { success: false, error: 'Failed to query active tab for TOGGLE_PLAY' };
      }
    }
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.TOGGLE_PLAY,
      });
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`TOGGLE_PLAY relay failed for tab ${tabId}: ${msg}`);
      return { success: false, error: msg };
    }
  };

  /**
   * SHORTCUT_ACTION: side panel asks background to trigger a cue navigation
   * shortcut (prev-cue / next-cue / replay-cue) in the content script of
   * the active tab. Reuses the TOGGLE_PLAY active-tab resolution.
   */
  private handleShortcutAction = async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    const payload = request.payload as ShortcutActionPayload;
    const action = payload?.action;
    if (!action || !['prev-cue', 'next-cue', 'replay-cue', 'toggle-overlay'].includes(action)) {
      return { success: false, error: `Invalid shortcut action: ${action}` };
    }
    let tabId = payload?.tabId;
    if (tabId === undefined) {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab?.id) {
          return { success: false, error: 'No active tab found for SHORTCUT_ACTION' };
        }
        tabId = activeTab.id;
      } catch {
        return { success: false, error: 'Failed to query active tab for SHORTCUT_ACTION' };
      }
    }
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.SHORTCUT_ACTION,
        payload: { action },
      });
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`SHORTCUT_ACTION relay failed for tab ${tabId}: ${msg}`);
      return { success: false, error: msg };
    }
  };

  /**
   * VIDEO_EPISODE_CHANGED: the content-script detected an in-page episode/movie
   * switch — the active `<video>` element was REPLACED by a new one (SPAs like
   * themoviebox.org swap the entire element on episode switch; quality switches
   * keep the same element so they do not trigger this). This happens without
   * any tab-level navigation event, so `chrome.tabs.onUpdated` never fires and
   * the normal navigation clear in `onTabUpdated` cannot run. Clear the tab's
   * detected media so the new episode starts fresh instead of accumulating
   * media from the previous episode. Reuses the same clear methods as
   * `onTabRemoved` / `onTabUpdated` loading — no new clear logic.
   *
   * Downloads are intentionally NOT cleared: an in-progress download of the
   * previous episode should not be aborted just because the user switched
   * episodes in the player. Only the detected-media list (popup/side panel) is
   * reset.
   */
  private handleVideoEpisodeChanged = async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    const payload = request.payload as VideoEpisodeChangedPayload;
    const tabId = payload?.tabId;
    if (tabId === undefined) {
      return { success: false, error: 'Missing tabId in VIDEO_EPISODE_CHANGED payload' };
    }
    this.networkInterceptor.clearTab(tabId);
    this.clearSessionMedia(tabId);
    this.lastCuesByTab.delete(tabId);
    this.autoDownloadedTabs.delete(tabId);
    this.updateBadgeForTab(tabId);
    console.log('[bg VIDEO_EPISODE_CHANGED] cleared media for tab', tabId);
    return { success: true };
  };

  /**
   * DETECTED_SUBTITLE_URL: the main-world fetch interceptor caught a subtitle
   * fetch that `chrome.webRequest` missed (page Service Worker served it from
   * cache → webRequest did not fire). The content-script relayed the URL here.
   * Run it through the same `detectSubtitle` detector as the webRequest path
   * and store it in the network interceptor's subtitle map (dedup by URL).
   * Reuses `onMediaDetected` notification by calling `handleRequest` with a
   * synthetic webRequest-shaped object — no new storage logic.
   *
   * ponytail: reuses detectSubtitle + networkInterceptor.handleRequest (which
   * dedups + notifies listeners). No parallel subtitle store. Ceiling: only
   * `fetch` is patched in main world — XHR-based subtitle fetches still missed.
   */
  private handleDetectedSubtitleUrl = (
    request: MessageRequest,
  ): MessageResponse => {
    const payload = request.payload as DetectedSubtitleUrlPayload;
    const tabId = payload.tabId;
    if (!tabId || !payload.url) {
      return { success: false, error: 'Missing tabId or url' };
    }

    // Build a synthetic OnBeforeRequestDetails so handleRequest can run the
    // same detectSubtitle + dedup + notify path as real webRequest events.
    const syntheticDetails = {
      url: payload.url,
      method: 'GET',
      tabId,
      type: 'xmlhttprequest' as chrome.webRequest.ResourceType,
      timeStamp: Date.now(),
      // initiator omitted — handleRequest's extension-request filter checks
      // initiator.startsWith('chrome-extension://'); undefined passes.
    } as chrome.webRequest.OnBeforeRequestDetails;

    this.networkInterceptor.handleRequest(syntheticDetails);
    return { success: true };
  };
}

/**
 * Extract a base filename (without extension) from a URL path.
 */
function extractBaseName(url: string): string {
  try {
    const path = new URL(url).pathname;
    const file = path.slice(path.lastIndexOf('/') + 1);
    const dot = file.lastIndexOf('.');
    return dot > 0 ? file.slice(0, dot) : file;
  } catch {
    return 'subtitle';
  }
}

/**
 * Build a `chrome.webRequest.OnBeforeRequestDetails`-like object so a scanned
 * URL can be replayed through `NetworkInterceptor.handleRequest`.
 */
function buildDetails(
  url: string,
  tabId: number,
  timeStamp: number,
): chrome.webRequest.OnBeforeRequestDetails {
  return {
    url,
    method: 'GET',
    tabId,
    type: 'media',
    timeStamp,
    documentLifecycle: 'active',
    frameId: 0,
    frameType: 'outermost_frame',
    parentFrameId: -1,
    requestId: `scan-${tabId}-${url}`,
  } as chrome.webRequest.OnBeforeRequestDetails;
}

// --- module-level singleton ---

let backgroundService: BackgroundService | null = null;

/**
 * Initialise the background service worker singleton. Called on service-worker
 * startup. Safe to call multiple times — subsequent calls are no-ops.
 */
export async function initBackground(): Promise<BackgroundService> {
  if (backgroundService) {
    return backgroundService;
  }
  backgroundService = new BackgroundService();
  await backgroundService.init();
  return backgroundService;
}

/**
 * Get the current background service instance (or `null` if not yet
 * initialised).
 */
export function getBackgroundService(): BackgroundService | null {
  return backgroundService;
}

/**
 * Reset the singleton. Intended for unit-test isolation.
 */
export function resetBackgroundService(): void {
  if (backgroundService) {
    backgroundService.stop();
    backgroundService = null;
  }
}

// --- auto-initialise on service worker startup ---

// Service workers in MV3 can be terminated and restarted at any time.
// This top-level call ensures the background service is (re)initialised
// every time the service worker wakes up.
// Guard against running in non-extension environments (e.g. Jest tests).
if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
  initBackground().catch((err) => {
    console.error('[Video Downloader] Failed to initialise background service:', err);
  });
}
