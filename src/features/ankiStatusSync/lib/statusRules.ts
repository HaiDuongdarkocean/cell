import type { WordStatus } from '@/entities/dictionary';

/** Anki queue codes (NormalizedAnkiCard.queue). */
export const ANKI_QUEUE = {
  suspended: -1,
  buriedDay: -3,
  buriedSched: -2,
  new: 0,
  learn: 1,
  review: 2,
  dayLearn: 3,
} as const;

/** Maturity threshold — Anki's definition of a mature card. */
export const MATURE_INTERVAL_DAYS = 21;

export type RuleOutcome = 'known' | 'tracking' | 'skip';

export interface AnkiCardState {
  readonly queue: number;
  readonly ivl: number;
}

export interface SrsCardState {
  readonly scheduledDays: number;
}

/** Map a single Anki card state to a wordStatus outcome. Any live card means
 *  the user is engaged with the term → `tracking`; card existence itself is
 *  rendered through the `hasCard` layer, never a dedicated status. */
export function ankiCardOutcome(card: AnkiCardState): RuleOutcome {
  if (!Number.isFinite(card.queue) || !Number.isFinite(card.ivl)) return 'skip';
  if (card.queue === ANKI_QUEUE.suspended) return 'skip';
  if (card.queue === ANKI_QUEUE.review && card.ivl >= MATURE_INTERVAL_DAYS) return 'known';
  return 'tracking';
}

/** Map a Tihoka SRS card state to a wordStatus outcome. `scheduledDays` should
 *  be the max across the card's memory components. */
export function srsCardOutcome(card: SrsCardState): RuleOutcome {
  if (!Number.isFinite(card.scheduledDays)) return 'skip';
  return card.scheduledDays >= MATURE_INTERVAL_DAYS ? 'known' : 'tracking';
}

const STRENGTH: Record<RuleOutcome, number> = { skip: 0, tracking: 1, known: 2 };

/** Merge outcomes from all sources for a term — the stronger truth wins. */
export function mergeOutcomes(outcomes: readonly RuleOutcome[]): RuleOutcome {
  let best: RuleOutcome = 'skip';
  for (const o of outcomes) {
    if (STRENGTH[o] > STRENGTH[best]) best = o;
  }
  return best;
}

export function outcomeToStatus(
  outcome: RuleOutcome,
): Exclude<WordStatus, 'unknown'> | null {
  return outcome === 'skip' ? null : outcome;
}
