// tokenizeMetaClient — content-script proxy for the merged tokenize fast
// lane (TOKENIZE_META_GET) plus the SW warmup ping (TOKENIZE_PING).
// The merged call returns statuses + frequency entries in one roundtrip;
// dictionary readings stay on the separate READINGS_GET lane.

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import type { MessageResponse } from '@/entities/message';
import type { FrequencyEntry, WordStatus } from '@/entities/dictionary';
import { normalizeLangCode } from './wordStatusClient';

const META_TERMS_CHUNK = 1000;

export interface TokenizeMeta {
  statuses: Map<string, WordStatus>;
  frequencyEntries: Map<string, FrequencyEntry[]>;
}

export async function getTokenizeMeta(
  langCode: string,
  terms: readonly string[],
): Promise<TokenizeMeta> {
  const statuses = new Map<string, WordStatus>();
  const frequencyEntries = new Map<string, FrequencyEntry[]>();
  if (terms.length === 0) return { statuses, frequencyEntries };

  for (let i = 0; i < terms.length; i += META_TERMS_CHUNK) {
    const response = await sendMessage<
      MessageResponse<{ statuses: Record<string, WordStatus>; frequencyEntries: Record<string, FrequencyEntry[]> }>
    >({
      type: MESSAGE_TYPES.TOKENIZE_META_GET,
      payload: { tabId: -1, langCode: normalizeLangCode(langCode), terms: terms.slice(i, i + META_TERMS_CHUNK) },
    });
    if (response?.success && response.data) {
      for (const [term, status] of Object.entries(response.data.statuses ?? {})) {
        statuses.set(term, status);
      }
      for (const [term, entries] of Object.entries(response.data.frequencyEntries ?? {})) {
        frequencyEntries.set(term, entries);
      }
    }
  }
  return { statuses, frequencyEntries };
}

/** Wake the service worker ahead of the first real flush — MV3 suspends idle
 *  workers and the first sendMessage otherwise pays the cold-start cost. */
export function pingTokenizeMeta(langCode?: string): void {
  void sendMessage<MessageResponse>({
    type: MESSAGE_TYPES.TOKENIZE_PING,
    payload: { tabId: -1, langCode: langCode ? normalizeLangCode(langCode) : undefined },
  }).catch(() => {});
}
