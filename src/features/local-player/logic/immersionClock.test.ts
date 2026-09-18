import {
  MAX_SESSION_GAP_MS,
  accumulateDelta,
  aggregateHistory,
  levelForHours,
  type ImmersionRecordLike,
} from './immersionClock';

const MIN = 60_000;

const rec = (id: string, watchedAt: string, watchDurationMs: number): ImmersionRecordLike => ({
  id,
  watchedAt,
  watchDurationMs,
});

const atLocal = (y: number, mo: number, d: number, h = 0, mi = 0): string =>
  new Date(y, mo - 1, d, h, mi).toISOString();

describe('accumulateDelta', () => {
  it('adds the elapsed gap', () => {
    expect(accumulateDelta(100, 1000, 1250)).toBe(350);
  });

  it('caps gaps at MAX_SESSION_GAP_MS', () => {
    expect(accumulateDelta(0, 0, 60_000)).toBe(MAX_SESSION_GAP_MS);
  });

  it('ignores zero and backwards gaps', () => {
    expect(accumulateDelta(50, 1000, 1000)).toBe(50);
    expect(accumulateDelta(50, 1000, 500)).toBe(50);
  });
});

describe('levelForHours', () => {
  it('maps milestones to levels', () => {
    expect(levelForHours(0)).toEqual({ level: 1, floorH: 0, nextH: 50, progress: 0 });
    expect(levelForHours(49.9).level).toBe(1);
    expect(levelForHours(50).level).toBe(2);
    expect(levelForHours(149).level).toBe(2);
    expect(levelForHours(150).level).toBe(3);
    expect(levelForHours(599).level).toBe(4);
    expect(levelForHours(600).level).toBe(5);
    expect(levelForHours(1499).level).toBe(6);
    expect(levelForHours(1500).level).toBe(7);
    expect(levelForHours(99999).level).toBe(7);
  });

  it('computes in-band progress and null nextH at top level', () => {
    const mid = levelForHours(75);
    expect(mid).toEqual({ level: 2, floorH: 50, nextH: 150, progress: 0.25 });
    const top = levelForHours(2000);
    expect(top.nextH).toBeNull();
    expect(top.progress).toBe(1);
  });
});

describe('aggregateHistory', () => {
  const now = new Date(2026, 9, 10, 12, 0); // Oct 10, noon local

  it('sums total and today, ignores zero-duration entries', () => {
    const s = aggregateHistory(
      [
        rec('watch-a-1', atLocal(2026, 10, 10, 9), 30 * MIN),
        rec('watch-a-0', atLocal(2026, 10, 10, 8), 0),
        rec('watch-b-1', atLocal(2026, 10, 9, 20), 45 * MIN),
      ],
      now,
    );
    expect(s.totalMs).toBe(75 * MIN);
    expect(s.todayMs).toBe(30 * MIN);
  });

  it('splits a cross-midnight session across both days', () => {
    const s = aggregateHistory(
      [rec('watch-a-1', atLocal(2026, 10, 9, 23, 30), 60 * MIN)],
      new Date(2026, 9, 10, 1, 0),
    );
    expect(s.todayMs).toBe(30 * MIN);
    expect(s.streakDays).toBe(2);
  });

  it('streak counts back from today, or yesterday when today is empty', () => {
    const records = [
      rec('watch-a-1', atLocal(2026, 10, 9, 10), 10 * MIN),
      rec('watch-a-2', atLocal(2026, 10, 8, 10), 10 * MIN),
      rec('watch-a-3', atLocal(2026, 10, 6, 10), 10 * MIN), // gap Oct 7
    ];
    expect(aggregateHistory(records, now).streakDays).toBe(2);
    const withToday = [...records, rec('watch-a-4', atLocal(2026, 10, 10, 6), 5 * MIN)];
    expect(aggregateHistory(withToday, now).streakDays).toBe(3);
  });

  it('last7dMs covers the rolling 7x24h window', () => {
    const s = aggregateHistory(
      [
        rec('watch-a-1', atLocal(2026, 10, 10, 11), 10 * MIN),
        rec('watch-a-2', atLocal(2026, 10, 4, 12), 10 * MIN), // inside window
        rec('watch-a-3', atLocal(2026, 10, 2, 12), 10 * MIN), // outside
      ],
      now,
    );
    expect(s.last7dMs).toBe(20 * MIN);
  });

  it('splits sources by record-id prefix, not videoId', () => {
    const s = aggregateHistory(
      [
        rec('stream-42-1', atLocal(2026, 10, 10, 9), 20 * MIN),
        rec('watch-stream:fake-1', atLocal(2026, 10, 10, 9), 10 * MIN), // local file named stream:*
      ],
      now,
    );
    expect(s.bySource).toEqual({ localMs: 10 * MIN, streamMs: 20 * MIN });
  });

  it('skips unparseable watchedAt', () => {
    const s = aggregateHistory([rec('watch-a-1', 'not-a-date', 10 * MIN)], now);
    expect(s.totalMs).toBe(0);
  });
});
