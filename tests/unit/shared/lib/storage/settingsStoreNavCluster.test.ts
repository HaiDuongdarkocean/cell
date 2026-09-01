import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CURRENT_SCHEMA_VERSION, loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '@/shared/config/config';

// Mock chrome.storage.local
const storage: Record<string, unknown> = {};
const chromeMock = {
  storage: {
    local: {
      get: jest.fn(async (keys: string | string[]) => {
        const key = Array.isArray(keys) ? keys[0] : keys;
        return { [key]: storage[key] };
      }),
      set: jest.fn(async (obj: Record<string, unknown>) => {
        Object.assign(storage, obj);
      }),
    },
  },
};
(global as { chrome?: unknown }).chrome = chromeMock;

describe('settingsStore schema v9 migration (ADR-025 unified subtitle block)', () => {
  beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
    chromeMock.storage.local.get.mockClear();
    chromeMock.storage.local.set.mockClear();
  });

  it('CURRENT_SCHEMA_VERSION is 27 (V27 adds SRS settings slice)', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(27);
  });

  it('migrates v1 settings to v13 with nav cluster + block defaults merged', async () => {
    const v1Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 1,
    };
    delete (v1Settings as Record<string, unknown>).navClusterEnabled;
    delete (v1Settings as Record<string, unknown>).navClusterButtonSize;
    delete (v1Settings as Record<string, unknown>).navClusterTextOpacity;
    delete (v1Settings as Record<string, unknown>).navClusterButtonBgOpacity;
    delete (v1Settings as Record<string, unknown>).subtitleBlockSettings;
    storage[STORAGE_KEYS.SETTINGS] = v1Settings;

    const result = await loadSettings();

    expect(result.navClusterEnabled).toBe(true);
    expect(result.navClusterButtonSize).toBe(34);
    expect(result.navClusterTextOpacity).toBe(1);
    expect(result.navClusterButtonBgOpacity).toBe(0.2);
    // v8→v9 migration: legacyY = (targetY=18 + nativeY=6) / 2 = 12
    expect(result.subtitleBlockSettings).toEqual({
      yOffsetPercent: 12,
      globalScale: 1,
      bgOpacity: 0.7,
    });
  });

  it('preserves existing v1 fields after migration to v9', async () => {
    const v1Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 1,
      concurrentDownloads: 7,
    };
    delete (v1Settings as Record<string, unknown>).navClusterEnabled;
    storage[STORAGE_KEYS.SETTINGS] = v1Settings;

    const result = await loadSettings();

    expect(result.concurrentDownloads).toBe(7);
    expect(result.navClusterEnabled).toBe(true);
  });

  it('v8 → v9: creates subtitleBlockSettings from legacy yOffsetPercent in layer styles', async () => {
    storage[STORAGE_KEYS.SETTINGS] = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 8,
      subtitleOverlayTargetStyle: { ...DEFAULT_SETTINGS.subtitleOverlayTargetStyle, yOffsetPercent: 50 },
      subtitleOverlayNativeStyle: { ...DEFAULT_SETTINGS.subtitleOverlayNativeStyle, yOffsetPercent: 30 },
      navClusterBgOpacity: 0.4,
    };
    const result = await loadSettings();
    // legacyY = (targetY + nativeY) / 2 = (50 + 30) / 2 = 40
    expect(result.subtitleBlockSettings.yOffsetPercent).toBe(40);
    expect(result.subtitleBlockSettings.bgOpacity).toBe(0.4);
    expect(result.subtitleBlockSettings.globalScale).toBe(1);
  });

  it('v8 → v9: removes navClusterPosition, navClusterCollapsed; old navClusterBgOpacity → subtitleBlockSettings', async () => {
    storage[STORAGE_KEYS.SETTINGS] = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 8,
      navClusterPosition: { x: 20, y: 30 },
      navClusterBgOpacity: 0.5,
      navClusterCollapsed: true,
    };
    const result = await loadSettings();
    expect((result as unknown as Record<string, unknown>).navClusterPosition).toBeUndefined();
    // Old navClusterBgOpacity (0.5) → subtitleBlockSettings.bgOpacity
    expect(result.subtitleBlockSettings.bgOpacity).toBe(0.5);
    // New navClusterButtonBgOpacity (v13 field) = 0.2 default
    expect(result.navClusterButtonBgOpacity).toBe(0.2);
    expect((result as unknown as Record<string, unknown>).navClusterCollapsed).toBeUndefined();
  });

  it('v8 → v9: strips yOffsetPercent from layer styles', async () => {
    storage[STORAGE_KEYS.SETTINGS] = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 8,
      subtitleOverlayTargetStyle: { ...DEFAULT_SETTINGS.subtitleOverlayTargetStyle, yOffsetPercent: 50 },
    };
    const result = await loadSettings();
    expect((result.subtitleOverlayTargetStyle as unknown as Record<string, unknown>).yOffsetPercent).toBeUndefined();
  });

  it('v8 → v9: falls back to targetY when nativeY is 0 (no native offset)', async () => {
    storage[STORAGE_KEYS.SETTINGS] = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 8,
      subtitleOverlayTargetStyle: { ...DEFAULT_SETTINGS.subtitleOverlayTargetStyle, yOffsetPercent: 60 },
      subtitleOverlayNativeStyle: { ...DEFAULT_SETTINGS.subtitleOverlayNativeStyle, yOffsetPercent: 0 },
    };
    const result = await loadSettings();
    // nativeY=0 → legacyY = targetY = 60
    expect(result.subtitleBlockSettings.yOffsetPercent).toBe(60);
  });

  it('clamps invalid navClusterTextOpacity < 0 to 0', async () => {
    storage[STORAGE_KEYS.SETTINGS] = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 8,
      navClusterTextOpacity: -0.3,
    };
    const result = await loadSettings();
    expect(result.navClusterTextOpacity).toBe(0);
  });

  it('clamps invalid navClusterButtonBgOpacity > 1 to 1', async () => {
    storage[STORAGE_KEYS.SETTINGS] = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 8,
      navClusterButtonBgOpacity: 1.5,
    };
    const result = await loadSettings();
    expect(result.navClusterButtonBgOpacity).toBe(1);
  });

  it('v12→v13 migration: maps old navClusterButtonOpacity to navClusterTextOpacity', async () => {
    storage[STORAGE_KEYS.SETTINGS] = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 12,
      navClusterButtonOpacity: 0.85,
    };
    delete (storage[STORAGE_KEYS.SETTINGS] as Record<string, unknown>).navClusterTextOpacity;
    delete (storage[STORAGE_KEYS.SETTINGS] as Record<string, unknown>).navClusterButtonBgOpacity;
    const result = await loadSettings();
    expect(result.navClusterTextOpacity).toBe(0.85);
    expect(result.navClusterButtonBgOpacity).toBe(0.2);
    expect((result as unknown as Record<string, unknown>).navClusterButtonOpacity).toBeUndefined();
  });

  it('accepts in-range navClusterButtonSize=33 (free range 10-100)', async () => {
    storage[STORAGE_KEYS.SETTINGS] = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 8,
      navClusterButtonSize: 33,
    };
    const result = await loadSettings();
    expect(result.navClusterButtonSize).toBe(33);
  });

  it('clamps below-range navClusterButtonSize=5 to min 10', async () => {
    storage[STORAGE_KEYS.SETTINGS] = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 8,
      navClusterButtonSize: 5,
    };
    const result = await loadSettings();
    expect(result.navClusterButtonSize).toBe(10);
  });

  it('clamps above-range navClusterButtonSize=150 to max 100', async () => {
    storage[STORAGE_KEYS.SETTINGS] = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 8,
      navClusterButtonSize: 150,
    };
    const result = await loadSettings();
    expect(result.navClusterButtonSize).toBe(100);
  });

  it('falls back to default 34 when navClusterButtonSize is non-numeric', async () => {
    storage[STORAGE_KEYS.SETTINGS] = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 8,
      navClusterButtonSize: 'big' as unknown as number,
    };
    const result = await loadSettings();
    expect(result.navClusterButtonSize).toBe(34);
  });

  it('saveSettings stamps schemaVersion 22', async () => {
    await saveSettings({ navClusterEnabled: false });
    const stored = storage[STORAGE_KEYS.SETTINGS] as { schemaVersion: number };
    expect(stored.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('saveSettings partial preserves existing stored fields (read-modify-write)', async () => {
    // Bug: saveSettings({position}) after drag wiped buttonSize/bgOpacity/textOpacity
    // to defaults because it merged with DEFAULT_SETTINGS, not current stored settings.
    // ADR-025: position removed — test now uses subtitleBlockSettings partial.
    const existing = {
      ...DEFAULT_SETTINGS,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      navClusterEnabled: true,
      navClusterButtonSize: 56,
      navClusterTextOpacity: 0.5,
      navClusterButtonBgOpacity: 0.3,
      subtitleBlockSettings: { yOffsetPercent: 60, globalScale: 1.1, bgOpacity: 0.3 },
    };
    storage[STORAGE_KEYS.SETTINGS] = existing;

    // Simulate block drag persist: only subtitleBlockSettings in partial.
    await saveSettings({ subtitleBlockSettings: { yOffsetPercent: 70, globalScale: 1.1, bgOpacity: 0.3 } } as Partial<typeof DEFAULT_SETTINGS>);

    const stored = storage[STORAGE_KEYS.SETTINGS] as typeof DEFAULT_SETTINGS;
    expect(stored.subtitleBlockSettings.yOffsetPercent).toBe(70);
    // Other nav cluster fields MUST be preserved (not reset to defaults).
    expect(stored.navClusterButtonSize).toBe(56);
    expect(stored.navClusterTextOpacity).toBe(0.5);
    expect(stored.navClusterButtonBgOpacity).toBe(0.3);
    expect(stored.navClusterEnabled).toBe(true);
  });

  it('v2 settings migrate through v9 and produce subtitleBlockSettings', async () => {
    const v2Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 2,
      navClusterEnabled: false,
    };
    delete (v2Settings as Record<string, unknown>).subtitleOffset;
    // v2 didn't have navClusterBgOpacity (legacy field) — delete so v8→v9
    // migration uses old default 0.7 for subtitleBlockSettings.bgOpacity
    delete (v2Settings as Record<string, unknown>).navClusterBgOpacity;
    storage[STORAGE_KEYS.SETTINGS] = v2Settings;
    const result = await loadSettings();
    expect(result.navClusterEnabled).toBe(false);
    // v8→v9 migration: legacyY = (targetY=18 + nativeY=6) / 2 = 12
    expect(result.subtitleBlockSettings).toEqual({
      yOffsetPercent: 12,
      globalScale: 1,
      bgOpacity: 0.7,
    });
    expect(result.subtitleOffset).toEqual({});
  });
});


