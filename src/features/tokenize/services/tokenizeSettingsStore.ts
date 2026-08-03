import { getStorage, setStorage } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import type { TokenizeSettings } from '@/features/tokenize/types';

export const TOKENIZE_SETTINGS_SCHEMA_VERSION = 1;

export const DEFAULT_TOKENIZE_SETTINGS: TokenizeSettings = {
  schemaVersion: TOKENIZE_SETTINGS_SCHEMA_VERSION,
  origins: {},
  urls: {},
  subtitleUrls: {},
};

function mergeWithDefaults(stored: unknown): TokenizeSettings {
  if (typeof stored !== 'object' || stored === null) {
    return { ...DEFAULT_TOKENIZE_SETTINGS };
  }
  const s = stored as Partial<TokenizeSettings>;
  return {
    schemaVersion: TOKENIZE_SETTINGS_SCHEMA_VERSION,
    origins: typeof s.origins === 'object' && s.origins !== null ? { ...s.origins } : {},
    urls: typeof s.urls === 'object' && s.urls !== null ? { ...s.urls } : {},
    subtitleUrls: typeof s.subtitleUrls === 'object' && s.subtitleUrls !== null ? { ...s.subtitleUrls } : {},
  };
}

/** Load tokenize settings from chrome.storage.local. */
export async function loadTokenizeSettings(): Promise<TokenizeSettings> {
  const stored = await getStorage<Record<string, unknown>>(STORAGE_KEYS.TOKENIZE_SETTINGS);
  const raw = stored[STORAGE_KEYS.TOKENIZE_SETTINGS];
  return mergeWithDefaults(raw);
}

/** Persist tokenize settings to chrome.storage.local. */
export async function saveTokenizeSettings(settings: TokenizeSettings): Promise<void> {
  await setStorage({ [STORAGE_KEYS.TOKENIZE_SETTINGS]: settings });
}

/** Check whether tokenize is enabled for a URL. Exact URL wins over origin. */
export function isTokenizeEnabledForUrl(settings: TokenizeSettings, url: string): boolean {
  try {
    const { origin, href } = new URL(url);
    if (settings.urls[href] !== undefined) return settings.urls[href];
    if (settings.origins[origin] !== undefined) return settings.origins[origin];
    return false;
  } catch {
    return false;
  }
}

/** Return a new settings object with the URL enable state set. */
export function setTokenizeEnabledForUrl(
  settings: TokenizeSettings,
  url: string,
  enabled: boolean,
): TokenizeSettings {
  const { href } = new URL(url);
  return {
    ...settings,
    urls: { ...settings.urls, [href]: enabled },
  };
}

/** Return a new settings object with the origin enable state set. */
export function setTokenizeEnabledForOrigin(
  settings: TokenizeSettings,
  origin: string,
  enabled: boolean,
): TokenizeSettings {
  return {
    ...settings,
    origins: { ...settings.origins, [origin]: enabled },
  };
}

/** Check whether subtitle tokenize is enabled for a URL. */
export function isSubtitleTokenizeEnabledForUrl(settings: TokenizeSettings, url: string): boolean {
  try {
    const { href } = new URL(url);
    if (settings.subtitleUrls[href] !== undefined) return settings.subtitleUrls[href];
    return false;
  } catch {
    return false;
  }
}

/** Return a new settings object with the subtitle URL enable state set. */
export function setSubtitleTokenizeEnabledForUrl(
  settings: TokenizeSettings,
  url: string,
  enabled: boolean,
): TokenizeSettings {
  const { href } = new URL(url);
  return {
    ...settings,
    subtitleUrls: { ...settings.subtitleUrls, [href]: enabled },
  };
}
