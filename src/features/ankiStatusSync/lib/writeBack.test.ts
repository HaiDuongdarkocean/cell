import { buildWriteBack, todayIndexFromProbe } from './writeBack';

const base = { id: 42, due: 100, odid: 0 };

describe('buildWriteBack', () => {
  it('returns null for suspended cards', () => {
    expect(buildWriteBack({ ...base, queue: -1, ivl: 30 }, 500)).toBeNull();
  });

  it('matures a new card with the full field set', () => {
    const plan = buildWriteBack({ ...base, queue: 0, ivl: 0 }, 500)!;
    expect(plan.reason).toBe('matured');
    expect(plan.params).toEqual({
      card: 42,
      keys: ['ivl', 'queue', 'type', 'due'],
      values: [21, 2, 2, 501],
    });
  });

  it('keeps a higher existing interval', () => {
    const plan = buildWriteBack({ ...base, queue: 2, ivl: 60, due: 510 }, 500)!;
    expect(plan.reason).toBe('already-mature');
    expect(plan.params.values).toEqual([60, 2, 2, 510]);
  });

  it('never regresses the review due below tomorrow', () => {
    const plan = buildWriteBack({ ...base, queue: 2, ivl: 25, due: 400 }, 500)!;
    expect(plan.params.values[3]).toBe(501);
  });

  it('bumps review ivl < 21 to the mature floor', () => {
    const plan = buildWriteBack({ ...base, queue: 2, ivl: 5, due: 600 }, 500)!;
    expect(plan.params.values[0]).toBe(21);
  });

  it('writes odue for filtered-deck cards and leaves odid alone', () => {
    const plan = buildWriteBack({ ...base, queue: 1, ivl: 0, odid: 777 }, 500)!;
    expect(plan.params.keys).toEqual(['ivl', 'queue', 'type', 'due', 'odue']);
    expect(plan.params.values).toEqual([21, 2, 2, 501, 501]);
    expect(plan.params.keys).not.toContain('odid');
  });
});

describe('todayIndexFromProbe', () => {
  it('derives the index from a probed offset', () => {
    expect(todayIndexFromProbe(500, 0)).toBe(500);
    expect(todayIndexFromProbe(507, 7)).toBe(500);
    expect(todayIndexFromProbe(493, -7)).toBe(500);
  });
});
