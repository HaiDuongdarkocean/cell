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
import { sendMessage } from '@/shared/lib/chrome-apis';
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
}

export interface OffscreenFetchResult {
  readonly ok: boolean;
  readonly status: number;
  readonly content: string;
  readonly finalUrl: string;
}

/**
 * Fetch a URL via the offscreen document. Ensures the offscreen document is
 * ready first, then sends a FETCH_REQUEST and awaits the FETCH_RESPONSE.
 *
 * @throws Error if the offscreen document fails to respond or returns an error.
 */
export async function offscreenFetch(
  offscreenManager: OffscreenManager,
  url: string,
  options?: OffscreenFetchOptions,
): Promise<OffscreenFetchResult> {
  await offscreenManager.ensureOffscreenReady();

  const request: MessageRequest = {
    type: MESSAGE_TYPES.FETCH_REQUEST,
    payload: {
      url,
      options,
    } satisfies FetchRequestPayload,
  };

  const response = (await sendMessage(
    request,
  )) as MessageResponse<FetchResponsePayload> | undefined;

  if (!response) {
    throw new Error(
      'Offscreen document did not respond to FETCH_REQUEST. ' +
        'The offscreen listener may not have registered.',
    );
  }
  if (!response.success || !response.data) {
    throw new Error(response.error ?? 'Offscreen fetch failed');
  }

  return {
    ok: response.data.ok,
    status: response.data.status,
    content: response.data.content,
    finalUrl: response.data.finalUrl,
  };
}
