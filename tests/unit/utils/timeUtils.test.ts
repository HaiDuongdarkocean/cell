import {
  assTimeToMs,
  vttTimeToMs,
  srtTimeToMs,
  msToSrtTime,
  msToAssTime,
  parseTimestamp,
} from '@/lib/utils/timeUtils';

describe('timeUtils', () => {
  describe('assTimeToMs', () => {
    it('converts a standard ASS time to milliseconds', () => {
      expect(assTimeToMs('0:01:30.50')).toBe(90500);
    });

    it('converts an hour-bearing ASS time correctly', () => {
      expect(assTimeToMs('1:02:03.40')).toBe(3723400);
    });

    it('converts zero time to 0', () => {
      expect(assTimeToMs('0:00:00.00')).toBe(0);
    });

    it('treats the fractional part as centiseconds (2 digits)', () => {
      expect(assTimeToMs('0:00:01.99')).toBe(1990);
    });

    it('throws on an invalid ASS time format', () => {
      expect(() => assTimeToMs('invalid')).toThrow('Invalid ASS time format');
    });
  });

  describe('vttTimeToMs', () => {
    it('converts a standard VTT time to milliseconds', () => {
      expect(vttTimeToMs('00:01:30.500')).toBe(90500);
    });

    it('converts zero time to 0', () => {
      expect(vttTimeToMs('00:00:00.000')).toBe(0);
    });

    it('converts a time with full hours correctly', () => {
      expect(vttTimeToMs('01:02:03.400')).toBe(3723400);
    });

    it('treats the fractional part as milliseconds (3 digits)', () => {
      expect(vttTimeToMs('00:00:01.005')).toBe(1005);
    });

    it('throws on an invalid VTT time format', () => {
      expect(() => vttTimeToMs('not-a-time')).toThrow('Invalid VTT time format');
    });
  });

  describe('srtTimeToMs', () => {
    it('converts a standard SRT time to milliseconds', () => {
      expect(srtTimeToMs('00:01:30,500')).toBe(90500);
    });

    it('converts zero time to 0', () => {
      expect(srtTimeToMs('00:00:00,000')).toBe(0);
    });

    it('converts a time with full hours correctly', () => {
      expect(srtTimeToMs('01:02:03,400')).toBe(3723400);
    });

    it('treats the fractional part as milliseconds (3 digits)', () => {
      expect(srtTimeToMs('00:00:01,005')).toBe(1005);
    });

    it('throws on an invalid SRT time format', () => {
      expect(() => srtTimeToMs('bad')).toThrow('Invalid SRT time format');
    });
  });

  describe('msToSrtTime', () => {
    it('converts milliseconds to SRT time format', () => {
      expect(msToSrtTime(90500)).toBe('00:01:30,500');
    });

    it('converts zero to 00:00:00,000', () => {
      expect(msToSrtTime(0)).toBe('00:00:00,000');
    });

    it('pads hours to two digits', () => {
      expect(msToSrtTime(3723400)).toBe('01:02:03,400');
    });

    it('pads milliseconds to three digits', () => {
      expect(msToSrtTime(1500)).toBe('00:00:01,500');
    });
  });

  describe('msToAssTime', () => {
    it('converts milliseconds to ASS time format', () => {
      expect(msToAssTime(90500)).toBe('0:01:30.50');
    });

    it('converts zero to 0:00:00.00', () => {
      expect(msToAssTime(0)).toBe('0:00:00.00');
    });

    it('does not pad the hour field', () => {
      expect(msToAssTime(3723400)).toBe('1:02:03.40');
    });

    it('rounds milliseconds down to centiseconds (2 digits)', () => {
      expect(msToAssTime(1505)).toBe('0:00:01.50');
    });
  });

  describe('parseTimestamp', () => {
    it('parses SRT timestamp with comma separator', () => {
      expect(parseTimestamp('00:00:01,000')).toBe(1000);
    });

    it('parses VTT timestamp with dot separator', () => {
      expect(parseTimestamp('00:00:01.000')).toBe(1000);
    });

    it('parses timestamp with hours', () => {
      expect(parseTimestamp('01:02:03,400')).toBe(3723400);
    });

    it('parses zero timestamp', () => {
      expect(parseTimestamp('00:00:00,000')).toBe(0);
    });

    it('parses zero timestamp with dot separator', () => {
      expect(parseTimestamp('00:00:00.000')).toBe(0);
    });

    it('throws on invalid format', () => {
      expect(() => parseTimestamp('invalid')).toThrow('Invalid timestamp format');
    });
  });
});
