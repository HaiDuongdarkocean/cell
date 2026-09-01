import { buildClusterCssVars } from '@/features/subtitle/ui/subtitleUI';
import type { NavClusterSettings } from '@/entities/media';

type ClusterVars = Record<string, string>;

describe('buildClusterCssVars — SSOT for cluster CSS custom properties', () => {
  it('returns defaults when settings is undefined', () => {
    const vars = buildClusterCssVars() as ClusterVars;
    expect(vars['--cluster-btn-size']).toBe('clamp(22px, 5cqw, 34px)');
    expect(vars['--cluster-icon-size']).toBe('clamp(12px, 3cqw, 20px)');
    expect(vars['--cluster-text-opacity']).toBe('1');
    expect(vars['--cluster-bg-opacity']).toBe('0.2');
  });

  it('returns defaults when settings has no relevant fields', () => {
    const vars = buildClusterCssVars({} as NavClusterSettings) as ClusterVars;
    expect(vars['--cluster-btn-size']).toBe('clamp(22px, 5cqw, 34px)');
    expect(vars['--cluster-text-opacity']).toBe('1');
    expect(vars['--cluster-bg-opacity']).toBe('0.2');
  });

  it('applies custom buttonSize with clamp formula', () => {
    const vars = buildClusterCssVars({ buttonSize: 48, textOpacity: 1, bgOpacity: 0.2, enabled: true }) as ClusterVars;
    // 48 * 0.65 = 31.2 → round = 31
    // 48 * 0.15 = 7.2 → round = 7
    expect(vars['--cluster-btn-size']).toBe('clamp(31px, 7cqw, 48px)');
    // 48 * 0.35 = 16.8 → round = 17
    // 48 * 0.082 = 3.936 → round = 4
    expect(vars['--cluster-icon-size']).toBe('clamp(17px, 4cqw, 20px)');
  });

  it('applies custom textOpacity and bgOpacity', () => {
    const vars = buildClusterCssVars({ buttonSize: 34, textOpacity: 0.5, bgOpacity: 0.8, enabled: true }) as ClusterVars;
    expect(vars['--cluster-text-opacity']).toBe('0.5');
    expect(vars['--cluster-bg-opacity']).toBe('0.8');
  });

  it('produces identical output for same settings (deterministic)', () => {
    const settings: NavClusterSettings = { buttonSize: 40, textOpacity: 0.7, bgOpacity: 0.3, enabled: true };
    expect(buildClusterCssVars(settings)).toEqual(buildClusterCssVars(settings));
  });

  it('matches the formula used by NavCluster and clusterRight (no regression)', () => {
    // Verify the exact formula that was duplicated across 4 files
    const size = 34;
    const expected = {
      '--cluster-btn-size': `clamp(${Math.round(size * 0.65)}px, ${Math.round(size * 0.15)}cqw, ${size}px)`,
      '--cluster-icon-size': `clamp(${Math.round(size * 0.35)}px, ${Math.round(size * 0.082)}cqw, 20px)`,
      '--cluster-text-opacity': '1',
      '--cluster-bg-opacity': '0.2',
    };
    expect(buildClusterCssVars({ buttonSize: size, textOpacity: 1, bgOpacity: 0.2, enabled: true }) as ClusterVars).toEqual({
      ...expected,
      '--iconbutton-liquid-surface': 'rgba(10, 16, 26, 0.2)',
      '--iconbutton-liquid-surface-hover': 'rgba(14, 22, 34, 0.26)',
      '--iconbutton-liquid-surface-active': 'rgba(14, 22, 34, 0.32)',
      '--iconbutton-liquid-foreground': 'rgba(247, 248, 248, 1)',
      '--iconbutton-liquid-specular': 'rgba(255, 255, 255, 0.55)',
      '--iconbutton-liquid-caustic': 'rgba(160, 184, 220, 0.42)',
      '--iconbutton-liquid-inner-shadow': 'rgba(0, 0, 0, 0.3)',
      '--iconbutton-liquid-contact-shadow': 'rgba(0, 0, 0, 0.2)',
      '--iconbutton-liquid-focus-ring': 'rgba(255, 255, 255, 0.35)',
      '--iconbutton-liquid-backdrop-blur': 'var(--blur-lg)',
    });
  });
});
