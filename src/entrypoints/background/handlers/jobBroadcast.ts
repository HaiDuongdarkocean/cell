import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { Job } from '@/entities/job/types';
import type { BackgroundContext } from '../context';
import { broadcastToAllContexts } from '../helpers/broadcast';

export function broadcastJobEvent(
  ctx: BackgroundContext,
  payload: { job?: Job; removedId?: string },
): void {
  void broadcastToAllContexts(ctx, { type: MESSAGE_TYPES.JOB_EVENT, payload });
}
