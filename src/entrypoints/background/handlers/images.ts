/**
 * Image search message handler — FETCH_IMAGES (spec §9.4 B).
 *
 * Content-script asks background to search Wikimedia Commons for images of a
 * term. Background SW fetch bypasses CORS (host_permissions <all_urls>).
 * The pure `imageSearchService` helpers build the URL + parse JSON.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import type { FetchImagesResponse } from '@/features/dictionaryPopup/types';
import { FetchImagesPayloadSchema } from '@/features/dictionaryPopup/schema';
import {
  buildWikimediaImagesUrl,
  parseWikimediaImagesResponse,
  DEFAULT_MAX_IMAGE_RESULTS,
} from '@/features/dictionaryPopup/services/imageSearchService';
import { fetchWithTimeout } from '@/shared/lib/fetchWithTimeout';

/** Fetch timeout (ms) — Wikimedia API is usually fast, but keep a cap. */
const FETCH_IMAGES_TIMEOUT_MS = 10000;

/** Register the FETCH_IMAGES message handler. */
export function registerImageSearchHandlers(ctx: BackgroundContext): void {
  ctx.on(
    MESSAGE_TYPES.FETCH_IMAGES,
    async (request): Promise<MessageResponse<FetchImagesResponse>> => {
      const parsed = FetchImagesPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid FETCH_IMAGES payload: ${parsed.error.message}` };
      }
      const { term, maxResults: maxResultsParam } = parsed.data;
      const maxResults = maxResultsParam ?? DEFAULT_MAX_IMAGE_RESULTS;

      const url = buildWikimediaImagesUrl(term, maxResults);
      try {
        const response = await fetchWithTimeout(url, { method: 'GET' }, FETCH_IMAGES_TIMEOUT_MS);
        if (!response.ok) {
          return { success: false, error: `Wikimedia Images HTTP ${response.status}` };
        }
        const json = (await response.json()) as unknown;
        const items = parseWikimediaImagesResponse(json, term, maxResults);
        if (items.length === 0) {
          return { success: false, error: 'No images found for this term' };
        }
        return { success: true, data: { items } };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: `Image fetch failed: ${msg}` };
      }
    },
  );
}
