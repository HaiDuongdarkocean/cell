export interface SrsFsrsSerializedState {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  learning_steps: number;
  state: number;
  last_review: string | null;
}

export type ReviewJudgment = 'forget' | 'remember';

export interface SrsFsrsAdapter {
  readonly createEmpty: (now: Date) => SrsFsrsSerializedState;
  readonly next: (
    state: SrsFsrsSerializedState,
    now: Date,
    judgment: ReviewJudgment,
    preserveDue: boolean,
  ) => SrsFsrsSerializedState;
  readonly getDue: (state: SrsFsrsSerializedState) => string;
}
