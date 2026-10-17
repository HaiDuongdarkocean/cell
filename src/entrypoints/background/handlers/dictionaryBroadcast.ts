import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import { broadcastToAllContexts } from '../helpers/broadcast';

export function broadcastDictionaryChanged(
  ctx: BackgroundContext,
  langCode: string,
  reason: string,
): void {
  void broadcastToAllContexts(ctx, {
    type: MESSAGE_TYPES.DICTIONARY_CHANGED,
    payload: { reason, langCode },
  });
}
