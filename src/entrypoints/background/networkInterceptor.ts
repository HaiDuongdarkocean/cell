import { detectVideo } from '@/features/detection';
import { detectSubtitle } from '@/features/detection';
import {
  addOnBeforeRequestListener,
  type WebRequestListener,
} from '@/shared/lib/chrome-apis';
import type { DetectedVideo, DetectedSubtitle, NetworkRequest } from '@/entities/media';

/**
 * Callback invoked whenever new media (video and/or subtitle) is detected from
 * a captured network request. Receives the full current set of detected videos
 * and subtitles for the tab that produced the request.
 */
export type MediaDetectedCallback = (
  videos: DetectedVideo[],
  subtitles: DetectedSubtitle[],
) => void;

/**
 * Wraps `chrome.webRequest.onBeforeRequest` to detect downloadable video and
 * subtitle URLs. Detected media is stored per-tab in memory and interested
 * subscribers are notified whenever a new detection occurs.
 *
 * The class is designed so that the core detection logic (`handleRequest`) is
 * independent of the Chrome API, making it straightforward to unit-test.
 */
export class NetworkInterceptor {
  private readonly videos: Map<string, DetectedVideo> = new Map();
  private readonly subtitles: Map<string, DetectedSubtitle> = new Map();
  private readonly listeners: Set<MediaDetectedCallback> = new Set();

  /** Bound listener reference so it can be removed cleanly in `stop()`. */
  private boundListener:
    | ((details: chrome.webRequest.OnBeforeRequestDetails) => chrome.webRequest.BlockingResponse | undefined)
    | null = null;

  /** Unsubscribe function returned by the webRequest adapter. */
  private unsubscribe: (() => void) | null = null;

  /**
   * Start listening to `chrome.webRequest.onBeforeRequest` for all URLs.
   * Each captured request is forwarded to {@link handleRequest}.
   */
  start(): void {
    if (this.boundListener !== null) {
      return;
    }

    this.boundListener = (
      details: chrome.webRequest.OnBeforeRequestDetails,
    ): chrome.webRequest.BlockingResponse | undefined => {
      this.handleRequest(details);
      return undefined;
    };

    const filter: chrome.webRequest.RequestFilter = {
      urls: ['<all_urls>'],
    };

    this.unsubscribe = addOnBeforeRequestListener(this.boundListener as WebRequestListener, filter);
  }

  /**
   * Stop listening to `chrome.webRequest.onBeforeRequest`. Safe to call even
   * when no listener is currently registered.
   */
  stop(): void {
    if (this.boundListener === null) {
      return;
    }

    this.unsubscribe?.();
    this.unsubscribe = null;
    this.boundListener = null;
  }

  /**
   * Handle a single web request. Converts the Chrome details object into a
   * {@link NetworkRequest}, runs the video and subtitle detectors, and stores
   * any positive detections. When new media is stored, all registered
   * listeners are notified with the current per-tab media set.
   *
   * Extracted as a public method so it can be exercised directly in tests
   * without needing a real `chrome.webRequest` implementation.
   */
  handleRequest(details: chrome.webRequest.OnBeforeRequestDetails): void {
    // Ignore requests initiated by the extension itself (background service
    // worker, offscreen documents, etc.). Without this filter, a `fetch()` call
    // made by the downloader to retrieve a subtitle would be re-detected as a new
    // subtitle, causing duplicate entries in the popup.
    const isExtensionRequest =
      details.tabId === -1 ||
      (details.initiator !== undefined &&
        details.initiator.startsWith('chrome-extension://'));

    if (isExtensionRequest) {
      return;
    }

    const request: NetworkRequest = {
      url: details.url,
      method: details.method,
      tabId: details.tabId,
      type: details.type,
      timeStamp: details.timeStamp,
      initiator: details.initiator,
    };

    const video = detectVideo(request);
    const subtitle = detectSubtitle(request);

    // Debug logging for media detection
    if (video || subtitle) {
      console.log('[NetworkInterceptor] Detected media:', {
        tabId: details.tabId,
        video: video ? { id: video.id, format: video.format, url: video.url } : null,
        subtitle: subtitle ? { id: subtitle.id, format: subtitle.format, language: subtitle.language, url: subtitle.url } : null,
      });
    }

    let detectedNewMedia = false;

    if (video !== null) {
      // Deduplicate by URL+tabId: if a video with the same URL already exists
      // for this tab, skip it. Without this, every page reload or repeated
      // request to the same m3u8 URL creates a new entry (with a new UUID),
      // causing unbounded accumulation of duplicate media in the popup.
      const existing = this.getVideos(details.tabId).find(
        (v) => v.url === video.url,
      );
      if (existing === undefined) {
        this.videos.set(video.id, video);
        detectedNewMedia = true;
      }
    }

    if (subtitle !== null) {
      // Same dedup for subtitles: skip if the same URL is already stored.
      const existingSub = this.getSubtitles(details.tabId).find(
        (s) => s.url === subtitle.url,
      );
      if (existingSub === undefined) {
        this.subtitles.set(subtitle.id, subtitle);
        detectedNewMedia = true;
      }
    }

    if (detectedNewMedia) {
      this.notifyListeners(details.tabId);
    }
  }

  /**
   * Get all detected videos for a tab.
   */
  getVideos(tabId: number): DetectedVideo[] {
    return [...this.videos.values()].filter((video) => video.tabId === tabId);
  }

  /**
   * Update a stored video in-place (e.g. to enrich it with the real tab URL
   * and page title after detection). No-op if the video id is not known.
   */
  updateVideo(id: string, updated: DetectedVideo): void {
    if (this.videos.has(id)) {
      this.videos.set(id, updated);
    }
  }

  /**
   * Update a stored subtitle in-place. No-op if the subtitle id is not known.
   */
  updateSubtitle(id: string, updated: DetectedSubtitle): void {
    if (this.subtitles.has(id)) {
      this.subtitles.set(id, updated);
    }
  }

  /**
   * Notify media listeners for a tab (fires onMediaDetected callbacks).
   * Used by callers that batch-update subtitles (e.g.
   * resolveUnknownSubtitleLanguages) so they can update silently via
   * updateSubtitle then fire a single notification after all updates land —
   * avoiding premature pushAutoLoadSubtitles runs that see partial state.
   */
  notifyMediaListeners(tabId: number): void {
    this.notifyListeners(tabId);
  }

  /**
   * Get all detected subtitles for a tab.
   */
  getSubtitles(tabId: number): DetectedSubtitle[] {
    return [...this.subtitles.values()].filter((subtitle) => subtitle.tabId === tabId);
  }

  /**
   * Get all detected media (videos and subtitles) for a tab.
   */
  getMedia(tabId: number): { videos: DetectedVideo[]; subtitles: DetectedSubtitle[] } {
    return {
      videos: this.getVideos(tabId),
      subtitles: this.getSubtitles(tabId),
    };
  }

  /**
   * Get ALL detected videos across every tab.
   */
  getAllVideos(): DetectedVideo[] {
    return [...this.videos.values()];
  }

  /**
   * Get ALL detected subtitles across every tab.
   */
  getAllSubtitles(): DetectedSubtitle[] {
    return [...this.subtitles.values()];
  }

  /**
   * Clear all detected media for a tab.
   */
  clearTab(tabId: number): void {
    for (const [id, video] of this.videos) {
      if (video.tabId === tabId) {
        this.videos.delete(id);
      }
    }
    for (const [id, subtitle] of this.subtitles) {
      if (subtitle.tabId === tabId) {
        this.subtitles.delete(id);
      }
    }
  }

  /**
   * Clear all detected media across every tab.
   */
  clearAll(): void {
    this.videos.clear();
    this.subtitles.clear();
  }

  /**
   * Restore previously-saved media directly into the in-memory maps,
   * preserving original IDs and enriched metadata (tabUrl, title, etc.).
   * Used by the background service to restore state from session storage
   * after a service worker restart.
   *
   * Unlike {@link handleRequest}, this does NOT re-detect or re-enrich —
   * it inserts the saved objects as-is.
   */
  restoreMedia(videos: DetectedVideo[], subtitles: DetectedSubtitle[]): void {
    for (const video of videos) {
      this.videos.set(video.id, video);
    }
    for (const subtitle of subtitles) {
      this.subtitles.set(subtitle.id, subtitle);
    }
  }

  /**
   * Add pre-detected subtitles (e.g. from the YouTube MAIN-world DOM parse,
   * ADR-020) directly into the subtitle map, bypassing `handleRequest`'s
   * network-interception path. Deduplicates by URL within the same tab and
   * notifies listeners when at least one new subtitle is added.
   *
   * Returns the number of newly-added subtitles (0 = all duplicates).
   */
  addDetectedSubtitles(subtitles: DetectedSubtitle[]): number {
    let added = 0;
    for (const subtitle of subtitles) {
      const existing = this.getSubtitles(subtitle.tabId).find(
        (s) => s.url === subtitle.url,
      );
      if (existing === undefined) {
        this.subtitles.set(subtitle.id, subtitle);
        added++;
      }
    }
    if (added > 0) {
      this.notifyListeners(subtitles[0]?.tabId ?? 0);
    }
    return added;
  }

  /**
   * Subscribe to media detection updates. The provided callback is invoked
   * with the current set of detected videos and subtitles for the relevant tab
   * whenever a new detection occurs.
   *
   * @returns an unsubscribe function; calling it removes the callback.
   */
  onMediaDetected(callback: MediaDetectedCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all registered listeners with the current per-tab media set.
   */
  private notifyListeners(tabId: number): void {
    const videos = this.getVideos(tabId);
    const subtitles = this.getSubtitles(tabId);
    for (const listener of this.listeners) {
      listener(videos, subtitles);
    }
  }
}

