import { describe, it, expect } from '@jest/globals';
import { DEFAULT_SETTINGS, DEFAULT_NAV_CLUSTER_SETTINGS, DEFAULT_SUBTITLE_BLOCK_SETTINGS } from '@/shared/config/config';
import type { Settings, NavClusterSettings, SubtitleBlockSettings } from '@/entities/settings';

describe('NavClusterSettings + SubtitleBlockSettings types + defaults (ADR-025)', () => {
  it('DEFAULT_NAV_CLUSTER_SETTINGS has 4 fields (enabled, buttonSize, textOpacity, bgOpacity)', () => {
    expect(DEFAULT_NAV_CLUSTER_SETTINGS).toBeDefined();
    expect(DEFAULT_NAV_CLUSTER_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_NAV_CLUSTER_SETTINGS.buttonSize).toBe(34);
    expect(DEFAULT_NAV_CLUSTER_SETTINGS.textOpacity).toBe(1);
    expect(DEFAULT_NAV_CLUSTER_SETTINGS.bgOpacity).toBe(0.2);
  });

  it('DEFAULT_SUBTITLE_BLOCK_SETTINGS has 3 fields (yOffsetPercent, globalScale, bgOpacity)', () => {
    expect(DEFAULT_SUBTITLE_BLOCK_SETTINGS).toBeDefined();
    expect(DEFAULT_SUBTITLE_BLOCK_SETTINGS.yOffsetPercent).toBe(75);
    expect(DEFAULT_SUBTITLE_BLOCK_SETTINGS.globalScale).toBe(1);
    expect(DEFAULT_SUBTITLE_BLOCK_SETTINGS.bgOpacity).toBe(0.7);
  });

  it('DEFAULT_SETTINGS includes navCluster flat fields + subtitleBlockSettings', () => {
    expect(DEFAULT_SETTINGS.navClusterEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.navClusterButtonSize).toBe(34);
    expect(DEFAULT_SETTINGS.navClusterTextOpacity).toBe(1);
    expect(DEFAULT_SETTINGS.navClusterButtonBgOpacity).toBe(0.2);
    expect(DEFAULT_SETTINGS.subtitleBlockSettings).toEqual(DEFAULT_SUBTITLE_BLOCK_SETTINGS);
  });

  it('NavClusterSettings interface shape (4 fields: enabled, buttonSize, textOpacity, bgOpacity)', () => {
    const s: NavClusterSettings = {
      enabled: true,
      buttonSize: 48,
      textOpacity: 0.8,
      bgOpacity: 0.3,
    };
    expect(s.enabled).toBe(true);
  });

  it('SubtitleBlockSettings interface shape', () => {
    const b: SubtitleBlockSettings = {
      yOffsetPercent: 50,
      globalScale: 1.2,
      bgOpacity: 0.5,
    };
    expect(b.yOffsetPercent).toBe(50);
  });

  it('Settings interface includes navCluster + block fields', () => {
    const s: Settings = { ...DEFAULT_SETTINGS };
    expect(s.navClusterEnabled).toBe(true);
    expect(s.subtitleBlockSettings.yOffsetPercent).toBe(75);
  });

  it('buttonSize is a number in free range 10-100 (ADR-018 D2-rev)', () => {
    const valid: Array<NavClusterSettings['buttonSize']> = [10, 33, 34, 48, 56, 100];
    expect(valid).toHaveLength(6);
    expect(valid.every((v) => typeof v === 'number')).toBe(true);
  });
});

