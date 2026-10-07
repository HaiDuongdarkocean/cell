import { t } from '@/shared/i18n';
import { toIso6391, baseLangCode, isoCodeToLabel } from '@/shared/config/languageRegistry';
import { DEFAULT_DICTIONARY_POPUP_SETTINGS, DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE } from '@/shared/config/config';
import type { LanguageProfile, ResolvedProfile, Settings, DictionaryPopupSettings, TtsSettings } from '../types';

export { ResolvedProfile };

export function profileIdForTarget(languageValue: string): `profile-${string}` {
  return `profile-${toIso6391(baseLangCode(languageValue))}`;
}

export function buildProfileName(
  profileNative: string,
  universalNative: string,
  target: string,
  existingNames: string[],
): string {
  const native = profileNative || universalNative;
  const nativeLabel = (isoCodeToLabel(native) ?? native) || t('ui.language.none');
  const targetLabel = isoCodeToLabel(target) ?? target;
  const normalize = (s: string) => s.trim().toLowerCase();
  const existing = new Set(existingNames.map(normalize));
  let candidate = `${nativeLabel} → ${targetLabel}`;
  let suffix = 2;
  while (existing.has(normalize(candidate))) {
    candidate = `${nativeLabel} → ${targetLabel} (${suffix})`;
    suffix += 1;
  }
  return candidate;
}

export function resolveProfile(profile: LanguageProfile, universalNativeLanguage: string): ResolvedProfile {
  const resolvedNative = profile.native || universalNativeLanguage;
  return {
    ...profile,
    native: resolvedNative,
    resourceLangCode: toIso6391(profile.target.split('-')[0] ?? profile.target),
  };
}

export function getActiveProfileSettings(
  settings: Pick<Settings, 'universalNativeLanguage' | 'languageProfiles' | 'activeProfileId'>,
): ResolvedProfile | null {
  if (!settings.activeProfileId || !settings.languageProfiles?.length) return null;
  const profile = settings.languageProfiles.find((p) => p.id === settings.activeProfileId);
  if (!profile) return null;
  return resolveProfile(profile, settings.universalNativeLanguage);
}

type ProfileShape = { target: string; native: string };

export function validateLanguageProfile(
  draft: ProfileShape,
  existing: readonly LanguageProfile[],
  editingId?: string | null,
): { valid: boolean; emptyTarget: boolean; duplicate: boolean; messages: string[] } {
  const messages: string[] = [];
  if (!draft.target) {
    messages.push(t('settings.profiles.error.required'));
    return { valid: false, emptyTarget: true, duplicate: false, messages };
  }
  const targetBase = toIso6391(baseLangCode(draft.target));
  const isDuplicate = existing.some(
    (p) => p.id !== (editingId ?? undefined) && toIso6391(baseLangCode(p.target)) === targetBase,
  );
  if (isDuplicate) {
    messages.push(t('settings.profiles.error.duplicate'));
    return { valid: false, emptyTarget: false, duplicate: true, messages };
  }
  return { valid: true, emptyTarget: false, duplicate: false, messages };
}

const FLAT_FIELD_KEYS: (keyof ResolvedProfile & keyof Settings)[] = [
  'subtitleOverlayAutoLoad',
  'subtitleOverlayAutoLoadAsr',
  'subtitleOverlayAutoTranslate',
  'subtitleOverlayTargetStyle',
  'subtitleOverlayNativeStyle',
  'dictionaryPopup',
  'showReadings',
];

/** Fill in missing TTS fields from defaults so incomplete persisted slices don't crash the UI. */
function mergeTtsWithDefaults(activeTts: TtsSettings | undefined, defaultTts: TtsSettings): TtsSettings {
  const merged: Record<string, unknown> = { ...(defaultTts as unknown as Record<string, unknown>) };
  if (activeTts) {
    for (const key of Object.keys(defaultTts)) {
      const value = (activeTts as unknown as Record<string, unknown>)[key];
      if (value !== undefined) {
        merged[key] = value;
      }
    }
  }
  return merged as unknown as TtsSettings;
}

/** Merge active profile's dictionaryPopup with defaults, especially the nested tts slice. */
function mergeDictionaryPopupWithDefaults(
  active: DictionaryPopupSettings | undefined,
  defaults: DictionaryPopupSettings,
): DictionaryPopupSettings {
  const merged: Record<string, unknown> = { ...(defaults as unknown as Record<string, unknown>) };
  if (active) {
    for (const key of Object.keys(defaults)) {
      const value = (active as unknown as Record<string, unknown>)[key];
      if (value !== undefined) {
        merged[key] = value;
      }
    }
    const activeTts = (active as unknown as Record<string, unknown>).tts;
    if (activeTts !== undefined) {
      const defaultTts = (defaults as unknown as Record<string, unknown>).tts as TtsSettings;
      merged.tts = mergeTtsWithDefaults(activeTts as TtsSettings, defaultTts);
    }
  }
  return merged as unknown as DictionaryPopupSettings;
}

/** Copy the resolved flat fields from the top-level settings back into the active language profile.
 * This keeps the active profile in sync with global settings edits before they are persisted. */
export function syncFlatFieldsToActiveProfile(settings: Settings): Settings {
  if (!settings.activeProfileId || !settings.languageProfiles?.length) return settings;
  const profileIndex = settings.languageProfiles.findIndex((p) => p.id === settings.activeProfileId);
  if (profileIndex === -1) return settings;

  const profile = settings.languageProfiles[profileIndex];
  const updated: LanguageProfile = {
    ...profile,
    subtitleOverlayAutoLoad: settings.subtitleOverlayAutoLoad,
    subtitleOverlayAutoLoadAsr: settings.subtitleOverlayAutoLoadAsr,
    subtitleOverlayAutoTranslate: settings.subtitleOverlayAutoTranslate,
    subtitleOverlayTargetStyle: settings.subtitleOverlayTargetStyle ?? DEFAULT_OVERLAY_STYLE_TARGET,
    subtitleOverlayNativeStyle: settings.subtitleOverlayNativeStyle ?? DEFAULT_OVERLAY_STYLE_NATIVE,
    dictionaryPopup: settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS,
    showReadings: settings.showReadings,
  };

  return {
    ...settings,
    languageProfiles: settings.languageProfiles.map((p, i) => (i === profileIndex ? updated : p)),
  };
}

export function resolveSettingsFlatFields(settings: Record<string, unknown>): Record<string, unknown> {
  const typed = settings as unknown as Settings;
  const active = getActiveProfileSettings(typed);
  if (active) {
    FLAT_FIELD_KEYS.forEach((key) => {
      if (key in active) {
        if (key === 'dictionaryPopup') {
          settings[key as string] = mergeDictionaryPopupWithDefaults(
            active.dictionaryPopup,
            DEFAULT_DICTIONARY_POPUP_SETTINGS,
          ) as unknown;
        } else {
          settings[key as string] = active[key] as unknown;
        }
      }
    });
    settings.subtitleOverlayTargetLanguage = active.target;
    settings.subtitleOverlayNativeLanguage = active.native;
  }
  return settings;
}
