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

  // Fallback: marker-joined request realigns by ⟦Ti⟧ index even when the
  // provider merges or splits lines.
  if (terms.length > 1) {
    const marked = await fetchSegments(joinTermTexts(terms), sl, tl);
    if (marked.length > 0) {
      return alignTermGlosses(marked, terms.length);
    }
  }
  return plain.length > 0 ? plain : [];
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
    for (const chunk of chunkTermMarkerTexts(terms, TERM_REQUEST_CHAR_BUDGET)) {
      const aligned = await translateTermChunk(chunk, sl, tl);
      for (let i = 0; i < chunk.length; i++) {
        const raw = aligned[i] ?? '';
        if (!raw) continue;
        const gloss = raw.trim();
        glosses[chunk[i]!] = gloss.toLowerCase() === chunk[i]!.toLowerCase() ? '' : gloss;
      }
    }
    return { success: true, data: { glosses } };
  });
}
