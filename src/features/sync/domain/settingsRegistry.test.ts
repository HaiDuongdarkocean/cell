import { flatten, isMaterializablePath } from './flatten';
import {
  AUTO_DOWNLOAD_WHITELIST_FIELD_REGISTRY,
  OCR_SETTINGS_FIELD_REGISTRY,
  PROFILE_FIELD_REGISTRY,
  SETTINGS_FIELD_REGISTRY,
  STUDY_MODES_FIELD_REGISTRY,
  SYNCED_KV_REGISTRIES,
  THEME_CONFIG_FIELD_REGISTRY,
  THEME_MODE_FIELD_REGISTRY,
  TOKENIZE_SETTINGS_FIELD_REGISTRY,
} from './settingsRegistry';

const leafPaths = (value: unknown, registry: Parameters<typeof flatten>[1]) =>
  flatten(value, registry).map((leaf) => leaf.path);

describe('settings registry — device-local fields never produce records (SC-20)', () => {
  const settings = {
    schemaVersion: 32,
    uiLanguage: 'en',
    universalNativeLanguage: 'vi',
    languageProfiles: [{ id: 'profile-en', target: 'en' }],
    activeProfileId: 'profile-en',
    concurrentDownloads: 3,
    subtitleOverlayTargetLanguage: 'en',
    subtitleOverlayNativeLanguage: 'vi',
    subtitleOverlayAutoLoad: true,
    subtitleOverlayAutoLoadAsr: false,
    subtitleOverlayAutoTranslate: true,
    subtitleOverlayTargetStyle: { fontSize: 24 },
    subtitleOverlayNativeStyle: { fontSize: 20 },
    dictionaryPopup: { enabled: true, triggerMode: 'click' },
    localPlayerSettings: {
      subtitleMatchEnabled: true,
      resumePromptEnabled: false,
      lastDirectoryId: 'dir-9',
    },
    pronunciation: {
      fallbackEngines: ['native', 'browserTts'],
      downloadEspeakTtsData: true,
      localFile: { packageType: 'single', dslFileHandleId: 'h1', lastIndexedAt: 1 },
    },
    srs: {
      defaultStudyConfigId: 'cfg-1',
      activeCollectionId: 'col-1',
      activeDeckId: 'deck-1',
      activeNotetypeId: 'nt-1',
      activeLanguageProfileId: 'profile-en',
      dataLifecycle: { reviewEventMaxAgeDays: 30 },
    },
    subtitleApiKeys: [
      {
        id: 'k1',
        provider: 'subdl',
        key: 'secret',
        status: 'active',
        rateLimitedUntil: 12345,
        addedAt: 7,
      },
    ],
    keyboardShortcuts: [{ action: 'play-pause', key: ' ' }],
    subtitlePreference: { 'https://a.com/x': { en: 1 } },
    cardCreator: {
      ankiConnectUrl: 'http://localhost:8765',
      fieldMappings: { 'Cell Video Card': { targetWord: 'Front' } },
    },
    frequencyBands: { core: 500 },
  };

  it('emits none of the device-local paths', () => {
    const paths = leafPaths(settings, SETTINGS_FIELD_REGISTRY);
    const forbidden = [
      'schemaVersion',
      'activeProfileId',
      'languageProfiles',
      'dictionaryPopup',
      'subtitleOverlayTargetLanguage',
      'subtitleOverlayNativeLanguage',
      'subtitleOverlayAutoLoad',
      'subtitleOverlayAutoLoadAsr',
      'subtitleOverlayAutoTranslate',
      'subtitleOverlayTargetStyle',
      'subtitleOverlayNativeStyle',
      'localPlayerSettings/lastDirectoryId',
      'pronunciation/downloadEspeakTtsData',
      'srs/activeCollectionId',
      'srs/activeDeckId',
      'srs/activeNotetypeId',
      'srs/activeLanguageProfileId',
    ];
    for (const banned of forbidden) {
      expect(paths.some((p) => p === banned || p.startsWith(`${banned}/`))).toBe(false);
    }
    expect(paths.some((p) => p.startsWith('pronunciation/localFile'))).toBe(false);
  });

  it('emits synced leaf paths incl. per-inner-key maps', () => {
    const paths = leafPaths(settings, SETTINGS_FIELD_REGISTRY);
    expect(paths).toEqual(
      expect.arrayContaining([
        'uiLanguage',
        'universalNativeLanguage',
        'concurrentDownloads',
        'frequencyBands/core',
        'subtitlePreference/https:~1~1a.com~1x/en',
        'cardCreator/ankiConnectUrl',
        'cardCreator/fieldMappings/Cell Video Card/targetWord',
        'localPlayerSettings/subtitleMatchEnabled',
        'pronunciation/fallbackEngines',
        'srs/defaultStudyConfigId',
        'srs/dataLifecycle/reviewEventMaxAgeDays',
        'keyboardShortcuts/@play-pause',
        'subtitleApiKeys/@k1',
      ]),
    );
  });

  it('strips runtime status fields from subtitleApiKeys elements', () => {
    const leaf = flatten(settings, SETTINGS_FIELD_REGISTRY).find(
      (l) => l.path === 'subtitleApiKeys/@k1',
    );
    expect(leaf?.value).toEqual({
      id: 'k1',
      provider: 'subdl',
      key: 'secret',
      addedAt: 7,
    });
  });
});

describe('profile registry', () => {
  const profile = {
    id: 'profile-en',
    target: 'en',
    native: '',
    name: 'English',
    order: 1,
    subtitleOverlayAutoLoad: false,
    dictionaryPopup: {
      enabled: true,
      externalDictLinks: [{ id: 'l1', name: 'Wiktionary', urlTemplate: 'https://x/{term}' }],
      tts: {
        enabled: true,
        savedVoices: [{ voiceName: 'v', lang: 'en', order: 1 }],
        voices: ['v'],
        downloadedLanguages: ['en'],
        hiddenLanguages: ['vi'],
        localTtsEnabled: true,
        localTtsLanguage: 'en',
        maxDisplay: 3,
      },
    },
  };

  it('syncs real profile fields but never tts device-local fields', () => {
    const paths = leafPaths(profile, PROFILE_FIELD_REGISTRY);
    expect(paths).toEqual(
      expect.arrayContaining([
        'id',
        'target',
        'name',
        'order',
        'subtitleOverlayAutoLoad',
        'dictionaryPopup/enabled',
        'dictionaryPopup/externalDictLinks/@l1',
        'dictionaryPopup/tts/enabled',
        'dictionaryPopup/tts/maxDisplay',
      ]),
    );
    const ttsLocal = [
      'dictionaryPopup/tts/savedVoices',
      'dictionaryPopup/tts/voices',
      'dictionaryPopup/tts/downloadedLanguages',
      'dictionaryPopup/tts/hiddenLanguages',
      'dictionaryPopup/tts/localTtsEnabled',
      'dictionaryPopup/tts/localTtsLanguage',
    ];
    for (const banned of ttsLocal) {
      expect(paths.some((p) => p === banned || p.startsWith(`${banned}/`))).toBe(false);
    }
  });
});

describe('secondary key registries', () => {
  it('studyModes: version/activeModeId local, custom modes and cleanup rules per-element', () => {
    const value = {
      version: 3,
      activeModeId: 'm1',
      customModes: [{ id: 'm9', type: 'custom', steps: [] }],
      advanced: {
        skipNoDialogue: 'OFF',
        cleanupRules: {
          builtinEnabled: { 'rule-1': true },
          custom: [{ id: 'cr1', pattern: 'x', enabled: true, builtin: false, name: 'n', description: 'd' }],
        },
      },
    };
    const paths = leafPaths(value, STUDY_MODES_FIELD_REGISTRY);
    expect(paths).not.toContain('version');
    expect(paths).not.toContain('activeModeId');
    expect(paths).toEqual(
      expect.arrayContaining([
        'customModes/@m9',
        'advanced/cleanupRules/custom/@cr1',
        'advanced/cleanupRules/builtinEnabled/rule-1',
        'advanced/skipNoDialogue',
      ]),
    );
  });

  it('auto_download_whitelist: per-element by normalized url, tabId stripped', () => {
    const leaves = flatten(
      [{ url: 'https://a.com/show', addedAt: 5, tabId: 9 }],
      AUTO_DOWNLOAD_WHITELIST_FIELD_REGISTRY,
    );
    expect(leaves).toEqual([
      { path: '@https:~1~1a.com~1show', value: { url: 'https://a.com/show', addedAt: 5 } },
    ]);
  });

  it('tokenizeSettings: schemaVersion local, origin maps merge per inner key', () => {
    const paths = leafPaths(
      {
        schemaVersion: 1,
        origins: { 'https://a.com': true },
        urls: { 'https://a.com/x?v=1': false },
        subtitleOrigins: {},
        subtitleUrls: {},
      },
      TOKENIZE_SETTINGS_FIELD_REGISTRY,
    );
    expect(paths).toEqual([
      'origins/https:~1~1a.com',
      'urls/https:~1~1a.com~1x?v=1',
    ]);
  });

  it('ocrSettings: schemaVersion local, origins merge per inner key', () => {
    const paths = leafPaths(
      {
        schemaVersion: 1,
        origins: { 'https://a.com': { ocrEnabled: true, splitRatio: 0.5 } },
      },
      OCR_SETTINGS_FIELD_REGISTRY,
    );
    expect(paths).toEqual([
      'origins/https:~1~1a.com/ocrEnabled',
      'origins/https:~1~1a.com/splitRatio',
    ]);
  });

  it('themeMode/themeConfig flatten trivially', () => {
    expect(flatten('dark', THEME_MODE_FIELD_REGISTRY)).toEqual([
      { path: '', value: 'dark' },
    ]);
    expect(
      leafPaths({ preset: 'ocean', customColors: { light: { primary: '#fff' } } }, THEME_CONFIG_FIELD_REGISTRY),
    ).toEqual(['customColors/light/primary', 'preset']);
  });
});

describe('registry wiring', () => {
  it('provides a registry for every synced storage key', () => {
    expect(Object.keys(SYNCED_KV_REGISTRIES).sort()).toEqual([
      'auto_download_whitelist',
      'ocrSettings',
      'settings',
      'studyModes',
      'themeConfig',
      'themeMode',
      'tokenizeSettings',
    ]);
  });

  it('marks device-local and unknown paths as not materializable', () => {
    expect(isMaterializablePath('activeProfileId', SETTINGS_FIELD_REGISTRY)).toBe(false);
    expect(isMaterializablePath('srs/activeDeckId', SETTINGS_FIELD_REGISTRY)).toBe(false);
    expect(isMaterializablePath('pronunciation/localFile/x', SETTINGS_FIELD_REGISTRY)).toBe(false);
    expect(isMaterializablePath('brandNewField', SETTINGS_FIELD_REGISTRY)).toBe(false);
    expect(isMaterializablePath('uiLanguage', SETTINGS_FIELD_REGISTRY)).toBe(true);
    expect(isMaterializablePath('subtitleApiKeys/@k1', SETTINGS_FIELD_REGISTRY)).toBe(true);
    expect(isMaterializablePath('version', STUDY_MODES_FIELD_REGISTRY)).toBe(false);
    expect(isMaterializablePath('', AUTO_DOWNLOAD_WHITELIST_FIELD_REGISTRY)).toBe(true);
  });
});
