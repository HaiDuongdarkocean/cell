import { deriveColorTokens, DEFAULT_LIGHT_COLORS } from './tokens';
import { getLuminance } from '@/shared/lib/contrast';

describe('deriveColorTokens', () => {
  it('derives a surface-hover visually distinct from surface', () => {
    const t = deriveColorTokens(
      { ...DEFAULT_LIGHT_COLORS, surface: '#F5F5F4' },
    );
    const hover = t['--color-surface-hover'];
    expect(hover).not.toBe('#F5F5F4');
    expect(getLuminance(hover)).toBeLessThan(getLuminance('#F5F5F4'));
  });
});
