// wordStatusClient — content-script proxy for word status storage.
//
// IndexedDB is origin-isolated to the extension origin; content scripts run in
// the web page origin and cannot access the extension's IDB directly. All
// reads/writes therefore go through the background service worker via MV3
// messages (spec §9.4 B).

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import type { MessageResponse } from '@/entities/message';
import type { WordStatus } from '../types';

/**
 * Get statuses for many terms from the background word-status store.
 * Returns a map of term -> status (missing terms default to 'unknown').
 */
export async function getWordStatuses(
  langCode: string,
  terms: readonly string[],
): Promise<Map<string, WordStatus>> {
  if (terms.length === 0) return new Map();

  const response = await sendMessage<MessageResponse<{ statuses: Record<string, WordStatus> }>>({
    type: MESSAGE_TYPES.WORD_STATUSES_GET,
    payload: { tabId: -1, langCode, terms },
  });

  if (!response?.success || !response.data) {
    return new Map();
  }

  return new Map(Object.entries(response.data.statuses));
}

/**
 * Persist a single word status via the background word-status store.
 */
export async function setWordStatus(
  langCode: string,
  term: string,
  status: WordStatus,
): Promise<void> {
  const response = await sendMessage<MessageResponse>({
    type: MESSAGE_TYPES.WORD_STATUS_SET,
    payload: { tabId: -1, langCode, term, status },
  });

  if (!response?.success) {
    throw new Error(response?.error ?? 'Failed to set word status');
  }
}
