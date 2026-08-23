import { buildProfileName, getActiveProfileSettings, resolveProfile, resolveSettingsFlatFields, validateLanguageProfile } from './profileResolution';
import type { LanguageProfile, Settings } from '../types';

const mockProfile = (overrides: Partial<LanguageProfile> = {}): LanguageProfile => ({
  id: 'p1',
  target: 'en',
  native: '',
  name: 'test profile',
  order: 1,
  subtitleOverlayTargetStyle: { visible: true, fontSize: 24, fontWeight: 600, textColor: '#ffffff', backgroundColor: '#000000', textOpacity: 1, backgroundOpacity: 0.85, horizontalAlign: 'center', textShadow: { preset: 'soft', color: '#000000', offsetX: 0, offsetY: 1, blur: 2 }, fontFamily: 'var(--font-family, sans-serif)' },
  subtitleOverlayNativeStyle: { visible: true, fontSize: 20, fontWeight: 600, textColor: '#ffffff', backgroundColor: '#000000', textOpacity: 0.85, backgroundOpacity: 0.7, horizontalAlign: 'center', textShadow: { preset: 'soft', color: '#000000', offsetX: 0, offsetY: 1, blur: 2 }, fontFamily: 'var(--font-family, sans-serif)' },
  subtitleOverlayAutoLoad: true,
  subtitleOverlayAutoLoadAsr: false,
  subtitleOverlayAutoTranslate: true,
  dictionaryPopup: { enabled: true, triggerMode: 'click', defaultActiveTab: null, popupWidthPx: 560, popupMaxHeightPx: 480, popupSheetHeightVh: 75, tts: { enabled: true, savedVoices: [], voices: [], maxDisplay: 3, autoplayCount: 0, preferredAccent: 'US', localTtsEnabled: false, localTtsLanguage: 'en', downloadedLanguages: [] }, externalDictLinks: [], srsDestination: 'anki', badgePointerTrigger: { position: 'center', size: 36, pointerScale: 0.25 } },
  resourceIds: [1, 2],
  ...overrides,
});

describe('buildProfileName', () => {
  it('generates "Native → Target" from ISO codes', () => {
    expect(buildProfileName('', 'vi', 'en', [])).toMatch(/vietnamese\s*→\s*english/i);
  });

  it('adds a suffix when name already exists', () => {
    const existing = ['Vietnamese → English'];
    const result = buildProfileName('', 'vi', 'en', existing);
    expect(result).toMatch(/Vietnamese → English \(2\)/i);
  });
});

describe('resolveProfile', () => {
  it('falls back to universal native when profile native is empty', () => {
    const resolved = resolveProfile(mockProfile(), 'vi');
    expect(resolved.native).toBe('vi');
    expect(resolved.resourceLangCode).toBe('en');
  });

  it('uses profile native override', () => {
    const resolved = resolveProfile(mockProfile({ native: 'ja' }), 'vi');
    expect(resolved.native).toBe('ja');
  });

  it('resolves BCP-47 variant to ISO 639-1 base', () => {
    const resolved = resolveProfile(mockProfile({ target: 'zh-hans' }), 'vi');
    expect(resolved.resourceLangCode).toBe('zh');
  });
});

describe('getActiveProfileSettings', () => {
  it('returns null when no active profile id', () => {
    const settings: Pick<Settings, 'universalNativeLanguage' | 'languageProfiles' | 'activeProfileId'> = {
      universalNativeLanguage: 'vi',
      languageProfiles: [mockProfile()],
      activeProfileId: null,
    };
    expect(getActiveProfileSettings(settings)).toBeNull();
  });

  it('resolves the active profile', () => {
    const settings: Pick<Settings, 'universalNativeLanguage' | 'languageProfiles' | 'activeProfileId'> = {
      universalNativeLanguage: 'vi',
      languageProfiles: [mockProfile({ id: 'p1' })],
      activeProfileId: 'p1',
    };
    const active = getActiveProfileSettings(settings);
    expect(active).not.toBeNull();
    expect(active?.id).toBe('p1');
    expect(active?.native).toBe('vi');
  });
});

describe('resolveSettingsFlatFields', () => {
  it('overwrites flat fields from the active resolved profile', () => {
    const settings = {
      universalNativeLanguage: 'vi',
      languageProfiles: [mockProfile({ id: 'p1' })],
      activeProfileId: 'p1',
      subtitleOverlayTargetLanguage: 'xx',
    };
    const resolved = resolveSettingsFlatFields(settings as unknown as Record<string, unknown>);
    expect(resolved.subtitleOverlayTargetLanguage).toBe('en');
    expect(resolved.subtitleOverlayNativeLanguage).toBe('vi');
    expect(resolved.subtitleOverlayAutoLoad).toBe(true);
  });
});

describe('validateLanguageProfile', () => {
  it('blocks empty target', () => {
    const result = validateLanguageProfile({ target: '', native: '' }, 'vi', []);
    expect(result.valid).toBe(false);
    expect(result.emptyTarget).toBe(true);
  });

  it('blocks duplicate (target, native) pair', () => {
    const existing = [mockProfile({ id: 'p1', target: 'en', native: '' })];
    const result = validateLanguageProfile({ target: 'en', native: '' }, 'vi', existing);
    expect(result.valid).toBe(false);
    expect(result.duplicate).toBe(true);
  });

  it('allows editing existing profile', () => {
    const existing = [mockProfile({ id: 'p1', target: 'en', native: '' })];
    const result = validateLanguageProfile({ target: 'en', native: 'ja' }, 'vi', existing, 'p1');
    expect(result.valid).toBe(true);
  });
});
