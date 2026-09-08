/**
 * Media detection message handlers — GET_DETECTED_MEDIA, PAGE_SCAN_RESULT,
 * DETECTED_SUBTITLE_URL.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { detectVideo } from '@/features/detection';
import { detectSubtitle } from '@/features/detection';
import type { BackgroundContext } from '../context';
import {
  getActiveTabId,
  updateBadgeForTab,
  pushAutoLoadSubtitles,
  clearSessionMedia,
  saveSessionMedia,
  buildDetails,
} from '../helpers';
import type {
  NetworkRequest,
} from '@/entities/media';
import type {
  MessageResponse,
  DetectedMediaUpdatePayload,
} from '@/entities/message';
import {
  GetDetectedMediaPayloadSchema,
  PageScanResultPayloadSchema,
  DetectedSubtitleUrlPayloadSchema,
} from '@/entities/message/schema';

/** Register media detection message handlers. */
export function registerMediaDetectionHandlers(ctx: BackgroundContext): void {
  // GET_DETECTED_MEDIA: return videos + subtitles for the requested tab only.
  ctx.on(MESSAGE_TYPES.GET_DETECTED_MEDIA, async (request): Promise<MessageResponse<DetectedMediaUpdatePayload>> => {
    await ctx.sessionReady;
    const parsed = GetDetectedMediaPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid GET_DETECTED_MEDIA payload: ${parsed.error.message}` };
    }
    const payload = parsed.data;
    const tabId = payload?.tabId ?? (await getActiveTabId(ctx));

    if (tabId === undefined) {
      return { success: true, data: { videos: [], subtitles: [], tabId: 0 } };
    }

    const { videos, subtitles } = ctx.networkInterceptor.getMedia(tabId);
    return { success: true, data: { videos, subtitles, tabId } };
  });

  // PAGE_SCAN_RESULT: merge scanned URLs with network detection.
  ctx.on(MESSAGE_TYPES.PAGE_SCAN_RESULT, async (request): Promise<MessageResponse> => {
    const parsed = PageScanResultPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid PAGE_SCAN_RESULT payload: ${parsed.error.message}` };
    }
    const payload = parsed.data;
    const tabId = payload.tabId;

    if (tabId === undefined) {
      return { success: false, error: 'Missing tabId in PAGE_SCAN_RESULT payload' };
    }

    // If the scan comes from a different frame/pageUrl than what we last stored,
    // the user has navigated to a new episode (or switched provider). Clear the
    // old tab media before adding the new episode's tracks, otherwise the
    // sidepanel mixes old/new and auto-load still pushes the previous episode's
    // subtitle for the new video.
    const lastPageUrl = ctx.networkInterceptor.getLastPageUrl(tabId);
    if (payload.pageUrl && lastPageUrl && payload.pageUrl !== lastPageUrl) {
      ctx.networkInterceptor.clearTab(tabId);
      clearSessionMedia(ctx, tabId);
      ctx.lastCuesByTab.delete(tabId);
      ctx.autoDownloadedTabs.delete(tabId);
    }
    ctx.networkInterceptor.setLastPageUrl(tabId, payload.pageUrl);

    const existingVideos = ctx.networkInterceptor.getVideos(tabId);
    const existingSubtitles = ctx.networkInterceptor.getSubtitles(tabId);
    const existingVideoUrls = new Set(existingVideos.map((v) => v.url));
    const existingSubtitleUrls = new Set(existingSubtitles.map((s) => s.url));

    const now = Date.now();
    let addedNew = false;

    // `pageUrl` is the frame origin that owns the scanned `<track>`/`<source>`
    // elements. Pass it as the request `initiator` so it flows into
    // `DetectedSubtitle.initiator` and becomes the DNR Referer/Origin source.
    // Without it, origin-checking CDNs (prox.anicore.tv behind anikage.cc)
    // return 403 "forbidden origin" when the extension fetches the subtitle —
    // a scanned URL never went through webRequest, so it has no real
    // `details.initiator` and the DNR rule is never registered.
    const initiator = payload.pageUrl;

    for (const url of payload.videoUrls) {
      if (existingVideoUrls.has(url)) {
        continue;
      }
      const networkRequest: NetworkRequest = {
        url,
        method: 'GET',
        tabId,
        type: 'media',
        timeStamp: now,
        initiator,
      };
      if (detectVideo(networkRequest)) {
        ctx.networkInterceptor.handleRequest(
          buildDetails(url, tabId, now, initiator),
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
        initiator,
      };
      // trustAsSubtitle: the page scanner already classified these URLs as
      // subtitles — either by URL pattern (<a> hrefs) or by <track> element
      // semantics (anikage.cc-style extension-less URLs). Re-checking the URL
      // pattern here would discard the <track> signal. The NON_SUBTITLE_KEYWORDS
      // guard still runs inside detectSubtitle to reject thumbnail/chapter VTT.
      if (detectSubtitle(networkRequest, { trustAsSubtitle: true })) {
        ctx.networkInterceptor.handleRequest(
          buildDetails(url, tabId, now, initiator),
          { trustAsSubtitle: true },
        );
        addedNew = true;
      }
    }

    if (addedNew) {
      const videos = ctx.networkInterceptor.getVideos(tabId);
      const subtitles = ctx.networkInterceptor.getSubtitles(tabId);
      ctx.messageBus.broadcast({
        type: MESSAGE_TYPES.DETECTED_MEDIA_UPDATE,
        payload: { videos, subtitles, tabId } satisfies DetectedMediaUpdatePayload,
      });
      updateBadgeForTab(ctx, tabId);
    }

    const allSubtitles = ctx.networkInterceptor.getSubtitles(tabId);
    if (allSubtitles.length > 0) {
      void pushAutoLoadSubtitles(ctx, tabId, allSubtitles, payload.frameId);
    }
    // Persist the scanned subtitle set so REQUEST_AUTO_LOAD_SUBTITLES can
    // re-push when the player content script is not ready at the first scan.
    saveSessionMedia(ctx, tabId, ctx.networkInterceptor.getVideos(tabId), allSubtitles);

    return { success: true };
  });

  // DETECTED_SUBTITLE_URL: main-world fetch interceptor caught a subtitle fetch.
  ctx.on(MESSAGE_TYPES.DETECTED_SUBTITLE_URL, async (request): Promise<MessageResponse> => {
    const parsed = DetectedSubtitleUrlPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid DETECTED_SUBTITLE_URL payload: ${parsed.error.message}` };
    }
    const payload = parsed.data;
    const tabId = payload.tabId;
    if (!tabId || !payload.url) {
      return { success: false, error: 'Missing tabId or url' };
    }

    let resolvedUrl = payload.url;
    let initiator: string | undefined;
    if (!/^https?:\/\//i.test(resolvedUrl)) {
      try {
        const tab = await new Promise<chrome.tabs.Tab | undefined>((resolve) => {
          chrome.tabs.get(tabId, (t) => {
            if (chrome.runtime.lastError) {
              resolve(undefined);
            } else {
              resolve(t);
            }
          });
        });
        if (tab?.url) {
          resolvedUrl = new URL(resolvedUrl, tab.url).href;
          initiator = tab.url;
        }
      } catch {
        // Leave relative; handleRequest will do best-effort parsing.
      }
    }

    const syntheticDetails = {
      url: resolvedUrl,
      method: 'GET',
      tabId,
      type: 'xmlhttprequest' as chrome.webRequest.ResourceType,
      timeStamp: Date.now(),
      initiator,
    } as chrome.webRequest.OnBeforeRequestDetails;

    ctx.networkInterceptor.handleRequest(syntheticDetails);
    return { success: true };
  });
}
