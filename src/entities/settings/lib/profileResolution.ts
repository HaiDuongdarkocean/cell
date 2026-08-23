import { toIso6391, isoCodeToLabel } from '@/shared/config/languageRegistry';
import type { LanguageProfile, ResolvedProfile, Settings } from '../types';

export { ResolvedProfile };

export function generateProfileId(): string {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  return `${Date.now()}-${random}`;
}

export function buildProfileName(
  profileNative: string,
  universalNative: string,
  target: string,
  existingNames: string[],
): string {
  const native = profileNative || universalNative;
  const nativeLabel = (isoCodeToLabel(native) ?? native) || 'None';
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
  universalNativeLanguage: string,
  existing: readonly LanguageProfile[],
  editingId?: string | null,
): { valid: boolean; emptyTarget: boolean; duplicate: boolean; messages: string[] } {
  const messages: string[] = [];
  if (!draft.target) {
    messages.push('Please select a target language.');
    return { valid: false, emptyTarget: true, duplicate: false, messages };
  }
  const resolvedNative = draft.native || universalNativeLanguage;
  const targetBase = toIso6391(draft.target.split('-')[0] ?? draft.target);
  const nativeBase = toIso6391(resolvedNative.split('-')[0] ?? resolvedNative);
  const isDuplicate = existing.some(
    (p) =>
      p.id !== (editingId ?? undefined) &&
      toIso6391(p.target.split('-')[0] ?? p.target) === targetBase &&
      toIso6391((p.native || universalNativeLanguage).split('-')[0] ?? (p.native || universalNativeLanguage)) === nativeBase,
  );
  if (isDuplicate) {
    messages.push('A profile with the same target and native language already exists.');
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
];

export function resolveSettingsFlatFields(settings: Record<string, unknown>): Record<string, unknown> {
  const typed = settings as unknown as Settings;
  const active = getActiveProfileSettings(typed);
  if (active) {
    FLAT_FIELD_KEYS.forEach((key) => {
      if (key in active) {
        settings[key as string] = active[key] as unknown;
      }
    });
    settings.subtitleOverlayTargetLanguage = active.target;
    settings.subtitleOverlayNativeLanguage = active.native;
  }
  return settings;
}
