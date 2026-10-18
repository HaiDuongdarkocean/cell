import { msToSrtTime, timePartsToMs } from './timeUtils';

describe('timePartsToMs', () => {
  it('treats undefined hours as zero', () => {
    expect(timePartsToMs(undefined, '02', '03', '004')).toBe(123_004);
  });

  it('sums all parts', () => {
    expect(timePartsToMs('1', '02', '03', '004')).toBe(3_723_004);
    expect(timePartsToMs('10', '00', '00', '000')).toBe(36_000_000);
  });
});

describe('msToSrtTime', () => {
  it('formats with comma separator and zero padding', () => {
    expect(msToSrtTime(0)).toBe('00:00:00,000');
    expect(msToSrtTime(3_723_004)).toBe('01:02:03,004');
    expect(msToSrtTime(36_000_000)).toBe('10:00:00,000');
  });

  it('round-trips with timePartsToMs', () => {
    const ms = 3_661_001;
    const [hms, milli] = msToSrtTime(ms).split(',');
    const [h, m, s] = hms.split(':');
    expect(timePartsToMs(h, m, s, milli)).toBe(ms);
  });
});
