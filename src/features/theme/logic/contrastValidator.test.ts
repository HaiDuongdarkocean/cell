import {
  getContrastRatio,
  meetsAA,
  meetsAAA,
  meetsAALarge,
  getRating,
  validateTheme,
} from '@/features/theme/logic/contrastValidator';
import { DEFAULT_THEME_CONFIG } from '@/features/theme/logic/themeConfig';
import { DEFAULT_LIGHT_COLORS } from '@/shared/lib/tokens';

describe('contrastValidator', () => {
  describe('getContrastRatio', () => {
    it('black/white = 21', () => {
      expect(getContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    });
    it('same color = 1', () => {
      expect(getContrastRatio(DEFAULT_LIGHT_COLORS.primary, DEFAULT_LIGHT_COLORS.primary)).toBeCloseTo(1, 5);
    });
    it('is symmetric (fg/bg swap same result)', () => {
      expect(getContrastRatio('#ffffff', '#000000')).toBeCloseTo(getContrastRatio('#000000', '#ffffff'), 5);
    });
    it('handles 3-digit hex', () => {
      expect(getContrastRatio('#000', '#fff')).toBeCloseTo(21, 0);
    });
  });

  describe('meetsAA / meetsAAA / meetsAALarge', () => {
    it('AA threshold 4.5', () => {
      expect(meetsAA(4.5)).toBe(true);
      expect(meetsAA(4.49)).toBe(false);
    });
    it('AAA threshold 7', () => {
      expect(meetsAAA(7)).toBe(true);
      expect(meetsAAA(6.99)).toBe(false);
    });
    it('AALarge threshold 3', () => {
      expect(meetsAALarge(3)).toBe(true);
      expect(meetsAALarge(2.99)).toBe(false);
    });
  });

  describe('getRating', () => {
    it('AAA when ratio >= 7', () => {
      expect(getRating(7.5)).toEqual({ level: 'AAA', ratio: 7.5, pass: true });
      expect(getRating(7)).toEqual({ level: 'AAA', ratio: 7, pass: true });
    });
    it('AA when 4.5 <= ratio < 7', () => {
      expect(getRating(5)).toEqual({ level: 'AA', ratio: 5, pass: true });
      expect(getRating(4.5)).toEqual({ level: 'AA', ratio: 4.5, pass: true });
    });
    it('Fail when ratio < 4.5', () => {
      expect(getRating(4)).toEqual({ level: 'Fail', ratio: 4, pass: false });
      expect(getRating(1)).toEqual({ level: 'Fail', ratio: 1, pass: false });
    });
  });

  describe('validateTheme', () => {
    it('returns 3 pairs for light palette', () => {
      const result = validateTheme(DEFAULT_THEME_CONFIG.customColors.light);
      expect(result.pairs).toHaveLength(3);
      expect(result.pairs.map((p) => p.label)).toEqual([
        'Text / Canvas',
        'Text Secondary / Canvas',
        'White / Primary',
      ]);
    });
    it('allPass true when all pairs pass AA', () => {
      // Default light palette: text #0f172a on canvas #ffffff = high contrast.
      const result = validateTheme(DEFAULT_THEME_CONFIG.customColors.light);
      expect(result.allPass).toBe(true);
    });
    it('allPass false when a pair fails', () => {
      // White text on white canvas = fail.
      const bad = { ...DEFAULT_THEME_CONFIG.customColors.light, text: '#ffffff' };
      const result = validateTheme(bad);
      expect(result.allPass).toBe(false);
      expect(result.pairs[0].rating.level).toBe('Fail');
    });
    it('each pair has fg, bg, ratio, rating', () => {
      const result = validateTheme(DEFAULT_THEME_CONFIG.customColors.dark);
      for (const p of result.pairs) {
        expect(typeof p.fg).toBe('string');
        expect(typeof p.bg).toBe('string');
        expect(typeof p.ratio).toBe('number');
        expect(p.rating).toBeDefined();
      }
    });
  });
});
