import { createImmersionTracker, type ImmersionTrackerDeps } from './immersionTracker';
import type { HistoryRecord } from '@/features/local-player/services/mediaLibraryRepository';

interface State {
  writes: HistoryRecord[];
  session: boolean;
  addFails: boolean;
  now: number;
}

function makeTracker(): { tracker: ReturnType<typeof createImmersionTracker>; state: State } {
  const state: State = { writes: [], session: true, addFails: false, now: 1_000_000 };
  const deps: ImmersionTrackerDeps = {
    addEntry: async (r) => {
      if (state.addFails) throw new Error('idb down');
      state.writes.push({ ...r });
    },
    getHost: async () => 'youtube.com',
    hasSession: (tabId) => state.session && tabId === 7,
    now: () => state.now,
  };
  return { tracker: createImmersionTracker(deps), state };
}

const tick = (tracker: ReturnType<typeof createImmersionTracker>, state: State, ms = 250): void => {
  state.now += ms;
  tracker.noteTimeUpdate(7, state.now);
};

const flushWrites = async (): Promise<void> => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

describe('immersionTracker', () => {
  it('records nothing for tabs without a session', async () => {
    const { tracker, state } = makeTracker();
    tracker.noteTimeUpdate(99, 0);
    state.now += 60_000;
    tracker.noteTimeUpdate(99, 60_000);
    tracker.noteTimeUpdate(7, 0); // wrong-tab gate is fine, but kill session:
    state.session = false;
    tick(tracker, state, 60_000);
    tracker.closeTab(7);
    await flushWrites();
    expect(state.writes).toHaveLength(0);
  });

  it('accumulates wall time and flushes at >=15s, same record id', async () => {
    const { tracker, state } = makeTracker();
    for (let i = 0; i < 70; i += 1) tick(tracker, state);
    tracker.notePlayState(7, false);
    await flushWrites();
    expect(state.writes.length).toBeGreaterThanOrEqual(1);
    const ids = new Set(state.writes.map((w) => w.id));
    expect(ids.size).toBe(1);
    const last = state.writes[state.writes.length - 1];
    expect(last.watchDurationMs).toBeGreaterThanOrEqual(15_000);
    expect(last.id).toMatch(/^stream-7-\d+$/);
    await flushWrites();
    expect(last.videoId).toMatch(/^stream:/);
  });

  it('pause closes the segment; resume opens a new id', async () => {
    const { tracker, state } = makeTracker();
    for (let i = 0; i < 20; i += 1) tick(tracker, state);
    tracker.notePlayState(7, false);
    await flushWrites();
    expect(state.writes).toHaveLength(1);
    tracker.notePlayState(7, true);
    for (let i = 0; i < 20; i += 1) tick(tracker, state);
    tracker.closeTab(7);
    await flushWrites();
    expect(state.writes.length).toBe(2);
    expect(state.writes[0].id).not.toBe(state.writes[1].id);
  });

  it('drops timeupdates after pause (paused-scrub) until play resumes', async () => {
    const { tracker, state } = makeTracker();
    for (let i = 0; i < 20; i += 1) tick(tracker, state);
    tracker.notePlayState(7, false);
    await flushWrites();
    const base = state.writes[0].watchDurationMs;
    for (let i = 0; i < 10; i += 1) tick(tracker, state); // scrub while paused
    tracker.closeTab(7);
    await flushWrites();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].watchDurationMs).toBe(base);
  });

  it('closes a stale segment via idle auto-close on next event', async () => {
    const { tracker, state } = makeTracker();
    for (let i = 0; i < 20; i += 1) tick(tracker, state);
    state.now += 60_000; // > SESSION_IDLE_MS without events
    tick(tracker, state); // finalizes old segment, opens new one
    for (let i = 0; i < 20; i += 1) tick(tracker, state);
    tracker.closeTab(7);
    await flushWrites();
    expect(state.writes.length).toBeGreaterThanOrEqual(2);
    const ids = new Set(state.writes.map((w) => w.id));
    expect(ids.size).toBe(2);
  });

  it('keeps accumulating after an addEntry failure (retry on next flush)', async () => {
    const { tracker, state } = makeTracker();
    for (let i = 0; i < 70; i += 1) tick(tracker, state);
    state.addFails = true;
    tracker.notePlayState(7, false);
    await flushWrites();
    expect(state.writes).toHaveLength(0); // all failed

    state.addFails = false;
    tracker.notePlayState(7, true);
    for (let i = 0; i < 20; i += 1) tick(tracker, state);
    tracker.closeTab(7);
    await flushWrites();
    expect(state.writes.length).toBeGreaterThanOrEqual(1);
  });

  it('closeTab finalizes the open segment once', async () => {
    const { tracker, state } = makeTracker();
    for (let i = 0; i < 20; i += 1) tick(tracker, state);
    tracker.closeTab(7);
    tracker.closeTab(7);
    await flushWrites();
    expect(state.writes).toHaveLength(1);
  });

  it('writes positionMs from the last currentTime', async () => {
    const { tracker, state } = makeTracker();
    for (let i = 0; i < 20; i += 1) tick(tracker, state);
    tracker.closeTab(7);
    await flushWrites();
    expect(state.writes[0].positionMs).toBe(state.now);
  });

  it('counts timeupdates carrying isPlaying:true with no prior play event (autoplay-before-attach)', async () => {
    const { tracker, state } = makeTracker();
    for (let i = 0; i < 20; i += 1) {
      state.now += 250;
      tracker.noteTimeUpdate(7, state.now, true);
    }
    tracker.closeTab(7);
    await flushWrites();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].watchDurationMs).toBeGreaterThan(0);
  });

  it('drops timeupdates carrying isPlaying:false and closes the segment (paused-scrub)', async () => {
    const { tracker, state } = makeTracker();
    for (let i = 0; i < 20; i += 1) tick(tracker, state);
    tracker.noteTimeUpdate(7, state.now + 250, false);
    await flushWrites();
    expect(state.writes).toHaveLength(1);
    const base = state.writes[0].watchDurationMs;
    for (let i = 0; i < 10; i += 1) {
      state.now += 250;
      tracker.noteTimeUpdate(7, state.now, false);
    }
    tracker.closeTab(7);
    await flushWrites();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].watchDurationMs).toBe(base);
  });
});
