import {
  DEFAULT_SRS_SETTINGS,
  SRS_REMINDER_ALARM,
  SRS_REMINDER_LOOKBACK_DAYS,
  SRS_REMINDER_NOTIFICATION_ID,
  SRS_REMINDER_SNOOZE_MS,
} from '@/shared/config/config';
import {
  clearAlarm,
  createAlarm,
  createNotification,
  createTab,
  getAlarm,
  getNotificationPermissionLevel,
  getURL,
  queryTabs,
  updateTab,
  updateWindow,
} from '@/shared/lib/chrome-apis';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { t } from '@/shared/i18n';
import { getAllCollections } from '@/features/srs/repositories/collectionRepository';
import { getReviewEventsByTimestampRange } from '@/features/srs/repositories/reviewEventRepository';
import { computeLearnedHour, adoptLearnedCandidate, nextReminderFireMs } from '@/features/srs/logic/learnReminderHour';
import { computeStreak, dayKeyFor, dayStartMs, getSrsHomeStats } from '@/features/srs/services/getSrsHomeStats';
import { getDayStartHourMirror, getReminderState, setReminderState } from '@/features/srs/services/reminderState';
import { logger } from '@/shared/lib/logger';

export type ReminderTrigger = 'alarm' | 'snooze' | 'init' | 'config';

export const SRS_REMINDER_SNOOZE_ALARM = 'srs-reminder-snooze';
const DAY_MS = 24 * 60 * 60 * 1000;
const SRS_STUDY_PATH = 'src/entrypoints/srs-study/index.html';

async function readReminderConfig(): Promise<{ enabled: boolean; preferredHour: number }> {
  const settings = await loadSettings();
  const reminder = settings.srs.reminder ?? DEFAULT_SRS_SETTINGS.reminder;
  const preferred = reminder.preferredHour;
  return {
    enabled: reminder.enabled,
    preferredHour: preferred >= 0 && preferred <= 23 ? preferred : DEFAULT_SRS_SETTINGS.reminder.preferredHour,
  };
}

async function armAt(whenMs: number): Promise<void> {
  await createAlarm(SRS_REMINDER_ALARM, { when: Math.max(whenMs, Date.now() + 1000) });
}

/** Re-assert the alarm after a service-worker restart — alarms may be dropped. */
export async function ensureReminderArmed(now = new Date()): Promise<void> {
  try {
    const config = await readReminderConfig();
    if (!config.enabled) {
      await clearAlarm(SRS_REMINDER_ALARM);
      await clearAlarm(SRS_REMINDER_SNOOZE_ALARM);
      return;
    }
    const snoozed = await getAlarm(SRS_REMINDER_SNOOZE_ALARM);
    if (snoozed) return;
    const alarm = await getAlarm(SRS_REMINDER_ALARM);
    if (alarm && alarm.scheduledTime > now.getTime()) return;
    await evaluateReminder('init', now);
  } catch (error) {
    logger.warn('srs-reminder: ensure armed failed', { error });
  }
}

export async function snoozeReminder(now = Date.now()): Promise<void> {
  await createAlarm(SRS_REMINDER_SNOOZE_ALARM, { when: now + SRS_REMINDER_SNOOZE_MS });
}

export async function openSrsStudyTab(): Promise<void> {
  const url = getURL(SRS_STUDY_PATH);
  const existing = (await queryTabs({ url: `${url}*` }))[0];
  if (existing?.id !== undefined) {
    await updateTab(existing.id, { active: true });
    if (existing.windowId !== undefined) await updateWindow(existing.windowId, { focused: true });
    return;
  }
  await createTab({ url });
}

async function resolveCollectionId(): Promise<string | null> {
  const settings = await loadSettings();
  if (settings.srs.activeCollectionId) return settings.srs.activeCollectionId;
  const collections = await getAllCollections();
  return collections[0]?.id ?? null;
}

async function notify(dueNow: number, streakDays: number): Promise<void> {
  await createNotification(SRS_REMINDER_NOTIFICATION_ID, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: t('srs.reminder.title'),
    message: t('srs.reminder.body', [dueNow, streakDays]),
    buttons: [{ title: t('srs.reminder.studyNow') }, { title: t('srs.reminder.snooze') }],
    priority: 1,
    requireInteraction: true,
  });
}

export async function evaluateReminder(trigger: ReminderTrigger, now = new Date()): Promise<void> {
  try {
    const config = await readReminderConfig();
    if (!config.enabled) {
      await clearAlarm(SRS_REMINDER_ALARM);
      return;
    }

    const state = await getReminderState();
    const dayStartHour = await getDayStartHourMirror();
    const todayStart = dayStartMs(now, dayStartHour);
    const events = await getReviewEventsByTimestampRange(
      todayStart - SRS_REMINDER_LOOKBACK_DAYS * DAY_MS,
      now.getTime(),
    );
    const dayKey = dayKeyFor(now.getTime(), dayStartHour);
    const studiedToday = events.some((e) => e.answeredAt >= todayStart);

    const candidate = computeLearnedHour(events, dayStartHour);
    const learnedHour = adoptLearnedCandidate(candidate, state.learnedHour) ?? state.learnedHour;
    const effectiveHour = learnedHour ?? config.preferredHour;
    const nextSlot = nextReminderFireMs(effectiveHour, now.getTime());

    if (studiedToday) {
      await setReminderState({
        ...state,
        learnedHour,
        stats: candidate ? { count: candidate.count, runnerUp: candidate.runnerUpCount } : state.stats,
        lastStudiedDayKey: dayKey,
      });
      await armAt(nextSlot);
      return;
    }

    const lastSlot = nextReminderFireMs(effectiveHour, now.getTime() - DAY_MS);
    const slotElapsed = lastSlot >= todayStart;
    const alreadyNotified = state.notificationDayKey === dayKey && trigger !== 'snooze';
    const permission = await getNotificationPermissionLevel();

    const collectionId = slotElapsed && !alreadyNotified && permission === 'granted'
      ? await resolveCollectionId()
      : null;
    if (slotElapsed && !alreadyNotified && permission === 'granted' && collectionId) {
      const stats = await getSrsHomeStats(collectionId, dayStartHour, now);
      const streakDays = Math.max(
        stats.streakDays - 1,
        computeStreak(new Set(events.map((e) => dayKeyFor(e.answeredAt, dayStartHour))), dayStartHour, now),
      );
      await notify(stats.dueNow, streakDays);
      await setReminderState({
        ...state,
        learnedHour,
        stats: candidate ? { count: candidate.count, runnerUp: candidate.runnerUpCount } : state.stats,
        notificationDayKey: dayKey,
      });
    } else {
      await setReminderState({
        ...state,
        learnedHour,
        stats: candidate ? { count: candidate.count, runnerUp: candidate.runnerUpCount } : state.stats,
      });
    }

    await armAt(nextSlot);
  } catch (error) {
    logger.warn('srs-reminder: evaluate failed', { error });
    try {
      await createAlarm(SRS_REMINDER_ALARM, { when: Date.now() + 60 * 60 * 1000 });
    } catch {
      // best-effort retry arm; next SW init re-asserts via ensureReminderArmed
    }
  }
}
