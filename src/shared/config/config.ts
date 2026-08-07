import type { Settings, FilenameSource, KeyboardShortcut, NavClusterSettings, SubtitleBlockSettings } from '@/entities/media';
import type { OverlayStyleConfig, TextShadowConfig } from '@/entities/subtitle';
import type { CardCreatorSettings, DictionaryPopupSettings } from '@/entities/settings';
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

/** Feature flag: run the legacy vanilla subtitle overlay instead of the React shadow-root UI. */
export const USE_LEGACY_SUBTITLE = false;

/** Feature flag: run the legacy light-DOM settings dialog instead of the React shadow-root UI. */
export const USE_LEGACY_SETTINGS = false;

/** Feature flag: run the legacy light-DOM universal panel instead of the React shadow-root UI. */
export const USE_LEGACY_UNIVERSAL_PANEL = false;

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
  // ADR-021 D7: generate native subtitle manually from active target.
  { action: 'generate-native', key: 'g' },
  // ADR-026: Card Creator entry shortcuts — q quick-update, e edit-card.
  { action: 'quick-update', key: 'q' },
  { action: 'edit-card', key: 'e' },
  // Play/pause toggle — default key 'pause' (Pause/Break).
  { action: 'play-pause', key: 'pause' },
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
  mediaUpdateMode: 'overwrite',
  // schema v14: auto-complete toggles (spec §9.3.1, D7) — default all true.
  autoCompleteToggles: {
    definitions: true,
    wordAudios: true,
    sentenceAudios: true,
    images: true,
    sentenceTranslation: true,
    sentence: true,
  },
  audioFallback: 'community-then-tts',
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
  tts: { enabled: true, savedVoices: [], voices: [], maxDisplay: 3, autoplayCount: 0, preferredAccent: 'US' },
  badgePointerTrigger: { position: 'center', size: 36, pointerScale: 0.25 },
};

export const DEFAULT_SETTINGS: Settings = {
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
} as const;

// === Popup Dimensions ===

export const POPUP_WIDTH = 400;
export const POPUP_HEIGHT = 600;

/** Fallback viewport dimensions when `window` is undefined (SSR/test env). */
export const FALLBACK_VIEWPORT_WIDTH = 1920;
export const FALLBACK_VIEWPORT_HEIGHT = 1080;

/** Duration (ms) for "Copied!" feedback on URL copy buttons. */
export const COPY_FEEDBACK_DURATION_MS = 2000;

