import type { Settings, FilenameSource, KeyboardShortcut, NavClusterSettings } from '@/entities/media';
import type { OverlayStyleConfig, TextShadowConfig } from '@/entities/subtitle';

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

/** Default keyboard shortcuts for subtitle floating panel (a/d/s/w/t). */
export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { action: 'prev-cue', key: 'a' },
  { action: 'next-cue', key: 'd' },
  { action: 'replay-cue', key: 's' },
  { action: 'toggle-overlay', key: 'w' },
  { action: 'toggle-panel', key: 't' },
];

// === Default Overlay Style (ADR-013) ===

const DEFAULT_TEXT_SHADOW: TextShadowConfig = {
  preset: 'soft',
  color: '#000000',
  blur: 2,
  offsetX: 0,
  offsetY: 1,
};

/** Default appearance for target subtitle overlay (prominent, bottom 18% — UI v4). */
export const DEFAULT_OVERLAY_STYLE_TARGET: OverlayStyleConfig = {
  fontSize: 24,
  textColor: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0.85,
  textOpacity: 1,
  textShadow: DEFAULT_TEXT_SHADOW,
  fontFamily: 'sans-serif',
  yOffsetPercent: 18,
  horizontalAlign: 'center',
  visible: true,
};

/** Default appearance for native subtitle overlay (muted, bottom 6% — UI v4). */
export const DEFAULT_OVERLAY_STYLE_NATIVE: OverlayStyleConfig = {
  fontSize: 20,
  textColor: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0.7,
  textOpacity: 0.85,
  textShadow: DEFAULT_TEXT_SHADOW,
  fontFamily: 'sans-serif',
  yOffsetPercent: 6,
  horizontalAlign: 'center',
  visible: true,
};

export const DEFAULT_SETTINGS: Settings = {
  concurrentDownloads: DEFAULT_CONCURRENT_DOWNLOADS,
  defaultQuality: DEFAULT_QUALITY,
  defaultSubtitleLanguage: DEFAULT_SUBTITLE_LANGUAGE,
  selectedSubtitleLanguages: DEFAULT_SELECTED_SUBTITLE_LANGUAGES,
  theme: 'light',
  convertToMp4: 'always',
  parallelConversion: 'auto',
  manualWorkerCount: DEFAULT_MANUAL_WORKER_COUNT,
  parallelFallback: 'sequential',
  segmentConcurrency: DEFAULT_SEGMENT_CONCURRENCY,
  filenameSource: DEFAULT_FILENAME_SOURCE,
  preferredVideoFormat: DEFAULT_PREFERRED_VIDEO_FORMAT,
  autoSelectEnabled: DEFAULT_AUTO_SELECT_ENABLED,
  subtitleOverlayTargetLanguage: '',
  subtitleOverlayNativeLanguage: '',
  subtitleOverlayAutoLoad: false,
  subtitleOverlayTargetStyle: DEFAULT_OVERLAY_STYLE_TARGET,
  subtitleOverlayNativeStyle: DEFAULT_OVERLAY_STYLE_NATIVE,
  subtitlePreference: {},
  keyboardShortcuts: DEFAULT_KEYBOARD_SHORTCUTS,
  // === Nav Cluster (ADR-018) — schema v2 ===
  navClusterEnabled: true,
  navClusterPosition: { x: 0, y: 75 },
  navClusterButtonSize: 48,
  navClusterBgOpacity: 0.7,
  navClusterButtonOpacity: 0.9,
  navClusterCollapsed: false,
};

/**
 * Default nav cluster settings slice (ADR-018 D2). Used for schema v1→v2
 * migration merge + as fallback when storage load fails.
 */
export const DEFAULT_NAV_CLUSTER_SETTINGS: NavClusterSettings = {
  enabled: true,
  position: { x: 0, y: 75 },
  buttonSize: 48,
  bgOpacity: 0.7,
  buttonOpacity: 0.9,
  collapsed: false,
};

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
} as const;

// === Popup Dimensions ===

export const POPUP_WIDTH = 400;
export const POPUP_HEIGHT = 600;
