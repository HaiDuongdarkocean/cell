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
  buildDetails,
} from '../helpers';
import type {
  NetworkRequest,
} from '@/entities/media';
import type {
  MessageResponse,
  GetDetectedMediaPayload,
  DetectedMediaUpdatePayload,
  PageScanResultPayload,
  DetectedSubtitleUrlPayload,
} from '@/entities/message';

/** Register media detection message handlers. */
export function registerMediaDetectionHandlers(ctx: BackgroundContext): void {
  // GET_DETECTED_MEDIA: return videos + subtitles for the requested tab only.
  ctx.on(MESSAGE_TYPES.GET_DETECTED_MEDIA, async (request): Promise<MessageResponse<DetectedMediaUpdatePayload>> => {
    await ctx.sessionReady;
    const payload = request.payload as GetDetectedMediaPayload | undefined;
    const tabId = payload?.tabId ?? (await getActiveTabId(ctx));

    if (tabId === undefined) {
      return { success: true, data: { videos: [], subtitles: [], tabId: 0 } };
    }

    const { videos, subtitles } = ctx.networkInterceptor.getMedia(tabId);
    return { success: true, data: { videos, subtitles, tabId } };
  });

  // PAGE_SCAN_RESULT: merge scanned URLs with network detection.
  ctx.on(MESSAGE_TYPES.PAGE_SCAN_RESULT, async (request): Promise<MessageResponse> => {
    const payload = request.payload as PageScanResultPayload;
    const tabId = payload.tabId;

    if (tabId === undefined) {
      console.error('PAGE_SCAN_RESULT received without tabId');
      return { success: false, error: 'Missing tabId in PAGE_SCAN_RESULT payload' };
    }

    const existingVideos = ctx.networkInterceptor.getVideos(tabId);
    const existingSubtitles = ctx.networkInterceptor.getSubtitles(tabId);
    const existingVideoUrls = new Set(existingVideos.map((v) => v.url));
    const existingSubtitleUrls = new Set(existingSubtitles.map((s) => s.url));

    const now = Date.now();
    let addedNew = false;

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
      };
      if (detectVideo(networkRequest)) {
        ctx.networkInterceptor.handleRequest(
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
        ctx.networkInterceptor.handleRequest(
          buildDetails(url, tabId, now),
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
    console.log('[bg PAGE_SCAN_RESULT] subtitles detected', {
      tabId,
      subtitleCount: allSubtitles.length,
      subtitleLanguages: allSubtitles.map((s) => s.language),
    });
    if (allSubtitles.length > 0) {
      void pushAutoLoadSubtitles(ctx, tabId, allSubtitles);
    }

    return { success: true };
  });

  // DETECTED_SUBTITLE_URL: main-world fetch interceptor caught a subtitle fetch.
  ctx.on(MESSAGE_TYPES.DETECTED_SUBTITLE_URL, (request): MessageResponse => {
    const payload = request.payload as DetectedSubtitleUrlPayload;
    const tabId = payload.tabId;
    if (!tabId || !payload.url) {
      return { success: false, error: 'Missing tabId or url' };
    }

    const syntheticDetails = {
      url: payload.url,
      method: 'GET',
      tabId,
      type: 'xmlhttprequest' as chrome.webRequest.ResourceType,
      timeStamp: Date.now(),
    } as chrome.webRequest.OnBeforeRequestDetails;

    ctx.networkInterceptor.handleRequest(syntheticDetails);
    return { success: true };
  });
}
