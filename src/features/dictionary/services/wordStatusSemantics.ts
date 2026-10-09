import { STATUS_CYCLE, type WordStatus } from '@/entities/dictionary';

/** Base-knowledge level — flags only ever sit on `unknown`. */
export type WordBaseStatus = 'unknown' | 'known' | 'ignore';
export type WordStatusFlag = 'none' | 'tracking' | 'learning';

export function baseStatus(status: WordStatus): WordBaseStatus {
  return status === 'tracking' || status === 'learning' ? 'unknown' : status;
}

export function statusFlag(status: WordStatus): WordStatusFlag {
  return status === 'tracking' || status === 'learning' ? status : 'none';
}

export function isNotKnown(status: WordStatus): boolean {
  return baseStatus(status) === 'unknown';
}

/** Cycle base knowledge: unknown → known → ignore → unknown. Flags are
 *  input-only — the result is always a base status (writing a base clears
 *  the flag, per spec REQ-2/REQ-3). */
export function nextBaseStatus(status: WordStatus): WordStatus {
  const idx = STATUS_CYCLE.indexOf(baseStatus(status));
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]!;
}

/** Key-4 semantics: `unknown ↔ tracking`; `learning` already implies
 *  engagement so it is a no-op; `known`/`ignore` keep their terminal state. */
export function toggleTrackingFlag(status: WordStatus): WordStatus {
  if (status === 'unknown') return 'tracking';
  if (status === 'tracking') return 'unknown';
  return status;
}
