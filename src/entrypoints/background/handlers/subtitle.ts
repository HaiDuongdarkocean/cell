/**
 * Subtitle message handlers — UPDATE_SUBTITLE_LANGUAGE,
 * REQUEST_AUTO_LOAD_SUBTITLES, FETCH_SUBTITLE_CONTENT,
 * SUBTITLE_CUES_LOADED, REQUEST_SUBTITLE_CUES.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { STORAGE_KEYS } from '@/shared/config/config';
import type { BackgroundContext } from '../context';
import {
  pushAutoLoadSubtitles,
} from '../helpers';
import { offscreenFetch } from '../offscreenFetch';
import type {
  DetectedVideo,
  DetectedSubtitle,
} from '@/types/media';
import type {
  MessageResponse,
  UpdateSubtitleLanguagePayload,
  RequestAutoLoadSubtitlesPayload,
  FetchSubtitleContentPayload,
  FetchSubtitleContentResult,
  SubtitleCuesLoadedPayload,
  RequestSubtitleCuesPayload,
} from '@/types/message';

/** Register subtitle message handlers. */
export function registerSubtitleHandlers(ctx: BackgroundContext): void {
  // UPDATE_SUBTITLE_LANGUAGE: update a subtitle's detected language code.
  ctx.on(MESSAGE_TYPES.UPDATE_SUBTITLE_LANGUAGE, async (request): Promise<MessageResponse> => {
    const payload = request.payload as UpdateSubtitleLanguagePayload;
    if (!payload?.subtitleId || !payload?.language) {
      return { success: false, error: 'Missing subtitleId or language' };
    }

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
    const payload = request.payload as RequestAutoLoadSubtitlesPayload;
    const tabId = payload?.tabId;
    console.log('[bg REQUEST_AUTO_LOAD_SUBTITLES]', { tabId });
    if (tabId === undefined) {
      return { success: false, error: 'Missing tabId in REQUEST_AUTO_LOAD_SUBTITLES' };
    }

    try {
      const data = await chrome.storage.session.get(STORAGE_KEYS.SESSION_MEDIA);
      const all = data[STORAGE_KEYS.SESSION_MEDIA] as
        | Record<string, { videos: DetectedVideo[]; subtitles: DetectedSubtitle[] }>
        | undefined;
      const entry = all?.[String(tabId)];
      console.log('[bg REQUEST_AUTO_LOAD_SUBTITLES] session media', {
        tabId,
        hasEntry: !!entry,
        subtitleCount: entry?.subtitles?.length ?? 0,
        subtitleLanguages: entry?.subtitles?.map((s) => s.language),
      });
      if (!entry || entry.subtitles.length === 0) {
        return { success: true };
      }
      await pushAutoLoadSubtitles(ctx, tabId, entry.subtitles);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`REQUEST_AUTO_LOAD_SUBTITLES failed for tab ${tabId}: ${msg}`);
    }
    return { success: true };
  });

  // FETCH_SUBTITLE_CONTENT: content-script asks background to fetch a subtitle URL (CORS).
  ctx.on(MESSAGE_TYPES.FETCH_SUBTITLE_CONTENT, async (request): Promise<MessageResponse<FetchSubtitleContentResult>> => {
    const payload = request.payload as FetchSubtitleContentPayload;
    const rawUrl = payload?.url;
    if (!rawUrl) {
      return { success: false, error: 'Missing url in FETCH_SUBTITLE_CONTENT' };
    }

    let finalUrl = rawUrl;
    const tabUrl = payload.tabUrl;
    if (tabUrl) {
      try {
        finalUrl = new URL(rawUrl, tabUrl).href;
      } catch {
        finalUrl = rawUrl;
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
    }
  });

  // SUBTITLE_CUES_LOADED: relay bilingual cues from content-script to side panel.
  ctx.on(MESSAGE_TYPES.SUBTITLE_CUES_LOADED, async (request): Promise<MessageResponse> => {
    const payload = request.payload as SubtitleCuesLoadedPayload;
    if (!payload?.cues) {
      return { success: false, error: 'Missing cues in SUBTITLE_CUES_LOADED' };
    }
    if (payload.tabId !== undefined) {
      ctx.lastCuesByTab.set(payload.tabId, payload.cues);
    }
    if (payload.tabId !== undefined && payload.tabId !== ctx.activeTabIdForPanel) {
      return { success: true };
    }
    try {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
        payload: { tabId: payload.tabId, cues: payload.cues },
      });
    } catch {
      // Side panel may not be open — silently ignore; cues are cached above
    }
    return { success: true };
  });

  // REQUEST_SUBTITLE_CUES: side panel asks background for cached cues.
  ctx.on(MESSAGE_TYPES.REQUEST_SUBTITLE_CUES, async (request): Promise<MessageResponse> => {
    const payload = request.payload as RequestSubtitleCuesPayload;
    const tabId = payload?.tabId;
    if (tabId === undefined) {
      return { success: false, error: 'Missing tabId in REQUEST_SUBTITLE_CUES' };
    }
    const cues = ctx.lastCuesByTab.get(tabId) ?? [];
    return { success: true, data: { cues } };
  });
}
