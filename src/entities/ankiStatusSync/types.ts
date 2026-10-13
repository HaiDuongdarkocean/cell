/** anki-status-sync entities — shared types for Anki ↔ wordStatus ↔ SRS sync. */

export interface AnkiCardLink {
  readonly cardId: number;
  /** Normalized term (same key space as wordStatus rows). */
  readonly term: string;
  readonly langCode: string;
  readonly queue: number;
  readonly ivl: number;
  /** Anki `mod` — seconds-precision epoch. */
  readonly mod: number;
}

export type AnkiSyncTrigger = 'alarm' | 'manual' | 'import' | 'event' | 'srs';

/** One completed sync pass — newest first, capped by ANKI_RUN_HISTORY_CAP. */
export interface AnkiRunEntry {
  readonly at: number;
  readonly trigger: AnkiSyncTrigger;
  readonly cardsSeen: number;
  readonly changed: number;
  readonly errors: number;
  readonly writeBacksFlushed: number;
  readonly addonOnline: boolean;
  readonly langCode: string | null;
}

export const ANKI_RUN_HISTORY_CAP = 20;

export interface AnkiStatusSyncState {
  readonly lastSyncAt: number | null;
  readonly lastTrigger: AnkiSyncTrigger | null;
  readonly cardsSeen: number;
  readonly changed: number;
  readonly errors: number;
  readonly consecutiveFailures: number;
  /** null = never probed; false = addon offline → poll fallback active. */
  readonly addonOnline: boolean | null;
  readonly addonCursor: number;
  readonly writeBackUnsupportedNotified: boolean;
  readonly history: readonly AnkiRunEntry[];
}

export const EMPTY_ANKI_SYNC_STATE: AnkiStatusSyncState = {
  lastSyncAt: null,
  lastTrigger: null,
  cardsSeen: 0,
  changed: 0,
  errors: 0,
  consecutiveFailures: 0,
  addonOnline: null,
  addonCursor: 0,
  writeBackUnsupportedNotified: false,
  history: [],
};

export interface WriteBackTask {
  readonly cardId: number;
  readonly term: string;
  readonly langCode: string;
  readonly enqueuedAt: number;
  readonly attempts: number;
}

export interface WriteBackLogEntry {
  readonly cardId: number;
  readonly term: string;
  readonly ok: boolean;
  readonly reason: string;
  readonly at: number;
}

/** One parsed addon feed event. */
export interface AnkiBridgeEvent {
  readonly cardId: number;
  readonly kind: string;
  readonly ts: number;
}

/** UI-facing view: persisted state + live queue/log for the Anki Sync page. */
export interface AnkiStatusSyncView extends AnkiStatusSyncState {
  readonly running: boolean;
  readonly linkedCards: number;
  readonly pendingWriteBacks: number;
  readonly writeBackQueue: readonly WriteBackTask[];
  readonly writeBackLog: readonly WriteBackLogEntry[];
}
