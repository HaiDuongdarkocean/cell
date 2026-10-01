import {
  ankiCardOutcome,
  srsCardOutcome,
  mergeOutcomes,
  outcomeToStatus,
  ANKI_QUEUE,
  MATURE_INTERVAL_DAYS,
} from './statusRules';

describe('ankiCardOutcome', () => {
  it('maps new/learn/day-learn/buried to learning', () => {
    for (const queue of [ANKI_QUEUE.new, ANKI_QUEUE.learn, ANKI_QUEUE.dayLearn, ANKI_QUEUE.buriedSched, ANKI_QUEUE.buriedDay]) {
      expect(ankiCardOutcome({ queue, ivl: 0 })).toBe('learning');
    }
  });

  it('maps suspended to skip', () => {
    expect(ankiCardOutcome({ queue: ANKI_QUEUE.suspended, ivl: 100 })).toBe('skip');
  });

  it('maps review below threshold to learning', () => {
    expect(ankiCardOutcome({ queue: ANKI_QUEUE.review, ivl: 20 })).toBe('learning');
    expect(ankiCardOutcome({ queue: ANKI_QUEUE.review, ivl: 0 })).toBe('learning');
  });

  it('maps review at/above threshold to known', () => {
    expect(ankiCardOutcome({ queue: ANKI_QUEUE.review, ivl: MATURE_INTERVAL_DAYS })).toBe('known');
    expect(ankiCardOutcome({ queue: ANKI_QUEUE.review, ivl: 365 })).toBe('known');
  });

  it('skips malformed rows', () => {
    expect(ankiCardOutcome({ queue: NaN, ivl: 5 })).toBe('skip');
    expect(ankiCardOutcome({ queue: 2, ivl: Number.POSITIVE_INFINITY })).toBe('skip');
  });
});

describe('srsCardOutcome', () => {
  it('maps scheduledDays >= 21 to known, else learning', () => {
    expect(srsCardOutcome({ scheduledDays: 21 })).toBe('known');
    expect(srsCardOutcome({ scheduledDays: 20.9 })).toBe('learning');
    expect(srsCardOutcome({ scheduledDays: 0 })).toBe('learning');
  });

  it('skips malformed input', () => {
    expect(srsCardOutcome({ scheduledDays: NaN })).toBe('skip');
  });
});

describe('mergeOutcomes', () => {
  it('picks the stronger outcome', () => {
    expect(mergeOutcomes(['learning', 'known'])).toBe('known');
    expect(mergeOutcomes(['skip', 'learning'])).toBe('learning');
    expect(mergeOutcomes(['skip'])).toBe('skip');
    expect(mergeOutcomes([])).toBe('skip');
  });
});

describe('outcomeToStatus', () => {
  it('maps outcomes to statuses, skip to null', () => {
    expect(outcomeToStatus('known')).toBe('known');
    expect(outcomeToStatus('learning')).toBe('learning');
    expect(outcomeToStatus('skip')).toBeNull();
  });
});
