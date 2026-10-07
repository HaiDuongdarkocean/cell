// wordTranslationsClient — content-script proxy for batched per-term glosses
// (spec word-translation REQ-1). Sends TRANSLATE_TERMS to the background SW,
// which sub-batches marker-joined terms into ≤1500-char provider requests.
//
// Returns a sparse map term -> gloss; '' = covered but no usable gloss.
// Resolves `null` on message failure so callers keep existing glosses instead
// of clearing to blank.

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import type { MessageResponse } from '@/entities/message';

const TERMS_CHUNK = 500;

export async function getWordTranslations(
  sl: string,
  tl: string,
  terms: readonly string[],
): Promise<Map<string, string> | null> {
  const out = new Map<string, string>();
  if (terms.length === 0 || !tl) return out;

  for (let i = 0; i < terms.length; i += TERMS_CHUNK) {
    const response = await sendMessage<MessageResponse<{ glosses: Record<string, string> }>>({
      type: MESSAGE_TYPES.TRANSLATE_TERMS,
      payload: { tabId: -1, sl, tl, terms: terms.slice(i, i + TERMS_CHUNK) },
    });
    if (response?.success !== true) return null;
    for (const [term, gloss] of Object.entries(response.data?.glosses ?? {})) {
      out.set(term, gloss);
    }
  }
  return out;
}
