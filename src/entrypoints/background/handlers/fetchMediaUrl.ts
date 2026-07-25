/**
 * Media URL fetch handler — FETCH_MEDIA_URL.
 *
 * Fetches an external image/audio URL from the background SW to bypass
 * page CSP restrictions. Returns a data: URL (base64) so the content
 * script can consume it directly without a cross-context fetch.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse, FetchMediaUrlPayload, FetchMediaUrlResponse } from '@/entities/message/types';
import { FetchMediaUrlPayloadSchema } from '@/features/dictionaryPopup/schema';

/** Convert an ArrayBuffer to a base64 string. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/** Register the FETCH_MEDIA_URL message handler. */
export function registerFetchMediaUrlHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.FETCH_MEDIA_URL, async (request): Promise<MessageResponse<FetchMediaUrlResponse>> => {
    const parsed = FetchMediaUrlPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid FETCH_MEDIA_URL payload: ${parsed.error.message}` };
    }
    const { url, kind } = parsed.data;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': kind === 'image' ? 'image/*, */*' : 'audio/*, */*' },
      });
      if (!response.ok) {
        return { success: false, error: `Media fetch HTTP ${response.status}` };
      }
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        return { success: false, error: 'Media fetch returned empty data' };
      }
      const mimeType = response.headers.get('content-type') ?? (kind === 'image' ? 'image/png' : 'audio/mpeg');
      const base64 = arrayBufferToBase64(arrayBuffer);
      const dataUrl = `data:${mimeType};base64,${base64}`;
      return { success: true, data: { url: dataUrl } };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Media fetch failed: ${msg}` };
    }
  });
}
