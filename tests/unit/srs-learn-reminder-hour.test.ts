import {
  adoptLearnedCandidate,
  computeLearnedHour,
  nextReminderFireMs,
} from '@/features/srs/logic/learnReminderHour';

function eventsOnDays(days: number, hour: number, perDay = 1, startDay = 0): { answeredAt: number }[] {
  const out: { answeredAt: number }[] = [];
  for (let d = startDay; d < startDay + days; d += 1) {
    for (let i = 0; i < perDay; i += 1) {
      const at = new Date();
      at.setDate(at.getDate() - d);
      at.setHours(hour, i * 10, 0, 0);
      out.push({ answeredAt: at.getTime() });
    }
  }
  return out;
}

describe('computeLearnedHour', () => {
  it('returns null for empty history', () => {
    expect(computeLearnedHour([], 4)).toBeNull();
  });

  it('returns null below minimum study days', () => {
    const events = eventsOnDays(4, 20, 3);
    expect(computeLearnedHour(events, 4)).toBeNull();
  });

  it('returns modal hour once enough study days exist', () => {
    const events = [
      ...eventsOnDays(5, 20),
      ...eventsOnDays(2, 9, 1, 5),
    ];
    const candidate = computeLearnedHour(events, 4);
    expect(candidate?.hour).toBe(20);
    expect(candidate?.count).toBe(5);
    expect(candidate?.runnerUpCount).toBe(2);
  });

  it('returns null when top count below minimum', () => {
    const events = [8, 12, 20, 7, 15, 22].flatMap((h, i) => eventsOnDays(1, h, 1, i));
    expect(computeLearnedHour(events, 4)).toBeNull();
  });

  it('counts the first event per study day, not raw event volume', () => {
    const events = [
      ...eventsOnDays(5, 20),
      ...eventsOnDays(5, 9, 4),
    ];
    const candidate = computeLearnedHour(events, 4);
    expect(candidate?.hour).toBe(9);
    expect(candidate?.count).toBe(5);
  });
});

describe('adoptLearnedCandidate', () => {
  const candidate = { hour: 21, count: 5, runnerUpCount: 2, studyDays: 6 };

  it('adopts first candidate when none learned yet', () => {
    expect(adoptLearnedCandidate(candidate, null)).toBe(21);
  });

  it('keeps current when candidate equals it', () => {
    expect(adoptLearnedCandidate(candidate, 21)).toBe(21);
  });

  it('adopts new hour on clear margin', () => {
    expect(adoptLearnedCandidate(candidate, 20)).toBe(21);
  });

  it('rejects a switch without margin (anti-jitter)', () => {
    const narrow = { hour: 21, count: 5, runnerUpCount: 4, studyDays: 8 };
    expect(adoptLearnedCandidate(narrow, 20)).toBeNull();
  });

  it('returns null when no candidate', () => {
    expect(adoptLearnedCandidate(null, 20)).toBeNull();
  });
});

describe('nextReminderFireMs', () => {
  it('returns today when the hour is still ahead', () => {
    const now = new Date();
    now.setHours(10, 30, 0, 0);
    const fire = new Date(nextReminderFireMs(20, now.getTime()));
    expect(fire.getDate()).toBe(now.getDate());
    expect(fire.getHours()).toBe(20);
    expect(fire.getMinutes()).toBe(0);
  });

  it('returns tomorrow when the hour already passed', () => {
    const now = new Date();
    now.setHours(21, 30, 0, 0);
    const fire = nextReminderFireMs(20, now.getTime());
    expect(fire).toBeGreaterThan(now.getTime());
    expect(new Date(fire).getHours()).toBe(20);
    expect(fire - now.getTime()).toBeGreaterThan(20 * 60 * 60 * 1000);
  });

  it('skips to tomorrow when exactly on the boundary', () => {
    const now = new Date();
    now.setHours(20, 0, 0, 0);
    const fire = nextReminderFireMs(20, now.getTime());
    expect(fire).toBeGreaterThan(now.getTime());
    expect(new Date(fire).getDate()).not.toBe(now.getDate());
  });
});
