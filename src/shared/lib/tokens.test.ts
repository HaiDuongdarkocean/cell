import { deriveColorTokens, DEFAULT_DARK_COLORS } from './tokens';
import { getLuminance } from '@/shared/lib/contrast';

describe('deriveColorTokens', () => {
  it('lifts surface-hover above surface on dark themes (never sinks)', () => {
    const t = deriveColorTokens(
      { ...DEFAULT_DARK_COLORS, surface: '#242424' },
      'dark',
    );
    const hover = t['--color-surface-hover'];
    expect(getLuminance(hover)).toBeGreaterThan(getLuminance('#242424'));
  });
});
