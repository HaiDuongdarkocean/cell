/**
 * TRANSLATE_TERMS handler — batched per-term glosses for the subtitle overlay
 * (spec word-translation REQ-1). Terms are wrapped in `⟦T{i}⟧` markers, grouped
 * into ≤1500-char Google requests, aligned back by marker. Google first,
 * MyMemory fallback — same provider chain as TRANSLATE.
 *
 * Failure is non-fatal: a failed sub-batch contributes no glosses; the caller
 * keeps rendering tokens without them.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import { TranslateTermsPayloadSchema } from '@/entities/message/dictionarySchemas';
import { fetchWithTimeout } from '@/shared/lib/fetchWithTimeout';
import {
  buildTranslateUrl,
  buildMyMemoryUrl,
  parseGoogleResponse,
  parseMyMemoryResponse,
  joinTermTexts,
  alignTermGlosses,
  chunkTermMarkerTexts,
} from '@/features/translate/service/translateService';

const GOOGLE_TRANSLATE_TIMEOUT_MS = 4000;
const MYMEMORY_TRANSLATE_TIMEOUT_MS = 6000;
const TERM_REQUEST_CHAR_BUDGET = 1500;
const GLOSS_CACHE_MAX = 20000;

const glossCache = new Map<string, string>();

function glossCacheKey(sl: string, tl: string, term: string): string {
  return `${sl}|${tl}|${term}`;
}

function glossCacheSet(key: string, gloss: string): void {
  if (glossCache.size >= GLOSS_CACHE_MAX) {
    const oldest = glossCache.keys().next().value;
    if (oldest !== undefined) glossCache.delete(oldest);
  }
  glossCache.set(key, gloss);
}

async function fetchSegments(text: string, sl: string, tl: string): Promise<string[]> {
  try {
    const response = await fetchWithTimeout(buildTranslateUrl(text, sl, tl), {
      method: 'GET',
      headers: { 'Accept': 'application/json, text/plain, */*' },
    }, GOOGLE_TRANSLATE_TIMEOUT_MS);
    if (response.ok) {
      const segments = parseGoogleResponse(await response.json());
      if (segments.length > 0 && segments.some((s) => s.length > 0)) return segments;
    }
  } catch {
    // fall through to MyMemory
  }

  try {
    const response = await fetchWithTimeout(buildMyMemoryUrl(text, sl, tl), {
      method: 'GET',
    }, MYMEMORY_TRANSLATE_TIMEOUT_MS);
    if (!response.ok) return [];
    return parseMyMemoryResponse(await response.json());
  } catch {
    return [];
  }
}

async function translateTermChunk(
  terms: readonly string[],
  sl: string,
  tl: string,
): Promise<readonly string[]> {
  // Primary: newline-joined terms — Google returns one segment per line,
  // which zips positionally and produces better single-word glosses than the
  // marker form. Terms are pre-sanitized so embedded newlines can't skew the
  // count.
  const plain = await fetchSegments(terms.map((t) => t.replace(/\n/g, ' ')).join('\n'), sl, tl);
  if (plain.length === terms.length) {
    return plain.map((g) => g.trim());
  }

  if (terms.length === 1) {
    // All segments belong to the one term — join them.
    return plain.length > 0 ? [plain.join(' ').trim()] : [];
  }

  // Fallback: marker-joined request realigns by ⟦Ti⟧ index even when the
  // provider merges or splits lines.
  const marked = await fetchSegments(joinTermTexts(terms), sl, tl);
  if (marked.length > 0) {
    return alignTermGlosses(marked, terms.length);
  }
  // A wrong-length plain result must not zip positionally — misaligned
  // glosses are worse than none. Failing the sub-batch keeps existing
  // glosses (resolve semantics treat absent terms as uncovered).
  return [];
}

export function registerTranslateTermsHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.TRANSLATE_TERMS, async (request): Promise<MessageResponse<{ glosses: Record<string, string> }>> => {
    const parsed = TranslateTermsPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid TRANSLATE_TERMS payload: ${parsed.error.message}` };
    }
    const { terms, sl, tl } = parsed.data;
    if (terms.length === 0 || !tl) {
      return { success: true, data: { glosses: {} } };
    }

    const glosses: Record<string, string> = {};
    const misses: string[] = [];
    for (const term of terms) {
      const cached = glossCache.get(glossCacheKey(sl, tl, term));
      if (cached !== undefined) {
        if (cached) glosses[term] = cached;
      } else {
        misses.push(term);
      }
    }

    for (const chunk of chunkTermMarkerTexts(misses, TERM_REQUEST_CHAR_BUDGET)) {
      const aligned = await translateTermChunk(chunk, sl, tl);
      for (let i = 0; i < chunk.length; i++) {
        const term = chunk[i]!;
        const gloss = (aligned[i] ?? '').trim();
        const final = gloss.toLowerCase() === term.toLowerCase() ? '' : gloss;
        glossCacheSet(glossCacheKey(sl, tl, term), final);
        if (final) glosses[term] = final;
      }
    }
    return { success: true, data: { glosses } };
  });
}
