import type { Settings, FilenameSource, KeyboardShortcut, NavClusterSettings, SubtitleBlockSettings } from '@/entities/media';
import type { OverlayStyleConfig, TextShadowConfig } from '@/entities/subtitle';
import type { AiBridgeSettings, AnkiStatusSyncSettings, CardCreatorSettings, CondensedAudioSettings, DictionaryPopupSettings, LocalPlayerSettings, PronunciationSettings, SrsSettingsSlice, TtsSettings } from '@/entities/settings';
import { DEFAULT_BAND_THRESHOLDS } from '@/shared/lib/frequencyBand';
import tokensJson from '@/shared/styles/tokens.json';

// === Default Configuration ===

export const DEFAULT_CONCURRENT_DOWNLOADS = 3;
export const MAX_CONCURRENT_DOWNLOADS = 10;
export const MIN_CONCURRENT_DOWNLOADS = 1;

export const DEFAULT_QUALITY = 'highest' as const;

export const DEFAULT_SUBTITLE_LANGUAGE = 'en';

export const DEFAULT_PREFERRED_VIDEO_FORMAT = 'm3u8' as const;

export const DEFAULT_SELECTED_SUBTITLE_LANGUAGES: string[] = ['all'];

export const DEFAULT_AUTO_SELECT_ENABLED = false;

export const MAX_RETRY = 3;
export const SEGMENT_TIMEOUT_MS = 30_000; // 30 seconds per segment
export const DETECTION_TIMEOUT_MS = 30_000; // 30 seconds to wait for media detection

/**
 * Number of M3U8 segments to fetch in parallel during a single download.
 * Higher values utilize network bandwidth better but risk server throttling
 * (403/429) and increased memory (each in-flight segment is held as a Blob).
 *
 * - 1  = sequential (debug fallback)
 * - 6  = default (good balance for most servers)
 * - 12 = max (aggressive, may trigger rate limits)
 */
export const DEFAULT_SEGMENT_CONCURRENCY = 6;
export const MAX_SEGMENT_CONCURRENCY = 12;
export const MIN_SEGMENT_CONCURRENCY = 1;

/**
 * Maximum total segment size (in bytes) for which TS→MP4 conversion is
 * attempted when `convertToMp4` is set to `'small-only'`. Files larger than
 * this are saved as `.ts` directly to avoid long conversion times.
 */
export const MAX_CONVERT_BYTES = 150 * 1024 * 1024; // 150 MB

// === Parallel Conversion Settings ===

/**
 * Minimum worker count for parallel TS→MP4 conversion. Below this, the
 * sequential path is used.
 */
export const MIN_PARALLEL_WORKERS = 2;

/**
 * Maximum worker count for parallel TS→MP4 conversion. Capped to avoid
 * oversubscribing CPU cores and multiplying memory.
 */
export const MAX_PARALLEL_WORKERS = 6;

/**
 * Default worker count when `parallelConversion` is `'manual'` and the user
 * has not explicitly set a value.
 */
export const DEFAULT_MANUAL_WORKER_COUNT = 4;

/**
 * Default filename source mode. `'title-fallback'` uses the detected media
 * title and falls back to a beautified URL base name when the title is empty
 * or generic.
 */
export const DEFAULT_FILENAME_SOURCE: FilenameSource = 'title-fallback';

/**
 * Titles that are considered "generic" / non-informative and should trigger
 * the URL fallback in `'title-fallback'` mode.
 */
export const GENERIC_TITLES = new Set([
  'video',
  'untitled',
  'unknown',
  'media',
  'movie',
  'clip',
  'stream',
  'player',
  'video player',
  'html5 video',
]);

/**
 * File size threshold (in bytes) below which parallel conversion is not
 * attempted even in auto mode — sequential is fast enough for small files.
 */
export const PARALLEL_MIN_FILE_BYTES = 150 * 1024 * 1024; // 150 MB

/**
 * File size threshold (in bytes) above which auto mode may use up to 4
 * workers (if hardware and safety analysis allow).
 */
export const PARALLEL_LARGE_FILE_BYTES = 300 * 1024 * 1024; // 300 MB

// === Default Settings ===

/** Default keyboard shortcuts for subtitle floating panel (a/d/s/w/t + Ctrl+Shift+T + q/e Card Creator). */
export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { action: 'prev-cue', key: 'a' },
  { action: 'next-cue', key: 'd' },
  { action: 'replay-cue', key: 's' },
  { action: 'toggle-overlay', key: 'w' },
  { action: 'toggle-panel', key: 't' },
  // ADR-021 D7: combo Ctrl+Shift+T toggle auto-translate (no conflict with single 't' toggle-panel).
  { action: 'toggle-translate', key: 't', ctrl: true, shift: true },
  // Player Mode — G matches the Player Mode button tooltip.
  { action: 'toggle-player-mode', key: 'g' },
  // Generate native subtitle manually from active target.
  { action: 'generate-native', key: 'h' },
  // ADR-026: Card Creator entry shortcuts — q quick-update, e edit-card.
  { action: 'quick-update', key: 'q' },
  { action: 'edit-card', key: 'e' },
  // Play/pause toggle — default key ' ' (SpaceBar, convention mọi video player).
  // KeyboardEvent.key cho spacebar = ' ' (space char), không phải 'space'.
  { action: 'play-pause', key: ' ' },
  // Immersion playback — seek between cues containing an unknown word.
  { action: 'next-vocab-token', key: 'x' },
  { action: 'prev-vocab-token', key: 'z' },
  // Page-level: toggle the universal panel. Handled by the content-script
  // global listener (featureInit), not the subtitle/video keyboard handler.
  { action: 'toggle-universal-panel', key: 'u', ctrl: true },
  // Page-level: open the universal panel straight into Dictionary search —
  // instant lookup flow (also page-level, see toggle-universal-panel).
  { action: 'open-dictionary-search', key: 't', shift: true },
];

// === Default Overlay Style (ADR-013) ===

const DEFAULT_TEXT_SHADOW: TextShadowConfig = {
  preset: 'soft',
  color: tokensJson.static.overlay['text-shadow'],
  blur: 2,
  offsetX: 0,
  offsetY: 1,
};

/** ADR-025: reference size for auto-scale (sqrt of a "standard" video area). */
export const SUBTITLE_BLOCK_REFERENCE_SIZE = 1000;

/** Default appearance for target subtitle overlay (prominent — UI v4, ADR-025). */
export const DEFAULT_OVERLAY_STYLE_TARGET: OverlayStyleConfig = {
  fontSize: 24,
  textColor: tokensJson.static.overlay.text,
  backgroundColor: tokensJson.static.overlay.background,
  backgroundOpacity: 0.85,
  textOpacity: 1,
  textShadow: DEFAULT_TEXT_SHADOW,
  fontFamily: 'var(--font-family, sans-serif)',
  fontWeight: 600,
  horizontalAlign: 'center',
  visible: true,
};

/** Default appearance for native subtitle overlay (muted — UI v4, ADR-025). */
export const DEFAULT_OVERLAY_STYLE_NATIVE: OverlayStyleConfig = {
  fontSize: 20,
  textColor: tokensJson.static.overlay.text,
  backgroundColor: tokensJson.static.overlay.background,
  backgroundOpacity: 0.7,
  textOpacity: 0.85,
  textShadow: DEFAULT_TEXT_SHADOW,
  fontFamily: 'var(--font-family, sans-serif)',
  fontWeight: 600,
  horizontalAlign: 'center',
  visible: true,
};

/** Default unified subtitle block settings (ADR-025).
 *  yOffsetPercent now represents the CENTER of the subtitle block (not the top
 *  edge), thanks to `transform: translateY(-50%)` in SUBTITLE_BLOCK_CSS. The
 *  default 75% places the block center at 3/4 of the video height. */
export const DEFAULT_SUBTITLE_BLOCK_SETTINGS: SubtitleBlockSettings = {
  yOffsetPercent: 75,
  globalScale: 1,
  bgOpacity: 0.7,
};

/** Default Card Creator settings (Anki integration, schema v10). */
export const DEFAULT_CARD_CREATOR_SETTINGS: CardCreatorSettings = {
  ankiConnectUrl: 'http://localhost:8765',
  defaultDeck: 'English: Vocab',
  defaultNoteType: '0.Ocean_Vocab_v4.0.0',
  defaultTags: '',
  mediaUpdateMode: 'skip',
  // schema v14: auto-complete toggles (spec §9.3.1, D7) — default all true.
  autoCompleteToggles: {
    definitions: true,
    wordAudios: true,
    sentenceAudios: true,
    images: true,
    sentenceTranslation: true,
    sentence: true,
  },
  // schema v29: per-note-type field mappings (edited in Settings → Card Creator).
  fieldMappings: {},
  audioFallback: 'community-then-tts',
};

/** Default Pronunciation settings (spec ocean-pronunciation-engine + local-pronunciation-audio — schema v26). */
export const DEFAULT_PRONUNCIATION_SETTINGS: PronunciationSettings = {
  fallbackEngines: ['localFile', 'native', 'supertonic', 'browserTts', 'espeak'],
  downloadEspeakTtsData: false,
  localFile: {
    packageType: 'single',
    dslFileHandleId: null,
    audioArchiveHandleId: null,
    splitArchiveDirectoryHandleId: null,
    splitArchivePattern: '',
    lastIndexedAt: null,
  },
};

/** Default Local Player settings (spec local-video-player.md — schema v22). */
export const DEFAULT_LOCAL_PLAYER_SETTINGS: LocalPlayerSettings = {
  subtitleMatchEnabled: true,
  resumePromptEnabled: true,
  lastDirectoryId: null,
};

/** Default frequency band thresholds (schema v28). */
export const DEFAULT_FREQUENCY_BANDS = DEFAULT_BAND_THRESHOLDS;

/** Default Ocean SRS settings (spec ocean-language-acquisition-srs — schema v27). */
export const DEFAULT_SRS_SETTINGS: SrsSettingsSlice = {
  defaultStudyConfigId: null,
  activeCollectionId: null,
  activeDeckId: null,
  activeNotetypeId: null,
  activeLanguageProfileId: null,
  dataLifecycle: {
    reviewEventMaxAgeDays: 365,
    reviewEventMaxCount: 10000,
    audioQuotaMb: 50,
    imageQuotaMb: 50,
  },
  reminder: {
    enabled: false,
    preferredHour: 20,
  },
};

/** Daily study reminder alarm + tuning (spec srs-daily-reminder). */
export const SRS_REMINDER_ALARM = 'srs-reminder';
export const SRS_REMINDER_NOTIFICATION_ID = 'srs-daily-reminder';
export const SRS_REMINDER_LOOKBACK_DAYS = 28;
export const SRS_REMINDER_MIN_STUDY_DAYS = 5;
export const SRS_REMINDER_MIN_COUNT = 3;
export const SRS_REMINDER_MARGIN = 2;
export const SRS_REMINDER_SNOOZE_MS = 60 * 60 * 1000;

export const DEFAULT_TTS_SETTINGS: TtsSettings = {
  enabled: true,
  savedVoices: [],
  voices: [],
  maxDisplay: 3,
  autoplayCount: 0,
  preferredAccent: 'US',
  localTtsEnabled: false,
  localTtsLanguage: 'en',
  downloadedLanguages: [],
  hiddenLanguages: [],
  supertonicVoices: ['M1'],
  supertonicDownloadedVoices: [],
};

/** Default Dictionary Popup settings (spec §9.3 — schema v14). */
export const DEFAULT_DICTIONARY_POPUP_SETTINGS: DictionaryPopupSettings = {
  enabled: true,
  triggerMode: 'click',
  defaultActiveTab: null,
  srsDestination: 'anki',
  popupWidthPx: 560,
  popupMaxHeightPx: 480,
  popupSheetHeightVh: 75,
  externalDictLinks: [
    { id: 'cambridge', name: 'Cambridge Dictionary', urlTemplate: 'https://dictionary.cambridge.org/dictionary/english/{term}', langCodes: ['en'] },
    { id: 'wiktionary', name: 'Wiktionary', urlTemplate: 'https://en.wiktionary.org/wiki/{term}', langCodes: ['en'] },
    { id: 'gtranslate', name: 'Google Translate', urlTemplate: 'https://translate.google.com/?sl=auto&tl={lang}&text={term}', langCodes: [] },
  ],
  tts: DEFAULT_TTS_SETTINGS,
  badgePointerTrigger: { position: 'center', size: 36, pointerScale: 0.25 },
  translationVisibility: 'hidden',
  includeAllExamplesOnDefSelect: false,
  frequencyDisplay: 'stars',
};

export const DEFAULT_CONDENSED_AUDIO_SETTINGS: CondensedAudioSettings = {
  padMs: 500,
} as const;

export const DEFAULT_ANKI_STATUS_SYNC_SETTINGS: AnkiStatusSyncSettings = {
  enabled: true,
  writeBackEnabled: false,
  addonPort: 8766,
} as const;

/** Default AI bridge settings (spec ai-bridge-dictionary — REQ-6, REQ-7, REQ-10). */
export const DEFAULT_AI_BRIDGE_SETTINGS: AiBridgeSettings = {
  defaultProvider: 'chatgpt',
  providerOrder: ['chatgpt', 'gemini', 'deepseek', 'claude'],
  prompts: {
    wordExplain: {
      system: `You are a language API that explains the specific nuance of specified word(s) in a sentence.

Respond concisely in no more than 100 words.

Specified word(s) MUST be in its original language.

All other explanation text MUST be in language [ANSWER_LANG].

In your response:

DO NOT OUTPUT the language name or the word 'nuance';

DO NOT OUTPUT the context sentence ;

DO NOT OUTPUT romaji/pinyin/furigana or any notes on pronunciation;

Conclude with the specific nuance within the context sentence.`,
      user: 'Sentence: [SENTENCE]\nWord(s): [WORD]',
    },
    sentenceBreakdown: {
      system: `You are a language API that does sentence breakdown-explanations.

Break down the supplied sentence into SMALL, meaningful, contiguous chunks.

OUTPUT FORMAT — respond with ONLY a sequence of <chunk> elements, exactly this shape:

<chunk>
<text>chunk words in their original language</text>
<meaning>reworded meaning in [ANSWER_LANG]</meaning>
<explanation>grammar notes in [ANSWER_LANG] — particles, tenses, role</explanation>
</chunk>
<chunk>
<text>next chunk</text>
<meaning>...</meaning>
<explanation>...</explanation>
</chunk>

Example for the sentence "the cat sat" (meaning/explanation shown in [ANSWER_LANG]):

<chunk>
<text>the cat</text>
<meaning>reworded meaning of "the cat" in [ANSWER_LANG]</meaning>
<explanation>grammar note about "the cat" in [ANSWER_LANG]</explanation>
</chunk>
<chunk>
<text>sat</text>
<meaning>reworded meaning of "sat" in [ANSWER_LANG]</meaning>
<explanation>grammar note about "sat" in [ANSWER_LANG]</explanation>
</chunk>

Rules:
- <text> MUST stay in the original language; <meaning> and <explanation> MUST be in language [ANSWER_LANG].
- <meaning> MUST be reworded — definition or synonyms, never identical to <text>.
- <explanation> is at most 100 words.
- Output NOTHING outside <chunk> elements — no titles, intros, summaries, or the original sentence.
- No quotation marks, brackets, or readings/romaji/pinyin/furigana inside <text> or <meaning>.
- NEVER output any text in [TARGET_LANG] except inside <text>.`,
      user: '[SENTENCE]',
    },
    sentenceTranslate: {
      system: `You are a language translation API.

RESPOND ONLY with the translated text.

MAINTAIN the EXACT punctuation of the original text.

DO NOT RESPOND with enclosing quotations unless the original text has them.

Sentence MUST BE translated into this SPECIFIC language: [TARGET_LANG].`,
      user: '[SENTENCE]',
    },
  },
  sentenceTranslateEngine: 'google',
  answerLanguage: 'native',
  autoOpenOnMiss: true,
};

export const DEFAULT_SETTINGS: Settings = {
  uiLanguage: 'auto',
  universalNativeLanguage: 'vi',
  languageProfiles: [],
  activeProfileId: null,
  concurrentDownloads: DEFAULT_CONCURRENT_DOWNLOADS,
  defaultQuality: DEFAULT_QUALITY,
  defaultSubtitleLanguage: DEFAULT_SUBTITLE_LANGUAGE,
  selectedSubtitleLanguages: DEFAULT_SELECTED_SUBTITLE_LANGUAGES,
  convertToMp4: 'always',
  parallelConversion: 'auto',
  manualWorkerCount: DEFAULT_MANUAL_WORKER_COUNT,
  parallelFallback: 'sequential',
  segmentConcurrency: DEFAULT_SEGMENT_CONCURRENCY,
  filenameSource: DEFAULT_FILENAME_SOURCE,
  preferredVideoFormat: DEFAULT_PREFERRED_VIDEO_FORMAT,
  autoSelectEnabled: DEFAULT_AUTO_SELECT_ENABLED,
  // V4 defaults (2026-07-05): auto-load ON + target=en + native=vi — anh yêu
  // không cần setup mỗi lần. Existing users migrated via v3→v4 migration.
  subtitleOverlayTargetLanguage: 'en',
  subtitleOverlayNativeLanguage: 'vi',
  subtitleOverlayAutoLoad: true,
  // V6 default (2026-10): ASR auto-load OFF — anh yêu muốn tắt YouTube
  // auto-generated captions mặc định, bật thủ công khi cần. Existing users
  // migrated via v5→v6 (treat missing/true → false).
  subtitleOverlayAutoLoadAsr: false,
  // ADR-021: auto-translate target→native when site has no native track.
  // Default true — kim chỉ nam "user vào và học thôi" (auto-dịch khi native thiếu).
  subtitleOverlayAutoTranslate: true,
  // Reading annotations (spec reading-annotation, schema v41): default OFF at
  // the flat level — zh profiles carry 'always'; flat value mirrors active profile.
  readingDisplay: 'off',
  // Word-translation glosses (spec word-translation, schema v41): flat level
  // mirrors the active profile; default OFF for all targets.
  glossDisplay: 'off',
  subtitleOverlayTargetStyle: DEFAULT_OVERLAY_STYLE_TARGET,
  subtitleOverlayNativeStyle: DEFAULT_OVERLAY_STYLE_NATIVE,
  subtitlePreference: {},
  keyboardShortcuts: DEFAULT_KEYBOARD_SHORTCUTS,
  // === Nav Cluster (ADR-018, ADR-025) — schema v3 ===
  navClusterEnabled: true,
  navClusterButtonSize: 34,
  navClusterTextOpacity: 1,
  navClusterButtonBgOpacity: 0.2,
  // === Subtitle Block (ADR-025) — schema v9 ===
  subtitleBlockSettings: DEFAULT_SUBTITLE_BLOCK_SETTINGS,
  // === Subtitle Offset (ADR-019) — schema v3 ===
  subtitleOffset: {},
  // === Card Creator (Anki integration) — schema v10 ===
  cardCreator: DEFAULT_CARD_CREATOR_SETTINGS,
  // === Dictionary Popup (spec §9.3) — schema v14 ===
  dictionaryPopup: DEFAULT_DICTIONARY_POPUP_SETTINGS,
  // === Subtitle Search (spec subtitle-search.md) — schema v21 ===
  subtitleApiKeys: [],
  // === Pronunciation (spec ocean-pronunciation-engine — schema v25) ===
  pronunciation: DEFAULT_PRONUNCIATION_SETTINGS,
  // === Frequency bands (schema v28) ===
  frequencyBands: DEFAULT_FREQUENCY_BANDS,
  // === Local Player (spec local-video-player.md) — schema v22 ===
  localPlayerSettings: DEFAULT_LOCAL_PLAYER_SETTINGS,
  // === Ocean Language Acquisition SRS (schema v27) ===
  srs: DEFAULT_SRS_SETTINGS,
  // === Condensed audio (spec condensed-audio — schema v33) ===
  condensedAudio: DEFAULT_CONDENSED_AUDIO_SETTINGS,
  // === Anki status sync (spec anki-known-seed — schema v34) ===
  ankiStatusSync: DEFAULT_ANKI_STATUS_SYNC_SETTINGS,
  // === AI bridge (spec ai-bridge-dictionary — REQ-6/REQ-7/REQ-10) ===
  aiBridge: DEFAULT_AI_BRIDGE_SETTINGS,
};

/**
 * Default nav cluster settings slice (ADR-018 D2). Used for schema v1→v2
 * migration merge + as fallback when storage load fails.
 */
export const DEFAULT_NAV_CLUSTER_SETTINGS: NavClusterSettings = {
  enabled: true,
  buttonSize: 34,
  textOpacity: 1,
  bgOpacity: 0.2,
} as const;

// === Storage Keys ===

export const STORAGE_KEYS = {
  SETTINGS: 'settings',
  DETECTED_MEDIA: 'detected_media',
  DOWNLOADS: 'downloads',
  EXTENSION_STATUS: 'extension_status',
  /** Per-tab detected media in session storage (survives SW restarts). */
  SESSION_MEDIA: 'session_media',
  /** Per-tab downloads in session storage (survives SW restarts). */
  SESSION_DOWNLOADS: 'session_downloads',
  /** Auto-download whitelist (origin+pathname → auto-download on visit). */
  AUTO_DOWNLOAD_WHITELIST: 'auto_download_whitelist',
  /** ADR-022 D1: theme mode tách riêng khỏi settings ('light'|'dark'|'system'). */
  THEME_MODE: 'themeMode',
  /** ADR-022 D1: theme config (customColors palette) tách riêng khỏi settings. */
  THEME_CONFIG: 'themeConfig',
  /** Tokenize on Media per-origin/URL enable state. */
  TOKENIZE_SETTINGS: 'tokenizeSettings',
  /** Orbital badge collapsed position { edge, tangential } — edge: 'left'|'right'|'top'|'bottom',
   *  tangential: px along that edge (survives reload). */
  ORBITAL_BADGE_POSITION: 'orbitalBadgePosition',
  /** Last active universal orbital panel tab per session ('dictionary' | 'settings'). */
  UNIVERSAL_PANEL_TAB: 'universalPanelTab',
  /** Recent dictionary search terms for the universal panel session. */
  DICTIONARY_SEARCH_HISTORY: 'dictionarySearchHistory',
  /** Player Mode split content width % (20-60). Survives reload + re-enter. */
  PLAYER_MODE_CONTENT_PCT: 'playerModeContentPct',
  /** Player Mode mobile (<600px) cue display mode ('list'|'active'). Survives reload + re-enter. */
  PLAYER_MODE_CUE_DISPLAY: 'playerModeCueDisplay',
  /** Split View CueList panel width % (20-60). Survives reload + re-toggle. */
  SPLIT_VIEW_PCT: 'splitViewPct',
  /** Split View mobile sheet height % of viewport (clamped to min px + viewport). Survives reload + re-toggle. */
  SPLIT_VIEW_SHEET_HEIGHT_VH: 'splitViewSheetHeightVh',
  /** Universal panel Dictionary tab right pane width % (25-75). Survives reload + reopen. */
  DICT_TAB_PANE_PCT: 'dictTabPanePct',
  /** Cue difficulty filter mode ('all'|'i1'|'hasUnknown'|'allKnown'|'dense'|'tracking'). Survives reload + surface switch. */
  CUE_FILTER_MODE: 'cueFilterMode',
  /** Subtitle manager mobile sheet height % of viewport (20-95). Survives close/reopen. */
  SUBTITLE_MANAGER_SHEET_HEIGHT_VH: 'subtitleManagerSheetHeightVh',
  /** Host cue panel ('t') mobile sheet height % of viewport (20-95). Survives close/reopen. */
  CUE_PANEL_SHEET_HEIGHT_VH: 'cuePanelSheetHeightVh',
  /** Per-key subtitle quota ledger in session storage (spec subtitle-search.md).
   *  Session-only: per-profile, not synced, survives SW restart. */
  SUBTITLE_KEY_LEDGER: 'subtitleKeyLedger',
  /** Local player library metadata cache (spec local-video-player.md). */
  LOCAL_PLAYER_LIBRARY: 'localPlayerLibrary',
  /** Local player subtitle-panel (Split View CueList) enable state — survives reload. */
  LOCAL_PLAYER_SUBTITLE_PANEL_OPEN: 'localPlayerSubtitlePanelOpen',
  /** Per-origin OCR preference (spec orca-ocr-layer.md). Map origin → OcrOriginState. */
  OCR_SETTINGS: 'ocrSettings',
  /** Study Modes state (spec media-study-modes.md). */
  STUDY_MODES: 'studyModes',
  /** Study Modes "Advanced" section toggle state — survives reload. UI-only, not synced. */
  STUDY_MODES_ADVANCED_OPEN: 'studyModesAdvancedOpen',
  /** Cached Anki schema (decks/models/fields-by-model) — spec anki-config-in-settings. */
  ANKI_SCHEMA_CACHE: 'ankiSchemaCache',
  OCR_REGION_RESULT: '__ocrRegionResult',
  /** Dev-only dictionary lookup log ring buffer (lookupLogStore). */
  LOOKUP_LOG: 'lookupLog',
  /** Timestamp of the last orphan sweep (session storage — once per browser session). */
  ORPHAN_SWEEP_AT: 'orphanSweepAt',
  /** SRS daily reminder runtime state (spec srs-daily-reminder). SW-readable. */
  SRS_REMINDER_STATE: 'srsReminderState',
  /** Mirror of srsUiPrefs fields the service worker needs (localStorage is
   *  unreachable from SW) — currently { dayStartHour }. */
  SRS_UI_PREFS_MIRROR: 'srsUiPrefsMirror',
} as const;

/** Minimum interval between orphan sweeps across MV3 service-worker restarts. */
export const ORPHAN_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

// === Popup Dimensions ===

export const POPUP_WIDTH = 400;
export const POPUP_HEIGHT = 600;

/** Fallback viewport dimensions when `window` is undefined (SSR/test env). */
export const FALLBACK_VIEWPORT_WIDTH = 1920;
export const FALLBACK_VIEWPORT_HEIGHT = 1080;

/** Duration (ms) for "Copied!" feedback on URL copy buttons. */
export const COPY_FEEDBACK_DURATION_MS = 2000;

