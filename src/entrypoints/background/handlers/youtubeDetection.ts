/**
 * YouTube detection message handlers — INNERTUBE_FALLBACK_REQUEST only (ADR-020).
 *
 * Path B (YouTube): the MAIN-world script reads `ytInitialPlayerResponse` and
 * posts caption tracks via `window.postMessage`. The isolated content-script
 * relays them to the background as `DETECTED_SUBTITLES`. **As of ADR-028 the
 * `DETECTED_SUBTITLES` handler lives in `detectionDispatch.ts`** (unified
 * dispatch by `payload.source`) — `messageBus.on()` overwrites, so only one
 * registrant is allowed. This file keeps the YouTube-specific
 * `INNERTUBE_FALLBACK_REQUEST` handler (iQIYI has no fallback).
 *
 * When the DOM parse yields no tracks, the MAIN-world script requests an
 * InnerTube fallback (`INNERTUBE_FALLBACK_REQUEST`). The background SW fetches
 * InnerTube (content scripts cannot set `User-Agent` — forbidden header).
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import {
  mapYouTubeCaptionTracks,
  fetchCaptionTracksViaInnerTube,
  type YouTubeCaptionTrack,
} from '@/features/detection';
import type { BackgroundContext } from '../context';
import {
  getActiveTabId,
  updateBadgeForTab,
  pushAutoLoadSubtitles,
} from '../helpers';
import type {
  MessageResponse,
  InnertubeFallbackPayload,
} from '@/entities/message';
import type { DetectedMediaUpdatePayload } from '@/entities/message';

/** Register YouTube-specific fallback handler (ADR-020; DETECTED_SUBTITLES moved to detectionDispatch.ts in ADR-028). */
export function registerYouTubeFallbackHandlers(
  ctx: BackgroundContext,
): void {
  // INNERTUBE_FALLBACK_REQUEST: MAIN-world script could not read captions from
  // the DOM — background SW fetches InnerTube (WEB client, no User-Agent override).
  ctx.on(
    MESSAGE_TYPES.INNERTUBE_FALLBACK_REQUEST,
    async (request): Promise<MessageResponse> => {
      const payload = request.payload as InnertubeFallbackPayload;
      const tabId = payload.tabId ?? (await getActiveTabId(ctx));
      if (tabId === undefined) {
        return {
          success: false,
          error: 'Missing tabId for INNERTUBE_FALLBACK_REQUEST',
        };
      }

      console.log('[bg INNERTUBE_FALLBACK] fetching via InnerTube ANDROID', {
        tabId,
        videoId: payload.videoId,
        hasVisitorData: !!payload.visitorData,
      });
      const tracks = await fetchCaptionTracksViaInnerTube(
        payload.videoId,
        payload.apiKey,
        payload.visitorData,
      );
      const subtitles = mapYouTubeCaptionTracks(tracks as YouTubeCaptionTrack[], tabId);
      if (subtitles.length === 0) {
        console.warn(
          '[bg INNERTUBE_FALLBACK] no tracks from InnerTube — PO Token may be required',
          { tabId, videoId: payload.videoId },
        );
        return { success: true };
      }

      const added = ctx.networkInterceptor.addDetectedSubtitles(subtitles);
      if (added > 0) {
        const allSubtitles = ctx.networkInterceptor.getSubtitles(tabId);
        ctx.messageBus.broadcast({
          type: MESSAGE_TYPES.DETECTED_MEDIA_UPDATE,
          payload: {
            videos: ctx.networkInterceptor.getVideos(tabId),
            subtitles: allSubtitles,
            tabId,
          } satisfies DetectedMediaUpdatePayload,
        });
        updateBadgeForTab(ctx, tabId);
        void pushAutoLoadSubtitles(ctx, tabId, allSubtitles);
      }
      return { success: true };
    },
  );
}
