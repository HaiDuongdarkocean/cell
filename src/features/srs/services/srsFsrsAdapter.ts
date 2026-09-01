import { type Card, type Grade, Rating, createEmptyCard, fsrs } from 'ts-fsrs';
import type { ReviewJudgment, SrsFsrsAdapter, SrsFsrsSerializedState } from '@/entities/srs/types';

const CURRENT_VERSION = 1;

const JUDGMENT_TO_RATING: Record<ReviewJudgment, Grade> = {
  forget: Rating.Again as Grade,
  remember: Rating.Good as Grade,
};

function toSerialized(card: Card): SrsFsrsSerializedState {
  return {
    version: CURRENT_VERSION,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    learningSteps: card.learning_steps,
    state: card.state,
    lastReview: card.last_review?.toISOString(),
  };
}

function toFsrsCard(state: SrsFsrsSerializedState): Card {
  return {
    ...state,
    due: new Date(state.due),
    elapsed_days: state.elapsedDays,
    scheduled_days: state.scheduledDays,
    learning_steps: state.learningSteps,
    last_review: state.lastReview ? new Date(state.lastReview) : undefined,
  } as Card;
}

function isSerializedStateLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function migrateLegacyToV1(state: Record<string, unknown>): SrsFsrsSerializedState {
  return {
    version: CURRENT_VERSION,
    due: typeof state.due === 'string' ? state.due : new Date().toISOString(),
    stability: Number(state.stability ?? 0),
    difficulty: Number(state.difficulty ?? 0),
    elapsedDays: Number(
      state.elapsedDays ?? state.elapsed_days ?? 0,
    ),
    scheduledDays: Number(
      state.scheduledDays ?? state.scheduled_days ?? 0,
    ),
    reps: Number(state.reps ?? 0),
    lapses: Number(state.lapses ?? 0),
    learningSteps: Number(
      state.learningSteps ?? state.learning_steps ?? 0,
    ),
    state: Number(state.state ?? 0),
    lastReview:
      typeof state.lastReview === 'string'
        ? state.lastReview
        : typeof state.last_review === 'string'
          ? state.last_review
          : undefined,
  };
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
        return {
          ...nextState,
          due: state.due,
          scheduledDays: state.scheduledDays,
        };
      }

      return nextState;
    },

    getDue: (state) => state.due,

    isDue: (state, now) => new Date(state.due) <= now,

    migrate: (state, fromVersion) => {
      if (isSerializedStateLike(state)) {
        if (fromVersion >= CURRENT_VERSION && typeof state.due === 'string') {
          return state as unknown as SrsFsrsSerializedState;
        }
        return migrateLegacyToV1(state);
      }
      return toSerialized(createEmptyCard(new Date()));
    },
  };
}
