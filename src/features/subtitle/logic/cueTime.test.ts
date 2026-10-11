import { formatCueTimestamp } from './cueTime';

describe('formatCueTimestamp', () => {
  it('drops the hour field below one hour', () => {
    expect(formatCueTimestamp(0)).toBe('0:00');
    expect(formatCueTimestamp(177_000)).toBe('2:57');
    expect(formatCueTimestamp(3_599_000)).toBe('59:59');
  });

  it('shows the hour field only when the value reaches one hour', () => {
    expect(formatCueTimestamp(3_600_000)).toBe('1:00:00');
    expect(formatCueTimestamp(5_946_000)).toBe('1:39:06');
    expect(formatCueTimestamp(36_610_000)).toBe('10:10:10');
  });

  it('pads minutes and seconds inside their own field', () => {
    expect(formatCueTimestamp(67_000)).toBe('1:07');
    expect(formatCueTimestamp(3_605_000)).toBe('1:00:05');
  });

  it('clamps offset-shifted negative values to zero', () => {
    expect(formatCueTimestamp(-5_000)).toBe('0:00');
  });
});
