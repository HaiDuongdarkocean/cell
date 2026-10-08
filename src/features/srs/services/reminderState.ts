import { STORAGE_KEYS } from '@/shared/config/config';
import { getStorage, setStorage } from '@/shared/lib/chrome-apis';

export interface ReminderStats {
  readonly count: number;
  readonly runnerUp: number;
}

export interface ReminderState {
  readonly learnedHour: number | null;
  readonly stats: ReminderStats;
  readonly lastStudiedDayKey: string | null;
  readonly notificationDayKey: string | null;
}

export const DEFAULT_REMINDER_STATE: ReminderState = {
  learnedHour: null,
  stats: { count: 0, runnerUp: 0 },
  lastStudiedDayKey: null,
  notificationDayKey: null,
};

type ReminderStateRecord = Record<string, Partial<ReminderState> | undefined>;

export async function getReminderState(): Promise<ReminderState> {
  const stored = await getStorage<ReminderStateRecord>(STORAGE_KEYS.SRS_REMINDER_STATE);
  return { ...DEFAULT_REMINDER_STATE, ...(stored[STORAGE_KEYS.SRS_REMINDER_STATE] ?? {}) };
}

export async function setReminderState(state: ReminderState): Promise<void> {
  await setStorage({ [STORAGE_KEYS.SRS_REMINDER_STATE]: state });
}

type UiPrefsMirrorRecord = Record<string, { readonly dayStartHour?: number } | undefined>;

export async function getDayStartHourMirror(fallback = 4): Promise<number> {
  const stored = await getStorage<UiPrefsMirrorRecord>(STORAGE_KEYS.SRS_UI_PREFS_MIRROR);
  const hour = stored[STORAGE_KEYS.SRS_UI_PREFS_MIRROR]?.dayStartHour;
  return typeof hour === 'number' && hour >= 0 && hour <= 23 ? hour : fallback;
}
