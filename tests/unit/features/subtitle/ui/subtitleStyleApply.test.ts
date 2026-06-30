import {
  calcYOffsetPercent,
  buildTextShadow,
  sanitizeFontFamily,
  hexToRgba,
} from '@/features/subtitle/ui/subtitleUI';
import type { TextShadowConfig } from '@/types/subtitle';

// === calcYOffsetPercent ===

describe('calcYOffsetPercent', () => {
  // Overlay anchored at `bottom%` (distance from video bottom). Drag up
  // (deltaY<0) → offset increases → subtitle moves up (natural drag direction).
  // Drag down (deltaY>0) → offset decreases → subtitle moves down.

  it('returns current offset when delta is 0', () => {
    expect(calcYOffsetPercent(0, 600, 10)).toBe(10);
  });

  it('drag down decreases offset (subtitle follows down)', () => {
    // delta 60px down on 600px container = 10% → 10 - 10 = 0
    expect(calcYOffsetPercent(60, 600, 10)).toBe(0);
  });

  it('drag up increases offset, clamps to 95', () => {
    // delta -600px up on 600px = +100% → 5 + 100 = 105 → clamp 95
    expect(calcYOffsetPercent(-600, 600, 5)).toBe(95);
  });

  it('drag down clamps to 0 when result negative', () => {
    // delta 60000px down → 90 - 10000 = negative → clamp 0
    expect(calcYOffsetPercent(60000, 600, 90)).toBe(0);
  });

  it('rounds to nearest integer', () => {
    // delta 3px down on 600px = 0.5% → 10 - 0.5 = 9.5 → Math.round(9.5) = 10
    expect(calcYOffsetPercent(3, 600, 10)).toBe(10);
  });

  it('drag up adds offset (subtitle follows up)', () => {
    // delta -30px up on 600px = +5% → 20 + 5 = 25
    expect(calcYOffsetPercent(-30, 600, 20)).toBe(25);
  });

  it('regression: natural drag up moves subtitle up', () => {
    // start at bottom (offset 0), drag up 120px on 600px container → +20% → 20
    expect(calcYOffsetPercent(-120, 600, 0)).toBe(20);
  });

  it('regression: natural drag down moves subtitle down', () => {
    // start near top (offset 80), drag down 120px on 600px → -20% → 60
    expect(calcYOffsetPercent(120, 600, 80)).toBe(60);
  });
});

// === buildTextShadow ===

describe('buildTextShadow', () => {
  const base: TextShadowConfig = {
    preset: 'custom',
    color: '#000000',
    blur: 2,
    offsetX: 1,
    offsetY: 1,
  };

  it('returns "none" for preset none', () => {
    expect(buildTextShadow({ ...base, preset: 'none' })).toBe('none');
  });

  it('returns soft preset format', () => {
    const result = buildTextShadow({ ...base, preset: 'soft', color: '#000000' });
    expect(result).toBe('0 1px 2px #000000');
  });

  it('returns cinema preset format', () => {
    const result = buildTextShadow({ ...base, preset: 'cinema', color: '#333333' });
    expect(result).toBe('2px 2px 4px #333333');
  });

  it('returns custom format with offsetX/offsetY/blur/color', () => {
    const result = buildTextShadow({
      ...base,
      preset: 'custom',
      color: '#ff0000',
      blur: 3,
      offsetX: 2,
      offsetY: -1,
    });
    expect(result).toBe('2px -1px 3px #ff0000');
  });
});

// === sanitizeFontFamily ===

describe('sanitizeFontFamily', () => {
  it('returns sans-serif for empty string', () => {
    expect(sanitizeFontFamily('')).toBe('sans-serif');
  });

  it('returns sans-serif for whitespace-only string', () => {
    expect(sanitizeFontFamily('   ')).toBe('sans-serif');
  });

  it('returns valid font-family string trimmed', () => {
    expect(sanitizeFontFamily('  Noto Sans JP, sans-serif  ')).toBe('Noto Sans JP, sans-serif');
  });

  it('blocks url() and falls back to sans-serif', () => {
    expect(sanitizeFontFamily('url(evil.com/font.woff)')).toBe('sans-serif');
  });

  it('blocks @import and falls back to sans-serif', () => {
    expect(sanitizeFontFamily('@import url(evil.com)')).toBe('sans-serif');
  });

  it('blocks expression() and falls back to sans-serif', () => {
    expect(sanitizeFontFamily('expression(alert(1))')).toBe('sans-serif');
  });

  it('blocks javascript: protocol and falls back to sans-serif', () => {
    expect(sanitizeFontFamily('javascript:alert(1)')).toBe('sans-serif');
  });

  it('allows generic family names', () => {
    expect(sanitizeFontFamily('serif')).toBe('serif');
    expect(sanitizeFontFamily('monospace')).toBe('monospace');
  });

  it('allows quoted font names with fallback', () => {
    expect(sanitizeFontFamily('"Noto Sans JP", "Hiragino Sans", sans-serif')).toBe(
      '"Noto Sans JP", "Hiragino Sans", sans-serif',
    );
  });
});

// === hexToRgba ===

describe('hexToRgba', () => {
  it('converts 6-digit hex with alpha', () => {
    expect(hexToRgba('#000000', 0.7)).toBe('rgba(0, 0, 0, 0.7)');
  });

  it('converts #ffffff with alpha 1', () => {
    expect(hexToRgba('#ffffff', 1)).toBe('rgba(255, 255, 255, 1)');
  });

  it('converts #ff0000 with alpha 0', () => {
    expect(hexToRgba('#ff0000', 0)).toBe('rgba(255, 0, 0, 0)');
  });

  it('converts 3-digit hex #fff', () => {
    expect(hexToRgba('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
  });

  it('converts 3-digit hex #000', () => {
    expect(hexToRgba('#000', 0.3)).toBe('rgba(0, 0, 0, 0.3)');
  });

  it('returns rgba(0,0,0,alpha) for invalid hex (fallback)', () => {
    expect(hexToRgba('not-a-hex', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
  });
});
