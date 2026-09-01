import { createSrsFsrsAdapter } from './srsFsrsAdapter';

describe('srsFsrsAdapter', () => {
  const adapter = createSrsFsrsAdapter();
  const now = new Date('2026-09-01T00:00:00.000Z');

  it('creates an empty state at the given time', () => {
    const state = adapter.createEmpty(now);
    expect(state.due).toBe(now.toISOString());
    expect(state.stability).toBe(0);
    expect(state.difficulty).toBe(0);
    expect(state.reps).toBe(0);
    expect(state.lapses).toBe(0);
    expect(state.state).toBe(0);
    expect(state.version).toBe(1);
    expect(state.lastReview).toBeUndefined();
    expect(state.learningSteps).toBe(0);
  });

  it('advances state on remember and updates due', () => {
    const state = adapter.createEmpty(now);
    const next = adapter.next(state, now, 'remember', false);
    expect(next.reps).toBe(1);
    expect(next.stability).toBeGreaterThan(0);
    expect(new Date(next.due).getTime()).toBeGreaterThan(now.getTime());
  });

  it('advances state on forget and reviews the card', () => {
    const state = adapter.createEmpty(now);
    const next = adapter.next(state, now, 'forget', false);
    expect(next.reps).toBe(1);
    expect(next.lastReview).toBe(now.toISOString());
  });

  it('preserves the original due when preserveDue is true', () => {
    const state = adapter.createEmpty(now);
    const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const next = adapter.next(state, future, 'remember', true);
    expect(next.due).toBe(state.due);
    expect(next.reps).toBe(1);
  });

  it('returns the due date from state', () => {
    const state = adapter.createEmpty(now);
    expect(adapter.getDue(state)).toBe(state.due);
  });

  it('reports a card as due when the due time has passed', () => {
    const state = adapter.createEmpty(now);
    expect(adapter.isDue(state, now)).toBe(true);
    const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    expect(adapter.isDue(state, future)).toBe(true);
    const past = new Date(now.getTime() - 1);
    expect(adapter.isDue(state, past)).toBe(false);
  });

  it('migrates a legacy snake_case state to the v1 camelCase shape', () => {
    const legacy = {
      due: now.toISOString(),
      stability: 1.5,
      difficulty: 3,
      elapsed_days: 2,
      scheduled_days: 1,
      reps: 3,
      lapses: 0,
      learning_steps: 1,
      state: 1,
      last_review: now.toISOString(),
    };
    const migrated = adapter.migrate(legacy, 0);
    expect(migrated.version).toBe(1);
    expect(migrated.due).toBe(legacy.due);
    expect(migrated.elapsedDays).toBe(2);
    expect(migrated.scheduledDays).toBe(1);
    expect(migrated.learningSteps).toBe(1);
    expect(migrated.lastReview).toBe(legacy.last_review);
  });

  it('returns a v1 state unchanged during migration', () => {
    const state = adapter.createEmpty(now);
    const migrated = adapter.migrate(state, 1);
    expect(migrated).toEqual(state);
  });

  it('creates an empty state when migration input is invalid', () => {
    const migrated = adapter.migrate(null, 0);
    expect(migrated.version).toBe(1);
    expect(migrated.reps).toBe(0);
  });
});
