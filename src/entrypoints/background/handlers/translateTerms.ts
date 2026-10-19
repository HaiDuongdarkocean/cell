/**
 * TRANSLATE_TERMS handler — batched per-term glosses for the subtitle overlay
 * (spec word-translation REQ-1). Terms are wrapped in `⟦T{i}⟧` markers, grouped
 * into ≤4500-char Google requests, aligned back by marker.
 *
 * Failure is non-fatal: a failed sub-batch contributes no glosses; the caller
 * keeps rendering tokens without them.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import { TranslateTermsPayloadSchema } from '@/entities/message/dictionarySchemas';
import { fetchWithTimeout } from '@/shared/lib/fetchWithTimeout';
import { getSessionStorage, removeSessionStorage, setSessionStorage } from '@/shared/lib/chrome-apis/storage';
import {
  buildTranslateRequest,
  parseGoogleResponse,
  joinTermTexts,
  alignTermGlosses,
  chunkTermMarkerTexts,
} from '@/features/translate/service/translateService';
import { googleTranslatePaced, type PacedResult } from '@/features/translate/service/googleRateLimiter';

const GOOGLE_TRANSLATE_TIMEOUT_MS = 8000;
const TERM_REQUEST_CHAR_BUDGET = 4500;
const GLOSS_CACHE_MAX = 20000;
const GLOSS_SESSION_PREFIX = 'gloss:';

const glossCache = new Map<string, string>();

function glossCacheKey(sl: string, tl: string, term: string): string {
  return `${sl}|${tl}|${term}`;
}

function glossCacheSet(key: string, gloss: string): void {
  if (glossCache.size >= GLOSS_CACHE_MAX) {
    const oldest = glossCache.keys().next().value;
    if (oldest !== undefined) {
      glossCache.delete(oldest);
      void removeSessionStorage(GLOSS_SESSION_PREFIX + oldest);
    }
  }
  glossCache.set(key, gloss);
  void setSessionStorage({ [GLOSS_SESSION_PREFIX + key]: gloss });
}

async function fetchSegments(
  text: string,
  sl: string,
  tl: string,
): Promise<PacedResult<string[]>> {
  const { url, body } = buildTranslateRequest(text, sl, tl);
  return googleTranslatePaced(async () => {
    try {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      }, GOOGLE_TRANSLATE_TIMEOUT_MS);
      if (response.ok) {
        const segments = parseGoogleResponse(await response.json());
        if (segments.length > 0 && segments.some((s) => s.length > 0)) {
          return { status: 200, value: segments };
        }
      }
      return { status: response.status, value: null };
    } catch {
      // failure is non-fatal — caller renders tokens without glosses
      return { status: 0, value: null };
    }
  });
}

async function translateTermChunk(
  terms: readonly string[],
  sl: string,
  tl: string,
): Promise<{ glosses: readonly string[] | null; providerFailed: boolean }> {
  // Primary: newline-joined terms — Google returns one segment per line,
  // which zips positionally and produces better single-word glosses than the
  // marker form. Terms are pre-sanitized so embedded newlines can't skew the
  // count.
  const plain = await fetchSegments(terms.map((t) => t.replace(/\n/g, ' ')).join('\n'), sl, tl);
  const plainSegments = plain.value ?? [];
  if (plainSegments.length === terms.length) {
    return { glosses: plainSegments.map((g) => g.trim()), providerFailed: false };
  }

  if (terms.length === 1) {
    // All segments belong to the one term — join them.
    return {
      glosses: plainSegments.length > 0 ? [plainSegments.join(' ').trim()] : null,
      providerFailed: plain.status !== 200,
    };
  }

  // A 429/time-out is not worth a second request — the marker retry would hit
  // the same wall. Only fall back on a well-formed-but-misaligned response.
  if (plain.status !== 200) {
    return { glosses: null, providerFailed: true };
  }

  // Fallback: marker-joined request realigns by ⟦Ti⟧ index even when the
  // provider merges or splits lines.
  const marked = await fetchSegments(joinTermTexts(terms), sl, tl);
  if (marked.value && marked.value.length > 0) {
    return { glosses: alignTermGlosses(marked.value, terms.length), providerFailed: false };
  }
  // A wrong-length plain result must not zip positionally — misaligned
  // glosses are worse than none. null = whole sub-batch failed (provider
  // error/rate limit): caller skips it so the terms are NOT cached as ''
  // — caching '' would permanently suppress glosses for the session.
  return { glosses: null, providerFailed: marked.status !== 200 };
}

export function registerTranslateTermsHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.TRANSLATE_TERMS, async (request): Promise<MessageResponse<{ glosses: Record<string, string> }>> => {
    const parsed = TranslateTermsPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid TRANSLATE_TERMS payload: ${parsed.error.message}` };
    }
    const { terms, sl, tl, cacheOnly } = parsed.data;
    if (terms.length === 0 || !tl) {
      return { success: true, data: { glosses: {} } };
    }

    const glosses: Record<string, string> = {};
    let misses: string[] = [];
    for (const term of terms) {
      const cached = glossCache.get(glossCacheKey(sl, tl, term));
      if (cached !== undefined) {
        if (cached) glosses[term] = cached;
      } else {
        misses.push(term);
      }
    }

    if (misses.length > 0) {
      const stored = await getSessionStorage(
        misses.map((term) => GLOSS_SESSION_PREFIX + glossCacheKey(sl, tl, term)),
      ).catch((): Record<string, unknown> => ({}));
      const unresolved: string[] = [];
      for (const term of misses) {
        const key = glossCacheKey(sl, tl, term);
        const hit = stored[GLOSS_SESSION_PREFIX + key];
        if (typeof hit === 'string') {
          glossCache.set(key, hit);
          if (hit) glosses[term] = hit;
        } else {
          unresolved.push(term);
        }
      }
      misses = unresolved;
    }

    // cacheOnly callers take the hit map as-is — misses stay unbuilt so a
    // throttled provider cannot hold back already-cached glosses.
    if (cacheOnly === true) {
      return { success: true, data: { glosses } };
    }

    let providerFailed = false;
    for (const chunk of chunkTermMarkerTexts(misses, TERM_REQUEST_CHAR_BUDGET)) {
      const result = await translateTermChunk(chunk, sl, tl);
      providerFailed = providerFailed || result.providerFailed;
      // Sequential coverage: stop at the first provider failure — remaining
      // chunks would fail identically while scattering holes across later
      // cues. They retry on the next leg.
      if (result.glosses === null) break;
      for (let i = 0; i < chunk.length; i++) {
        const term = chunk[i]!;
        const gloss = (result.glosses[i] ?? '').trim();
        const final = gloss.toLowerCase() === term.toLowerCase() ? '' : gloss;
        glossCacheSet(glossCacheKey(sl, tl, term), final);
        if (final) glosses[term] = final;
      }
    }
    // Total provider failure (rate limit/outage) must surface as a failed
    // response — a silent empty map would tell the preloader's gloss leg
    // "done" and the terms would never retry.
    if (providerFailed && Object.keys(glosses).length === 0) {
      return { success: false, error: 'translate.provider.unavailable' };
    }
    return { success: true, data: { glosses } };
  });
}
