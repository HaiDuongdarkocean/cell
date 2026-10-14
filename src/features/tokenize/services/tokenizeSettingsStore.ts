import { getStorage, setStorage } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import type { TokenizeSettings } from '@/features/tokenize/types';

export const TOKENIZE_SETTINGS_SCHEMA_VERSION = 1;

export const DEFAULT_TOKENIZE_SETTINGS: TokenizeSettings = {
  schemaVersion: TOKENIZE_SETTINGS_SCHEMA_VERSION,
  origins: {},
  urls: {},
  subtitleOrigins: {},
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
    subtitleOrigins: typeof s.subtitleOrigins === 'object' && s.subtitleOrigins !== null ? { ...s.subtitleOrigins } : {},
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

function canonicalPageKey(url: string): string {
  const u = new URL(url);
  const videoId = u.searchParams.get('v');
  return `${u.origin}${u.pathname}${videoId ? `?v=${videoId}` : ''}`;
}

/** Check whether tokenize is enabled for a URL. Exact URL wins over origin. */
export function isTokenizeEnabledForUrl(settings: TokenizeSettings, url: string): boolean {
  try {
    const { origin, href } = new URL(url);
    const key = canonicalPageKey(url);
    if (settings.urls[key] !== undefined) return settings.urls[key];
    if (settings.urls[href] !== undefined) return settings.urls[href];
    if (settings.origins[origin] !== undefined) return settings.origins[origin];
    return false;
  } catch {
    return false;
  }
}

/** Return a new settings object with the URL enable state set. Also records
 *  the value at origin level so sibling pages on the same site inherit it. */
export function setTokenizeEnabledForUrl(
  settings: TokenizeSettings,
  url: string,
  enabled: boolean,
): TokenizeSettings {
  const { origin } = new URL(url);
  return {
    ...settings,
    origins: { ...settings.origins, [origin]: enabled },
    urls: { ...settings.urls, [canonicalPageKey(url)]: enabled },
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
    const { origin, href } = new URL(url);
    const key = canonicalPageKey(url);
    if (settings.subtitleUrls[key] !== undefined) return settings.subtitleUrls[key];
    if (settings.subtitleUrls[href] !== undefined) return settings.subtitleUrls[href];
    if (settings.subtitleOrigins[origin] !== undefined) return settings.subtitleOrigins[origin];
    return false;
  } catch {
    return false;
  }
}

/** Check whether subtitle tokenize is enabled for an origin — embed child
 *  frames read the top page's toggle context, which is only known at origin
 *  level (page-specific subtitleUrls entries for other top pages must not
 *  leak through). */
export function isSubtitleTokenizeEnabledForOrigin(settings: TokenizeSettings, origin: string): boolean {
  return settings.subtitleOrigins[origin] ?? false;
}

/** Return a new settings object with the subtitle URL enable state set. Also
 *  records the value at origin level so sibling pages on the same site inherit it. */
export function setSubtitleTokenizeEnabledForUrl(
  settings: TokenizeSettings,
  url: string,
  enabled: boolean,
): TokenizeSettings {
  const { origin } = new URL(url);
  return {
    ...settings,
    subtitleOrigins: { ...settings.subtitleOrigins, [origin]: enabled },
    subtitleUrls: { ...settings.subtitleUrls, [canonicalPageKey(url)]: enabled },
  };
}
