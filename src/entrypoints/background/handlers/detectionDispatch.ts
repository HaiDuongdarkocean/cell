/**
 * Unified DETECTED_SUBTITLES handler — dispatch by `payload.source` (ADR-028).
 *
 * CRITICAL: `messageBus.on()` uses `handlers.set(type, handler)` — registering
 * two handlers for the same `DETECTED_SUBTITLES` type overwrites the first
 * (see `messageBus.ts:32`). This file is the SINGLE registrant for
 * `DETECTED_SUBTITLES`; it dispatches to the YouTube or iQIYI mapper based on
 * `payload.source`:
 * - `source === 'iqiyi'` → `mapIqiyiSubtitleTracks` (ADR-028)
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
  type YouTubeCaptionTrack,
  type IqiyiSubtitleTrack,
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
  AutoLoadSubtitlesPayload,
} from '@/entities/message';
import type { DetectedMediaUpdatePayload } from '@/entities/message';
import type { DetectedSubtitle } from '@/entities/media';

/** Register the unified DETECTED_SUBTITLES handler (ADR-028). */
export function registerDetectionDispatchHandlers(
  ctx: BackgroundContext,
): void {
  ctx.on(
    MESSAGE_TYPES.DETECTED_SUBTITLES,
    async (request): Promise<MessageResponse> => {
      const payload = request.payload as DetectedSubtitlesPayload;
      const tabId = payload.tabId ?? (await getActiveTabId(ctx));
      if (tabId === undefined) {
        return { success: false, error: 'Missing tabId for DETECTED_SUBTITLES' };
      }

      const source = payload.source;
      let subtitles: DetectedSubtitle[];
      if (source === 'iqiyi') {
        // IQ: origin from data.dstl (dynamic, MAIN world passes via payload).
        // Fallback is the canonical CDN host — MAIN world normally supplies it.
        subtitles = mapIqiyiSubtitleTracks(
          payload.tracks as IqiyiSubtitleTrack[],
          tabId,
          payload.origin ?? 'https://meta.video.iqiyi.com',
        );
      } else {
        // YouTube (source === 'youtube' or undefined — backward compat ADR-020).
        subtitles = mapYouTubeCaptionTracks(
          payload.tracks as YouTubeCaptionTrack[],
          tabId,
        );
      }

      if (subtitles.length === 0) {
        // New video detected with NO subtitles (SPA nav from a video WITH
        // subtitles to one WITHOUT). Clear the previous video's subtitles so
        // the overlay does not persist into the new video. Broadcast empty
        // media update + send AUTO_LOAD_SUBTITLES with null target/native so
        // the content-script overlay clears its cues. (Clone ADR-020 logic.)
        console.log(
          '[bg DETECTED_SUBTITLES] no tracks — clearing previous subtitles',
          { tabId, source, videoId: payload.videoId, tvid: payload.tvid },
        );
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
      console.log('[bg DETECTED_SUBTITLES] stored subtitles', {
        tabId,
        source,
        videoId: payload.videoId,
        tvid: payload.tvid,
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
}
