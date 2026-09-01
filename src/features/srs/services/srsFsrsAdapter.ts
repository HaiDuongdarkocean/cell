import { type Card, type Grade, Rating, createEmptyCard, fsrs } from 'ts-fsrs';
import type { ReviewJudgment, SrsFsrsAdapter, SrsFsrsSerializedState } from '@/entities/srs/types';

const JUDGMENT_TO_RATING: Record<ReviewJudgment, Grade> = {
  forget: Rating.Again as Grade,
  remember: Rating.Good as Grade,
};

function toSerialized(card: Card): SrsFsrsSerializedState {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    learning_steps: card.learning_steps,
    state: card.state,
    last_review: card.last_review?.toISOString() ?? null,
  };
}

function toFsrsCard(state: SrsFsrsSerializedState): Card {
  return {
    ...state,
    due: new Date(state.due),
    last_review: state.last_review ? new Date(state.last_review) : undefined,
  } as Card;
}

export function createSrsFsrsAdapter(): SrsFsrsAdapter {
  const engine = fsrs();

  return {
    createEmpty: (now: Date) => {
      const card = createEmptyCard(now);
      return toSerialized(card);
    },

    next: (state, now, judgment, preserveDue) => {
      const card = toFsrsCard(state);
      const result = engine.next(card, now, JUDGMENT_TO_RATING[judgment]);
      const nextState = toSerialized(result.card);

      if (preserveDue) {
        nextState.due = state.due;
        nextState.scheduled_days = state.scheduled_days;
      }

      return nextState;
    },

    getDue: (state) => state.due,
  };
}
