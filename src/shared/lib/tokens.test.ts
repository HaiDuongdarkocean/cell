import { deriveColorTokens, DEFAULT_DARK_COLORS, getPresetColors } from './tokens';
import { getLuminance } from '@/shared/lib/contrast';
import type { CoreColorTokens } from '@/entities/theme/types';

describe('deriveColorTokens', () => {
  it('lifts surface-hover above surface on dark themes (never sinks)', () => {
    const t = deriveColorTokens(
      { ...DEFAULT_DARK_COLORS, surface: '#242424' },
      'dark',
    );
    const hover = t['--color-surface-hover'];
    expect(getLuminance(hover)).toBeGreaterThan(getLuminance('#242424'));
  });

  it('derives primary-emphasis from the palette for presets without a tuned value', () => {
    const forest: CoreColorTokens = getPresetColors('forest').dark;
    const t = deriveColorTokens(forest, 'dark', 'forest');
    expect(t['--color-primary-emphasis']).not.toBe(forest.primary);
    expect(t['--color-on-primary-emphasis']).toBeDefined();
  });

  it('keeps tuned preset accents only on the pristine preset palette', () => {
    const dawn = getPresetColors('dawn');
    const pristine = deriveColorTokens(dawn.dark, 'dark', 'dawn');
    expect(pristine['--color-primary-emphasis']).toBe('#2E68A8');

    const custom = deriveColorTokens(
      { ...dawn.dark, primary: '#E8A34D' },
      'dark',
      'dawn',
    );
    expect(custom['--color-primary-emphasis']).not.toBe('#2E68A8');
    expect(custom['--color-primary-emphasis']).not.toBe('#E8A34D');
  });
});
