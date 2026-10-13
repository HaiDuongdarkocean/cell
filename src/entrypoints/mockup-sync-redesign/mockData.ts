/** Deterministic fixtures for the sync redesign mockup. */

export type DriveState =
  | 'empty'
  | 'connected'
  | 'syncing'
  | 'reauth'
  | 'offline'
  | 'full'
  | 'error';

export type AnkiState = 'off' | 'never' | 'idle' | 'syncing' | 'error';

export interface DriveAccount {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly isSystem: boolean;
}

export interface DriveFixture {
  readonly accounts: readonly DriveAccount[];
  readonly lastSyncedAt: number | null;
  /** Items synced per day, oldest → newest (14 values). */
  readonly activity: readonly number[];
  readonly profiles: readonly { readonly id: string; readonly label: string; readonly destination: string }[];
}

const HOUR = 3_600_000;

export const DRIVE_FIXTURES: Record<DriveState, DriveFixture> = {
  empty: {
    accounts: [],
    lastSyncedAt: null,
    activity: [],
    profiles: [],
  },
  connected: {
    accounts: [
      { id: 'c1', name: 'the0cean@gmail.com', provider: 'Google Drive', isSystem: true },
    ],
    lastSyncedAt: Date.now() - 2 * HOUR,
    activity: [2, 5, 0, 8, 3, 12, 6, 0, 4, 9, 14, 7, 11, 18],
    profiles: [
      { id: 'p1', label: 'English', destination: 'c1' },
      { id: 'p2', label: '日本語', destination: 'c1' },
      { id: 'p3', label: 'Tiếng Việt', destination: 'local' },
    ],
  },
  syncing: {
    accounts: [
      { id: 'c1', name: 'the0cean@gmail.com', provider: 'Google Drive', isSystem: true },
    ],
    lastSyncedAt: Date.now() - 26 * HOUR,
    activity: [2, 5, 0, 8, 3, 12, 6, 0, 4, 9, 14, 7, 11, 18],
    profiles: [
      { id: 'p1', label: 'English', destination: 'c1' },
      { id: 'p2', label: '日本語', destination: 'c1' },
      { id: 'p3', label: 'Tiếng Việt', destination: 'local' },
    ],
  },
  reauth: {
    accounts: [
      { id: 'c1', name: 'the0cean@gmail.com', provider: 'Google Drive', isSystem: true },
    ],
    lastSyncedAt: Date.now() - 72 * HOUR,
    activity: [2, 5, 0, 8, 3, 12, 6, 0, 4, 9, 0, 0, 0, 0],
    profiles: [
      { id: 'p1', label: 'English', destination: 'c1' },
      { id: 'p2', label: '日本語', destination: 'c1' },
    ],
  },
  offline: {
    accounts: [
      { id: 'c1', name: 'the0cean@gmail.com', provider: 'Google Drive', isSystem: true },
    ],
    lastSyncedAt: Date.now() - 5 * HOUR,
    activity: [2, 5, 0, 8, 3, 12, 6, 0, 4, 9, 14, 7, 11, 18],
    profiles: [],
  },
  full: {
    accounts: [
      { id: 'c1', name: 'the0cean@gmail.com', provider: 'Google Drive', isSystem: true },
    ],
    lastSyncedAt: Date.now() - 30 * HOUR,
    activity: [2, 5, 0, 8, 3, 12, 6, 0, 4, 9, 14, 0, 0, 0],
    profiles: [],
  },
  error: {
    accounts: [
      { id: 'c1', name: 'the0cean@gmail.com', provider: 'Google Drive', isSystem: true },
    ],
    lastSyncedAt: null,
    activity: [],
    profiles: [],
  },
};

export interface AnkiFixture {
  readonly enabled: boolean;
  readonly lastSyncAt: number | null;
  readonly cardsSeen: number;
  readonly changed: number;
  readonly errors: number;
  readonly addonOnline: boolean | null;
  /** Statuses changed per sync run, oldest → newest (14 values). */
  readonly changesPerSync: readonly number[];
  /** Errors per sync run, same window. */
  readonly errorsPerSync: readonly number[];
}

export const ANKI_FIXTURES: Record<AnkiState, AnkiFixture> = {
  off: {
    enabled: false,
    lastSyncAt: Date.now() - 240 * HOUR,
    cardsSeen: 0,
    changed: 0,
    errors: 0,
    addonOnline: null,
    changesPerSync: [],
    errorsPerSync: [],
  },
  never: {
    enabled: true,
    lastSyncAt: null,
    cardsSeen: 0,
    changed: 0,
    errors: 0,
    addonOnline: true,
    changesPerSync: [],
    errorsPerSync: [],
  },
  idle: {
    enabled: true,
    lastSyncAt: Date.now() - 2 * HOUR,
    cardsSeen: 1240,
    changed: 18,
    errors: 0,
    addonOnline: true,
    changesPerSync: [4, 12, 7, 22, 9, 3, 15, 31, 6, 11, 8, 19, 14, 18],
    errorsPerSync: [0, 1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0],
  },
  syncing: {
    enabled: true,
    lastSyncAt: Date.now() - 26 * HOUR,
    cardsSeen: 1240,
    changed: 0,
    errors: 0,
    addonOnline: true,
    changesPerSync: [4, 12, 7, 22, 9, 3, 15, 31, 6, 11, 8, 19, 14, 18],
    errorsPerSync: [0, 1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0],
  },
  error: {
    enabled: true,
    lastSyncAt: Date.now() - 30 * HOUR,
    cardsSeen: 1187,
    changed: 9,
    errors: 12,
    addonOnline: false,
    changesPerSync: [4, 12, 7, 22, 9, 3, 15, 31, 6, 11, 8, 0, 0, 9],
    errorsPerSync: [0, 1, 0, 0, 0, 0, 2, 0, 0, 0, 3, 4, 5, 12],
  },
};

export function timeAgo(value: number): string {
  const diffSec = Math.round((value - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86400), 'day');
}
