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
import { Downloader } from './downloader';
import { OffscreenManager } from './offscreenManager';
import { MESSAGE_TYPES } from '@/constants/messages';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/constants/config';
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
  ConvertTsToMp4Payload,
  ConvertTsToMp4ResultPayload,
  PageScanResultPayload,
  DownloadListResponse,
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
   * Initialise the background service: load persisted settings, wire event
   * streams, register all message handlers, and start listeners.
   */
  async init(): Promise<void> {
    // 1. Load persisted settings and apply to the download queue.
    const settings = await this.loadSettings();
    this.downloadQueue.setMaxConcurrent(settings.concurrentDownloads);

    // 2. Load persisted extension active state.
    const status = await this.loadExtensionStatus();
    this.extensionActive = status;

    // 3. Wire event streams.
    this.wireEvents();

    // 4. Register all message handlers.
    this.registerHandlers();

    // 5. Start listeners.
    if (this.extensionActive) {
      this.networkInterceptor.start();
    }
    this.messageBus.start();
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

    // Convert callback → offscreen ffmpeg.
    this.downloader.setConvertCallback(
      async (segments: ArrayBuffer[], downloadId: string): Promise<ArrayBuffer> => {
        await this.offscreenManager.ensureOffscreenDocument();

        const request: MessageRequest = {
          type: MESSAGE_TYPES.CONVERT_TS_TO_MP4,
          payload: { segments, downloadId } satisfies ConvertTsToMp4Payload,
        };

        const response = (await chrome.runtime.sendMessage(
          request,
        )) as MessageResponse<ConvertTsToMp4ResultPayload>;

        if (!response.success || !response.data) {
          throw new Error(response.error ?? 'ffmpeg conversion failed');
        }

        return response.data.mp4Data;
      },
    );

    // Set the queue executor: dispatches each item to the downloader.
    this.downloadQueue.setExecutor(async (item: DownloadItem) => {
      const media = this.mediaMap.get(item.id);
      if (!media) {
        throw new Error(`No media found for download ${item.id}`);
      }

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
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
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
    // The interceptor stores videos keyed by id; getVideos filters by tabId.
    // We cannot enumerate tab ids directly, so return empty as a fallback —
    // the active-tab path above handles the common case.
    return [];
  }

  private findAllSubtitles(): DetectedSubtitle[] {
    return [];
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
    const stored = result[STORAGE_KEYS.SETTINGS] as Settings | undefined;
    return stored ?? DEFAULT_SETTINGS;
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

    if (tabId === undefined) {
      return { success: false, error: 'No active tab found' };
    }

    const { videos, subtitles } = this.networkInterceptor.getMedia(tabId);
    return { success: true, data: { videos, subtitles } };
  };

  /** DOWNLOAD_VIDEO: create a download item for the requested video. */
  private handleDownloadVideo = async (
    request: MessageRequest,
  ): Promise<MessageResponse<{ downloadId: string }>> => {
    const payload = request.payload as DownloadVideoPayload;
    const video = await this.findVideoById(payload.videoId);

    if (!video) {
      return { success: false, error: `Video not found: ${payload.videoId}` };
    }

    const item = this.createDownloadItem(video, 'video');
    this.downloadQueue.add(item);

    return { success: true, data: { downloadId: item.id } };
  };

  /** DOWNLOAD_SUBTITLE: create a download item for the requested subtitle. */
  private handleDownloadSubtitle = async (
    request: MessageRequest,
  ): Promise<MessageResponse<{ downloadId: string }>> => {
    const payload = request.payload as DownloadSubtitlePayload;
    const subtitle = await this.findSubtitleById(payload.subtitleId);

    if (!subtitle) {
      return {
        success: false,
        error: `Subtitle not found: ${payload.subtitleId}`,
      };
    }

    const item = this.createDownloadItem(subtitle, 'subtitle');
    this.downloadQueue.add(item);

    return { success: true, data: { downloadId: item.id } };
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
