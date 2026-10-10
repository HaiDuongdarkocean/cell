import {
  ankiCardOutcome,
  srsCardOutcome,
  mergeOutcomes,
  outcomeToStatus,
  ANKI_QUEUE,
  MATURE_INTERVAL_DAYS,
} from './statusRules';

describe('ankiCardOutcome', () => {
  it('maps new/learn/day-learn/buried to tracking', () => {
    for (const queue of [ANKI_QUEUE.new, ANKI_QUEUE.learn, ANKI_QUEUE.dayLearn, ANKI_QUEUE.buriedSched, ANKI_QUEUE.buriedDay]) {
      expect(ankiCardOutcome({ queue, ivl: 0 })).toBe('tracking');
    }
  });

  it('maps suspended to skip', () => {
    expect(ankiCardOutcome({ queue: ANKI_QUEUE.suspended, ivl: 100 })).toBe('skip');
  });

  it('maps review below threshold to tracking', () => {
    expect(ankiCardOutcome({ queue: ANKI_QUEUE.review, ivl: 20 })).toBe('tracking');
    expect(ankiCardOutcome({ queue: ANKI_QUEUE.review, ivl: 0 })).toBe('tracking');
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
  it('maps scheduledDays >= 21 to known, else tracking', () => {
    expect(srsCardOutcome({ scheduledDays: 21 })).toBe('known');
    expect(srsCardOutcome({ scheduledDays: 20.9 })).toBe('tracking');
    expect(srsCardOutcome({ scheduledDays: 0 })).toBe('tracking');
  });

  it('skips malformed input', () => {
    expect(srsCardOutcome({ scheduledDays: NaN })).toBe('skip');
  });
});

describe('mergeOutcomes', () => {
  it('picks the stronger outcome', () => {
    expect(mergeOutcomes(['tracking', 'known'])).toBe('known');
    expect(mergeOutcomes(['skip', 'tracking'])).toBe('tracking');
    expect(mergeOutcomes(['skip'])).toBe('skip');
    expect(mergeOutcomes([])).toBe('skip');
  });
});

describe('outcomeToStatus', () => {
  it('maps outcomes to statuses, skip to null', () => {
    expect(outcomeToStatus('known')).toBe('known');
    expect(outcomeToStatus('tracking')).toBe('tracking');
    expect(outcomeToStatus('skip')).toBeNull();
  });
});
