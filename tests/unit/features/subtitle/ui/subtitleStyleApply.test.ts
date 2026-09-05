import {
  buildTextShadow,
  sanitizeFontFamily,
  hexToRgba,
} from '@/features/subtitle/ui/subtitleUI';
import type { TextShadowConfig } from '@/types/subtitle';

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
    expect(result).toBe('var(--shadow-textSoft) #000000');
  });

  it('returns cinema preset format', () => {
    const result = buildTextShadow({ ...base, preset: 'cinema', color: '#333333' });
    expect(result).toBe('var(--shadow-textCinema) #333333');
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

  it('returns token-based overlay color for invalid hex (fallback)', () => {
    expect(hexToRgba('not-a-hex', 0.5)).toBe('color-mix(in srgb, var(--color-overlay-background) 50%, transparent)');
  });
});
