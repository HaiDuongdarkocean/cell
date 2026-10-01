import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import type { MessageResponse } from '@/entities/message';
import type { AnkiStatusSyncState } from '@/entities/ankiStatusSync';

async function request<T>(type: string, payload: Record<string, unknown>): Promise<T> {
  const response = await sendMessage<MessageResponse<T>>({ type, payload });
  if (!response?.success) {
    throw new Error(response?.error ?? 'request failed');
  }
  return response.data as T;
}

export function runAnkiSyncNow(): Promise<AnkiStatusSyncState> {
  return request<AnkiStatusSyncState>(MESSAGE_TYPES.ANKI_STATUS_SYNC_RUN, {});
}

export function getAnkiSyncState(): Promise<AnkiStatusSyncState> {
  return request<AnkiStatusSyncState>(MESSAGE_TYPES.ANKI_STATUS_SYNC_STATE, {});
}
