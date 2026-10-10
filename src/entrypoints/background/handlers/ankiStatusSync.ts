/** Anki status sync handlers — manual sync trigger + state read, plus the
 *  periodic alarm tick. Spec anki-known-seed REQ-3/6/8. */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { t } from '@/shared/i18n';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import {
  AnkiStatusCardTermsPayloadSchema,
  AnkiStatusSyncRunPayloadSchema,
  AnkiStatusSrsCardDeletedPayloadSchema,
  AnkiStatusSrsReviewedPayloadSchema,
} from '@/entities/message/ankiStatusSyncSchemas';
import {
  ANKI_STATUS_SYNC_ALARM,
  ANKI_SYNC_PERIOD_MINUTES,
  getSyncState,
  listCardSourceTerms,
  reconcileSrsCardLoss,
  runAnkiStatusSync,
  syncSrsReviewToStatus,
} from '@/features/ankiStatusSync';
import type { CardSourceTerms } from '@/features/ankiStatusSync';
import { getCard, getNote } from '@/features/srs';
import { logger } from '@/shared/lib/logger';
import { broadcastSrsCardsChanged } from './srsCardsBroadcast';

let running = false;

async function runOnce(trigger: 'alarm' | 'manual', ctx: BackgroundContext): Promise<void> {
  if (running) return;
  running = true;
  try {
    const result = await runAnkiStatusSync(trigger);
    // Card links may have been swept/added without a status change — repaint
    // the token card layer in every context.
    if (result.langCode) void broadcastSrsCardsChanged(ctx, result.langCode);
  } catch (err) {
    logger.warn('anki-status-sync: run failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    running = false;
  }
}

export function registerAnkiStatusSyncHandlers(ctx: BackgroundContext): void {

  ctx.on(MESSAGE_TYPES.ANKI_STATUS_SYNC_RUN, async (request): Promise<MessageResponse> => {
    const parsed = AnkiStatusSyncRunPayloadSchema.safeParse(request.payload ?? {});
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid ANKI_STATUS_SYNC_RUN payload: ${parsed.error.message}`,
      };
    }
    try {
      await runOnce('manual', ctx);
      const state = await getSyncState();
      return { success: true, data: state };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: t('vocabulary.error.actionFailed', [message]) };
    }
  });

  ctx.on(MESSAGE_TYPES.ANKI_STATUS_SYNC_STATE, async (): Promise<MessageResponse> => {
    try {
      const state = await getSyncState();
      return { success: true, data: state };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: t('vocabulary.error.actionFailed', [message]) };
    }
  });

  ctx.on(MESSAGE_TYPES.ANKI_STATUS_CARD_TERMS, async (request): Promise<MessageResponse<CardSourceTerms>> => {
    const parsed = AnkiStatusCardTermsPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid ANKI_STATUS_CARD_TERMS payload: ${parsed.error.message}`,
      };
    }
    try {
      const data = await listCardSourceTerms(parsed.data.langCode);
      return { success: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: t('vocabulary.error.actionFailed', [message]) };
    }
  });

  ctx.on(MESSAGE_TYPES.ANKI_STATUS_SRS_REVIEWED, async (request): Promise<MessageResponse> => {
    const parsed = AnkiStatusSrsReviewedPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid ANKI_STATUS_SRS_REVIEWED payload: ${parsed.error.message}`,
      };
    }
    try {
      const { noteId, cardId } = parsed.data;
      const [note, card] = await Promise.all([getNote(noteId), getCard(cardId)]);
      await syncSrsReviewToStatus(note, card);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: t('vocabulary.error.actionFailed', [message]) };
    }
  });

  ctx.on(MESSAGE_TYPES.ANKI_STATUS_SRS_CARD_DELETED, async (request): Promise<MessageResponse> => {
    const parsed = AnkiStatusSrsCardDeletedPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid ANKI_STATUS_SRS_CARD_DELETED payload: ${parsed.error.message}`,
      };
    }
    try {
      const langCode = await reconcileSrsCardLoss(parsed.data.deckId, parsed.data.targetWord);
      if (langCode) void broadcastSrsCardsChanged(ctx, langCode);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: t('vocabulary.error.actionFailed', [message]) };
    }
  });
}

export function wireAnkiStatusSyncScheduling(ctx: BackgroundContext): Array<() => void> {
  const unsubs: Array<() => void> = [];
  if (typeof chrome !== 'undefined' && chrome.alarms !== undefined) {
    const onAlarm = (alarm: chrome.alarms.Alarm) => {
      if (alarm.name === ANKI_STATUS_SYNC_ALARM) void runOnce('alarm', ctx);
    };
    void chrome.alarms.create(ANKI_STATUS_SYNC_ALARM, {
      periodInMinutes: ANKI_SYNC_PERIOD_MINUTES,
    });
    chrome.alarms.onAlarm.addListener(onAlarm);
    unsubs.push(() => chrome.alarms.onAlarm.removeListener(onAlarm));
  }
  return unsubs;
}
