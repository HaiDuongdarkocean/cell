/**
 * UPDATE_SETTINGS patch sanitizer — per-key validation for the settings
 * merge boundary (spec: message-validation-thread REQ-4).
 *
 * A settings patch is a *subset* of `Settings`, so a strict zod object can't
 * express it without duplicating every field. Instead:
 * - `SETTINGS_PATCH_RULES` holds keys needing their own validator (element
 *   checks, nullable defaults, keys absent from DEFAULT_SETTINGS, drops)
 * - unlisted keys must exist in `DEFAULT_SETTINGS` and match the default's
 *   container kind (array / record / typeof, plus Number.isFinite)
 * - string-union keys additionally checked against `SETTINGS_ENUM_FIELDS`
 *
 * Lossy by design: unknown or mistyped keys are dropped, not errors.
 */
import { DEFAULT_SETTINGS } from '@/shared/config/config';
import type { Settings } from './types';

type PatchValidator = (value: unknown) => boolean;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const SUBTITLE_API_KEY_PROVIDERS = ['subdl', 'opensubtitles'] as const;
const SUBTITLE_API_KEY_STATUSES = ['unverified', 'active', 'rate-limited', 'invalid'] as const;

const isSubtitleApiKey = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  (SUBTITLE_API_KEY_PROVIDERS as readonly string[]).includes(value.provider as string) &&
  typeof value.key === 'string' &&
  (SUBTITLE_API_KEY_STATUSES as readonly string[]).includes(value.status as string) &&
  typeof value.addedAt === 'number';

const SETTINGS_PATCH_RULES: Partial<Record<keyof Settings, PatchValidator>> = {
  schemaVersion: () => false,
  activeProfileId: (v) => v === null || isString(v),
  subtitleApiKeys: (v) => Array.isArray(v) && v.every(isSubtitleApiKey),
  subtitlePreference: isRecord,
  subtitleOffset: isRecord,
  dictionaryPopup: isRecord,
  pronunciation: isRecord,
  frequencyBands: isRecord,
  subtitleOverlayTargetStyle: isRecord,
  subtitleOverlayNativeStyle: isRecord,
  subtitlePreviewTargetText: isString,
  subtitlePreviewNativeText: isString,
  defaultSubtitleLanguage: isString,
};

const SETTINGS_ENUM_FIELDS: Partial<Record<keyof Settings, readonly string[]>> = {
  uiLanguage: ['auto', 'en', 'vi'],
  defaultQuality: ['highest', '1080p', '720p', '480p', '360p', 'lowest', 'auto'],
  convertToMp4: ['always', 'small-only', 'never'],
  parallelConversion: ['auto', 'manual', 'off'],
  parallelFallback: ['sequential', 'retry-reduced', 'save-ts', 'fail'],
  filenameSource: ['title-fallback', 'title-only', 'url-only'],
  preferredVideoFormat: ['mp4', 'm3u8'],
};

function matchesDefault(key: keyof Settings, value: unknown): boolean {
  if (!Object.hasOwn(DEFAULT_SETTINGS, key)) return false;
  const enums = SETTINGS_ENUM_FIELDS[key];
  if (enums) return isString(value) && enums.includes(value);
  const def = DEFAULT_SETTINGS[key];
  if (def === null) return value === null;
  if (Array.isArray(def)) return Array.isArray(value);
  if (typeof def === 'object') return isRecord(value);
  if (typeof def === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === typeof def;
}

export function sanitizeSettingsPatch(patch: Record<string, unknown>): Partial<Settings> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const rule = Object.hasOwn(SETTINGS_PATCH_RULES, key)
      ? SETTINGS_PATCH_RULES[key as keyof Settings]
      : undefined;
    if (rule ? rule(value) : matchesDefault(key as keyof Settings, value)) {
      out[key] = value;
    }
  }
  return out as Partial<Settings>;
}
