/**
 * Centralized settings store with schema versioning + migration (ADR-017 D8, spec H5).
 *
 * All settings access SHOULD go through `loadSettings()` / `saveSettings()` rather
 * than direct `chrome.storage.local.get('settings')`. This ensures:
 * - Schema version is checked on every load
 * - Migrations run automatically when a version bump is detected
 * - Updated settings are persisted back after migration
 * - Callers always receive a complete `Settings` object (defaults merged)
 *
 * ponytail ceiling: V2 in-memory cache + cross-tab sync via storage.onChanged.
 * V1 reads on every call (settings are small + infrequent — no perf concern).
 */
import { getStorage, setStorage } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '@/shared/config/config';
import type { Settings, NavClusterButtonSize } from '@/entities/settings';

/** Current settings schema version. Bump when Settings shape changes. */
export const CURRENT_SCHEMA_VERSION = 7;

/** Settings payload as stored (with schemaVersion). */
interface StoredSettings extends Settings {
  schemaVersion: number;
}

/** Valid nav cluster button size range (ADR-018 D2-rev: free range 10-100px). */
const BUTTON_SIZE_MIN = 10;
const BUTTON_SIZE_MAX = 100;
const BUTTON_SIZE_DEFAULT: NavClusterButtonSize = 34;

/** Clamp a numeric value to [min, max]. Returns fallback if not a finite number. */
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

/** Coerce a value to boolean, defaulting to fallback. */
function coerceBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

/** Validate + clamp nav cluster fields after migration (ADR-018 D2 boundary validation). */
function validateNavClusterFields(s: Record<string, unknown>): void {
  const pos = s.navClusterPosition as { x?: number; y?: number } | undefined;
  if (pos && typeof pos === 'object') {
    s.navClusterPosition = {
      x: clampNumber(pos.x, 0, 100, 0),
      y: clampNumber(pos.y, 0, 100, 75),
    };
  }
  s.navClusterBgOpacity = clampNumber(s.navClusterBgOpacity, 0, 1, 0.7);
  s.navClusterButtonOpacity = clampNumber(s.navClusterButtonOpacity, 0, 1, 0.9);
  s.navClusterButtonSize = clampNumber(
    s.navClusterButtonSize,
    BUTTON_SIZE_MIN,
    BUTTON_SIZE_MAX,
    BUTTON_SIZE_DEFAULT,
  );
  s.navClusterEnabled = coerceBoolean(s.navClusterEnabled, true);
  s.navClusterCollapsed = coerceBoolean(s.navClusterCollapsed, false);
}

/**
 * Migrate settings from an older schema version to the current one.
 *
 * Each migration function takes the previous version's settings and returns
 * the next version's settings. Migrations run sequentially from the stored
 * version up to CURRENT_SCHEMA_VERSION.
 */
const migrations: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {
  // v0 → v1: first versioned schema. Unversioned settings (no schemaVersion
  // field) are treated as v0. Migration merges with defaults + stamps v1.
  0: (s) => ({ ...DEFAULT_SETTINGS, ...s, schemaVersion: 1 }),
  // v1 → v2: add nav cluster fields (ADR-018 D2). Merge DEFAULT_NAV_CLUSTER_SETTINGS
  // (already part of DEFAULT_SETTINGS) + validate/clamp nav fields.
  1: (s) => {
    const merged = { ...DEFAULT_SETTINGS, ...s, schemaVersion: 2 };
    validateNavClusterFields(merged);
    return merged;
  },
  // v2 → v3: add subtitleOffset (ADR-019). Additive — default {} (no offset).
  // Existing settings không có field này → merge với DEFAULT_SETTINGS.subtitleOffset={}.
  2: (s) => ({ ...DEFAULT_SETTINGS, ...s, subtitleOffset: s.subtitleOffset ?? {}, schemaVersion: 3 }),
  // v3 → v4: flip subtitle overlay defaults — auto-load ON, target=en, native=vi
  // (anh yêu không muốn setup mỗi lần). Fill default cho empty/undefined vì
  // pre-V4 default là '' (không phân biệt "user chọn ''" vs "default cũ ''").
  // User muốn tắt native → set '' sau khi load V4 (qua saveSettings).
  // User đã chọn lang khác hoặc tắt auto-load (false) → giữ nguyên.
  3: (s) => {
    const merged = { ...DEFAULT_SETTINGS, ...s, schemaVersion: 4 } as Record<string, unknown>;
    if (!merged.subtitleOverlayTargetLanguage) merged.subtitleOverlayTargetLanguage = 'en';
    if (!merged.subtitleOverlayNativeLanguage) merged.subtitleOverlayNativeLanguage = 'vi';
    if (merged.subtitleOverlayAutoLoad === undefined || merged.subtitleOverlayAutoLoad === false) {
      // pre-V4 default was false — treat as "not set" → flip to true.
      // User who explicitly disabled would re-disable after seeing auto-load ON.
      merged.subtitleOverlayAutoLoad = true;
    }
    return merged;
  },
  // v4 → v5: flip nav cluster button size → 34px (anh yêu không cần setup
  // mỗi lần). Only flip khi user đang ở pre-V5 default (buttonSize=48).
  // User đã chọn khác → giữ nguyên. (ADR-022 port: theme field removed from
  // Settings — theme now managed by themeStore/themeMode storage key. The
  // v4→v5 theme flip is no longer needed; themeStore.init() seeds themeMode
  // from legacy settings.theme if present.)
  4: (s) => {
    const merged = { ...DEFAULT_SETTINGS, ...s, schemaVersion: 5 } as Record<string, unknown>;
    if (merged.navClusterButtonSize === 48 || merged.navClusterButtonSize === undefined) {
      merged.navClusterButtonSize = 34;
    }
    return merged;
  },
  // v5 → v6: add subtitleOverlayAutoLoadAsr (default false). Existing users
  // who had auto-load ON were implicitly loading ASR — now ASR is opt-in.
  // Missing field → false (V6 default). No flip of existing explicit value.
  5: (s) => {
    const merged = { ...DEFAULT_SETTINGS, ...s, schemaVersion: 6 } as Record<string, unknown>;
    if (merged.subtitleOverlayAutoLoadAsr === undefined) {
      merged.subtitleOverlayAutoLoadAsr = false;
    }
    return merged;
  },
  // v6 → v7: add subtitleOverlayAutoTranslate (ADR-021, default true) +
  // 'toggle-translate' shortcut (Ctrl+Shift+T). Existing users get default true
  // (auto-dịch khi native thiếu — kim chỉ nam "user vào và học thôi").
  6: (s) => {
    const merged = { ...DEFAULT_SETTINGS, ...s, schemaVersion: 7 } as Record<string, unknown>;
    if (merged.subtitleOverlayAutoTranslate === undefined) {
      merged.subtitleOverlayAutoTranslate = true;
    }
    // Ensure toggle-translate shortcut exists in keyboardShortcuts.
    const shortcuts = Array.isArray(merged.keyboardShortcuts) ? merged.keyboardShortcuts : [];
    if (!shortcuts.some((sc: { action: string }) => sc.action === 'toggle-translate')) {
      merged.keyboardShortcuts = [...shortcuts, { action: 'toggle-translate', key: 't', ctrl: true, shift: true }];
    }
    return merged;
  },
};

/**
 * Load settings from chrome.storage.local with schema version check + migration.
 *
 * Returns a complete `Settings` object — defaults are merged for any missing
 * fields. If a migration runs, the updated settings are persisted back.
 */
export async function loadSettings(): Promise<Settings> {
  const data = await getStorage<Record<string, unknown>>(STORAGE_KEYS.SETTINGS);
  const raw = data[STORAGE_KEYS.SETTINGS] as Record<string, unknown> | undefined;

  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  const storedVersion = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  if (storedVersion >= CURRENT_SCHEMA_VERSION) {
    // Already current — merge with defaults for forward-compat (new fields added
    // in future versions that the user hasn't saved yet). Validate nav cluster
    // fields in case storage was edited externally with invalid values.
    const merged = { ...DEFAULT_SETTINGS, ...raw } as Record<string, unknown>;
    validateNavClusterFields(merged);
    return merged as unknown as Settings;
  }

  // Run migrations sequentially from stored version up to current.
  let migrated: Record<string, unknown> = { ...raw };
  for (let v = storedVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    const migrate = migrations[v];
    if (migrate) {
      migrated = migrate(migrated);
    } else {
      // No migration registered for this version — bump version + merge defaults.
      migrated = { ...DEFAULT_SETTINGS, ...migrated, schemaVersion: v + 1 };
    }
  }

  // Persist migrated settings back to storage. Write directly via setStorage
  // (NOT via saveSettings) — saveSettings now does read-modify-write and calls
  // loadSettings, which would re-trigger migration and recurse infinitely.
  const result = migrated as unknown as StoredSettings;
  void setStorage({ [STORAGE_KEYS.SETTINGS]: result });
  return result;
}

/**
 * Save settings to chrome.storage.local with the current schema version stamped.
 *
 * Read-modify-write: merges `settings` (partial) with the currently stored
 * settings, NOT with `DEFAULT_SETTINGS`. This preserves fields the caller
 * did not include — critical for partial persists like nav cluster drag
 * (`saveSettings({ navClusterPosition })`) and offset persist
 * (`saveSettings({ subtitleOffset })`), which would otherwise wipe every
 * other field to its default. Callers passing full settings (popup,
 * background UPDATE_SETTINGS) are unaffected — full merged with full is full.
 */
export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await loadSettings();
  const toStore: StoredSettings = {
    ...current,
    ...settings,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  } as StoredSettings;
  await setStorage({ [STORAGE_KEYS.SETTINGS]: toStore });
}
