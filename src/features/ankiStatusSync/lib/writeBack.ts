import { ANKI_QUEUE, MATURE_INTERVAL_DAYS } from './statusRules';

/** Write-back target state per spec REQ-5: mature the card by writing the
 *  full scheduling field set — never `setDueDate`/`reschedule` fallbacks. */

export interface WriteBackCardSnapshot {
  readonly id: number;
  readonly queue: number;
  readonly ivl: number;
  readonly due: number;
  /** Original deck id when the card sits in a filtered deck (0 otherwise). */
  readonly odid: number;
  readonly odue?: number;
}

export interface SetSpecificValueParams {
  readonly card: number;
  readonly keys: readonly string[];
  readonly values: readonly (number | string)[];
}

export interface WriteBackPlan {
  readonly params: SetSpecificValueParams;
  readonly reason: 'matured' | 'already-mature';
}

/** Build the `setSpecificValueOfCard` params that mature a card.
 *  `todayIndex` = review-day index of "today" in the collection
 *  (days since collection creation, day-rollover aware). Returns null for
 *  suspended cards — those are never touched. */
export function buildWriteBack(
  card: WriteBackCardSnapshot,
  todayIndex: number,
): WriteBackPlan | null {
  if (card.queue === ANKI_QUEUE.suspended) return null;
  const ivl = Math.max(MATURE_INTERVAL_DAYS, card.ivl);
  const alreadyMature = card.queue === ANKI_QUEUE.review && card.ivl >= MATURE_INTERVAL_DAYS;
  const due = card.queue === ANKI_QUEUE.review ? Math.max(card.due, todayIndex + 1) : todayIndex + 1;
  const keys = ['ivl', 'queue', 'type', 'due'];
  const values: (number | string)[] = [ivl, ANKI_QUEUE.review, 2, due];
  if (card.odid !== 0) {
    keys.push('odue');
    values.push(due);
  }
  return {
    params: { card: card.id, keys, values },
    reason: alreadyMature ? 'already-mature' : 'matured',
  };
}

/** Probe offsets to derive the collection's current review-day index from
 *  any review card found at a known relative `prop:due` offset.
 *  todayIndex = foundCard.due - probedOffset. */
export const TODAY_INDEX_PROBE_OFFSETS = [0, 1, -1, 7, -7, 30, -30, 90, -90] as const;

export function todayIndexFromProbe(cardDue: number, probedOffset: number): number {
  return cardDue - probedOffset;
}
