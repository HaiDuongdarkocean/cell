import type { Settings } from '../types/media';

// === Default Configuration ===

export const DEFAULT_CONCURRENT_DOWNLOADS = 3;
export const MAX_CONCURRENT_DOWNLOADS = 10;
export const MIN_CONCURRENT_DOWNLOADS = 1;

export const DEFAULT_QUALITY = 'highest' as const;

export const DEFAULT_SUBTITLE_LANGUAGE = 'en';

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

export const DEFAULT_SETTINGS: Settings = {
  concurrentDownloads: DEFAULT_CONCURRENT_DOWNLOADS,
  defaultQuality: DEFAULT_QUALITY,
  defaultSubtitleLanguage: DEFAULT_SUBTITLE_LANGUAGE,
  theme: 'light',
  convertToMp4: 'always',
  parallelConversion: 'auto',
  manualWorkerCount: DEFAULT_MANUAL_WORKER_COUNT,
  parallelFallback: 'save-ts',
};

// === Storage Keys ===

export const STORAGE_KEYS = {
  SETTINGS: 'settings',
  DETECTED_MEDIA: 'detected_media',
  DOWNLOADS: 'downloads',
  EXTENSION_STATUS: 'extension_status',
} as const;

// === Popup Dimensions ===

export const POPUP_WIDTH = 400;
export const POPUP_HEIGHT = 600;
