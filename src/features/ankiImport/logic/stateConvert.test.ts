import { convertCardState, decodeMemoryState, ankiDueMs } from './stateConvert';
import type { NormalizedAnkiCard } from '../model/normalized';

const now = new Date('2026-09-01T00:00:00.000Z');
const CRT = Date.parse('2025-01-01T00:00:00.000Z');
const DAY = 86_400_000;

const base: NormalizedAnkiCard = {
  id: 1, noteId: 10, deckId: 'd1', ord: 0,
  type: 2, queue: 2, due: 100, ivl: 30, factor: 2500,
  reps: 12, lapses: 1, left: 0, odid: 0,
};

const opts = { crtMs: CRT, desiredRetention: 0.9, now, minExplores: 1, revlog: [] as const };

describe('decodeMemoryState', () => {
  it('decodes fixed32 stability + difficulty fields', () => {
    const buf = new Uint8Array(10);
    const view = new DataView(buf.buffer);
    buf[0] = 0x0d; // field 1, wire 5
    view.setFloat32(1, 42.5, true);
    buf[5] = 0x15; // field 2, wire 5
    view.setFloat32(6, 6.25, true);
    expect(decodeMemoryState(buf)).toEqual({ stability: 42.5, difficulty: 6.25 });
  });

  it('returns null on garbage', () => {
    expect(decodeMemoryState(new Uint8Array([0xff, 0xff]))).toBeNull();
    expect(decodeMemoryState(new Uint8Array(0))).toBeNull();
  });
});

describe('ankiDueMs', () => {
  it('new card → now', () => {
    expect(ankiDueMs({ ...base, type: 0, queue: 0, due: 55 }, CRT, null, now.getTime())).toBe(now.getTime());
  });
  it('learning card → unix seconds', () => {
    const s = 1_800_000_000;
    expect(ankiDueMs({ ...base, type: 1, queue: 1, due: s }, CRT, null, now.getTime())).toBe(s * 1000);
  });
  it('review card (apkg) → crt + due days', () => {
    expect(ankiDueMs(base, CRT, null, now.getTime())).toBe(CRT + 100 * DAY);
  });
  it('review card (connect) → lastReview + ivl', () => {
    const last = now.getTime() - 5 * DAY;
    expect(ankiDueMs({ ...base, ivl: 30 }, null, last, now.getTime())).toBe(last + 30 * DAY);
  });
  it('day-learn on connect (no crt) → now', () => {
    expect(ankiDueMs({ ...base, type: 3, queue: 3, due: 400 }, null, null, now.getTime())).toBe(now.getTime());
  });
});

describe('convertCardState', () => {
  it('suspended → null', () => {
    expect(convertCardState({ ...base, queue: -1 }, opts)).toBeNull();
  });

  it('new → state 0, due now, exploreCount 0 on all components', () => {
    const r = convertCardState({ ...base, type: 0, queue: 0, reps: 0, lapses: 0, ivl: 0 }, opts)!;
    expect(r.fsrsState.state).toBe(0);
    expect(r.progress).toBe(0);
    for (const c of Object.values(r.components)) {
      expect(c.exploreCount).toBe(0);
      expect(c.fsrsState.state).toBe(0);
    }
  });

  it('review → state 2, due crt-based, reps/lapses copied, memory_state wins over estimate', () => {
    const r = convertCardState({ ...base, memoryState: { stability: 77.7, difficulty: 4.4 } }, opts)!;
    expect(r.fsrsState.state).toBe(2);
    expect(r.fsrsState.due).toBe(new Date(CRT + 100 * DAY).toISOString());
    expect(r.fsrsState.reps).toBe(12);
    expect(r.fsrsState.lapses).toBe(1);
    expect(r.fsrsState.stability).toBeCloseTo(77.7);
    expect(r.fsrsState.difficulty).toBeCloseTo(4.4);
  });

  it('SM-2 fallback when no memory_state', () => {
    const r = convertCardState({ ...base, ivl: 30, factor: 2500 }, opts)!;
    expect(r.fsrsState.stability).toBe(30);
    expect(r.fsrsState.difficulty).toBe(Math.min(10, Math.max(1, Math.round(11 - 2500 / 300))));
  });

  it('learning → state 1, progress 20, learningSteps from left', () => {
    const r = convertCardState({ ...base, type: 1, queue: 1, due: Math.floor(now.getTime() / 1000) + 600, left: 2100 }, opts)!;
    expect(r.fsrsState.state).toBe(1);
    expect(r.fsrsState.learningSteps).toBe(2);
    expect(r.progress).toBe(20);
    expect(r.components.meaning.exploreCount).toBe(1);
  });

  it('buried flags import under their underlying type', () => {
    const r = convertCardState({ ...base, type: 2, queue: -2 }, opts)!;
    expect(r.fsrsState.state).toBe(2);
  });

  it('mature review card lands ≥ target threshold (satisfied/maintenance bound)', () => {
    // long-ivl card reviewed recently → R ≈ 1 → progress ~111 → clamped 100
    const last = now.getTime() - 2 * DAY;
    const r = convertCardState(
      { ...base, memoryState: { stability: 400, difficulty: 5 }, ivl: 365 },
      { ...opts, revlog: [{ id: last, cardId: 1, ease: 3, ivl: 365, time: 1000 }] },
    )!;
    expect(r.progress).toBe(100);
  });
});
