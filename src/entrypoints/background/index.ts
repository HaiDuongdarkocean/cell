/**
 * Background service worker entry point — thin orchestrator.
 *
 * Wires together all building blocks:
 *  - NetworkInterceptor  (chrome.webRequest media detection)
 *  - MessageBus          (chrome.runtime messaging)
 *  - DownloadQueue       (concurrent download scheduling)
 *  - Downloader          (fetch → merge → convert → save)
 *  - OffscreenManager    (ffmpeg.wasm offscreen document lifecycle)
 *
 * Message handlers are extracted into `handlers/<feature>.ts` files.
 * Event wiring is in `wireEvents.ts`.
 * Helper functions are in `helpers.ts`.
 * Shared state + building blocks are exposed via {@link BackgroundContext}.
 */

import { NetworkInterceptor } from './networkInterceptor';
import { MessageBus } from './messageBus';
import { DownloadQueue } from '@/features/download';
import { Downloader } from '@/features/download';
import { OffscreenManager } from './offscreenManager';
import { cleanupOrphanedDownloads } from '@/shared/lib/storage/opfsStorage';
import {
  queryTabs,
  onStartup,
  onInstalled,
  getExtensionId,
} from '@/shared/lib/chrome-apis';
import type { BackgroundContext } from './context';
import {
  loadSettings,
  loadExtensionStatus,
  performSessionRestore,
  updateBadgeForActiveTab,
  clearBadge,
  getActiveTabId,
  reloadActiveTab,
  updateBadgeForTab,
  enrichVideo,
  enrichM3u8Variants,
  findVideoById,
  findSubtitleById,
  findAllVideos,
  findAllSubtitles,
  createDownloadItem,
  saveSettings,
  saveExtensionStatus,
  saveSessionMedia,
  loadSessionMedia,
  clearSessionMedia,
  saveSessionDownloads,
  loadSessionDownloads,
  clearSessionDownloads,
  pushAutoLoadSubtitles,
  resolveUnknownSubtitleLanguages,
  extractOrigin,
  maybeAutoDownload,
} from './helpers';
import { wireEvents } from './wireEvents';
import { registerDownloadHandlers } from './handlers/download';
import { registerMediaDetectionHandlers } from './handlers/mediaDetection';
import { registerSubtitleHandlers } from './handlers/subtitle';
import { registerSettingsHandlers } from './handlers/settings';
import { registerSidePanelRelayHandlers } from './handlers/sidePanelRelay';
import { registerYouTubeFallbackHandlers } from './handlers/youtubeDetection';
import { registerDetectionDispatchHandlers } from './handlers/detectionDispatch';
import { registerTranslateHandlers } from './handlers/translate';
import { registerCardCreatorHandlers } from './handlers/cardCreator';
import { registerLookupHandlers } from './handlers/lookup';
import { registerWordStatusHandlers } from './handlers/wordStatus';
import { registerFrequencyHandlers } from './handlers/frequency';
import { registerTtsHandlers } from './handlers/tts';
import { registerTtsFetchAudioHandlers } from './handlers/ttsFetchAudio';
import { registerForvoAudioHandlers } from './handlers/forvoAudio';
import { registerImageSearchHandlers } from './handlers/images';
import { registerFetchMediaUrlHandlers } from './handlers/fetchMediaUrl';
import { registerScreenshotHandlers } from './handlers/screenshot';
import { seedDevDataIfEmpty } from '@/features/dictionary/logic/devSeed';
import type { MessageHandler } from '@/entities/message';
import type {
  DetectedVideo,
  DetectedSubtitle,
  DownloadItem,
  Settings,
  MediaType,
  BilingualCue,
} from '@/entities/media';

/** Optional dependency overrides (used for testing). */
export interface BackgroundServiceOptions {
  readonly networkInterceptor?: NetworkInterceptor;
  readonly messageBus?: MessageBus;
  readonly downloadQueue?: DownloadQueue;
  readonly downloader?: Downloader;
  readonly offscreenManager?: OffscreenManager;
}

/**
 * Orchestrates the background service worker. Holds shared state + building
 * blocks, delegates message handling to `handlers/*` modules, and event
 * wiring to `wireEvents.ts`. Implements {@link BackgroundContext} so handler
 * modules can access state + helpers via `this`.
 */
export class BackgroundService implements BackgroundContext {
  readonly networkInterceptor: NetworkInterceptor;
  readonly messageBus: MessageBus;
  readonly downloadQueue: DownloadQueue;
  readonly downloader: Downloader;
  readonly offscreenManager: OffscreenManager;

  readonly mediaMap: Map<string, DetectedVideo | DetectedSubtitle> = new Map();
  readonly autoDownloadedTabs: Map<number, {
    url: string;
    enqueuedIds: Set<string>;
  }> = new Map();
  readonly lastCuesByTab: Map<number, BilingualCue[]> = new Map();
  activeTabIdForPanel: number | undefined = undefined;
  extensionActive = true;
  sessionReady: Promise<void> = Promise.resolve();

  /**
   * Set to `true` by {@link stop} when the singleton is reset (e.g. by
   * `onInstalled('update')` while `init()` is still running). `init()` checks
   * this flag after each await and aborts early — preventing a stale instance
   * from registering webRequest/event listeners that would shadow the fresh
   * singleton. Without this guard, media detected by the stale listener lands
   * in the stale instance's Map, invisible to the popup → "Video not found".
   */
  private aborted = false;

  private unsubscribers: Array<() => void> = [];

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
    this.registerHandlers();
    this.messageBus.start();

    // 1b. Start session restore IMMEDIATELY (before any await)
    this.sessionReady = performSessionRestore(this);

    // 2. Load persisted settings and apply to the download queue.
    const settings = await loadSettings();
    if (this.aborted) return; // reset by onInstalled('update') during await
    this.downloadQueue.setMaxConcurrent(settings.concurrentDownloads);
    this.downloader.setConvertMode(settings.convertToMp4);
    this.downloader.setSegmentConcurrency(settings.segmentConcurrency);
    this.downloader.setFilenameSource(settings.filenameSource);
    this.downloader.setParallelSettings({
      parallelConversion: settings.parallelConversion,
      manualWorkerCount: settings.manualWorkerCount,
    });

    // 3. Load persisted extension active state.
    this.extensionActive = await loadExtensionStatus();
    if (this.aborted) return; // reset by onInstalled('update') during await

    // 4. Wire event streams (network → broadcast, queue → broadcast, etc.)
    this.unsubscribers = wireEvents(this);

    // 4b. Wait for session restore to complete.
    await this.sessionReady;
    if (this.aborted) return; // reset by onInstalled('update') during await

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
      void updateBadgeForActiveTab(this);
    } else {
      clearBadge(this);
    }

    // 8. Resolve the initial active content tab for side-panel relay filtering.
    try {
      const tabs = await queryTabs({ active: true });
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

  /** Tear down the background service: stop listeners and unsubscribe events. */
  stop(): void {
    // Mark as aborted so an in-flight init() (e.g. reset by onInstalled('update')
    // while still awaiting settings) bails out before registering listeners.
    this.aborted = true;
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.networkInterceptor.stop();
    this.messageBus.stop();
  }

  // --- handler registration ---

  private registerHandlers(): void {
    registerDownloadHandlers(this);
    registerMediaDetectionHandlers(this);
    registerSubtitleHandlers(this);
    registerSettingsHandlers(this);
    registerSidePanelRelayHandlers(this);
    registerDetectionDispatchHandlers(this);
    registerYouTubeFallbackHandlers(this);
    registerTranslateHandlers(this);
    registerCardCreatorHandlers(this);
    registerLookupHandlers(this);
    registerWordStatusHandlers(this);
    registerFrequencyHandlers(this);
    registerTtsHandlers(this);
    registerTtsFetchAudioHandlers(this);
    registerForvoAudioHandlers(this);
    registerImageSearchHandlers(this);
    registerFetchMediaUrlHandlers(this);
    registerScreenshotHandlers(this);
  }

  /** Type-safe wrapper around messageBus.on. */
  on(type: string, handler: MessageHandler): void {
    this.messageBus.on(type as never, handler);
  }

  // --- context helpers (delegate to helpers.ts) ---

  getActiveTabId() { return getActiveTabId(this); }
  reloadActiveTab() { return reloadActiveTab(this); }
  updateBadgeForTab(tabId: number) { return updateBadgeForTab(this, tabId); }
  updateBadgeForActiveTab() { return updateBadgeForActiveTab(this); }
  clearBadge() { return clearBadge(this); }
  enrichVideo(video: DetectedVideo) { return enrichVideo(this, video); }
  enrichM3u8Variants(video: DetectedVideo) { return enrichM3u8Variants(this, video); }
  findVideoById(videoId: string) { return findVideoById(this, videoId); }
  findSubtitleById(subtitleId: string) { return findSubtitleById(this, subtitleId); }
  findAllVideos() { return findAllVideos(this); }
  findAllSubtitles() { return findAllSubtitles(this); }
  createDownloadItem(media: DetectedVideo | DetectedSubtitle, mediaType: MediaType): DownloadItem {
    return createDownloadItem(this, media, mediaType);
  }
  loadSettings() { return loadSettings(); }
  saveSettings(settings: Settings) { return saveSettings(this, settings); }
  loadExtensionStatus() { return loadExtensionStatus(); }
  saveExtensionStatus(active: boolean) { return saveExtensionStatus(this, active); }
  performSessionRestore() { return performSessionRestore(this); }
  saveSessionMedia(tabId: number, videos: DetectedVideo[], subtitles: DetectedSubtitle[]) {
    return saveSessionMedia(this, tabId, videos, subtitles);
  }
  loadSessionMedia() { return loadSessionMedia(this); }
  clearSessionMedia(tabId: number) { return clearSessionMedia(this, tabId); }
  saveSessionDownloads(tabId: number) { return saveSessionDownloads(this, tabId); }
  loadSessionDownloads() { return loadSessionDownloads(this); }
  clearSessionDownloads(tabId: number) { return clearSessionDownloads(this, tabId); }
  pushAutoLoadSubtitles(tabId: number, subtitles: DetectedSubtitle[]) {
    return pushAutoLoadSubtitles(this, tabId, subtitles);
  }
  resolveUnknownSubtitleLanguages(tabId: number, subtitles: DetectedSubtitle[]) {
    return resolveUnknownSubtitleLanguages(this, tabId, subtitles);
  }
  extractOrigin(tabUrl: string) { return extractOrigin(this, tabUrl); }
  maybeAutoDownload(tabId: number) { return maybeAutoDownload(this, tabId); }
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

// --- lifecycle: onStartup / onInstalled rehydration (M16, ADR-017 D3, spec C3) ---

// Service workers in MV3 can be terminated and restarted at any time.
// The top-level `initBackground()` call below ensures the background service
// is (re)initialised every time the service worker wakes up. The two lifecycle
// listeners below cover the remaining cases:
//
// - `chrome.runtime.onStartup` — fires when the browser starts (before any
//   tabs/pages). Ensures the SW is alive and state is rehydrated from
//   `chrome.storage.session` immediately, not lazily on first message.
// - `chrome.runtime.onInstalled` — fires on install/update. On update, the
//   singleton is reset first so any stale in-memory state from the previous
//   version is discarded, then re-initialised fresh from session storage.
//
// Both handlers are idempotent: `initBackground()` no-ops if already running.
// Guard against running in non-extension environments (e.g. Jest tests).
if (typeof chrome !== 'undefined' && getExtensionId()) {
  // Browser startup — rehydrate state from session storage immediately.
  onStartup(() => {
    initBackground().catch((err) => {
      console.error('[Video Downloader] onStartup init failed:', err);
    });
  });

  // Extension install/update — reset + fresh init (discard stale state on update).
  onInstalled((details) => {
    if (details.reason === 'update') {
      // On update: reset singleton so stale state from the previous version
      // is discarded, then re-init fresh from session storage.
      resetBackgroundService();
    }
    // On install: fresh init (no persisted state yet — session storage is empty).
    initBackground().catch((err) => {
      console.error('[Video Downloader] onInstalled init failed:', err);
    });
    // Auto-seed: import default dictionary + frequency data if DB empty.
    // Fire-and-forget — never blocks SW init. Runs in both dev and production.
    void seedDevDataIfEmpty('en');
  });

  // Top-level: (re)initialise on every SW wake-up (idle eviction restart).
  initBackground().catch((err) => {
    console.error('[Video Downloader] Failed to initialise background service:', err);
  });
}
