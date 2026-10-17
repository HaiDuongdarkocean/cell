/**
 * Mining queue message handlers — QUEUE_ADD / QUEUE_LIST / QUEUE_GET /
 * QUEUE_REMOVE + QUEUE_CHANGED broadcast (spec mining-queue.md REQ-7).
 *
 * The queue IDB lives in the extension origin; background is the single
 * writer so every surface (popup, universal panel, local-player page) shares
 * one queue. Every mutation broadcasts QUEUE_CHANGED to all tabs + extension
 * pages so open surfaces refetch.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import {
  addQueueItem,
  listQueueRows,
  getQueueItem,
  removeQueueItem,
} from '@/features/miningQueue/services/miningQueueRepository';
import type { MiningQueueInput } from '@/entities/miningQueue';
import { broadcastToAllContexts } from '../helpers/broadcast';

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function broadcastQueueChanged(ctx: BackgroundContext): Promise<void> {
  await broadcastToAllContexts(ctx, {
    type: MESSAGE_TYPES.QUEUE_CHANGED,
    payload: { tabId: -1 },
  });
}

export function registerMiningQueueHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.QUEUE_ADD, async (request): Promise<MessageResponse<{ id: string; deduped: boolean }>> => {
    const payload = request.payload as { item: MiningQueueInput };
    try {
      const { item, deduped } = await addQueueItem(payload.item);
      void broadcastQueueChanged(ctx);
      return { success: true, data: { id: item.id, deduped } };
    } catch (err) {
      return { success: false, error: errMessage(err) };
    }
  });

  ctx.on(MESSAGE_TYPES.QUEUE_LIST, async (): Promise<MessageResponse> => {
    try {
      const rows = await listQueueRows();
      return { success: true, data: { rows } };
    } catch (err) {
      return { success: false, error: errMessage(err) };
    }
  });

  ctx.on(MESSAGE_TYPES.QUEUE_GET, async (request): Promise<MessageResponse> => {
    const { id } = request.payload as { id: string };
    try {
      const item = await getQueueItem(id);
      return { success: true, data: { item } };
    } catch (err) {
      return { success: false, error: errMessage(err) };
    }
  });

  ctx.on(MESSAGE_TYPES.QUEUE_REMOVE, async (request): Promise<MessageResponse> => {
    const { id } = request.payload as { id: string };
    try {
      const removed = await removeQueueItem(id);
      if (removed) void broadcastQueueChanged(ctx);
      return { success: true, data: { removed } };
    } catch (err) {
      return { success: false, error: errMessage(err) };
    }
  });
}
