/**
 * Community audio handler — FETCH_COMMUNITY_AUDIO (spec §9.4 B).
 *
 * Fetches pronunciation audio from Wikimedia Commons (Wiktionary + Lingua Libre)
 * instead of Forvo because Forvo is behind Cloudflare bot protection.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type {
  MessageResponse,
  FetchCommunityAudioPayload,
} from '@/entities/message';
import type { FetchCommunityAudioResponse } from '@/features/dictionaryPopup/types';
import { FetchCommunityAudioPayloadSchema } from '@/features/dictionaryPopup/schema';
import { fetchScoredCommunityAudioItems } from '@/features/dictionaryPopup/services/communityAudioService';

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

      try {
        const settings = await ctx.loadSettings();
        const accent = settings.dictionaryPopup?.tts?.preferredAccent ?? 'US';
        const items = await fetchScoredCommunityAudioItems(payload.term, payload.langCode, accent);
        return { success: true, data: { items } };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: `Community audio fetch failed: ${msg}` };
      }
    },
  );
}
