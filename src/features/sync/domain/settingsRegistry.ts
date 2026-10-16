import { STORAGE_KEYS } from '@/shared/config/config';
import { isPlainJsonObject } from './flatten';
import type { ElementArrayRule, FieldRegistry, PathPattern } from './flatten';

const ALL_PATHS: readonly PathPattern[] = [[]];

const ACTIVE_PROFILE_MIRROR_EXCLUSIONS: readonly PathPattern[] = [
  ['subtitleOverlayTargetLanguage'],
  ['subtitleOverlayNativeLanguage'],
  ['subtitleOverlayAutoLoad'],
  ['subtitleOverlayAutoLoadAsr'],
  ['subtitleOverlayAutoTranslate'],
  ['subtitleOverlayTargetStyle'],
  ['subtitleOverlayNativeStyle'],
  ['dictionaryPopup'],
  ['readingDisplay'],
  ['glossDisplay'],
];

const TTS_LOCAL_EXCLUSIONS: readonly PathPattern[] = [
  ['*', 'tts', 'savedVoices'],
  ['*', 'tts', 'hiddenLanguages'],
  ['*', 'tts', 'localTtsEnabled'],
  ['*', 'tts', 'localTtsLanguage'],
  ['*', 'tts', 'voices'],
  ['*', 'tts', 'downloadedLanguages'],
  ['*', 'tts', 'supertonicVoices'],
  ['*', 'tts', 'supertonicDownloadedVoices'],
];

const DICT_LINKS_ELEMENT_ARRAY: ElementArrayRule = {
  path: ['*', 'dictionaryPopup', 'externalDictLinks'],
  elementId: stringFieldElementId('id'),
};

export const SETTINGS_FIELD_REGISTRY: FieldRegistry = {
  syncedPaths: [
    ['uiLanguage'],
    ['universalNativeLanguage'],
    ['concurrentDownloads'],
    ['defaultQuality'],
    ['selectedSubtitleLanguages'],
    ['convertToMp4'],
    ['parallelConversion'],
    ['manualWorkerCount'],
    ['parallelFallback'],
    ['segmentConcurrency'],
    ['filenameSource'],
    ['preferredVideoFormat'],
    ['autoSelectEnabled'],
    ['subtitlePreviewTargetText'],
    ['subtitlePreviewNativeText'],
    ['subtitlePreference'],
    ['subtitleOffset'],
    ['keyboardShortcuts'],
    ['navClusterEnabled'],
    ['navClusterButtonSize'],
    ['navClusterTextOpacity'],
    ['navClusterButtonBgOpacity'],
    ['subtitleBlockSettings'],
    ['cardCreator'],
    ['subtitleApiKeys'],
    ['localPlayerSettings'],
    ['pronunciation'],
    ['frequencyBands'],
    ['srs'],
    ['aiBridge'],
  ],
  excludedPaths: [
    ['schemaVersion'],
    ['activeProfileId'],
    ['languageProfiles'],
    ...ACTIVE_PROFILE_MIRROR_EXCLUSIONS,
    ['srs', 'activeCollectionId'],
    ['srs', 'activeDeckId'],
    ['srs', 'activeNotetypeId'],
    ['srs', 'activeLanguageProfileId'],
    ['localPlayerSettings', 'lastDirectoryId'],
    ['pronunciation', 'localFile', '*'],
    ['pronunciation', 'downloadEspeakTtsData'],
    ...TTS_LOCAL_EXCLUSIONS,
  ],
  elementArrays: [
    {
      path: ['subtitleApiKeys'],
      elementId: stringFieldElementId('id'),
      stripFields: ['status', 'rateLimitedUntil'],
    },
    DICT_LINKS_ELEMENT_ARRAY,
    { path: ['keyboardShortcuts'], elementId: stringFieldElementId('action') },
  ],
};

export const PROFILE_FIELD_REGISTRY: FieldRegistry = {
  syncedPaths: ALL_PATHS,
  excludedPaths: [...TTS_LOCAL_EXCLUSIONS],
  elementArrays: [DICT_LINKS_ELEMENT_ARRAY],
};

export const STUDY_MODES_FIELD_REGISTRY: FieldRegistry = {
  syncedPaths: ALL_PATHS,
  excludedPaths: [['version'], ['activeModeId']],
  elementArrays: [
    { path: ['customModes'], elementId: stringFieldElementId('id') },
    {
      path: ['advanced', 'cleanupRules', 'custom'],
      elementId: stringFieldElementId('id'),
    },
  ],
};

export const AUTO_DOWNLOAD_WHITELIST_FIELD_REGISTRY: FieldRegistry = {
  syncedPaths: ALL_PATHS,
  elementArrays: [
    { path: [], elementId: stringFieldElementId('url'), stripFields: ['tabId'] },
  ],
};

export const TOKENIZE_SETTINGS_FIELD_REGISTRY: FieldRegistry = {
  syncedPaths: ALL_PATHS,
  excludedPaths: [['schemaVersion']],
};

export const OCR_SETTINGS_FIELD_REGISTRY: FieldRegistry = {
  syncedPaths: ALL_PATHS,
  excludedPaths: [['schemaVersion']],
};

export const THEME_MODE_FIELD_REGISTRY: FieldRegistry = { syncedPaths: ALL_PATHS };

export const THEME_CONFIG_FIELD_REGISTRY: FieldRegistry = { syncedPaths: ALL_PATHS };

export const SYNCED_KV_REGISTRIES: Readonly<Record<string, FieldRegistry>> = {
  [STORAGE_KEYS.SETTINGS]: SETTINGS_FIELD_REGISTRY,
  [STORAGE_KEYS.THEME_MODE]: THEME_MODE_FIELD_REGISTRY,
  [STORAGE_KEYS.THEME_CONFIG]: THEME_CONFIG_FIELD_REGISTRY,
  [STORAGE_KEYS.TOKENIZE_SETTINGS]: TOKENIZE_SETTINGS_FIELD_REGISTRY,
  [STORAGE_KEYS.OCR_SETTINGS]: OCR_SETTINGS_FIELD_REGISTRY,
  [STORAGE_KEYS.STUDY_MODES]: STUDY_MODES_FIELD_REGISTRY,
  [STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST]: AUTO_DOWNLOAD_WHITELIST_FIELD_REGISTRY,
};

function stringFieldElementId(field: string): (element: unknown) => string | null {
  return (element) => {
    if (!isPlainJsonObject(element)) return null;
    const value = element[field];
    return typeof value === 'string' && value !== '' ? value : null;
  };
}
