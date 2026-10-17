import { describe, expect, it } from '@jest/globals';
import { formatMediaTimeMs, formatMediaTimeSec } from './formatMediaTime';

describe('formatMediaTimeMs', () => {
  it('drops the hour field below one hour', () => {
    expect(formatMediaTimeMs(0)).toBe('0:00');
    expect(formatMediaTimeMs(177_000)).toBe('2:57');
    expect(formatMediaTimeMs(3_599_000)).toBe('59:59');
  });

  it('shows the hour field at one hour and beyond', () => {
    expect(formatMediaTimeMs(3_600_000)).toBe('1:00:00');
    expect(formatMediaTimeMs(5_946_000)).toBe('1:39:06');
    expect(formatMediaTimeMs(36_610_000)).toBe('10:10:10');
  });

  it('pads minutes and seconds inside their own field', () => {
    expect(formatMediaTimeMs(67_000)).toBe('1:07');
    expect(formatMediaTimeMs(3_605_000)).toBe('1:00:05');
  });

  it('clamps negative values to zero', () => {
    expect(formatMediaTimeMs(-5_000)).toBe('0:00');
  });
});

describe('formatMediaTimeSec', () => {
  it('formats seconds as m:ss below one hour', () => {
    expect(formatMediaTimeSec(0)).toBe('0:00');
    expect(formatMediaTimeSec(5)).toBe('0:05');
    expect(formatMediaTimeSec(83)).toBe('1:23');
  });

  it('formats hours as h:mm:ss', () => {
    expect(formatMediaTimeSec(3661)).toBe('1:01:01');
  });

  it('handles invalid input', () => {
    expect(formatMediaTimeSec(-1)).toBe('0:00');
    expect(formatMediaTimeSec(NaN)).toBe('0:00');
    expect(formatMediaTimeSec(Infinity)).toBe('0:00');
  });
});
