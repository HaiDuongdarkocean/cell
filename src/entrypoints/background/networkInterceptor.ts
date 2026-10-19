import { detectVideo } from '@/features/detection';
import { detectSubtitle, isStremioSubtitleListing } from '@/features/detection';
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
 * Callback invoked when a Stremio addon subtitle listing URL is captured
 * (e.g. `stream.torrentio.to/api/v1/tmdb/subtitles/<id>`). The listing returns
 * JSON with real subtitle URLs in `subtitles[].url` — the callback fetches the
 * JSON, extracts those URLs, and re-injects them through `handleRequest`.
 */
export type ListingDetectedCallback = (
  url: string,
  tabId: number,
  initiator: string | undefined,
) => void;

type IndexedMedia = Pick<DetectedVideo, 'id' | 'url' | 'tabId'>;

interface TabMediaBucket<T extends IndexedMedia> {
  readonly byId: Map<string, T>;
  readonly byUrl: Map<string, T>;
}

function tabBucket<T extends IndexedMedia>(
  index: Map<number, TabMediaBucket<T>>,
  tabId: number,
): TabMediaBucket<T> {
  let bucket = index.get(tabId);
  if (bucket === undefined) {
    bucket = { byId: new Map(), byUrl: new Map() };
    index.set(tabId, bucket);
  }
  return bucket;
}

function indexIntoTab<T extends IndexedMedia>(
  index: Map<number, TabMediaBucket<T>>,
  item: T,
): void {
  const bucket = tabBucket(index, item.tabId);
  bucket.byId.set(item.id, item);
  const atUrl = bucket.byUrl.get(item.url);
  if (atUrl === undefined || atUrl.id === item.id) {
    bucket.byUrl.set(item.url, item);
  }
}

function indexMedia<T extends IndexedMedia>(
  index: Map<number, TabMediaBucket<T>>,
  byId: Map<string, T>,
  item: T,
): void {
  byId.set(item.id, item);
  indexIntoTab(index, item);
}

function updateIndexedMedia<T extends IndexedMedia>(
  index: Map<number, TabMediaBucket<T>>,
  byId: Map<string, T>,
  id: string,
  updated: T,
): void {
  const stored = byId.get(id);
  if (stored === undefined) {
    return;
  }
  byId.set(id, updated);
  const bucket = index.get(stored.tabId);
  if (bucket !== undefined) {
    if (stored.url !== updated.url && bucket.byUrl.get(stored.url)?.id === id) {
      bucket.byUrl.delete(stored.url);
    }
    if (stored.tabId !== updated.tabId) {
      bucket.byId.delete(id);
      if (bucket.byId.size === 0) {
        index.delete(stored.tabId);
      }
    }
  }
  indexIntoTab(index, updated);
}

function clearTabIndex<T extends IndexedMedia>(
  index: Map<number, TabMediaBucket<T>>,
  byId: Map<string, T>,
  tabId: number,
): void {
  const bucket = index.get(tabId);
  if (bucket === undefined) {
    return;
  }
  for (const id of bucket.byId.keys()) {
    byId.delete(id);
  }
  index.delete(tabId);
}

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
  private readonly videosByTab: Map<number, TabMediaBucket<DetectedVideo>> = new Map();
  private readonly subtitlesByTab: Map<number, TabMediaBucket<DetectedSubtitle>> = new Map();
  private readonly listeners: Set<MediaDetectedCallback> = new Set();
  private listingListener: ListingDetectedCallback | null = null;
  private listingMatcher: ((url: string) => boolean) | null = null;
  private tabClearedListeners: Set<(tabId: number) => void> = new Set();
  // Track the last pageUrl that produced media for each tab. Used by
  // PAGE_SCAN_RESULT and VIDEO_EPISODE_CHANGED to co-operatively clear old
  // media when a cross-origin player iframe navigates to a new episode.
  private readonly lastPageUrlByTab: Map<number, string> = new Map();

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
  handleRequest(
    details: chrome.webRequest.OnBeforeRequestDetails,
    opts?: { trustAsSubtitle?: boolean; language?: string; displayName?: string },
  ): void {
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

    // Stremio addon and generic subtitle listings: the URL returns a JSON
    // listing of subtitle URLs, not a subtitle file. Fire the listing callback
    // (async, not awaited) so the caller can fetch/parse and re-inject the
    // real subtitle URLs, then skip plain subtitle file detection; the
    // discovery pipeline will add the resolved entries as ready subtitles.
    const isListing = isStremioSubtitleListing(details.url) || this.listingMatcher?.(details.url);
    if (this.listingListener && isListing) {
      this.listingListener(details.url, details.tabId, details.initiator);
    }

    const request: NetworkRequest = {
      url: details.url,
      method: details.method,
      tabId: details.tabId,
      type: details.type,
      timeStamp: details.timeStamp,
      initiator: details.initiator,
    };

    // Always detect videos (e.g. .m3u8 playlists may also be listings).
    // Skip plain subtitle detection for listing URLs so the pipeline resolves
    // them with the correct label/format after decrypt/parsing.
    const video = detectVideo(request);
    const subtitle = isListing ? null : detectSubtitle(request, opts);

    let detectedNewMedia = false;

    if (video !== null) {
      // Deduplicate by URL+tabId: if a video with the same URL already exists
      // for this tab, skip it. Without this, every page reload or repeated
      // request to the same m3u8 URL creates a new entry (with a new UUID),
      // causing unbounded accumulation of duplicate media in the popup.
      const existing = this.videosByTab.get(details.tabId)?.byUrl.get(video.url);
      if (existing === undefined) {
        indexMedia(this.videosByTab, this.videos, video);
        detectedNewMedia = true;
      }
    }

    if (subtitle !== null) {
      // Same dedup for subtitles: skip if the same URL is already stored.
      const existingSub = this.subtitlesByTab.get(details.tabId)?.byUrl.get(subtitle.url);
      if (existingSub === undefined) {
        indexMedia(this.subtitlesByTab, this.subtitles, subtitle);
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
    const bucket = this.videosByTab.get(tabId);
    return bucket === undefined ? [] : [...bucket.byId.values()];
  }

  /**
   * Update a stored video in-place (e.g. to enrich it with the real tab URL
   * and page title after detection). No-op if the video id is not known.
   */
  updateVideo(id: string, updated: DetectedVideo): void {
    updateIndexedMedia(this.videosByTab, this.videos, id, updated);
  }

  /**
   * Update a stored subtitle in-place. No-op if the subtitle id is not known.
   */
  updateSubtitle(id: string, updated: DetectedSubtitle): void {
    updateIndexedMedia(this.subtitlesByTab, this.subtitles, id, updated);
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
    const bucket = this.subtitlesByTab.get(tabId);
    return bucket === undefined ? [] : [...bucket.byId.values()];
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
    this.lastPageUrlByTab.delete(tabId);
    clearTabIndex(this.videosByTab, this.videos, tabId);
    clearTabIndex(this.subtitlesByTab, this.subtitles, tabId);
    for (const listener of this.tabClearedListeners) {
      try {
        listener(tabId);
      } catch (err) {
        console.warn('[networkInterceptor] tab cleared listener failed:', err);
      }
    }
  }

  getLastPageUrl(tabId: number): string | undefined {
    return this.lastPageUrlByTab.get(tabId);
  }

  setLastPageUrl(tabId: number, pageUrl: string): void {
    this.lastPageUrlByTab.set(tabId, pageUrl);
  }

  onTabCleared(callback: (tabId: number) => void): () => void {
    this.tabClearedListeners.add(callback);
    return () => {
      this.tabClearedListeners.delete(callback);
    };
  }

  /**
   * Clear all detected media across every tab.
   */
  clearAll(): void {
    this.videos.clear();
    this.subtitles.clear();
    this.videosByTab.clear();
    this.subtitlesByTab.clear();
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
      indexMedia(this.videosByTab, this.videos, video);
    }
    for (const subtitle of subtitles) {
      indexMedia(this.subtitlesByTab, this.subtitles, subtitle);
    }
  }

  /**
   * Add pre-detected subtitles (e.g. from the YouTube MAIN-world DOM parse,
   * ADR-020) directly into the subtitle map, bypassing `handleRequest`'s
   * network-interception path. Deduplicates by URL within the same tab and
   * notifies listeners when at least one new subtitle is added.
   *
   * If a later discovery resolves an existing `language: 'unknown'` subtitle,
   * the stored record is updated in-place (same id) so the popup and
   * auto-loader see the real language without creating a duplicate URL.
   *
   * Returns the number of newly-added subtitles (0 = all duplicates).
   */
  addDetectedSubtitles(subtitles: readonly DetectedSubtitle[]): number {
    let added = 0;
    let updated = 0;
    for (const subtitle of subtitles) {
      const existing = this.subtitlesByTab.get(subtitle.tabId)?.byUrl.get(subtitle.url);
      if (existing === undefined) {
        indexMedia(this.subtitlesByTab, this.subtitles, subtitle);
        added++;
      } else if (
        existing.language === 'unknown' &&
        subtitle.language !== undefined &&
        subtitle.language !== 'unknown'
      ) {
        updateIndexedMedia(this.subtitlesByTab, this.subtitles, existing.id, {
          ...existing,
          language: subtitle.language,
          displayName: subtitle.displayName ?? existing.displayName,
        });
        updated++;
      }
    }
    if (added > 0 || updated > 0) {
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
   * Register a callback for Stremio addon subtitle listing URLs. When
   * `handleRequest` captures a URL matching `isStremioSubtitleListing`, this
   * callback is fired with the URL, tabId, and initiator — the caller fetches
   * the JSON listing, extracts `subtitles[].url`, and re-injects the real
   * subtitle URLs through `handleRequest`.
   */
  // (ADR-123) listing URLs are routed to the discovery pipeline — site
  // specifics live in adapters, not here.
  onListingDetected(callback: ListingDetectedCallback): () => void {
    this.listingListener = callback;
    return () => {
      if (this.listingListener === callback) {
        this.listingListener = null;
      }
    };
  }

  setListingMatcher(matcher: (url: string) => boolean): () => void {
    this.listingMatcher = matcher;
    return () => {
      this.listingMatcher = null;
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

