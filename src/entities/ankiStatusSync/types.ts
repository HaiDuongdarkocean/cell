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
