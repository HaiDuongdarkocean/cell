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
import { Downloader, type ConvertResult } from './downloader';
import { OffscreenManager } from './offscreenManager';
import { MESSAGE_TYPES } from '@/constants/messages';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/constants/config';
import { cleanupOrphanedDownloads } from '@/lib/storage/opfsStorage';
import { detectVideo } from '@/lib/detectors/videoDetector';
import { detectSubtitle } from '@/lib/detectors/subtitleDetector';
import type {
  DetectedVideo,
  DetectedSubtitle,
  DownloadItem,
  DownloadProgress,
  Settings,
  NetworkRequest,
  MediaType,
} from '@/types/media';
import type {
  MessageRequest,
  MessageResponse,
  MessageHandler,
  GetDetectedMediaPayload,
  DetectedMediaUpdatePayload,
  DownloadVideoPayload,
  DownloadSubtitlePayload,
  DownloadAllPayload,
  CancelDownloadPayload,
  DownloadProgressUpdatePayload,
  UpdateSettingsPayload,
  PageScanResultPayload,
  DownloadListResponse,
  ConvertTsToMp4V2Payload,
  ConvertTsToMp4V2ResultPayload,
  CreateOpfsBlobUrlPayload,
  CreateOpfsBlobUrlResultPayload,
  RevokeOpfsBlobUrlPayload,
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

  /** Unsubscribe functions for event subscriptions. */
  private unsubscribers: Array<() => void> = [];

  /** Cached active-state flag mirrored from storage. */
  private extensionActive = true;

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

    // 2. Load persisted settings and apply to the download queue.
    const settings = await this.loadSettings();
    this.downloadQueue.setMaxConcurrent(settings.concurrentDownloads);
    this.downloader.setConvertMode(settings.convertToMp4);

    // 3. Load persisted extension active state.
    const status = await this.loadExtensionStatus();
    this.extensionActive = status;

    // 4. Wire event streams (network → broadcast, queue → broadcast, etc.)
    this.wireEvents();

    // 5. Start the network interceptor if the extension is active.
    if (this.extensionActive) {
      this.networkInterceptor.start();
    }

    // 6. Clean up orphaned OPFS temp files from crashed sessions.
    void cleanupOrphanedDownloads().catch((err: unknown) => {
      console.warn('[background] OPFS orphan cleanup failed:', err);
    });
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
    // New media detected via network interception → notify popup.
    const unsubMedia = this.networkInterceptor.onMediaDetected(
      (videos, subtitles) => {
        this.messageBus.broadcast({
          type: MESSAGE_TYPES.DETECTED_MEDIA_UPDATE,
          payload: { videos, subtitles } satisfies DetectedMediaUpdatePayload,
        });
      },
    );

    // Download progress changes → notify popup.
    const unsubProgress = this.downloadQueue.onProgress((progress) => {
      this.messageBus.broadcast({
        type: MESSAGE_TYPES.DOWNLOAD_PROGRESS_UPDATE,
        payload: { progress } satisfies DownloadProgressUpdatePayload,
      });
    });

    // Downloader progress → queue progress tracking.
    this.downloader.onProgress((progress: DownloadProgress) => {
      this.downloadQueue.updateProgress(progress);
    });

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

        const request: MessageRequest = {
          type: MESSAGE_TYPES.CONVERT_TS_TO_MP4_V2,
          payload: { downloadId } satisfies ConvertTsToMp4V2Payload,
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
          await this.downloader.downloadSubtitle(
            media as DetectedSubtitle,
            item.id,
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
    this.on(MESSAGE_TYPES.GET_DOWNLOAD_PROGRESS, this.handleGetDownloadProgress);
    this.on(MESSAGE_TYPES.GET_SETTINGS, this.handleGetSettings);
    this.on(MESSAGE_TYPES.UPDATE_SETTINGS, this.handleUpdateSettings);
    this.on(MESSAGE_TYPES.GET_EXTENSION_STATUS, this.handleGetExtensionStatus);
    this.on(MESSAGE_TYPES.TOGGLE_EXTENSION, this.handleToggleExtension);
    this.on(MESSAGE_TYPES.PAGE_SCAN_RESULT, this.handlePageScanResult);
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
    // Query the last focused window (the browser window, not the popup window).
    // Using lastFocusedWindow instead of currentWindow because when the popup
    // is open, currentWindow refers to the popup's window, not the browser.
    const tabs = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    return tabs[0]?.id;
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

    return {
      id,
      mediaType,
      url: media.url,
      title,
      status: 'queued',
      progress: 0,
      videoId: mediaType === 'video' ? (media as DetectedVideo).id : undefined,
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

  // --- message handlers ---

  /** GET_DETECTED_MEDIA: return videos + subtitles for the active tab. */
  private handleGetDetectedMedia = async (
    request: MessageRequest,
  ): Promise<MessageResponse<DetectedMediaUpdatePayload>> => {
    const payload = request.payload as GetDetectedMediaPayload | undefined;
    const tabId = payload?.tabId ?? (await this.getActiveTabId());

    let videos: DetectedVideo[];
    let subtitles: DetectedSubtitle[];

    if (tabId !== undefined) {
      ({ videos, subtitles } = this.networkInterceptor.getMedia(tabId));
    } else {
      videos = [];
      subtitles = [];
    }

    // If the active-tab lookup returned nothing, fall back to all detected
    // media across all tabs. This handles the case where the popup is opened
    // while the browser window does not have a focused tab (e.g. in automated
    // tests or when the popup HTML is navigated to directly).
    if (videos.length === 0 && subtitles.length === 0) {
      videos = this.networkInterceptor.getAllVideos();
      subtitles = this.networkInterceptor.getAllSubtitles();
    }

    return { success: true, data: { videos, subtitles } };
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
    this.downloadQueue.pause(payload.downloadId);
    return { success: true };
  };

  /** RESUME_DOWNLOAD: resume a paused download by id. */
  private handleResumeDownload = async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    const payload = request.payload as CancelDownloadPayload;
    this.downloadQueue.resume(payload.downloadId);
    return { success: true };
  };

  /** GET_DOWNLOAD_PROGRESS: return all download items. */
  private handleGetDownloadProgress = async (): Promise<
    MessageResponse<DownloadListResponse>
  > => {
    return { success: true, data: { downloads: this.downloadQueue.getAll() } };
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
    // parallelConversion / manualWorkerCount / parallelFallback are read by
    // the offscreen conversion path when a conversion starts; no immediate
    // side-effect to apply here.

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
    } else {
      this.networkInterceptor.stop();
    }

    return { success: true, data: { active: this.extensionActive } };
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
        payload: { videos, subtitles } satisfies DetectedMediaUpdatePayload,
      });
    }

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
