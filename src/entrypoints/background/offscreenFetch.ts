/**
 * Offscreen fetch adapter (M15 — ADR-017 D2).
 *
 * Delegates `fetch()` calls from the service worker to the offscreen document
 * so that in-flight fetches are not silently aborted when the SW is evicted
 * for idleness. The offscreen document stays alive for the duration of the
 * fetch because it is the one awaiting the Response.
 *
 * Only used for short text-body fetches (subtitles, m3u8 playlists, language
 * detection). Binary segment downloads still go through the Downloader's own
 * fetch pipeline (which has its own resume logic).
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { t } from '@/shared/i18n';
import type { OffscreenManager } from './offscreenManager';
import type {
  FetchRequestPayload,
  FetchResponsePayload,
  MessageRequest,
  MessageResponse,
} from '@/entities/message';

export interface OffscreenFetchOptions {
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly credentials?: RequestCredentials;
  /** If 'arraybuffer', content is base64-encoded (binary-safe). */
  readonly responseType?: 'text' | 'arraybuffer';
}

export interface OffscreenFetchResult {
  readonly ok: boolean;
  readonly status: number;
  readonly content: string;
  readonly finalUrl: string;
}

/**
 * Fetch a URL via the offscreen document. Ensures the offscreen document is
 * ready first, then sends a FETCH_REQUEST and awaits its response.
 *
 * @throws Error if the offscreen document fails to respond or returns an error.
 */
export async function offscreenFetch(
  offscreenManager: OffscreenManager,
  url: string,
  options?: OffscreenFetchOptions,
): Promise<OffscreenFetchResult> {
  const request: MessageRequest = {
    type: MESSAGE_TYPES.FETCH_REQUEST,
    payload: {
      url,
      options,
    } satisfies FetchRequestPayload,
  };

  const response = await offscreenManager.sendToOffscreen<
    MessageResponse<FetchResponsePayload> | undefined
  >(request);

  if (!response) {
    console.error('[offscreen] No response for', request.type);
    throw new Error(t('ui.error.offscreenNoResponse'));
  }
  if (!response.success || !response.data) {
    throw new Error(response.error ?? t('ui.error.fetchFailed'));
  }

  return {
    ok: response.data.ok,
    status: response.data.status,
    content: response.data.content,
    finalUrl: response.data.finalUrl,
  };
}
