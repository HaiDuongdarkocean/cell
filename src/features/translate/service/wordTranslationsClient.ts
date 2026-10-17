// wordTranslationsClient — content-script proxy for batched per-term glosses
// (spec word-translation REQ-1). Sends TRANSLATE_TERMS to the background SW,
// which sub-batches marker-joined terms into ≤1500-char provider requests.
//
// Returns a sparse map term -> gloss; '' = covered but no usable gloss.
// Resolves `null` on message failure so callers keep existing glosses instead
// of clearing to blank.

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { batchSendTerms } from '@/shared/lib/batchSendTerms';

const TERMS_CHUNK = 500;

export async function getWordTranslations(
  sl: string,
  tl: string,
  terms: readonly string[],
  opts?: { cacheOnly?: boolean },
): Promise<Map<string, string> | null> {
  if (terms.length === 0 || !tl) return new Map();

  return batchSendTerms<{ glosses: Record<string, string> }, Map<string, string>>({
    type: MESSAGE_TYPES.TRANSLATE_TERMS,
    terms,
    chunkSize: TERMS_CHUNK,
    makePayload: (chunk) => ({ tabId: -1, sl, tl, terms: [...chunk], cacheOnly: opts?.cacheOnly }),
    empty: () => new Map<string, string>(),
    merge: (acc, data) => {
      for (const [term, gloss] of Object.entries(data.glosses ?? {})) {
        acc.set(term, gloss);
      }
    },
    abortOnFail: true,
  });
}
