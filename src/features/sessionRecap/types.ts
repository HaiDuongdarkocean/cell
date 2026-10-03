export type SessionRecapStatus = 'tracking' | 'learning' | 'known' | 'ignore';

export type SessionRecapStatusGroup = {
  readonly status: SessionRecapStatus;
  readonly terms: readonly string[];
  readonly moreCount: number;
};

export type SessionRecap = {
  readonly id: string;
  readonly videoId: string;
  readonly sourceLabel: string;
  readonly kind: 'local' | 'stream';
  readonly startMs: number;
  readonly endMs: number;
  readonly durationMs: number;
  readonly positionMs: number;
  readonly live: boolean;
  readonly lookups?: {
    readonly count: number;
    readonly terms: readonly string[];
    readonly moreCount: number;
  };
  readonly statusChanges?: {
    readonly count: number;
    readonly groups: readonly SessionRecapStatusGroup[];
    readonly derived: boolean;
  };
  readonly coverage?: {
    readonly value: number;
    readonly band: string;
    readonly computedAt: string;
  };
};

export const SESSION_GROUP_GAP_MS = 15 * 60_000;
export const SESSION_EVENTS_MAX_AGE_DAYS = 90;
export const DERIVE_LOOKBACK_DAYS = 30;
export const LIVE_FLUSH_MS = 90_000;
export const TERMS_CAP = 30;
