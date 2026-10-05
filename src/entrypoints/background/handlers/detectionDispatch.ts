/**
 * Unified DETECTED_SUBTITLES handler — dispatch by `payload.source` (ADR-028).
 *
 * CRITICAL: `messageBus.on()` throws on a second registration for the same
 * type. This file is the SINGLE registrant for `DETECTED_SUBTITLES`;
 * it dispatches to the YouTube or iQIYI mapper based on `payload.source`:
 * - `source === 'iqiyi'` → `mapIqiyiSubtitleTracks` (ADR-028)
 * - `source === 'netflix'` → `mapNetflixSubtitleTracks` (ADR-029)
 * - `source === 'youtube'` or `undefined` (backward compat ADR-020) →
 *   `mapYouTubeCaptionTracks`
 *
 * Both branches share the post-map flow: store → broadcast → pushAutoLoadSubtitles
 * (clone of the ADR-020 logic that previously lived in `youtubeDetection.ts`).
 *
 * ADR-020 amend: `youtubeDetection.ts` keeps ONLY `INNERTUBE_FALLBACK_REQUEST`.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendTabMessage } from '@/shared/lib/chrome-apis';
import {
  mapYouTubeCaptionTracks,
  mapIqiyiSubtitleTracks,
  mapNetflixSubtitleTracks,
  youTubeCaptionTrackArraySchema,
  iqiyiSubtitleTrackArraySchema,
  netflixSubtitleTrackArraySchema,
} from '@/features/detection';
import type { BackgroundContext } from '../context';
import {
  getActiveTabId,
  updateBadgeForTab,
  pushAutoLoadSubtitles,
  saveSessionAutoDownloadedTabs,
  clearSessionMedia,
} from '../helpers';
import type {
  MessageResponse,
  AutoLoadSubtitlesPayload,
} from '@/entities/message';
import { DetectedSubtitlesPayloadSchema } from '@/entities/message/schema';
import type { DetectedMediaUpdatePayload } from '@/entities/message';
import type { DetectedSubtitle } from '@/entities/media';

/** Register the unified DETECTED_SUBTITLES handler (ADR-028). */
export function registerDetectionDispatchHandlers(
  ctx: BackgroundContext,
): void {
  ctx.on(
    MESSAGE_TYPES.DETECTED_SUBTITLES,
    async (request): Promise<MessageResponse> => {
      const parsed = DetectedSubtitlesPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid DETECTED_SUBTITLES payload: ${parsed.error.message}` };
      }
      const payload = parsed.data;
      const tabId = payload.tabId ?? (await getActiveTabId(ctx));
      if (tabId === undefined) {
        return { success: false, error: 'Missing tabId for DETECTED_SUBTITLES' };
      }

      const source = payload.source;
      // Detection-time page identity for the AUTO_LOAD stale-push guard.
      // YouTube carries videoId; the canonical watch URL round-trips through
      // canonicalNavUrl on the content side.
      const sourcePageUrl = payload.videoId
        ? `https://www.youtube.com/watch?v=${payload.videoId}`
        : undefined;
      let subtitles: DetectedSubtitle[];
      if (source === 'iqiyi') {
        // IQ: origin from data.dstl (dynamic, MAIN world passes via payload).
        // Fallback is the canonical CDN host — MAIN world normally supplies it.
        const tracks = iqiyiSubtitleTrackArraySchema.safeParse(payload.tracks);
        if (!tracks.success) {
          return { success: false, error: `Invalid iqiyi tracks: ${tracks.error.message}` };
        }
        subtitles = mapIqiyiSubtitleTracks(
          tracks.data,
          tabId,
          payload.origin ?? 'https://meta.video.iqiyi.com',
        );
      } else if (source === 'netflix') {
        // Netflix (ADR-029): BCP 47 language directly, WebVTT-only, Netflix initiator.
        const tracks = netflixSubtitleTrackArraySchema.safeParse(payload.tracks);
        if (!tracks.success) {
          return { success: false, error: `Invalid netflix tracks: ${tracks.error.message}` };
        }
        subtitles = mapNetflixSubtitleTracks(
          tracks.data,
          tabId,
        );
      } else {
        // YouTube (source === 'youtube' or undefined — backward compat ADR-020).
        const tracks = youTubeCaptionTrackArraySchema.safeParse(payload.tracks);
        if (!tracks.success) {
          return { success: false, error: `Invalid youtube tracks: ${tracks.error.message}` };
        }
        subtitles = mapYouTubeCaptionTracks(
          tracks.data,
          tabId,
        );
      }

      if (subtitles.length === 0) {
        // New video detected with NO subtitles (SPA nav from a video WITH
        // subtitles to one WITHOUT). Clear the previous video's subtitles so
        // the overlay does not persist into the new video. Broadcast empty
        // media update + send AUTO_LOAD_SUBTITLES with null target/native so
        // the content-script overlay clears its cues. (Clone ADR-020 logic.)
        ctx.networkInterceptor.clearTab(tabId);
        ctx.autoDownloadedTabs.delete(tabId);
        saveSessionAutoDownloadedTabs(ctx);
        clearSessionMedia(ctx, tabId);
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
            pageUrl: sourcePageUrl,
            targetMatches: [],
            nativeMatches: [],
          } satisfies AutoLoadSubtitlesPayload,
        });
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
        void pushAutoLoadSubtitles(ctx, tabId, allSubtitles, undefined, {
          pushNullWhenNoMatch: true,
          pageUrl: sourcePageUrl,
        });
      }
      return { success: true };
    },
  );
}
