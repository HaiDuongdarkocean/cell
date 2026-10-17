import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import { broadcastToAllContexts } from '../helpers/broadcast';

export async function broadcastSrsCardsChanged(
  ctx: BackgroundContext,
  langCode: string,
): Promise<void> {
  await broadcastToAllContexts(ctx, {
    type: MESSAGE_TYPES.SRS_CARDS_CHANGED,
    payload: { langCode },
  });
}
