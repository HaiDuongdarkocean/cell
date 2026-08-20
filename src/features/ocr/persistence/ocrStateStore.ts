// ocrStateStore — per-origin OCR preference persistence (spec §AD4).
// Reuses tokenizeSettingsStore pattern: chrome.storage.local + mergeWithDefaults.
// SSOT: no ad-hoc keys like 'ocrState:<origin>' — uses Record<origin, OcrOriginState>.

import { getStorage, setStorage } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import type {
  OcrSettings,
  OcrOriginState,
} from './ocrStateTypes';
import {
  OCR_SETTINGS_SCHEMA_VERSION,
  DEFAULT_OCR_SETTINGS,
  DEFAULT_OCR_ORIGIN_STATE,
} from './ocrStateTypes';

// Re-export types + constants for convenience.
export type { OcrSettings, OcrOriginState } from './ocrStateTypes';
export { DEFAULT_OCR_SETTINGS, DEFAULT_OCR_ORIGIN_STATE } from './ocrStateTypes';

function mergeWithDefaults(stored: unknown): OcrSettings {
  if (typeof stored !== 'object' || stored === null) {
    return { ...DEFAULT_OCR_SETTINGS };
  }
  const s = stored as Partial<OcrSettings>;
  return {
    schemaVersion: OCR_SETTINGS_SCHEMA_VERSION,
    origins: typeof s.origins === 'object' && s.origins !== null ? { ...s.origins } : {},
  };
}

/** Load OCR settings from chrome.storage.local. */
export async function loadOcrSettings(): Promise<OcrSettings> {
  const stored = await getStorage<Record<string, unknown>>(STORAGE_KEYS.OCR_SETTINGS);
  const raw = stored[STORAGE_KEYS.OCR_SETTINGS];
  return mergeWithDefaults(raw);
}

/** Persist OCR settings to chrome.storage.local. */
export async function saveOcrSettings(settings: OcrSettings): Promise<void> {
  await setStorage({ [STORAGE_KEYS.OCR_SETTINGS]: settings });
}

/** Extract origin hostname from a URL. */
export function extractOriginFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** Get OCR state for an origin. Returns undefined if not set. */
export function getOcrPreference(
  settings: OcrSettings,
  origin: string,
): OcrOriginState | undefined {
  return settings.origins[origin];
}

/** Check whether OCR is enabled for a URL (by origin). */
export function isOcrEnabledForUrl(settings: OcrSettings, url: string): boolean {
  const origin = extractOriginFromUrl(url);
  if (!origin) return false;
  return settings.origins[origin]?.ocrEnabled ?? false;
}

/** Return a new settings object with the origin OCR state set. */
export function setOcrPreference(
  settings: OcrSettings,
  origin: string,
  state: OcrOriginState,
): OcrSettings {
  return {
    ...settings,
    origins: { ...settings.origins, [origin]: state },
  };
}

/** Return a new settings object with OCR enabled for an origin (using defaults). */
export function enableOcrForOrigin(
  settings: OcrSettings,
  origin: string,
): OcrSettings {
  return setOcrPreference(settings, origin, DEFAULT_OCR_ORIGIN_STATE);
}

/** Return a new settings object with OCR disabled (removed) for an origin. */
export function clearOcrPreference(
  settings: OcrSettings,
  origin: string,
): OcrSettings {
  const { [origin]: _, ...rest } = settings.origins;
  return { ...settings, origins: rest };
}
