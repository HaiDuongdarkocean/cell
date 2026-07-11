/**
 * Card Creator message handler — CARD_CREATOR_REQUEST.
 *
 * Content-script asks background to invoke an AnkiConnect action. Background
 * performs the HTTP fetch (host_permissions <all_urls> covers localhost/LAN)
 * and returns the raw result. This keeps CORS + SW idle-eviction concerns
 * in the background, away from the content script.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type {
  MessageResponse,
  CardCreatorRequestPayload,
  CardCreatorResponseData,
} from '@/entities/message';
import { invokeAnkiConnect, AnkiConnectError } from '@/features/cardCreator/service/ankiConnectClient';

/** Register the Card Creator request handler. */
export function registerCardCreatorHandlers(ctx: BackgroundContext): void {
  ctx.on(
    MESSAGE_TYPES.CARD_CREATOR_REQUEST,
    async (request): Promise<MessageResponse<CardCreatorResponseData>> => {
      const payload = request.payload as CardCreatorRequestPayload | undefined;
      if (!payload?.url || !payload.action) {
        return { success: false, error: 'Missing url or action in CARD_CREATOR_REQUEST' };
      }

      try {
        const result = await invokeAnkiConnect(
          globalThis.fetch.bind(globalThis),
          payload.url,
          payload.action,
          payload.params,
          payload.timeoutMs,
        );
        return { success: true, data: { result } };
      } catch (err) {
        if (err instanceof AnkiConnectError) {
          return { success: false, error: `${err.action}: ${err.message}` };
        }
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      }
    },
  );
}
