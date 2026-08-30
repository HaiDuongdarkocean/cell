/**
 * Local audio handler — FETCH_LOCAL_AUDIO.
 *
 * Reads the user's configured local Forvo package, queries the `.dsl` index,
 * and resolves audio entries from the zip archive. Returns `AudioItem[]` with
 * raw `audioBytes` (Uint8Array). The content script creates and revokes blob
 * URLs so object lifetimes stay in the same context as the audio element.
 */

import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import { FetchLocalAudioPayloadSchema, FetchLocalAudioResponseSchema } from '@/features/dictionaryPopup/schema';
import type { FetchLocalAudioResponse } from '@/features/dictionaryPopup/types';
import { LingvoDslAudioProvider } from '@/features/pronunciation/services/lingvoDslAudioProvider';

export function registerLocalAudioHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.FETCH_LOCAL_AUDIO, async (request): Promise<MessageResponse<FetchLocalAudioResponse>> => {
    const parsed = FetchLocalAudioPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid FETCH_LOCAL_AUDIO payload: ${parsed.error.message}`,
      };
    }

    const { term, langCode } = parsed.data;

    try {
      const settings = await ctx.loadSettings();
      const localFile = settings.pronunciation?.localFile;
      if (!localFile) {
        return { success: true, data: { items: [] } };
      }

      const provider = new LingvoDslAudioProvider(localFile);
      const items = await provider.resolve(term, langCode);
      const data = { items };
      FetchLocalAudioResponseSchema.parse(data);
      return { success: true, data };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Local audio fetch failed: ${msg}` };
    }
  });
}
