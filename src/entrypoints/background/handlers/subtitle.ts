/**
 * Subtitle message handlers — UPDATE_SUBTITLE_LANGUAGE,
 * REQUEST_AUTO_LOAD_SUBTITLES, FETCH_SUBTITLE_CONTENT,
 * SUBTITLE_CUES_LOADED, REQUEST_SUBTITLE_CUES.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { STORAGE_KEYS } from '@/shared/config/config';
import {
  getSessionStorage,
  sendMessage,
} from '@/shared/lib/chrome-apis';
import type { BackgroundContext } from '../context';
import {
  pushAutoLoadSubtitles,
} from '../helpers';
import { offscreenFetch } from '../offscreenFetch';
import { setRefererRule, removeRefererRule } from '@/shared/lib/chrome-apis/declarativeNetRequest';
import type {
  DetectedVideo,
  DetectedSubtitle,
  BilingualCue,
} from '@/entities/media';
import type {
  MessageResponse,
  FetchSubtitleContentResult,
} from '@/entities/message';
import {
  UpdateSubtitleLanguagePayloadSchema,
  RequestAutoLoadSubtitlesPayloadSchema,
  FetchSubtitleContentPayloadSchema,
  SubtitleCuesLoadedPayloadSchema,
  RequestSubtitleCuesPayloadSchema,
} from '@/entities/message/schema';

/** Register subtitle message handlers. */
export function registerSubtitleHandlers(ctx: BackgroundContext): void {
  // UPDATE_SUBTITLE_LANGUAGE: update a subtitle's detected language code.
  ctx.on(MESSAGE_TYPES.UPDATE_SUBTITLE_LANGUAGE, async (request): Promise<MessageResponse> => {
    const parsed = UpdateSubtitleLanguagePayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid UPDATE_SUBTITLE_LANGUAGE payload: ${parsed.error.message}` };
    }
    const payload = parsed.data;

    const existingSub = ctx.networkInterceptor.getAllSubtitles().find((s) => s.id === payload.subtitleId);
    if (existingSub) {
      ctx.networkInterceptor.updateSubtitle(payload.subtitleId, {
        ...existingSub,
        language: payload.language,
      });
    }

    const existing = ctx.mediaMap.get(payload.subtitleId);
    if (existing && (existing.format === 'ass' || existing.format === 'vtt' || existing.format === 'srt')) {
      ctx.mediaMap.set(payload.subtitleId, {
        ...(existing as DetectedSubtitle),
        language: payload.language,
      });
    }

    if (existingSub) {
      void pushAutoLoadSubtitles(ctx, existingSub.tabId, ctx.networkInterceptor.getSubtitles(existingSub.tabId));
    }

    return { success: true };
  });

  // REQUEST_AUTO_LOAD_SUBTITLES: content-script asks background to re-push.
  ctx.on(MESSAGE_TYPES.REQUEST_AUTO_LOAD_SUBTITLES, async (request): Promise<MessageResponse> => {
    const parsed = RequestAutoLoadSubtitlesPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid REQUEST_AUTO_LOAD_SUBTITLES payload: ${parsed.error.message}` };
    }
    const payload = parsed.data;
    const tabId = payload.tabId;
    if (tabId === undefined) {
      return { success: false, error: 'Missing tabId in REQUEST_AUTO_LOAD_SUBTITLES' };
    }

    try {
      const data = await getSessionStorage<Record<string, unknown>>(STORAGE_KEYS.SESSION_MEDIA);
      const all = data[STORAGE_KEYS.SESSION_MEDIA] as
        | Record<string, { videos: DetectedVideo[]; subtitles: DetectedSubtitle[] }>
        | undefined;
      const entry = all?.[String(tabId)];
      if (!entry || entry.subtitles.length === 0) {
        return { success: true };
      }
      await pushAutoLoadSubtitles(ctx, tabId, entry.subtitles, payload.frameId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`REQUEST_AUTO_LOAD_SUBTITLES failed for tab ${tabId}: ${msg}`);
    }
    return { success: true };
  });

  // FETCH_SUBTITLE_CONTENT: content-script asks background to fetch a subtitle URL (CORS).
  ctx.on(MESSAGE_TYPES.FETCH_SUBTITLE_CONTENT, async (request): Promise<MessageResponse<FetchSubtitleContentResult>> => {
    const parsed = FetchSubtitleContentPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid FETCH_SUBTITLE_CONTENT payload: ${parsed.error.message}` };
    }
    const payload = parsed.data;
    const rawUrl = payload.url;

    let finalUrl = rawUrl;
    const tabUrl = payload.tabUrl;
    if (tabUrl) {
      try {
        finalUrl = new URL(rawUrl, tabUrl).href;
      } catch {
        finalUrl = rawUrl;
      }
    }

    // Prefer the request `initiator` (iframe player origin) as the Referer —
    // many subtitle CDNs (e.g. lostproject.club behind megaplay.buzz) reject
    // the top-level tab URL and return 403. Fall back to tabUrl when
    // initiator is unavailable.
    //
    // `fetch()` from the offscreen document cannot set `Referer` (forbidden
    // header — browser strips it). We register a `declarativeNetRequest`
    // dynamic rule scoped to this exact URL + extension origin so the browser
    // rewrites `Referer` before the request leaves the network stack.
    const refererSource = payload.initiator ?? tabUrl;
    let ruleId: number | undefined;
    if (refererSource) {
      try {
        ruleId = await setRefererRule(finalUrl, refererSource);
      } catch (err) {
        console.warn('[FETCH_SUBTITLE_CONTENT] setRefererRule failed:', err);
      }
    }

    try {
      // M15: fetch via offscreen so SW idle eviction doesn't abort the subtitle fetch.
      const result = await offscreenFetch(ctx.offscreenManager, finalUrl);
      if (!result.ok) {
        return { success: false, error: `HTTP ${result.status}` };
      }
      return { success: true, data: { content: result.content, finalUrl: result.finalUrl } };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Background fetch failed: ${msg}` };
    } finally {
      if (ruleId !== undefined) {
        void removeRefererRule(ruleId).catch(() => {});
      }
    }
  });

  // SUBTITLE_CUES_LOADED: relay bilingual cues from content-script to side panel.
  ctx.on(MESSAGE_TYPES.SUBTITLE_CUES_LOADED, async (request): Promise<MessageResponse> => {
    const parsed = SubtitleCuesLoadedPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid SUBTITLE_CUES_LOADED payload: ${parsed.error.message}` };
    }
    const payload = parsed.data;
    const cues = payload.cues as BilingualCue[];
    if (payload.tabId !== undefined) {
      ctx.lastCuesByTab.set(payload.tabId, cues);
    }
    if (payload.tabId !== undefined && payload.tabId !== ctx.activeTabIdForPanel) {
      return { success: true };
    }
    try {
      await sendMessage({
        type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
        payload: { tabId: payload.tabId, cues },
      });
    } catch {
      // Side panel may not be open — silently ignore; cues are cached above
    }
    return { success: true };
  });

  // REQUEST_SUBTITLE_CUES: side panel asks background for cached cues.
  ctx.on(MESSAGE_TYPES.REQUEST_SUBTITLE_CUES, async (request): Promise<MessageResponse> => {
    const parsed = RequestSubtitleCuesPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid REQUEST_SUBTITLE_CUES payload: ${parsed.error.message}` };
    }
    const payload = parsed.data;
    const tabId = payload.tabId;
    if (tabId === undefined) {
      return { success: false, error: 'Missing tabId in REQUEST_SUBTITLE_CUES' };
    }
    const cues = ctx.lastCuesByTab.get(tabId) ?? [];
    return { success: true, data: { cues } };
  });
}
