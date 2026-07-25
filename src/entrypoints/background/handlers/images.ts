/**
 * Image search message handler — FETCH_IMAGES (spec §9.4 B).
 *
 * Content-script asks background to scrape Google Images for a term. Background
 * SW fetch bypasses CORS (host_permissions <all_urls>). The HTML is parsed by
 * the pure `parseGoogleImagesHtml` helper; this module owns only the fetch +
 * timeout + payload validation.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import type { FetchImagesResponse } from '@/features/dictionaryPopup/types';
import { FetchImagesPayloadSchema } from '@/features/dictionaryPopup/schema';
import {
  buildGoogleImagesUrl,
  parseGoogleImagesHtml,
  DEFAULT_MAX_IMAGE_RESULTS,
} from '@/features/dictionaryPopup/services/imageSearchService';
import { fetchWithTimeout } from '@/shared/lib/fetchWithTimeout';

/** Fetch timeout (ms) — Google Images can be slow on first query. */
const FETCH_IMAGES_TIMEOUT_MS = 5000;

/** Desktop Chrome User-Agent so Google returns the full HTML (not mobile lite). */
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

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

      const url = buildGoogleImagesUrl(term);
      try {
        const response = await fetchWithTimeout(
          url,
          { method: 'GET', headers: { 'User-Agent': DESKTOP_USER_AGENT } },
          FETCH_IMAGES_TIMEOUT_MS,
        );
        if (!response.ok) {
          return { success: false, error: `Google Images HTTP ${response.status}` };
        }
        const html = await response.text();
        const items = parseGoogleImagesHtml(html, term, maxResults);
        return { success: true, data: { items } };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: `Image fetch failed: ${msg}` };
      }
    },
  );
}
