/**
 * Word status message handlers — WORD_STATUS_GET / WORD_STATUS_SET /
 * WORD_STATUS_LIST / WORD_STATUS_CYCLE / WORD_STATUS_DELETE.
 *
 * Content scripts ask the background to read/write word status because
 * IndexedDB is origin-isolated: the extension's IDB lives in the extension
 * origin, not the web page. Background keeps the single source of truth.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { t } from '@/shared/i18n';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import {
  WordStatusGetPayloadSchema,
  WordStatusesGetPayloadSchema,
  WordStatusSetPayloadSchema,
  WordStatusListPayloadSchema,
  WordStatusCyclePayloadSchema,
  WordStatusDeletePayloadSchema,
  WordStatusSetManyPayloadSchema,
  WordStatusTrashManyPayloadSchema,
  WordStatusTrashPayloadSchema,
  WordStatusTrashListPayloadSchema,
  WordStatusRestoreManyPayloadSchema,
  WordStatusRestorePayloadSchema,
  WordStatusTrashDeletePayloadSchema,
} from '@/entities/message/dictionarySchemas';
import {
  getWordStatus,
  getWordStatuses,
  getAllWordStatuses,
  getPosStatusRows,
  aggregatePosStatus,
  setWordStatus,
  setWordStatuses,
  setWordStatusPos,
  cycleWordStatus,
  cycleWordStatusPos,
  deleteWordStatus,
} from '@/features/dictionary/services/wordStatusStore';
import {
  trashWordStatus,
  trashWordStatuses,
  listWordTrash,
  purgeExpiredTrash,
  restoreWordStatus,
  restoreWordStatuses,
  deleteWordTrash,
  type TrashedWordEntry,
} from '@/features/dictionary/services/wordTrashStore';
import type { WordStatus } from '@/entities/dictionary';
import {
  queryTabs,
  sendMessageToAllFramesInTab,
} from '@/shared/lib/chrome-apis/tabs';
import {
  isFirstStatusesGetForTab,
  requestRemoteCheck,
} from '../syncTriggers';
import { notifyUserMarkedKnown } from '@/features/ankiStatusSync';

/** Term status for cross-tab highlighting: least-learned aggregate over
 *  materialized pos rows + the term row (spec REQ-9 approximation). */
async function aggregateTermStatus(langCode: string, term: string): Promise<WordStatus> {
  const [termStatus, posRows] = await Promise.all([
    getWordStatus(langCode, term),
    getPosStatusRows(langCode, term),
  ]);
  return aggregatePosStatus(termStatus, posRows);
}

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

async function notifyKnownSequentially(langCode: string, terms: readonly string[]): Promise<void> {
  for (const term of terms) await notifyUserMarkedKnown(langCode, term);
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

    const { term, langCode, status, tabId, pos } = parsed.data;
    if (status === 'learning') return { success: true };
    try {
      if (pos) {
        await setWordStatusPos(langCode, term, pos, status, { source: 'user', sourceAt: Date.now() });
      } else {
        await setWordStatus(langCode, term, status, { source: 'user', sourceAt: Date.now() });
      }
      if (status === 'known') void notifyUserMarkedKnown(langCode, term);
      if (tabId !== undefined) {
        const termStatus = pos ? await aggregateTermStatus(langCode, term) : status;
        void broadcastToOtherTabs(tabId, MESSAGE_TYPES.WORD_STATUS_CHANGED, { langCode, term, status: termStatus, ...(pos ? { pos } : {}) });
      }
      requestRemoteCheck();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: t('vocabulary.error.actionFailed', [message]) };
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
      requestRemoteCheck();
      return { success: true, data: { status } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: t('vocabulary.error.actionFailed', [message]) };
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

    const { langCode, terms, tabId } = parsed.data;
    try {
      const map = await getWordStatuses(langCode, terms);
      const statuses: Record<string, WordStatus> = {};
      for (const [term, status] of map.entries()) {
        statuses[term] = status;
      }
      if (isFirstStatusesGetForTab(tabId)) requestRemoteCheck();
      return { success: true, data: { statuses } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: t('vocabulary.error.actionFailed', [message]) };
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
      await purgeExpiredTrash(parsed.data.langCode).catch(() => undefined);
      const entries = await getAllWordStatuses(parsed.data.langCode);
      requestRemoteCheck();
      return { success: true, data: { entries: [...entries] } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: t('vocabulary.error.actionFailed', [message]) };
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

    const { term, langCode, tabId, pos } = parsed.data;
    try {
      const status = pos
        ? await cycleWordStatusPos(langCode, term, pos)
        : await cycleWordStatus(langCode, term);
      if (status === 'known') void notifyUserMarkedKnown(langCode, term);
      const termStatus = pos ? await aggregateTermStatus(langCode, term) : status;
      void broadcastToOtherTabs(tabId, MESSAGE_TYPES.WORD_STATUS_CHANGED, { langCode, term, status: termStatus, ...(pos ? { pos } : {}) });
      requestRemoteCheck();
      return { success: true, data: { status } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: t('vocabulary.error.actionFailed', [message]) };
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
      requestRemoteCheck();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: t('vocabulary.error.actionFailed', [message]) };
    }
  });

  ctx.on(MESSAGE_TYPES.WORD_STATUS_SET_MANY, async (request): Promise<MessageResponse> => {
    const parsed = WordStatusSetManyPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid WORD_STATUS_SET_MANY payload: ${parsed.error.message}`,
      };
    }

    const { langCode, terms, status, tabId } = parsed.data;
    if (status === 'learning') return { success: true };
    try {
      await setWordStatuses(langCode, terms, status, { source: 'user', sourceAt: Date.now() });
      if (status === 'known') void notifyKnownSequentially(langCode, terms);
      void broadcastToOtherTabs(tabId, MESSAGE_TYPES.WORD_STATUS_SET_MANY, { langCode, terms, status });
      requestRemoteCheck();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: t('vocabulary.error.actionFailed', [message]) };
    }
  });

  ctx.on(MESSAGE_TYPES.WORD_STATUS_TRASH_MANY, async (request): Promise<MessageResponse> => {
    const parsed = WordStatusTrashManyPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid WORD_STATUS_TRASH_MANY payload: ${parsed.error.message}`,
      };
    }

    const { langCode, terms, tabId } = parsed.data;
    try {
      await trashWordStatuses(langCode, terms);
      void broadcastToOtherTabs(tabId, MESSAGE_TYPES.WORD_STATUS_TRASH_MANY, { langCode, terms });
      requestRemoteCheck();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: t('vocabulary.error.actionFailed', [message]) };
    }
  });

  ctx.on(MESSAGE_TYPES.WORD_STATUS_RESTORE_MANY, async (request): Promise<MessageResponse> => {
    const parsed = WordStatusRestoreManyPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid WORD_STATUS_RESTORE_MANY payload: ${parsed.error.message}`,
      };
    }

    const { langCode, terms, tabId } = parsed.data;
    try {
      const restored = await restoreWordStatuses(langCode, terms);
      const restoredKnown = [...restored].filter(([, status]) => status === 'known').map(([term]) => term);
      void notifyKnownSequentially(langCode, restoredKnown);
      void broadcastToOtherTabs(tabId, MESSAGE_TYPES.WORD_STATUS_RESTORE_MANY, { langCode, terms });
      requestRemoteCheck();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: t('vocabulary.error.actionFailed', [message]) };
    }
  });

  ctx.on(MESSAGE_TYPES.WORD_STATUS_TRASH, async (request): Promise<MessageResponse> => {
    const parsed = WordStatusTrashPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid WORD_STATUS_TRASH payload: ${parsed.error.message}`,
      };
    }

    const { term, langCode, tabId } = parsed.data;
    try {
      await trashWordStatus(langCode, term);
      void broadcastToOtherTabs(tabId, MESSAGE_TYPES.WORD_STATUS_DELETED, { langCode, term });
      requestRemoteCheck();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: t('vocabulary.error.actionFailed', [message]) };
    }
  });

  ctx.on(MESSAGE_TYPES.WORD_STATUS_TRASH_LIST, async (request): Promise<MessageResponse<{ entries: TrashedWordEntry[] }>> => {
    const parsed = WordStatusTrashListPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid WORD_STATUS_TRASH_LIST payload: ${parsed.error.message}`,
      };
    }

    try {
      const entries = await listWordTrash(parsed.data.langCode);
      requestRemoteCheck();
      return { success: true, data: { entries } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: t('vocabulary.error.actionFailed', [message]) };
    }
  });

  ctx.on(MESSAGE_TYPES.WORD_STATUS_RESTORE, async (request): Promise<MessageResponse<{ status: WordStatus }>> => {
    const parsed = WordStatusRestorePayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid WORD_STATUS_RESTORE payload: ${parsed.error.message}`,
      };
    }

    const { term, langCode, tabId } = parsed.data;
    try {
      const status = await restoreWordStatus(langCode, term);
      if (status === 'known') void notifyUserMarkedKnown(langCode, term);
      void broadcastToOtherTabs(tabId, MESSAGE_TYPES.WORD_STATUS_CHANGED, { langCode, term, status });
      requestRemoteCheck();
      return { success: true, data: { status } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: t('vocabulary.error.actionFailed', [message]) };
    }
  });

  ctx.on(MESSAGE_TYPES.WORD_STATUS_TRASH_DELETE, async (request): Promise<MessageResponse> => {
    const parsed = WordStatusTrashDeletePayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid WORD_STATUS_TRASH_DELETE payload: ${parsed.error.message}`,
      };
    }

    const { term, langCode } = parsed.data;
    try {
      await deleteWordTrash(langCode, term);
      requestRemoteCheck();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: t('vocabulary.error.actionFailed', [message]) };
    }
  });
}
