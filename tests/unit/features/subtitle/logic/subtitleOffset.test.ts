import {
  parseOffsetInput,
  clampOffsetMs,
  effectiveTime,
  formatOffsetDisplay,
} from '@/features/subtitle/logic/subtitleOffset';

describe('subtitleOffset — pure functions (V2 — no lazy/auto-commit)', () => {
  // === parseOffsetInput ===
  describe('parseOffsetInput', () => {
    it('parses positive seconds string', () => {
      expect(parseOffsetInput('0.7')).toBe(700);
      expect(parseOffsetInput('1.5')).toBe(1500);
      expect(parseOffsetInput('2')).toBe(2000);
    });

    it('parses negative seconds string', () => {
      expect(parseOffsetInput('-0.5')).toBe(-500);
      expect(parseOffsetInput('-2')).toBe(-2000);
    });

    it('parses with whitespace', () => {
      expect(parseOffsetInput('  0.7  ')).toBe(700);
    });

    it('parses with "s" suffix', () => {
      expect(parseOffsetInput('0.7s')).toBe(700);
      expect(parseOffsetInput('-0.5s')).toBe(-500);
    });

    it('returns null for non-numeric', () => {
      expect(parseOffsetInput('abc')).toBeNull();
      expect(parseOffsetInput('')).toBeNull();
      expect(parseOffsetInput('  ')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseOffsetInput('')).toBeNull();
    });

    it('accepts any range (no ±60s limit)', () => {
      expect(parseOffsetInput('61')).toBe(61000);
      expect(parseOffsetInput('-61')).toBe(-61000);
      expect(parseOffsetInput('60')).toBe(60000);
      expect(parseOffsetInput('-60')).toBe(-60000);
    });

    it('rejects NaN-producing inputs', () => {
      expect(parseOffsetInput('Infinity')).toBeNull();
      expect(parseOffsetInput('NaN')).toBeNull();
    });
  });

  // === clampOffsetMs ===
  describe('clampOffsetMs', () => {
    it('returns value within range unchanged', () => {
      expect(clampOffsetMs(0)).toBe(0);
      expect(clampOffsetMs(500)).toBe(500);
      expect(clampOffsetMs(-500)).toBe(-500);
      expect(clampOffsetMs(60000)).toBe(60000);
      expect(clampOffsetMs(-60000)).toBe(-60000);
    });

    it('passes through any value (no clamping)', () => {
      expect(clampOffsetMs(61000)).toBe(61000);
      expect(clampOffsetMs(999999)).toBe(999999);
    });

    it('passes through negative values (no clamping)', () => {
      expect(clampOffsetMs(-61000)).toBe(-61000);
      expect(clampOffsetMs(-999999)).toBe(-999999);
    });

    it('rounds to integer ms', () => {
      expect(clampOffsetMs(700.4)).toBe(700);
      expect(clampOffsetMs(700.6)).toBe(701);
    });
  });

  // === effectiveTime ===
  describe('effectiveTime', () => {
    it('adds positive offset (sub muộn → search time tăng)', () => {
      expect(effectiveTime(1000, 500)).toBe(1500);
    });

    it('adds negative offset (sub sớm → search time giảm)', () => {
      expect(effectiveTime(1000, -500)).toBe(500);
    });

    it('zero offset returns unchanged', () => {
      expect(effectiveTime(1000, 0)).toBe(1000);
    });

    it('can produce negative effective time (cue before video start)', () => {
      expect(effectiveTime(200, -500)).toBe(-300);
    });
  });

  // === formatOffsetDisplay ===
  describe('formatOffsetDisplay', () => {
    it('formats zero', () => {
      expect(formatOffsetDisplay(0)).toBe('0s');
    });

    it('formats positive ms → +seconds', () => {
      expect(formatOffsetDisplay(700)).toBe('+0.7s');
      expect(formatOffsetDisplay(1500)).toBe('+1.5s');
      expect(formatOffsetDisplay(2000)).toBe('+2s');
    });

    it('formats negative ms → -seconds', () => {
      expect(formatOffsetDisplay(-500)).toBe('-0.5s');
      expect(formatOffsetDisplay(-2000)).toBe('-2s');
    });

    it('formats exact seconds without decimal', () => {
      expect(formatOffsetDisplay(1000)).toBe('+1s');
      expect(formatOffsetDisplay(3000)).toBe('+3s');
    });

    it('trims trailing zero (1.0s → 1s)', () => {
      expect(formatOffsetDisplay(1000)).toBe('+1s');
      expect(formatOffsetDisplay(-1000)).toBe('-1s');
    });
  });
});
