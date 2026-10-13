import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import type { MessageResponse } from '@/entities/message';
import type { AnkiStatusSyncView } from '@/entities/ankiStatusSync';
import type { CardSourceTerms } from '../service/statusSyncService';
import { normalizeLangCode } from '@/features/dictionary';

async function request<T>(type: string, payload: Record<string, unknown>): Promise<T> {
  const response = await sendMessage<MessageResponse<T>>({ type, payload });
  if (!response?.success) {
    throw new Error(response?.error ?? 'request failed');
  }
  return response.data as T;
}

export function runAnkiSyncNow(): Promise<AnkiStatusSyncView> {
  return request<AnkiStatusSyncView>(MESSAGE_TYPES.ANKI_STATUS_SYNC_RUN, {});
}

export function getAnkiSyncState(): Promise<AnkiStatusSyncView> {
  return request<AnkiStatusSyncView>(MESSAGE_TYPES.ANKI_STATUS_SYNC_STATE, {});
}

export function getCardSourceTerms(langCode: string): Promise<CardSourceTerms> {
  return request<CardSourceTerms>(MESSAGE_TYPES.ANKI_STATUS_CARD_TERMS, { langCode: normalizeLangCode(langCode) });
}
