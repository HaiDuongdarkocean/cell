/**
 * Minimal in-browser chrome.* shim for the design-system showcase.
 *
 * Production code uses chrome.storage for settings and study modes.
 * In the Vite dev server there is no extension runtime, so this mock lets
 * SettingsTab, StudyModesTab, and other storage-backed surfaces load seeded
 * data and persist changes in-memory without errors.
 */

import { STORAGE_KEYS } from '@/shared/config/config';
import { getMockSettings, getMockStudyModeState } from './showcaseFixtures';
import { SHOWCASE_DATA } from './showcaseParams';

interface MockStorageArea {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

interface MockOnChanged {
  addListener(callback: (changes: Record<string, { newValue: unknown }>, area: string) => void): void;
  removeListener(callback: (changes: Record<string, { newValue: unknown }>, area: string) => void): void;
}

// Seed themeMode from ?mode= so the Theme section matches the showcase URL;
// otherwise themeStore falls back to its 'dark' default and desyncs.
const modeParam = typeof window === 'undefined'
  ? null
  : new URLSearchParams(window.location.search).get('mode');

const inMemoryStorage: Record<string, unknown> = {
  [STORAGE_KEYS.SETTINGS]: getMockSettings(SHOWCASE_DATA),
  [STORAGE_KEYS.STUDY_MODES]: getMockStudyModeState(SHOWCASE_DATA),
  ...(modeParam === 'light' || modeParam === 'dark' || modeParam === 'system'
    ? { [STORAGE_KEYS.THEME_MODE]: modeParam }
    : {}),
};

const onChangedListeners: ((changes: Record<string, { newValue: unknown }>, area: string) => void)[] = [];

function filterKeys(items: Record<string, unknown>, keys?: string | string[] | null): Record<string, unknown> {
  if (keys == null) return { ...items };
  const keyList = Array.isArray(keys) ? keys : [keys];
  const result: Record<string, unknown> = {};
  for (const key of keyList) {
    if (key in items) {
      result[key] = items[key];
    }
  }
  return result;
}

function notifyOnChanged(changes: Record<string, { newValue: unknown }>): void {
  for (const listener of onChangedListeners) {
    try {
      listener(changes, 'local');
    } catch {
      /* listeners are best-effort in showcase */
    }
  }
}

const mockStorage: MockStorageArea = {
  async get(keys) {
    return filterKeys(inMemoryStorage, keys);
  },
  async set(items) {
    const changes: Record<string, { newValue: unknown }> = {};
    for (const [key, value] of Object.entries(items)) {
      inMemoryStorage[key] = value;
      changes[key] = { newValue: value };
    }
    notifyOnChanged(changes);
  },
  async remove(keys) {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const key of keyList) {
      delete inMemoryStorage[key];
    }
  },
};

const mockOnChanged: MockOnChanged = {
  addListener(callback) {
    onChangedListeners.push(callback);
  },
  removeListener(callback) {
    const index = onChangedListeners.indexOf(callback);
    if (index >= 0) onChangedListeners.splice(index, 1);
  },
};

const mockRuntime = {
  id: 'cell-design-system-showcase',
  getURL(path: string): string {
    return `chrome-extension://cell-design-system-showcase/${path.replace(/^\//, '')}`;
  },
};

/** Install the chrome.* shim. Safe to call more than once. */
export function installMockChrome(): void {
  const existingChrome = (globalThis as unknown as { chrome?: typeof chrome }).chrome ?? {};

  (globalThis as unknown as { chrome: typeof chrome }).chrome = {
    ...existingChrome,
    storage: {
      local: mockStorage as unknown as chrome.storage.LocalStorageArea,
      onChanged: mockOnChanged as unknown as typeof chrome.storage.onChanged,
      session: {
        get: async () => ({}),
        set: async () => { /* no-op */ },
        remove: async () => { /* no-op */ },
      } as unknown as chrome.storage.SessionStorageArea,
    },
    runtime: mockRuntime as unknown as typeof chrome.runtime,
    i18n: {
      getMessage: (messageName: string) => messageName,
    } as unknown as typeof chrome.i18n,
  } as unknown as typeof chrome;
}
