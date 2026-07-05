/**
 * YouTube detection message handlers — DETECTED_SUBTITLES + INNERTUBE_FALLBACK_REQUEST (ADR-020).
 *
 * Path B (YouTube): the MAIN-world script reads `ytInitialPlayerResponse` and
 * posts caption tracks via `window.postMessage`. The isolated content-script
 * relays them here as `DETECTED_SUBTITLES`. This handler maps the raw tracks
 * to `DetectedSubtitle[]`, stores them in the network interceptor (bypassing
 * `detectSubtitle()` — YouTube timedtext URLs match 0 generic patterns), and
 * triggers the existing auto-load flow.
 *
 * When the DOM parse yields no tracks, the MAIN-world script requests an
 * InnerTube fallback (`INNERTUBE_FALLBACK_REQUEST`). The background SW fetches
 * InnerTube (content scripts cannot set `User-Agent` — forbidden header).
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendTabMessage } from '@/shared/lib/chrome-apis';
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
  DetectedSubtitlesPayload,
  InnertubeFallbackPayload,
  AutoLoadSubtitlesPayload,
} from '@/entities/message';
import type { DetectedMediaUpdatePayload } from '@/entities/message';

/** Register YouTube detection message handlers (ADR-020). */
export function registerYouTubeDetectionHandlers(ctx: BackgroundContext): void {
  // DETECTED_SUBTITLES: MAIN-world script found caption tracks in ytInitialPlayerResponse.
  ctx.on(
    MESSAGE_TYPES.DETECTED_SUBTITLES,
    async (request): Promise<MessageResponse> => {
      const payload = request.payload as DetectedSubtitlesPayload;
      const tabId = payload.tabId ?? (await getActiveTabId(ctx));
      if (tabId === undefined) {
        return { success: false, error: 'Missing tabId for DETECTED_SUBTITLES' };
      }

      const tracks = payload.tracks as YouTubeCaptionTrack[];
      const subtitles = mapYouTubeCaptionTracks(tracks, tabId);
      if (subtitles.length === 0) {
        // New video detected with NO subtitles (SPA nav from a video WITH
        // subtitles to one WITHOUT). Clear the previous video's subtitles so
        // the overlay does not persist into the new video. Broadcast empty
        // media update + send AUTO_LOAD_SUBTITLES with null target/native so
        // the content-script overlay clears its cues.
        console.log('[bg DETECTED_SUBTITLES] no tracks — clearing previous subtitles', {
          tabId,
          videoId: payload.videoId,
        });
        ctx.networkInterceptor.clearTab(tabId);
        ctx.autoDownloadedTabs.delete(tabId);
        ctx.lastCuesByTab.delete(tabId);
        ctx.messageBus.broadcast({
          type: MESSAGE_TYPES.DETECTED_MEDIA_UPDATE,
          payload: {
            videos: ctx.networkInterceptor.getVideos(tabId),
            subtitles: [],
            tabId,
          } satisfies DetectedMediaUpdatePayload,
        });
        updateBadgeForTab(ctx, tabId);
        await sendTabMessage(tabId, {
          type: MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
          payload: {
            tabId,
            target: null,
            native: null,
            targetMatches: [],
            nativeMatches: [],
          } satisfies AutoLoadSubtitlesPayload,
        });
        return { success: true };
      }

      const added = ctx.networkInterceptor.addDetectedSubtitles(subtitles);
      console.log('[bg DETECTED_SUBTITLES] stored YouTube subtitles', {
        tabId,
        videoId: payload.videoId,
        added,
        total: subtitles.length,
        languages: subtitles.map((s) => s.language),
      });

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
      const subtitles = mapYouTubeCaptionTracks(tracks, tabId);
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
