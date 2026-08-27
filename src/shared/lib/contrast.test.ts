import {
  parseColor,
  toHex,
  getLuminance,
  getContrastRatio,
  composite,
  resolveColor,
  meetsAA,
  meetsAAA,
  meetsAALarge,
  getRating,
  pickPrimaryForeground,
  UnsupportedColorError,
  MissingTokenError,
  ColorCycleError,
  ContrastError,
} from '@/shared/lib/contrast';

describe('contrast engine', () => {
  describe('parseColor', () => {
    it('parses 6-digit hex', () => {
      expect(parseColor('#2563eb')).toEqual({ r: 0x25, g: 0x63, b: 0xeb, a: 1 });
      expect(parseColor('2563eb')).toEqual({ r: 0x25, g: 0x63, b: 0xeb, a: 1 });
    });

    it('parses 3-digit hex', () => {
      expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    });

    it('parses 8-digit hex with alpha', () => {
      expect(parseColor('#ffffffff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(parseColor('#00000080')).toEqual({ r: 0, g: 0, b: 0, a: expect.closeTo(0.502, 3) });
    });

    it('parses rgb() and rgba() with integers and percentages', () => {
      expect(parseColor('rgb(255, 128, 0)')).toEqual({ r: 255, g: 128, b: 0, a: 1 });
      expect(parseColor('rgba(0, 0, 0, 0.5)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
      expect(parseColor('rgb(100%, 50%, 0%)')).toEqual({ r: 255, g: 128, b: 0, a: 1 });
    });

    it('parses named colors', () => {
      expect(parseColor('white')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(parseColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    });

    it('throws on unsupported color', () => {
      expect(() => parseColor('not-a-color')).toThrow(UnsupportedColorError);
      expect(() => parseColor('hsl(0,0%,0%)')).toThrow(UnsupportedColorError);
    });
  });

  describe('toHex', () => {
    it('converts to lowercase 6-digit hex', () => {
      expect(toHex('#FFF')).toBe('#ffffff');
      expect(toHex({ r: 0x25, g: 0x63, b: 0xeb, a: 1 })).toBe('#2563eb');
    });
  });

  describe('getLuminance', () => {
    it('returns 1 for white and 0 for black', () => {
      expect(getLuminance('#ffffff')).toBeCloseTo(1, 5);
      expect(getLuminance('#000000')).toBeCloseTo(0, 5);
    });

    it('matches known W3C examples', () => {
      expect(getLuminance('#ff0000')).toBeCloseTo(0.2126, 3);
      expect(getLuminance('#00ff00')).toBeCloseTo(0.7152, 3);
      expect(getLuminance('#0000ff')).toBeCloseTo(0.0722, 3);
    });

    it('throws for translucent color', () => {
      expect(() => getLuminance('rgba(0,0,0,0.5)')).toThrow(ContrastError);
    });
  });

  describe('getContrastRatio', () => {
    it('black/white = 21', () => {
      expect(getContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 2);
    });

    it('same color = 1', () => {
      expect(getContrastRatio('#5E6AD2', '#5E6AD2')).toBeCloseTo(1, 5);
    });

    it('is symmetric', () => {
      expect(getContrastRatio('#ffffff', '#000000')).toBeCloseTo(getContrastRatio('#000000', '#ffffff'), 5);
    });

    it('composites translucent foreground over opaque background', () => {
      // 50% black over white = gray #808080, contrast with white = 3.98
      expect(getContrastRatio('rgba(0,0,0,0.5)', '#ffffff')).toBeCloseTo(3.98, 1);
    });

    it('composites translucent background over supplied backdrop', () => {
      // 50% white over black = gray #808080, contrast with white = 3.98
      expect(getContrastRatio('#ffffff', 'rgba(255,255,255,0.5)', '#000000')).toBeCloseTo(3.98, 1);
    });

    it('throws when translucent background lacks backdrop', () => {
      expect(() => getContrastRatio('#ffffff', 'rgba(255,255,255,0.5)')).toThrow(ContrastError);
    });
  });

  describe('composite', () => {
    it('alpha 0 foreground is background', () => {
      expect(composite(parseColor('rgba(255,0,0,0)'), parseColor('#ffffff'))).toEqual(
        expect.objectContaining({ r: 255, g: 255, b: 255, a: 1 }),
      );
    });

    it('alpha 1 foreground is foreground', () => {
      expect(composite(parseColor('#ff0000'), parseColor('#ffffff'))).toEqual(
        expect.objectContaining({ r: 255, g: 0, b: 0, a: 1 }),
      );
    });

    it('50% black over white is #808080', () => {
      const out = composite(parseColor('rgba(0,0,0,0.5)'), parseColor('#ffffff'));
      expect(out).toEqual(expect.objectContaining({ r: 128, g: 128, b: 128, a: 1 }));
    });
  });

  describe('resolveColor', () => {
    const tokenMap: Record<string, string> = {
      'color-primary': '#5E6AD2',
      'color-primary-rgb': '94, 106, 210',
      'color-text': '#2A2A2B',
      'color-text-muted': 'var(--color-text-secondary)',
      'color-text-secondary': '#6E6E73',
      'color-glass-surface': 'rgba(255,255,255,0.85)',
      'color-glass-liquid-surface': 'color-mix(in srgb, var(--color-glass-surface), transparent 55%)',
      'color-liquid-blob-strong': 'color-mix(in srgb, var(--color-primary) 30%, transparent)',
    };

    it('resolves hex var', () => {
      expect(resolveColor('var(--color-text)', tokenMap)).toEqual({ r: 42, g: 42, b: 43, a: 1 });
    });

    it('resolves chained vars', () => {
      expect(resolveColor('var(--color-text-muted)', tokenMap)).toEqual({ r: 110, g: 110, b: 115, a: 1 });
    });

    it('resolves rgba with var(--*-rgb)', () => {
      expect(resolveColor('rgba(var(--color-primary-rgb), 0.12)', tokenMap)).toEqual(
        expect.objectContaining({ r: 94, g: 106, b: 210, a: 0.12 }),
      );
    });

    it('resolves color-mix with transparent', () => {
      const mixed = resolveColor('var(--color-glass-liquid-surface)', tokenMap);
      // 45% rgba(255,255,255,0.85) + 55% transparent -> alpha 0.3825
      expect(mixed.a).toBeCloseTo(0.3825, 3);
    });

    it('throws for missing token', () => {
      expect(() => resolveColor('var(--color-missing)', tokenMap)).toThrow(MissingTokenError);
    });

    it('throws for cycle', () => {
      const cyclic = {
        'color-a': 'var(--color-b)',
        'color-b': 'var(--color-a)',
      };
      expect(() => resolveColor('var(--color-a)', cyclic)).toThrow(ColorCycleError);
    });
  });

  describe('thresholds', () => {
    it('meetsAA for normal text', () => {
      expect(meetsAA(4.5)).toBe(true);
      expect(meetsAA(4.49)).toBe(false);
    });

    it('meetsAA for large text', () => {
      expect(meetsAALarge(3.0)).toBe(true);
      expect(meetsAALarge(2.99)).toBe(false);
    });

    it('meetsAAA for normal text', () => {
      expect(meetsAAA(7.0)).toBe(true);
      expect(meetsAAA(6.99)).toBe(false);
    });

    it('getRating respects large text thresholds', () => {
      expect(getRating(5.0, true)).toEqual({ level: 'AAA', ratio: 5.0, pass: true });
      expect(getRating(4.0, true)).toEqual({ level: 'AA', ratio: 4.0, pass: true });
      expect(getRating(2.0, true)).toEqual({ level: 'Fail', ratio: 2.0, pass: false });
    });
  });

  describe('pickPrimaryForeground', () => {
    it('picks white on dark primary', () => {
      expect(pickPrimaryForeground('#5E6AD2')).toBe('#ffffff');
    });

    it('picks black on light primary', () => {
      expect(pickPrimaryForeground('#F9F9F7')).toBe('#000000');
    });

    it('picks first passing candidate', () => {
      expect(pickPrimaryForeground('#ffffff', ['#000000', '#ffffff'])).toBe('#000000');
    });
  });
});
