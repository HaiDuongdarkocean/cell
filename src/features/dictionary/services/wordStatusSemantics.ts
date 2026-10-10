import { STATUS_CYCLE, type WordStatus } from '@/entities/dictionary';

/** Base-knowledge level — `tracking` only ever sits on the `unknown` base. */
export type WordBaseStatus = 'unknown' | 'known' | 'ignore';
export type WordStatusFlag = 'none' | 'tracking';

/** Legacy status that predates the tracking/hasCard split. Persisted rows are
 *  normalized to `tracking` here — the single read boundary for old data. */
export type StoredWordStatus = WordStatus | 'learning';

export function normalizeStoredStatus(status: StoredWordStatus): WordStatus {
  return status === 'learning' ? 'tracking' : status;
}

export function baseStatus(status: WordStatus): WordBaseStatus {
  return status === 'tracking' ? 'unknown' : status;
}

export function statusFlag(status: WordStatus): WordStatusFlag {
  return status === 'tracking' ? 'tracking' : 'none';
}

export function isNotKnown(status: WordStatus): boolean {
  return baseStatus(status) === 'unknown';
}

/** Cycle base knowledge: unknown → known → ignore → unknown. The tracking
 *  flag is input-only — the result is always a base status (writing a base
 *  clears the flag, per spec REQ-2/REQ-3). */
export function nextBaseStatus(status: WordStatus): WordStatus {
  const idx = STATUS_CYCLE.indexOf(baseStatus(status));
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]!;
}

/** Tracking is user-owned and toggles on top of every status:
 *  `tracking` → `unknown`; any other status (including `known` and `ignore`)
 *  → `tracking`. */
export function toggleTrackingFlag(status: WordStatus): WordStatus {
  return status === 'tracking' ? 'unknown' : 'tracking';
}
