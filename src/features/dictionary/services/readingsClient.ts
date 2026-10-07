// readingsClient — content-script proxy for batched pronunciation/reading
// resolution (spec reading-annotation). Same origin-isolation constraint as
// wordStatusClient: the dictionary IDB lives in the extension origin, so
// reads go through the background via READINGS_GET in 500-term chunks.
//
// Returns a sparse map term -> reading; missing terms have no usable reading.
// Any failure resolves to an empty map — callers render without readings.

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import type { MessageResponse } from '@/entities/message';
import { normalizeLangCode } from './wordStatusClient';

const READINGS_TERMS_CHUNK = 500;

export async function getReadings(
  langCode: string,
  terms: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (terms.length === 0) return out;

  for (let i = 0; i < terms.length; i += READINGS_TERMS_CHUNK) {
    const response = await sendMessage<MessageResponse<{ readings: Record<string, string> }>>({
      type: MESSAGE_TYPES.READINGS_GET,
      payload: { tabId: -1, langCode: normalizeLangCode(langCode), terms: terms.slice(i, i + READINGS_TERMS_CHUNK) },
    });
    if (response?.success && response.data) {
      for (const [term, reading] of Object.entries(response.data.readings ?? {})) {
        out.set(term, reading);
      }
    }
  }
  return out;
}
