import { SRS_REMINDER_ALARM, SRS_REMINDER_NOTIFICATION_ID, STORAGE_KEYS } from '@/shared/config/config';
import { onAlarm, onNotificationButtonClicked, onNotificationClicked, onStorageChanged, removeOnAlarmListener } from '@/shared/lib/chrome-apis';
import {
  ensureReminderArmed,
  evaluateReminder,
  openSrsStudyTab,
  snoozeReminder,
  SRS_REMINDER_SNOOZE_ALARM,
} from '@/features/srs/services/reminderService';
import { logger } from '@/shared/lib/logger';

const SNOOZE_BUTTON_INDEX = 1;

export function wireSrsReminderScheduling(): Array<() => void> {
  const alarmListener = (alarm: chrome.alarms.Alarm): void => {
    if (alarm.name === SRS_REMINDER_ALARM) void evaluateReminder('alarm');
    else if (alarm.name === SRS_REMINDER_SNOOZE_ALARM) void evaluateReminder('snooze');
  };
  onAlarm(alarmListener);

  const clickListener = (notificationId: string): void => {
    if (notificationId !== SRS_REMINDER_NOTIFICATION_ID) return;
    void openSrsStudyTab().catch((error) => logger.warn('srs-reminder: open tab failed', { error }));
  };
  onNotificationClicked(clickListener);

  const buttonListener = (notificationId: string, buttonIndex: number): void => {
    if (notificationId !== SRS_REMINDER_NOTIFICATION_ID) return;
    if (buttonIndex === SNOOZE_BUTTON_INDEX) void snoozeReminder();
    else void openSrsStudyTab().catch((error) => logger.warn('srs-reminder: open tab failed', { error }));
  };
  onNotificationButtonClicked(buttonListener);

  const storageListener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    if (area !== 'local') return;
    if (!changes[STORAGE_KEYS.SETTINGS] && !changes[STORAGE_KEYS.SRS_UI_PREFS_MIRROR]) return;
    void evaluateReminder('config');
  };
  onStorageChanged(storageListener);

  void ensureReminderArmed();

  return [() => removeOnAlarmListener(alarmListener)];
}
