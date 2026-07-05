import {
  hexToRgb,
  rgbToHex,
  getLuminance,
  generateShade,
  generateTint,
  generateHoverColor,
  generatePalette,
} from '@/features/theme/logic/colorGenerator';

describe('colorGenerator', () => {
  describe('hexToRgb', () => {
    it('parses 6-digit hex', () => {
      expect(hexToRgb('#2563eb')).toEqual({ r: 0x25, g: 0x63, b: 0xeb });
      expect(hexToRgb('2563eb')).toEqual({ r: 0x25, g: 0x63, b: 0xeb });
    });
    it('parses 3-digit hex (expands)', () => {
      expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#abc')).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc });
    });
    it('is case-insensitive', () => {
      expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#FfFfFf')).toEqual({ r: 255, g: 255, b: 255 });
    });
    it('trims whitespace', () => {
      expect(hexToRgb('  #2563eb  ')).toEqual({ r: 0x25, g: 0x63, b: 0xeb });
    });
    it('throws on invalid hex', () => {
      expect(() => hexToRgb('#gggggg')).toThrow('Invalid hex');
      expect(() => hexToRgb('not-a-color')).toThrow('Invalid hex');
      expect(() => hexToRgb('#12345')).toThrow('Invalid hex');
      expect(() => hexToRgb('')).toThrow('Invalid hex');
    });
  });

  describe('rgbToHex', () => {
    it('converts rgb to lowercase hex', () => {
      expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
      expect(rgbToHex(0x25, 0x63, 0xeb)).toBe('#2563eb');
    });
    it('clamps out-of-range values', () => {
      expect(rgbToHex(300, -10, 128)).toBe('#ff0080');
    });
    it('rounds floats', () => {
      // 127.6 → 128 (0x80), 0.4 → 0 (0x00), 255 → 255 (0xff)
      expect(rgbToHex(127.6, 0.4, 255)).toBe('#8000ff');
    });
  });

  describe('getLuminance', () => {
    it('returns 1 for white', () => {
      expect(getLuminance('#ffffff')).toBeCloseTo(1, 5);
    });
    it('returns 0 for black', () => {
      expect(getLuminance('#000000')).toBeCloseTo(0, 5);
    });
    it('returns mid value for gray', () => {
      const lum = getLuminance('#808080');
      expect(lum).toBeGreaterThan(0.1);
      expect(lum).toBeLessThan(0.5);
    });
    it('accepts 3-digit hex', () => {
      expect(getLuminance('#fff')).toBeCloseTo(1, 5);
    });
  });

  describe('generateShade', () => {
    it('0% returns unchanged', () => {
      expect(generateShade('#2563eb', 0)).toBe('#2563eb');
    });
    it('100% returns black', () => {
      expect(generateShade('#2563eb', 100)).toBe('#000000');
    });
    it('darkens by percent', () => {
      // 50% shade of white = 50% gray
      expect(generateShade('#ffffff', 50)).toBe('#808080');
    });
    it('handles 3-digit hex', () => {
      expect(generateShade('#fff', 50)).toBe('#808080');
    });
  });

  describe('generateTint', () => {
    it('0% returns unchanged', () => {
      expect(generateTint('#2563eb', 0)).toBe('#2563eb');
    });
    it('100% returns white', () => {
      expect(generateTint('#000000', 100)).toBe('#ffffff');
    });
    it('lightens by percent', () => {
      expect(generateTint('#000000', 50)).toBe('#808080');
    });
  });

  describe('generateHoverColor', () => {
    it('is shade 10%', () => {
      expect(generateHoverColor('#ffffff')).toBe(generateShade('#ffffff', 10));
      // 10% shade of white = #e6e6e6
      expect(generateHoverColor('#ffffff')).toBe('#e6e6e6');
    });
  });

  describe('generatePalette', () => {
    it('returns 11 stops 50-950', () => {
      const palette = generatePalette('#2563eb');
      expect(Object.keys(palette).map(Number).sort((a, b) => a - b))
        .toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
    });
    it('places base hex at 500', () => {
      const palette = generatePalette('#2563eb');
      expect(palette[500]).toBe('#2563eb');
    });
    it('50 is lighter than 500, 950 is darker', () => {
      const palette = generatePalette('#2563eb');
      expect(getLuminance(palette[50])).toBeGreaterThan(getLuminance(palette[500]));
      expect(getLuminance(palette[950])).toBeLessThan(getLuminance(palette[500]));
    });
  });
});
