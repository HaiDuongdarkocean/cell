/**
 * Subtitle search message handlers — SEARCH_SUBTITLES,
 * RESOLVE_SUBTITLE_DOWNLOAD, GET_KEY_QUOTA.
 *
 * Background owns all network calls (SubDL/OpenSubtitles) — content-script
 * không fetch API trực tiếp (CORS + key protection). Fetch delegated via
 * offscreenFetch (SW idle eviction safety, ADR-017 D2).
 *
 * Spec: docs/specs/subtitle-search.md
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { offscreenFetch } from '../offscreenFetch';
import { loadSettings } from '../helpers';
import type { BackgroundContext } from '../context';
import type {
  MessageResponse,
  SearchSubtitlesResult,
  ResolveSubtitleDownloadResult,
  GetKeyQuotaResult,
} from '@/entities/message';
import {
  SearchSubtitlesPayloadSchema,
  ResolveSubtitleDownloadPayloadSchema,
  GetKeyQuotaPayloadSchema,
} from '@/entities/message/schema';
import {
  pickProviderOrder,
  normalizeSearch,
  buildSearchRequest,
  buildDownloadRequest,
  decodeDownload,
} from '@/features/subtitle/logic/subtitleSearch';
import {
  extractImdbId,
  hasSubtitles,
  buildSubtitleListRequest,
} from '@/features/subtitle/logic/providers/subdlAdapter';
import {
  pickSearchKey,
  pickDownloadKey,
  markKeyStatus,
} from '@/features/subtitle/logic/keyRotation';
import {
  updateQuotaAfterDownload,
  decrementDownload,
  getQuotaInfo,
} from '../helpers/subtitleKeyLedger';
import { saveSettings } from '@/shared/lib/storage/settingsStore';
import { decodeBase64ToArrayBuffer } from '@/shared/lib/base64';
import type { SubtitleApiKey, SubtitleApiKeyProvider } from '@/entities/settings/types';
import type { SubtitleSearchResult, SearchError } from '@/features/subtitle/logic/subtitleSearchTypes';

/** Register subtitle search message handlers. */
export function registerSubtitleSearchHandlers(ctx: BackgroundContext): void {
  // SEARCH_SUBTITLES: search SubDL-first, OpenSubtitles fallback.
  ctx.on(
    MESSAGE_TYPES.SEARCH_SUBTITLES,
    async (request): Promise<MessageResponse<SearchSubtitlesResult>> => {
      const parsed = SearchSubtitlesPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid SEARCH_SUBTITLES payload: ${parsed.error.message}` };
      }
      const { query, languages, season, episode } = parsed.data;
      const searchQuery = { query, languages, season, episode };

      const settings = await loadSettings();
      const keys = settings.subtitleApiKeys ?? [];

      const errors: SearchError[] = [];
      for (const providerId of pickProviderOrder()) {
        const provider = providerId as SubtitleApiKeyProvider;
        let key = pickSearchKey(keys, provider);
        let attempts = 0;
        const maxAttempts = keys.filter((k) => k.provider === provider).length + 1;

        while (key && attempts < maxAttempts) {
          attempts++;
          const plan = buildSearchRequest(providerId, searchQuery, key.key);
          try {
            const res = await offscreenFetch(ctx.offscreenManager, plan.url, {
              method: plan.method,
              headers: plan.headers,
            });
            if (res.status === 429) {
              const retryAfter = parseInt(res.content, 10) || 60_000;
              await updateKeyStatus(keys, key.id, 'rate-limited', retryAfter);
              key = pickSearchKey(keys, provider);
              continue;
            }
            if (res.status === 401 || res.status === 403) {
              await updateKeyStatus(keys, key.id, 'invalid');
              key = pickSearchKey(keys, provider);
              continue;
            }
            if (!res.ok) {
              errors.push({ type: 'network', message: `HTTP ${res.status}` });
              break;
            }
            const raw = JSON.parse(res.content);

            // SubDL v2: film_name search returns movie matches, not subtitles.
            // If no subtitles in response, do step 2: search by imdb_id.
            if (providerId === 'subdl' && !hasSubtitles(raw)) {
              const imdbId = extractImdbId(raw);
              if (!imdbId) {
                // No movie match → 0 results
                if (key.status === 'unverified') {
                  await updateKeyStatus(keys, key.id, 'active');
                }
                break;
              }
              const step2Plan = buildSubtitleListRequest(imdbId, searchQuery, key.key);
              const step2Res = await offscreenFetch(ctx.offscreenManager, step2Plan.url, {
                method: step2Plan.method,
                headers: step2Plan.headers,
              });
              if (!step2Res.ok) {
                errors.push({ type: 'network', message: `HTTP ${step2Res.status}` });
                break;
              }
              const step2Results = normalizeSearch(providerId, JSON.parse(step2Res.content), searchQuery);
              if (step2Results.length > 0) {
                if (key.status === 'unverified') {
                  await updateKeyStatus(keys, key.id, 'active');
                }
                return { success: true, data: { results: step2Results } };
              }
              break;
            }

            const results = normalizeSearch(providerId, raw, searchQuery);
            if (results.length > 0) {
              // Key proved itself — mark active if was unverified.
              if (key.status === 'unverified') {
                await updateKeyStatus(keys, key.id, 'active');
              }
              return { success: true, data: { results } };
            }
            break; // 0 results → try next provider
          } catch (err) {
            errors.push({ type: 'network', message: String(err) });
            break;
          }
        }
        if (!key) {
          errors.push({ type: 'no-key', provider });
        }
      }

      // All providers exhausted
      const noKeyErr = errors.find((e) => e.type === 'no-key');
      if (noKeyErr && errors.length === 1) {
        return { success: true, data: { results: [], error: noKeyErr } };
      }
      return {
        success: true,
        data: { results: [], error: errors[0] ?? { type: 'network', message: 'No providers available' } },
      };
    },
  );

  // RESOLVE_SUBTITLE_DOWNLOAD: download subtitle content for a search result.
  ctx.on(
    MESSAGE_TYPES.RESOLVE_SUBTITLE_DOWNLOAD,
    async (request): Promise<MessageResponse<ResolveSubtitleDownloadResult>> => {
      const parsed = ResolveSubtitleDownloadPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return {
          success: false,
          error: `Invalid RESOLVE_SUBTITLE_DOWNLOAD payload: ${parsed.error.message}`,
        };
      }
      const { result: rawResult } = parsed.data;
      const result = rawResult as unknown as SubtitleSearchResult;

      const settings = await loadSettings();
      const keys = settings.subtitleApiKeys ?? [];
      const provider = result.source as SubtitleApiKeyProvider;
      const key = pickDownloadKey(keys, provider);
      if (!key) {
        return {
          success: true,
          data: { error: { type: 'no-key', provider } },
        };
      }

      const plan = buildDownloadRequest(result, key.key);

      try {
        // OpenSubtitles handshake: POST /download → {link, remaining, reset_time_utc}
        if (result.download.kind === 'handshake') {
          const handshakeRes = await offscreenFetch(ctx.offscreenManager, plan.url, {
            method: plan.method,
            headers: plan.headers,
          });
          if (!handshakeRes.ok) {
            return {
              success: true,
              data: { error: { type: 'network', message: `Handshake HTTP ${handshakeRes.status}` } },
            };
          }
          const handshake = JSON.parse(handshakeRes.content) as {
            link: string;
            remaining: number;
            reset_time_utc: string;
          };
          // Update quota ledger from API response
          const resetAt = Date.parse(handshake.reset_time_utc) || Date.now() + 86_400_000;
          await updateQuotaAfterDownload(key.id, handshake.remaining, resetAt);

          // Step 2: GET the temporary link → subtitle content (binary-safe)
          const fileRes = await offscreenFetch(ctx.offscreenManager, handshake.link, {
            method: 'GET',
            responseType: 'arraybuffer',
          });
          if (!fileRes.ok) {
            return {
              success: true,
              data: { error: { type: 'network', message: `Download HTTP ${fileRes.status}` } },
            };
          }
          const osBytes = decodeBase64ToArrayBuffer(fileRes.content);
          const decoded = await decodeDownload(provider, osBytes, result);
          // Key proved itself — mark active if was unverified.
          if (key.status === 'unverified') {
            await updateKeyStatus(keys, key.id, 'active');
          }
          return { success: true, data: { content: decoded.content, format: decoded.format } };
        }

        // SubDL direct: GET → subtitle content (binary ZIP — use arraybuffer)
        const res = await offscreenFetch(ctx.offscreenManager, plan.url, {
          method: plan.method,
          headers: plan.headers,
          responseType: 'arraybuffer',
        });
        if (!res.ok) {
          return {
            success: true,
            data: { error: { type: 'network', message: `HTTP ${res.status}` } },
          };
        }
        await decrementDownload(key.id);
        const bytes = decodeBase64ToArrayBuffer(res.content);
        const decoded = await decodeDownload(provider, bytes, result);
        // Key proved itself — mark active if was unverified.
        if (key.status === 'unverified') {
          await updateKeyStatus(keys, key.id, 'active');
        }
        return { success: true, data: { content: decoded.content, format: decoded.format } };
      } catch (err) {
        return {
          success: true,
          data: { error: { type: 'network', message: String(err) } },
        };
      }
    },
  );

  // GET_KEY_QUOTA: return quota info for UI display.
  ctx.on(
    MESSAGE_TYPES.GET_KEY_QUOTA,
    async (request): Promise<MessageResponse<GetKeyQuotaResult>> => {
      const parsed = GetKeyQuotaPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid GET_KEY_QUOTA payload: ${parsed.error.message}` };
      }
      const provider = parsed.data?.provider;
      const quotas = await getQuotaInfo(provider);
      return { success: true, data: { quotas } };
    },
  );
}

/** Update a key's status in settings + persist. */
async function updateKeyStatus(
  keys: readonly SubtitleApiKey[],
  keyId: string,
  status: SubtitleApiKey['status'],
  retryAfterMs?: number,
): Promise<void> {
  const updated = keys.map((k) =>
    k.id === keyId ? markKeyStatus(k, status, retryAfterMs) : k,
  );
  await saveSettings({ subtitleApiKeys: updated });
}
