// readingsClient — content-script proxy for batched pronunciation/reading
// resolution (spec reading-annotation). Same origin-isolation constraint as
// wordStatusClient: the dictionary IDB lives in the extension origin, so
// reads go through the background via READINGS_GET in 500-term chunks.
//
// Returns a sparse map term -> reading; missing terms have no usable reading.
// Any failure resolves to an empty map — callers render without readings.

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { batchSendTerms } from '@/shared/lib/batchSendTerms';
import { normalizeLangCode } from './wordStatusClient';

const READINGS_TERMS_CHUNK = 500;

export async function getReadings(
  langCode: string,
  terms: readonly string[],
): Promise<Map<string, string>> {
  const out = await batchSendTerms<{ readings: Record<string, string> }, Map<string, string>>({
    type: MESSAGE_TYPES.READINGS_GET,
    terms,
    chunkSize: READINGS_TERMS_CHUNK,
    makePayload: (chunk) => ({ tabId: -1, langCode: normalizeLangCode(langCode), terms: [...chunk] }),
    empty: () => new Map<string, string>(),
    merge: (acc, data) => {
      for (const [term, reading] of Object.entries(data.readings ?? {})) {
        acc.set(term, reading);
      }
    },
  });
  return out ?? new Map();
}
