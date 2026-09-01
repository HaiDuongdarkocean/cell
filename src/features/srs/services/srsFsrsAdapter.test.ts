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
    expect(state.last_review).toBeNull();
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
    expect(next.last_review).toBe(now.toISOString());
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
});
