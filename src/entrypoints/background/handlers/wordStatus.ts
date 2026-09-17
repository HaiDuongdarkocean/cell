/**
 * Word status message handlers — WORD_STATUS_GET / WORD_STATUS_SET /
 * WORD_STATUS_LIST / WORD_STATUS_CYCLE / WORD_STATUS_DELETE.
 *
 * Content scripts ask the background to read/write word status because
 * IndexedDB is origin-isolated: the extension's IDB lives in the extension
 * origin, not the web page. Background keeps the single source of truth.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import {
  WordStatusGetPayloadSchema,
  WordStatusesGetPayloadSchema,
  WordStatusSetPayloadSchema,
  WordStatusListPayloadSchema,
  WordStatusCyclePayloadSchema,
  WordStatusDeletePayloadSchema,
} from '@/entities/message/dictionarySchemas';
import {
  getWordStatus,
  getWordStatuses,
  getAllWordStatuses,
  setWordStatus,
  cycleWordStatus,
  deleteWordStatus,
} from '@/features/dictionary/services/wordStatusStore';
import type { WordStatus } from '@/entities/dictionary';
import {
  queryTabs,
  sendMessageToAllFramesInTab,
} from '@/shared/lib/chrome-apis/tabs';

/** Broadcast a status change/delete to content scripts in all other tabs. */
async function broadcastToOtherTabs(
  sourceTabId: number,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const tabs = await queryTabs({});
  const message = { type, payload: { tabId: sourceTabId, ...payload } };
  const targets = tabs.filter((tab) => tab.id !== undefined && tab.id !== sourceTabId);
  await Promise.allSettled(
    targets.map((tab) => sendMessageToAllFramesInTab(tab.id!, message)),
  );
}

/** Register word status handlers. */
export function registerWordStatusHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.WORD_STATUS_SET, async (request): Promise<MessageResponse> => {
    const parsed = WordStatusSetPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid WORD_STATUS_SET payload: ${parsed.error.message}`,
      };
    }

    const { term, langCode, status, tabId } = parsed.data;
    try {
      await setWordStatus(langCode, term, status);
      if (tabId !== undefined) {
        void broadcastToOtherTabs(tabId, MESSAGE_TYPES.WORD_STATUS_CHANGED, { langCode, term, status });
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ctx.on(MESSAGE_TYPES.WORD_STATUS_GET, async (request): Promise<MessageResponse<{ status: WordStatus }>> => {
    const parsed = WordStatusGetPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid WORD_STATUS_GET payload: ${parsed.error.message}`,
      };
    }

    const { term, langCode } = parsed.data;
    try {
      const status = await getWordStatus(langCode, term);
      return { success: true, data: { status } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ctx.on(MESSAGE_TYPES.WORD_STATUSES_GET, async (request): Promise<MessageResponse<{ statuses: Record<string, WordStatus> }>> => {
    const parsed = WordStatusesGetPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid WORD_STATUSES_GET payload: ${parsed.error.message}`,
      };
    }

    const { langCode, terms } = parsed.data;
    try {
      const map = await getWordStatuses(langCode, terms);
      const statuses: Record<string, WordStatus> = {};
      for (const [term, status] of map.entries()) {
        statuses[term] = status;
      }
      return { success: true, data: { statuses } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ctx.on(MESSAGE_TYPES.WORD_STATUS_LIST, async (request): Promise<MessageResponse<{ entries: { term: string; status: WordStatus; updatedAt: number }[] }>> => {
    const parsed = WordStatusListPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid WORD_STATUS_LIST payload: ${parsed.error.message}`,
      };
    }

    try {
      const entries = await getAllWordStatuses(parsed.data.langCode);
      return { success: true, data: { entries: [...entries] } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ctx.on(MESSAGE_TYPES.WORD_STATUS_CYCLE, async (request): Promise<MessageResponse<{ status: WordStatus }>> => {
    const parsed = WordStatusCyclePayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid WORD_STATUS_CYCLE payload: ${parsed.error.message}`,
      };
    }

    const { term, langCode, tabId } = parsed.data;
    try {
      const status = await cycleWordStatus(langCode, term);
      void broadcastToOtherTabs(tabId, MESSAGE_TYPES.WORD_STATUS_CHANGED, { langCode, term, status });
      return { success: true, data: { status } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ctx.on(MESSAGE_TYPES.WORD_STATUS_DELETE, async (request): Promise<MessageResponse> => {
    const parsed = WordStatusDeletePayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid WORD_STATUS_DELETE payload: ${parsed.error.message}`,
      };
    }

    const { term, langCode, tabId } = parsed.data;
    try {
      await deleteWordStatus(langCode, term);
      void broadcastToOtherTabs(tabId, MESSAGE_TYPES.WORD_STATUS_DELETED, { langCode, term });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });
}
