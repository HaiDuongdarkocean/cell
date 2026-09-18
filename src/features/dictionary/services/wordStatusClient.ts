// wordStatusClient — content-script proxy for word status storage.
//
// IndexedDB is origin-isolated to the extension origin; content scripts run in
// the web page origin and cannot access the extension's IDB directly. All
// reads/writes therefore go through the background service worker via MV3
// messages (spec §9.4 B).

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import type { MessageResponse } from '@/entities/message';
import type { WordStatus } from '@/entities/dictionary';
import type { WordStatusEntry } from './wordStatusStore';
import type { TrashedWordEntry } from './wordTrashStore';

/** Normalize any incoming lang code to the base-2 form the schemas require. */
export function normalizeLangCode(langCode: string): string {
  const base = langCode.split('-')[0]?.toLowerCase() ?? '';
  return base.length === 2 ? base : 'en';
}

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
    payload: { tabId: -1, langCode: normalizeLangCode(langCode), terms },
  });

  if (!response?.success || !response.data) {
    return new Map();
  }

  return new Map(Object.entries(response.data.statuses ?? {}));
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
    payload: { tabId: -1, langCode: normalizeLangCode(langCode), term, status },
  });

  if (!response?.success) {
    throw new Error(response?.error ?? 'Failed to set word status');
  }
}

/** List every stored word-status entry for a lang. */
export async function listWordStatuses(langCode: string): Promise<WordStatusEntry[]> {
  const response = await sendMessage<MessageResponse<{ entries: WordStatusEntry[] }>>({
    type: MESSAGE_TYPES.WORD_STATUS_LIST,
    payload: { tabId: -1, langCode: normalizeLangCode(langCode) },
  });

  if (!response?.success || !response.data) {
    return [];
  }

  return response.data.entries;
}

/** Cycle a term's status atomically in the background; returns the new status. */
export async function cycleWordStatus(langCode: string, term: string): Promise<WordStatus> {
  const response = await sendMessage<MessageResponse<{ status: WordStatus }>>({
    type: MESSAGE_TYPES.WORD_STATUS_CYCLE,
    payload: { tabId: -1, langCode: normalizeLangCode(langCode), term },
  });

  if (!response?.success || !response.data) {
    throw new Error(response?.error ?? 'Failed to cycle word status');
  }

  return response.data.status;
}

/** Delete a term's status row (unmark). */
export async function deleteWordStatus(langCode: string, term: string): Promise<void> {
  const response = await sendMessage<MessageResponse>({
    type: MESSAGE_TYPES.WORD_STATUS_DELETE,
    payload: { tabId: -1, langCode: normalizeLangCode(langCode), term },
  });

  if (!response?.success) {
    throw new Error(response?.error ?? 'Failed to delete word status');
  }
}

/** Soft-delete a term's status into the 24h trash window. */
export async function trashWordStatus(langCode: string, term: string): Promise<void> {
  const response = await sendMessage<MessageResponse>({
    type: MESSAGE_TYPES.WORD_STATUS_TRASH,
    payload: { tabId: -1, langCode: normalizeLangCode(langCode), term },
  });

  if (!response?.success) {
    throw new Error(response?.error ?? 'Failed to trash word status');
  }
}

/** List surviving trash entries (expired records purged by the read). */
export async function listWordTrash(langCode: string): Promise<TrashedWordEntry[]> {
  const response = await sendMessage<MessageResponse<{ entries: TrashedWordEntry[] }>>({
    type: MESSAGE_TYPES.WORD_STATUS_TRASH_LIST,
    payload: { tabId: -1, langCode: normalizeLangCode(langCode) },
  });

  if (!response?.success || !response.data) {
    return [];
  }

  return response.data.entries;
}

/** Restore a trashed term to its previous status; returns the restored status. */
export async function restoreWordStatus(langCode: string, term: string): Promise<WordStatus> {
  const response = await sendMessage<MessageResponse<{ status: WordStatus }>>({
    type: MESSAGE_TYPES.WORD_STATUS_RESTORE,
    payload: { tabId: -1, langCode: normalizeLangCode(langCode), term },
  });

  if (!response?.success || !response.data) {
    throw new Error(response?.error ?? 'Failed to restore word status');
  }

  return response.data.status;
}

/** Permanently delete a trash record (delete-forever). */
export async function deleteWordTrash(langCode: string, term: string): Promise<void> {
  const response = await sendMessage<MessageResponse>({
    type: MESSAGE_TYPES.WORD_STATUS_TRASH_DELETE,
    payload: { tabId: -1, langCode: normalizeLangCode(langCode), term },
  });

  if (!response?.success) {
    throw new Error(response?.error ?? 'Failed to delete trashed word');
  }
}
