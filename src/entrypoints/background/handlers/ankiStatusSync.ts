/** Anki status sync handlers — manual sync trigger + state read, plus the
 *  periodic alarm tick. Spec anki-known-seed REQ-3/6/8. */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { t } from '@/shared/i18n';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import {
  AnkiStatusSyncRunPayloadSchema,
  AnkiStatusSrsReviewedPayloadSchema,
} from '@/entities/message/ankiStatusSyncSchemas';
import {
  ANKI_STATUS_SYNC_ALARM,
  ANKI_SYNC_PERIOD_MINUTES,
  getSyncState,
  runAnkiStatusSync,
  syncSrsReviewToStatus,
} from '@/features/ankiStatusSync';
import { getCard, getNote } from '@/features/srs';
import { logger } from '@/shared/lib/logger';

let running = false;

async function runOnce(trigger: 'alarm' | 'manual'): Promise<void> {
  if (running) return;
  running = true;
  try {
    await runAnkiStatusSync(trigger);
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
      await runOnce('manual');
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
}

export function wireAnkiStatusSyncScheduling(): Array<() => void> {
  const unsubs: Array<() => void> = [];
  if (typeof chrome !== 'undefined' && chrome.alarms !== undefined) {
    const onAlarm = (alarm: chrome.alarms.Alarm) => {
      if (alarm.name === ANKI_STATUS_SYNC_ALARM) void runOnce('alarm');
    };
    void chrome.alarms.create(ANKI_STATUS_SYNC_ALARM, {
      periodInMinutes: ANKI_SYNC_PERIOD_MINUTES,
    });
    chrome.alarms.onAlarm.addListener(onAlarm);
    unsubs.push(() => chrome.alarms.onAlarm.removeListener(onAlarm));
  }
  return unsubs;
}
