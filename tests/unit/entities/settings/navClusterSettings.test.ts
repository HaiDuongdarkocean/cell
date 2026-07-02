import { describe, it, expect } from '@jest/globals';
import { DEFAULT_SETTINGS, DEFAULT_NAV_CLUSTER_SETTINGS } from '@/shared/config/config';
import type { Settings, NavClusterSettings, NavClusterPosition } from '@/entities/settings';

describe('NavClusterSettings types + defaults', () => {
  it('DEFAULT_NAV_CLUSTER_SETTINGS is exported with all 6 fields', () => {
    expect(DEFAULT_NAV_CLUSTER_SETTINGS).toBeDefined();
    expect(DEFAULT_NAV_CLUSTER_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_NAV_CLUSTER_SETTINGS.position).toEqual({ x: 0, y: 75 });
    expect(DEFAULT_NAV_CLUSTER_SETTINGS.buttonSize).toBe(48);
    expect(DEFAULT_NAV_CLUSTER_SETTINGS.bgOpacity).toBe(0.7);
    expect(DEFAULT_NAV_CLUSTER_SETTINGS.buttonOpacity).toBe(0.9);
    expect(DEFAULT_NAV_CLUSTER_SETTINGS.collapsed).toBe(false);
  });

  it('DEFAULT_SETTINGS includes all 6 navCluster flat fields', () => {
    expect(DEFAULT_SETTINGS.navClusterEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.navClusterPosition).toEqual({ x: 0, y: 75 });
    expect(DEFAULT_SETTINGS.navClusterButtonSize).toBe(48);
    expect(DEFAULT_SETTINGS.navClusterBgOpacity).toBe(0.7);
    expect(DEFAULT_SETTINGS.navClusterButtonOpacity).toBe(0.9);
    expect(DEFAULT_SETTINGS.navClusterCollapsed).toBe(false);
  });

  it('NavClusterPosition interface shape', () => {
    const pos: NavClusterPosition = { x: 50, y: 25 };
    expect(pos.x).toBe(50);
    expect(pos.y).toBe(25);
  });

  it('NavClusterSettings interface shape', () => {
    const s: NavClusterSettings = {
      enabled: true,
      position: { x: 0, y: 75 },
      buttonSize: 48,
      bgOpacity: 0.7,
      buttonOpacity: 0.9,
      collapsed: false,
    };
    expect(s.enabled).toBe(true);
  });

  it('Settings interface includes navCluster fields', () => {
    const s: Settings = { ...DEFAULT_SETTINGS };
    expect(s.navClusterEnabled).toBe(true);
    expect(s.navClusterPosition.x).toBe(0);
  });

  it('buttonSize only accepts 40 | 48 | 56', () => {
    const valid: Array<NavClusterSettings['buttonSize']> = [40, 48, 56];
    expect(valid).toHaveLength(3);
  });
});
