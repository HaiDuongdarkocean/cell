/**
 * Popup Dictionary lookup handler — LOOKUP_REQUEST.
 *
 * Content-script asks background to run a dictionary lookup. Background
 * performs the IDB query (extension origin) and returns the LookupResult.
 * This is necessary because IDB is origin-isolated: content scripts on
 * web pages cannot access the extension's IDB databases.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import { lookupOrchestratorMulti } from '@/features/dictionaryPopup/logic/lookupOrchestrator';
import type { LookupRequest, LookupResult } from '@/features/dictionaryPopup/types';

/** In-flight lookup abort controllers (for cancellation). */
const abortControllers = new Map<string, AbortController>();

/** Register the popup dictionary lookup handlers. */
export function registerLookupHandlers(ctx: BackgroundContext): void {
  ctx.on(
    MESSAGE_TYPES.LOOKUP_REQUEST,
    async (request): Promise<MessageResponse<LookupResult[]>> => {
      const payload = request.payload as { requestId: string; request: LookupRequest } | undefined;
      if (!payload?.requestId || !payload?.request) {
        return { success: false, error: 'Missing requestId or request in LOOKUP_REQUEST' };
      }

      const { requestId, request: lookupRequest } = payload;
      const ac = new AbortController();
      abortControllers.set(requestId, ac);

      try {
        const results = await lookupOrchestratorMulti(lookupRequest, {}, ac.signal);
        return { success: true, data: results };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      } finally {
        abortControllers.delete(requestId);
      }
    },
  );

  ctx.on(
    MESSAGE_TYPES.LOOKUP_CANCEL,
    async (request): Promise<MessageResponse<null>> => {
      const payload = request.payload as { requestId?: string } | undefined;
      const requestId = payload?.requestId;
      if (requestId) {
        const ac = abortControllers.get(requestId);
        if (ac) {
          ac.abort();
          abortControllers.delete(requestId);
        }
      }
      return { success: true, data: null };
    },
  );
}
