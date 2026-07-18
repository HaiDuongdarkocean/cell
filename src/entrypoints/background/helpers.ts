/**
 * Background helper functions — extracted from BackgroundService class.
 * Each function takes a {@link BackgroundContext} as the first parameter.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { STORAGE_KEYS } from '@/shared/config/config';
import tokensJson from '@/shared/styles/tokens.json';
import {
  getStorage,
  setStorage,
  getSessionStorage,
  setSessionStorage,
  queryTabs,
  getTab,
  sendTabMessage,
  reloadTab,
  setBadgeText,
  setBadgeBackgroundColor,
  setBadgeTextColor,
} from '@/shared/lib/chrome-apis';
import { loadSettings as loadSettingsFromStore, saveSettings as saveSettingsToStore } from '@/shared/lib/storage/settingsStore';
import { tryAutoDownload } from '@/features/download';
import { findSubtitlesForOverlay, type SubtitlePreference } from '@/features/subtitle';
import { detectLanguage, labelToIsoCode } from '@/features/detection';
import { parseM3u8 } from '@/shared/lib/parsers/m3u8Parser';
import { offscreenFetch, type OffscreenFetchOptions } from './offscreenFetch';
import { setRefererRule, removeRefererRule } from '@/shared/lib/chrome-apis/declarativeNetRequest';
import type { BackgroundContext } from './context';
import type {
  DetectedVideo,
  DetectedSubtitle,
  DownloadItem,
  Settings,
  MediaType,
  VideoVariant,
} from '@/entities/media';
import type { DetectedMediaUpdatePayload, AutoLoadSubtitlesPayload } from '@/entities/message';

/**
 * Generate a unique identifier, preferring `crypto.randomUUID` and falling back
 * to a timestamp + random combination.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Extract a base filename (without extension) from a URL path.
 */
export function extractBaseName(url: string): string {
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
 *
 * `initiator` (optional) is the frame origin that owns the scanned element
 * (`<track>`/`<source>`), taken from the content-script's
 * `window.location.href`. It flows into `NetworkRequest.initiator` →
 * `DetectedSubtitle.initiator` and becomes the DNR Referer/Origin source for
 * the subtitle fetch. Origin-checking CDNs (e.g. `prox.anicore.tv` behind
 * `anikage.cc`) return 403 "forbidden origin" without it, because a scanned
 * URL never went through `webRequest` (no real `details.initiator`).
 */
export function buildDetails(
  url: string,
  tabId: number,
  timeStamp: number,
  initiator?: string,
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
    initiator,
  } as chrome.webRequest.OnBeforeRequestDetails;
}

// --- tab helpers ---

/** Get the active tab id via `chrome.tabs.query`. */
export async function getActiveTabId(_ctx: BackgroundContext): Promise<number | undefined> {
  let tabs = await queryTabs({ active: true, currentWindow: false });
  if (tabs.length > 0) return tabs[0].id;
  tabs = await queryTabs({ active: true, lastFocusedWindow: true });
  return tabs[0]?.id;
}

/** Reload the active tab, skipping restricted URLs. */
export async function reloadActiveTab(_ctx: BackgroundContext): Promise<void> {
  const tabId = await getActiveTabId(_ctx);
  if (tabId === undefined) return;
  try {
    const tab = await getTab(tabId);
    if (tab.url && /^(chrome|edge|about|chrome-extension):/i.test(tab.url)) {
      return;
    }
    await reloadTab(tabId);
  } catch {
    // Tab may have been closed or be restricted; ignore.
  }
}

// --- badge helpers ---

/** Update the extension toolbar badge to show the number of detected media items. */
export function updateBadgeForTab(ctx: BackgroundContext, tabId: number): void {
  if (!ctx.extensionActive) {
    clearBadge(ctx);
    return;
  }
  const { videos, subtitles } = ctx.networkInterceptor.getMedia(tabId);
  const count = videos.length + subtitles.length;
  const text = count > 0 ? String(count) : '';
  try {
    void setBadgeText({ text, tabId });
    void setBadgeBackgroundColor({ color: tokensJson.core.light.primary, tabId });
    void setBadgeTextColor({ color: tokensJson.derived.light['color-primary-foreground'], tabId });
  } catch (err: unknown) {
    console.warn('[background] Failed to update badge:', err);
  }
}

/** Update the badge for the currently active tab. */
export async function updateBadgeForActiveTab(ctx: BackgroundContext): Promise<void> {
  const tabId = await getActiveTabId(ctx);
  if (tabId !== undefined) {
    updateBadgeForTab(ctx, tabId);
  } else {
    clearBadge(ctx);
  }
}

/** Clear the toolbar badge across all tabs. */
export function clearBadge(_ctx: BackgroundContext): void {
  try {
    void setBadgeText({ text: '' });
  } catch (err: unknown) {
    console.warn('[background] Failed to clear badge:', err);
  }
}

// --- media enrichment helpers ---

/** Enrich a detected video with the actual page URL and title from the tab. */
export function enrichVideo(ctx: BackgroundContext, video: DetectedVideo): DetectedVideo {
  void getTab(video.tabId).then((tab) => {
    const enriched: DetectedVideo = {
      ...video,
      tabUrl: tab.url ?? video.tabUrl,
      title: tab.title && tab.title.length > 0 ? tab.title : video.title,
    };
    ctx.networkInterceptor.updateVideo(video.id, enriched);
    ctx.messageBus.broadcast({
      type: MESSAGE_TYPES.DETECTED_MEDIA_UPDATE,
      payload: {
        videos: ctx.networkInterceptor.getVideos(video.tabId),
        subtitles: ctx.networkInterceptor.getSubtitles(video.tabId),
        tabId: video.tabId,
      } satisfies DetectedMediaUpdatePayload,
    });
    updateBadgeForTab(ctx, video.tabId);
  }).catch((err: unknown) => {
    console.warn(`[background] Failed to enrich video for tab ${video.tabId}:`, err);
  });
  return video;
}

/** Fetch and parse an m3u8 master playlist for quality tags. Fire-and-forget. */
export function enrichM3u8Variants(ctx: BackgroundContext, video: DetectedVideo): void {
  if (video.format !== 'm3u8' || video.variants.length > 0) {
    return;
  }

  void (async () => {
    try {
      // M15: fetch via offscreen so SW idle eviction doesn't abort the playlist fetch.
      const result = await offscreenFetch(ctx.offscreenManager, video.url, {
        credentials: 'same-origin',
        headers: { Accept: 'application/vnd.apple.mpegurl' },
      } satisfies OffscreenFetchOptions);
      if (!result.ok) {
        return;
      }
      const content = result.content;
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

      ctx.networkInterceptor.updateVideo(video.id, enriched);
      saveSessionMedia(ctx, video.tabId, ctx.networkInterceptor.getVideos(video.tabId), ctx.networkInterceptor.getSubtitles(video.tabId));
      ctx.messageBus.broadcast({
        type: MESSAGE_TYPES.DETECTED_MEDIA_UPDATE,
        payload: {
          videos: ctx.networkInterceptor.getVideos(video.tabId),
          subtitles: ctx.networkInterceptor.getSubtitles(video.tabId),
          tabId: video.tabId,
        } satisfies DetectedMediaUpdatePayload,
      });
    } catch {
      // Network/CORS errors are expected for some playlists; ignore.
    }
  })();
}

/** Find a detected video by its id, searching the active tab first then all tabs. */
export async function findVideoById(ctx: BackgroundContext, videoId: string): Promise<DetectedVideo | undefined> {
  const tabId = await getActiveTabId(ctx);
  if (tabId !== undefined) {
    const match = ctx.networkInterceptor.getVideos(tabId).find((v) => v.id === videoId);
    if (match) {
      return match;
    }
  }
  return findAllVideos(ctx).find((v) => v.id === videoId);
}

/** Find a detected subtitle by its id, searching the active tab first then all tabs. */
export async function findSubtitleById(ctx: BackgroundContext, subtitleId: string): Promise<DetectedSubtitle | undefined> {
  const tabId = await getActiveTabId(ctx);
  if (tabId !== undefined) {
    const match = ctx.networkInterceptor.getSubtitles(tabId).find((s) => s.id === subtitleId);
    if (match) {
      return match;
    }
  }
  return findAllSubtitles(ctx).find((s) => s.id === subtitleId);
}

/** Collect every detected video across all tabs. */
export function findAllVideos(ctx: BackgroundContext): DetectedVideo[] {
  return ctx.networkInterceptor.getAllVideos();
}

/** Collect every detected subtitle across all tabs. */
export function findAllSubtitles(ctx: BackgroundContext): DetectedSubtitle[] {
  return ctx.networkInterceptor.getAllSubtitles();
}

// --- download item helper ---

/** Build a DownloadItem from detected media and register it in the media map. */
export function createDownloadItem(
  ctx: BackgroundContext,
  media: DetectedVideo | DetectedSubtitle,
  mediaType: MediaType,
): DownloadItem {
  const id = generateId();
  ctx.mediaMap.set(id, media);

  const title =
    mediaType === 'video'
      ? (media as DetectedVideo).title
      : extractBaseName((media as DetectedSubtitle).url);

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

// --- settings helpers ---

export async function loadSettings(_ctx?: BackgroundContext): Promise<Settings> {
  return loadSettingsFromStore();
}

export async function saveSettings(_ctx: BackgroundContext | undefined, settings: Settings): Promise<void> {
  await saveSettingsToStore(settings);
}

export async function loadExtensionStatus(_ctx?: BackgroundContext): Promise<boolean> {
  const result = await getStorage<Record<string, unknown>>(STORAGE_KEYS.EXTENSION_STATUS);
  const stored = result[STORAGE_KEYS.EXTENSION_STATUS] as boolean | undefined;
  return stored ?? true;
}

export async function saveExtensionStatus(_ctx: BackgroundContext | undefined, active: boolean): Promise<void> {
  await setStorage({ [STORAGE_KEYS.EXTENSION_STATUS]: active });
}

// --- session persistence helpers ---

export async function performSessionRestore(ctx: BackgroundContext): Promise<void> {
  await loadSessionMedia(ctx);
  await loadSessionDownloads(ctx);
}

export function saveSessionMedia(
  _ctx: BackgroundContext,
  tabId: number,
  videos: DetectedVideo[],
  subtitles: DetectedSubtitle[],
): void {
  void getSessionStorage<Record<string, unknown>>(STORAGE_KEYS.SESSION_MEDIA).then((data) => {
    const all = (data[STORAGE_KEYS.SESSION_MEDIA] as
      | Record<string, { videos: DetectedVideo[]; subtitles: DetectedSubtitle[] }>
      | undefined) ?? {};
    all[String(tabId)] = { videos, subtitles };
    void setSessionStorage({
      [STORAGE_KEYS.SESSION_MEDIA]: all,
    });
  });
}

export async function loadSessionMedia(ctx: BackgroundContext): Promise<void> {
  try {
    const data = await getSessionStorage<Record<string, unknown>>(STORAGE_KEYS.SESSION_MEDIA);
    const all = data[STORAGE_KEYS.SESSION_MEDIA] as
      | Record<string, { videos: DetectedVideo[]; subtitles: DetectedSubtitle[] }>
      | undefined;
    if (!all) return;
    for (const [, entry] of Object.entries(all)) {
      ctx.networkInterceptor.restoreMedia(entry.videos, entry.subtitles);
    }
  } catch {
    // Session storage may not be available; ignore.
  }
}

export function clearSessionMedia(_ctx: BackgroundContext, tabId: number): void {
  void getSessionStorage<Record<string, unknown>>(STORAGE_KEYS.SESSION_MEDIA).then((data) => {
    const all = data[STORAGE_KEYS.SESSION_MEDIA] as
      | Record<string, unknown>
      | undefined;
    if (!all) return;
    delete all[String(tabId)];
    void setSessionStorage({
      [STORAGE_KEYS.SESSION_MEDIA]: all,
    });
  });
}

export function saveSessionDownloads(ctx: BackgroundContext, tabId: number): void {
  void getSessionStorage<Record<string, unknown>>(STORAGE_KEYS.SESSION_DOWNLOADS).then((data) => {
    const all = (data[STORAGE_KEYS.SESSION_DOWNLOADS] as
      | Record<string, DownloadItem[]>
      | undefined) ?? {};
    all[String(tabId)] = ctx.downloadQueue.getByTab(tabId);
    void setSessionStorage({
      [STORAGE_KEYS.SESSION_DOWNLOADS]: all,
    });
  });
}

export async function loadSessionDownloads(ctx: BackgroundContext): Promise<void> {
  try {
    const data = await getSessionStorage<Record<string, unknown>>(STORAGE_KEYS.SESSION_DOWNLOADS);
    const all = data[STORAGE_KEYS.SESSION_DOWNLOADS] as
      | Record<string, DownloadItem[]>
      | undefined;
    if (!all) return;
    for (const [, items] of Object.entries(all)) {
      for (const item of items) {
        if (item.status === 'downloading' || item.status === 'converting') {
          ctx.downloadQueue.restore({
            ...item,
            status: 'error',
            error: 'Interrupted (service worker restarted)',
          });
        } else {
          ctx.downloadQueue.restore(item);
        }
      }
    }
  } catch {
    // Session storage may not be available; ignore.
  }
}

export function clearSessionDownloads(_ctx: BackgroundContext, tabId: number): void {
  void getSessionStorage<Record<string, unknown>>(STORAGE_KEYS.SESSION_DOWNLOADS).then((data) => {
    const all = data[STORAGE_KEYS.SESSION_DOWNLOADS] as
      | Record<string, unknown>
      | undefined;
    if (!all) return;
    delete all[String(tabId)];
    void setSessionStorage({
      [STORAGE_KEYS.SESSION_DOWNLOADS]: all,
    });
  });
}

// --- subtitle helpers ---

/** Extract origin hostname from tab URL for subtitle preference lookup. */
export function extractOrigin(_ctx: BackgroundContext | undefined, tabUrl: string): string {
  try {
    return new URL(tabUrl).hostname;
  } catch {
    return '';
  }
}

/**
 * Find subtitles matching the user's overlay target/native languages and
 * push AUTO_LOAD_SUBTITLES to the content-script.
 */
export async function pushAutoLoadSubtitles(
  ctx: BackgroundContext,
  tabId: number,
  subtitles: DetectedSubtitle[],
): Promise<void> {
  try {
    const settings = await loadSettings();
    let preferences: SubtitlePreference | undefined;
    let tabUrl: string | undefined;
    try {
      const tab = await getTab(tabId);
      tabUrl = tab.url;
    } catch {
      // tab may be gone — skip preference, use first-match
    }
    if (tabUrl && settings.subtitlePreference) {
      const origin = extractOrigin(ctx, tabUrl);
      const sitePref = settings.subtitlePreference[origin];
      if (sitePref) {
        preferences = {
          target: sitePref[settings.subtitleOverlayTargetLanguage],
          native: sitePref[settings.subtitleOverlayNativeLanguage],
        };
      }
    }
    const result = findSubtitlesForOverlay(subtitles, settings, preferences);

    if (!result && subtitles.some((s) => s.language === 'unknown')) {
      // Unknown resolution now runs independently in onMediaDetected
      // (wireEvents.ts) so it fires regardless of auto-load match result.
      // After resolve, notifyListeners re-triggers this pushAutoLoadSubtitles
      // with the resolved languages — no need to re-run here.
    }

    if (!result) {
      return;
    }
    const payload: AutoLoadSubtitlesPayload = {
      tabId,
      target: result.target,
      native: result.native,
      targetMatches: result.targetMatches,
      nativeMatches: result.nativeMatches,
    };
    await sendTabMessage(tabId, {
      type: MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
      payload,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`AUTO_LOAD_SUBTITLES push failed for tab ${tabId}: ${msg}`);
  }
}

/**
 * Resolve `language: 'unknown'` subtitles by fetching their content in the
 * service worker and running frequency-based language detection.
 */
export async function resolveUnknownSubtitleLanguages(
  ctx: BackgroundContext,
  tabId: number,
  subtitles: DetectedSubtitle[],
): Promise<DetectedSubtitle[]> {
  const unknowns = subtitles.filter((s) => s.language === 'unknown');
  if (unknowns.length === 0) return [];

  const resolved: DetectedSubtitle[] = [];
  const results = await Promise.all(
    unknowns.map(async (sub) => {
      try {
        // Register a DNR rule so the browser rewrites `Referer` to the
        // subtitle's initiator (iframe player origin). Many subtitle CDNs
        // (e.g. lostproject.club behind megaplay.buzz) return 403 without
        // the correct Referer — and `fetch()` from the offscreen document
        // cannot set `Referer` (forbidden header). The rule is scoped to
        // this exact URL + extension origin and removed after the fetch.
        let ruleId: number | undefined;
        if (sub.initiator) {
          try {
            ruleId = await setRefererRule(sub.url, sub.initiator);
          } catch (err) {
            console.warn(`[bg resolveUnknownSubtitleLanguages] setRefererRule failed for sub ${sub.id}:`, err);
          }
        }
        let result: { ok: boolean; status: number; content: string; finalUrl: string };
        try {
          // M15: fetch via offscreen so SW idle eviction doesn't abort the language-detection fetch.
          result = await offscreenFetch(ctx.offscreenManager, sub.url);
        } finally {
          if (ruleId !== undefined) {
            void removeRefererRule(ruleId).catch(() => {});
          }
        }
        if (!result.ok) return null;
        const content = result.content;
        const label = detectLanguage(content, sub.format);
        if (!label) return null;
        const isoCode = labelToIsoCode(label);
        if (!isoCode) return null;
        // Return the update; apply batch after all unknowns resolved so
        // notifyListeners fires once (not per-sub), avoiding premature
        // pushAutoLoadSubtitles runs that see only partially-resolved state.
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

  if (resolved.length > 0) {
    for (const r of resolved) {
      ctx.networkInterceptor.updateSubtitle(r.id, r);
    }
    saveSessionMedia(ctx, tabId, ctx.networkInterceptor.getVideos(tabId), ctx.networkInterceptor.getSubtitles(tabId));
    // Fire a single notification after all updates land so onMediaDetected
    // → pushAutoLoadSubtitles sees the fully-resolved subtitle set.
    ctx.networkInterceptor.notifyMediaListeners(tabId);
  }

  return resolved;
}

/**
 * Dedup set for Stremio listing URLs already resolved. Stremio pages may fetch
 * the same listing URL multiple times (SPA navigation, re-renders) — without
 * dedup, each fetch would re-inject the same subtitle URLs (caught by
 * `handleRequest`'s URL dedup, but the redundant fetch + JSON parse is wasted).
 * Cleared on tab navigation via `clearTab` (the set is per-URL, not per-tab,
 * but stale entries are harmless — a re-listing after navigation just re-adds
 * the same subtitles which are already deduped by URL).
 */
const resolvedStremioListings = new Set<string>();

/**
 * Fetch a Stremio addon subtitle listing URL, parse the JSON response, and
 * re-inject each `subtitles[].url` through `handleRequest` so the real
 * subtitle files appear in the popup for download.
 *
 * Stremio addons (e.g. torrentio) serve a JSON listing at
 * `/<api-prefix>/<type>/subtitles/<id>` — NOT a subtitle file. The response:
 * ```json
 * {"subtitles": [{"url": "https://.../sub.en.srt", "lang": "en"}, ...]}
 * ```
 * The real subtitle files are in `subtitles[].url`. This function fetches the
 * listing, extracts those URLs, and feeds them back through the normal
 * detection pipeline with `trustAsSubtitle: true` (we know they're subtitles
 * from the JSON listing).
 */
export async function resolveStremioSubtitleListing(
  ctx: BackgroundContext,
  url: string,
  tabId: number,
  initiator: string | undefined,
): Promise<void> {
  if (resolvedStremioListings.has(url)) return;
  resolvedStremioListings.add(url);

  try {
    const result = await offscreenFetch(ctx.offscreenManager, url);
    if (!result.ok || !result.content) return;

    let parsed: { subtitles?: Array<{ url?: string; lang?: string }> | null };
    try {
      parsed = JSON.parse(result.content) as { subtitles?: Array<{ url?: string; lang?: string }> | null };
    } catch {
      console.warn(`[bg resolveStremioSubtitleListing] JSON parse failed for ${url}`);
      return;
    }

    const subs = parsed.subtitles;
    if (!subs || !Array.isArray(subs) || subs.length === 0) return;

    const now = Date.now();
    for (const sub of subs) {
      if (!sub.url) continue;
      ctx.networkInterceptor.handleRequest(
        buildDetails(sub.url, tabId, now, initiator),
        { trustAsSubtitle: true },
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[bg resolveStremioSubtitleListing] fetch failed for ${url}: ${msg}`);
  }
}

// --- auto-download helper ---

/** Auto-download entry point fired when media is detected for a tab. */
export async function maybeAutoDownload(ctx: BackgroundContext, tabId: number): Promise<void> {
  let tabUrl: string | undefined;
  try {
    const tab = await getTab(tabId);
    tabUrl = tab.url;
  } catch {
    return; // tab may already be gone
  }
  if (!tabUrl) return;

  const state = ctx.autoDownloadedTabs.get(tabId);
  const deps = {
    getMedia: (id: number) => ctx.networkInterceptor.getMedia(id),
    createDownloadItem: (media: DetectedVideo | DetectedSubtitle, type: 'video' | 'subtitle') =>
      createDownloadItem(ctx, media, type),
    addToQueue: (items: DownloadItem[]) => ctx.downloadQueue.addAll(items),
  };

  if (state && state.url === tabUrl) {
    const newIds = await tryAutoDownload(tabId, tabUrl, deps, state.enqueuedIds);
    for (const id of newIds) state.enqueuedIds.add(id);
    return;
  }

  const newIds = await tryAutoDownload(tabId, tabUrl, deps);
  if (newIds.length > 0) {
    ctx.autoDownloadedTabs.set(tabId, { url: tabUrl, enqueuedIds: new Set(newIds) });
  }
}
