// frequencyClient — content-script proxy for frequency entries.
//
// IndexedDB is origin-isolated to the extension origin; content scripts run in
// the web page origin and cannot access the extension's IDB directly. All
// frequency reads therefore go through the background service worker via MV3
// messages (spec §9.4 B).

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import type { MessageResponse } from '@/entities/message';
import type { FrequencyEntry } from '@/entities/dictionary';

/**
 * Get frequency entries for many terms from the background frequency store.
 * Returns a map of term -> FrequencyEntry[] (missing terms default to []).
 */
export async function getFrequencyEntries(
  langCode: string,
  terms: readonly string[],
): Promise<Map<string, FrequencyEntry[]>> {
  if (terms.length === 0) return new Map();

  const response = await sendMessage<MessageResponse<{ entries: Record<string, FrequencyEntry[]> }>>({
    type: MESSAGE_TYPES.FREQUENCY_GET,
    payload: { tabId: -1, langCode, terms },
  });

  if (!response?.success || !response.data) {
    return new Map();
  }

  return new Map(Object.entries(response.data.entries));
}
