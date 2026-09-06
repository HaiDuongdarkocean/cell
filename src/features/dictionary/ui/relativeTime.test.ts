import { formatRelativeTime } from './relativeTime';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

describe('formatRelativeTime', () => {
  it('returns "hôm nay" for same-day timestamps', () => {
    expect(formatRelativeTime(NOW, NOW)).toBe('hôm nay');
    expect(formatRelativeTime(NOW - 1000, NOW)).toBe('hôm nay');
  });

  it('returns "hôm qua" for 1 day ago', () => {
    expect(formatRelativeTime(NOW - DAY, NOW)).toBe('hôm qua');
  });

  it('returns "N ngày trước" under a month', () => {
    expect(formatRelativeTime(NOW - 5 * DAY, NOW)).toBe('5 ngày trước');
    expect(formatRelativeTime(NOW - 29 * DAY, NOW)).toBe('29 ngày trước');
  });

  it('returns "N tháng trước" under a year', () => {
    expect(formatRelativeTime(NOW - 45 * DAY, NOW)).toBe('1 tháng trước');
    expect(formatRelativeTime(NOW - 200 * DAY, NOW)).toBe('6 tháng trước');
  });

  it('returns "N năm trước" for very old imports', () => {
    expect(formatRelativeTime(NOW - 400 * DAY, NOW)).toBe('1 năm trước');
  });

  it('returns empty string for non-finite input', () => {
    expect(formatRelativeTime(NaN, NOW)).toBe('');
  });
});
