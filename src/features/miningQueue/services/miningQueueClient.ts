// miningQueueClient — content/panel proxy for the background mining queue
// store (same pattern as wordStatusClient: IndexedDB is origin-isolated to
// the extension, so every surface talks to background via QUEUE_* messages).

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage, onMessage, removeOnMessageListener } from '@/shared/lib/chrome-apis/runtime';
import { messagePayload } from '@/entities/message/payload';
import type { MessageResponse } from '@/entities/message';
import type {
  MiningQueueInput,
  MiningQueueItem,
  MiningQueueRow,
} from '@/entities/miningQueue';
import { t } from '@/shared/i18n';

/** Persist an item in the background queue; resolves with the stored row id
 *  + whether it deduped onto an existing row. Throws on store failure —
 *  callers must surface it (spec: no silent drops). */
export async function queueSave(
  input: MiningQueueInput,
): Promise<{ id: string; deduped: boolean }> {
  const response = await sendMessage<MessageResponse<{ id: string; deduped: boolean }>>({
    type: MESSAGE_TYPES.QUEUE_ADD,
    payload: { tabId: -1, item: input },
  });
  if (!response?.success || !response.data) {
    throw new Error(response?.error ?? t('queue.error.save'));
  }
  return response.data;
}

/** Lean rows newest-first for the queue surface. */
export async function queueList(): Promise<MiningQueueRow[]> {
  const response = await sendMessage<MessageResponse<{ rows: MiningQueueRow[] }>>({
    type: MESSAGE_TYPES.QUEUE_LIST,
    payload: { tabId: -1 },
  });
  if (!response?.success || !response.data) {
    throw new Error(response?.error ?? t('queue.error.load'));
  }
  return response.data.rows;
}

/** Full item incl. snapshot — cardify/quick-add replay. */
export async function queueGet(id: string): Promise<MiningQueueItem | undefined> {
  const response = await sendMessage<MessageResponse<{ item?: MiningQueueItem }>>({
    type: MESSAGE_TYPES.QUEUE_GET,
    payload: { tabId: -1, id },
  });
  if (!response?.success) {
    throw new Error(response?.error ?? t('queue.error.load'));
  }
  return response.data?.item;
}

/** Hard delete (discard / post-cardify / post-quick-add cleanup). */
export async function queueRemove(id: string): Promise<void> {
  const response = await sendMessage<MessageResponse>({
    type: MESSAGE_TYPES.QUEUE_REMOVE,
    payload: { tabId: -1, id },
  });
  if (!response?.success) {
    throw new Error(response?.error ?? t('queue.error.remove'));
  }
}

/** Subscribe to QUEUE_CHANGED broadcasts; returns unsubscribe. */
export function onQueueChanged(cb: () => void): () => void {
  const listener = (message: unknown): boolean => {
    if (messagePayload(message, MESSAGE_TYPES.QUEUE_CHANGED)) cb();
    return false;
  };
  onMessage(listener);
  return () => removeOnMessageListener(listener);
}
