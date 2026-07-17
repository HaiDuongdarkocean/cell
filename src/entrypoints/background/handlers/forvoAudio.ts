/**
 * Forvo community audio handler — FETCH_COMMUNITY_AUDIO (spec §9.4 B).
 *
 * Content-script asks background to scrape Forvo word-page audio. Background
 * SW fetch bypasses CORS (host_permissions forvo.com — Task T2). HTML is
 * parsed by the pure `forvoAudioService` and scored by accent preference.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type {
  MessageResponse,
  FetchCommunityAudioPayload,
} from '@/entities/message';
import type { FetchCommunityAudioResponse } from '@/features/dictionaryPopup/types';
import { FetchCommunityAudioPayloadSchema } from '@/features/dictionaryPopup/schema';
import {
  buildForvoUrl,
  parseForvoHtml,
  scoreAudioByAccent,
} from '@/features/dictionaryPopup/services/forvoAudioService';

/** Fetch timeout (ms) — matches reference `fetchWithTimeout` 5000ms. */
const FORVO_FETCH_TIMEOUT_MS = 5000;

/** Register the FETCH_COMMUNITY_AUDIO handler. */
export function registerForvoAudioHandlers(ctx: BackgroundContext): void {
  ctx.on(
    MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO,
    async (request): Promise<MessageResponse<FetchCommunityAudioResponse>> => {
      const parsed = FetchCommunityAudioPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return {
          success: false,
          error: `Invalid FETCH_COMMUNITY_AUDIO payload: ${parsed.error.message}`,
        };
      }
      const payload = parsed.data as FetchCommunityAudioPayload;

      const url = buildForvoUrl(payload.term, payload.langCode);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FORVO_FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'text/html,application/xhtml+xml,*/*' },
          signal: controller.signal,
        });
        if (!response.ok) {
          return { success: false, error: `Forvo HTTP ${response.status}` };
        }
        const html = await response.text();
        const raw = parseForvoHtml(html, payload.langCode);
        const settings = await ctx.loadSettings();
        const accent = settings.dictionaryPopup?.tts?.preferredAccent ?? 'US';
        const items = scoreAudioByAccent(raw, accent);
        return { success: true, data: { items } };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: `Forvo fetch failed: ${msg}` };
      } finally {
        clearTimeout(timer);
      }
    },
  );
}
