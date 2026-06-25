// Type definitions for media detection, download, and conversion

// === Video Types ===

export type VideoFormat = 'm3u8' | 'mp4' | 'ts' | 'webm' | 'unknown';

export type VideoQuality = 'highest' | '1080p' | '720p' | '480p' | '360p' | 'lowest' | 'auto';

export interface VideoVariant {
  readonly url: string;
  readonly quality: VideoQuality;
  readonly resolution?: string;
  readonly bandwidth?: number;
  readonly playlistUrl?: string;
  readonly size?: number; // File size in bytes
}

export interface DetectedVideo {
  readonly id: string;
  readonly url: string;
  readonly format: VideoFormat;
  readonly title: string;
  readonly tabId: number;
  readonly tabUrl: string;
  readonly detectedAt: number;
  readonly variants: VideoVariant[];
  readonly selectedVariantId?: string;
}

// === M3U8 Playlist Types ===

/**
 * Byte range specification for `#EXT-X-BYTERANGE`.
 * `offset` is optional — when absent, it equals the byte after the
 * previous segment in the same media file (per RFC 8216 §4.3.2.2).
 */
export interface ByteRange {
  readonly length: number;
  readonly offset?: number;
}

/**
 * Encryption metadata parsed from `#EXT-X-KEY`.
 * Only `AES-128` is supported for decryption; other methods (SAMPLE-AES,
 * Widevine, etc.) are parsed but not decrypted.
 */
export interface HlsEncryption {
  readonly method: string;
  readonly keyUri: string;
  readonly iv?: string;
}

/**
 * Init segment metadata parsed from `#EXT-X-MAP` (fMP4 / CMAF).
 * The init segment must be fetched and prepended to the .m4s segments
 * to produce a valid fragmented MP4 file.
 */
export interface HlsInitSegment {
  readonly uri: string;
  readonly byteRange?: ByteRange;
}

export interface TsSegment {
  readonly url: string;
  readonly duration: number;
  readonly sequence?: number;
  /** Byte range for `#EXT-X-BYTERANGE` segments. */
  readonly byteRange?: ByteRange;
  /** `true` if preceded by `#EXT-X-DISCONTINUITY` (ad break / codec change). */
  readonly discontinuity?: boolean;
}

/**
 * Byte range metadata for a single HLS segment after it has been appended
 * to `input.ts` in OPFS. Used by the parallel conversion engine to split
 * the merged file at safe segment boundaries.
 */
export interface SegmentRange {
  /** Zero-based index in the original playlist order. */
  readonly index: number;
  /** Byte offset where this segment starts in `input.ts`. */
  readonly startByte: number;
  /** Byte offset where this segment ends (exclusive) in `input.ts`. */
  readonly endByte: number;
  /** Size of this segment in bytes (`endByte - startByte`). */
  readonly size: number;
  /** Segment duration in seconds from `#EXTINF`, if available. */
  readonly duration?: number;
}

export interface M3u8Playlist {
  readonly version: number;
  readonly targetDuration: number;
  readonly segments: TsSegment[];
  readonly isMasterPlaylist: boolean;
  readonly variants: M3u8Variant[];
  /** Encryption info from `#EXT-X-KEY` (undefined if no encryption). */
  readonly encryption?: HlsEncryption;
  /** Init segment for fMP4/CMAF from `#EXT-X-MAP` (undefined for plain .ts). */
  readonly initSegment?: HlsInitSegment;
  /** `true` if `#EXT-X-ENDLIST` present (VOD). `false` for LIVE streams. */
  readonly hasEndlist?: boolean;
}

export interface M3u8Variant {
  readonly url: string;
  readonly bandwidth: number;
  readonly resolution?: string;
  readonly codecs?: string;
  readonly quality: VideoQuality;
}

// === Subtitle Types ===

export type SubtitleFormat = 'ass' | 'vtt' | 'srt';

export interface DetectedSubtitle {
  readonly id: string;
  readonly url: string;
  readonly format: SubtitleFormat;
  readonly language: string;
  readonly tabId: number;
  readonly detectedAt: number;
  readonly videoId?: string;
  readonly size?: number; // File size in bytes
}

// Parsed subtitle structures

export interface AssStyle {
  readonly name: string;
  readonly fontName: string;
  readonly fontSize: number;
  readonly primaryColor: string;
  readonly alignment: number;
}

export interface AssDialogue {
  readonly layer: number;
  readonly start: number; // milliseconds
  readonly end: number; // milliseconds
  readonly style: string;
  readonly name: string;
  readonly text: string;
}

export interface AssSubtitle {
  readonly scriptInfo: Record<string, string>;
  readonly styles: AssStyle[];
  readonly dialogues: AssDialogue[];
}

export interface VttCue {
  readonly id?: string;
  readonly start: number; // milliseconds
  readonly end: number; // milliseconds
  readonly text: string;
}

export interface VttSubtitle {
  readonly cues: VttCue[];
}

export interface SrtCue {
  readonly index: number;
  readonly start: number; // milliseconds
  readonly end: number; // milliseconds
  readonly text: string;
}

export interface SrtSubtitle {
  readonly cues: SrtCue[];
}

// === Download Types ===

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'converting'
  | 'done'
  | 'error'
  | 'cancelled'
  | 'paused';

export type MediaType = 'video' | 'subtitle';

export interface DownloadItem {
  readonly id: string;
  readonly mediaType: MediaType;
  readonly url: string;
  readonly title: string;
  /** Tab that originated this download. Used to scope popup display per-tab. */
  readonly tabId: number;
  readonly status: DownloadStatus;
  readonly progress: number; // 0-100 (overall)
  readonly error?: string;
  readonly startedAt?: number;
  readonly completedAt?: number;
  readonly savedFilename?: string;
  readonly videoId?: string;
  /** Quality label for badge display (e.g. "1080p"). Set at creation time. */
  readonly quality?: VideoQuality;
  /** Download phase progress (0-100), separate from conversion. */
  readonly downloadProgress?: number;
  /** Conversion phase progress (0-100), separate from download. */
  readonly convertProgress?: number;
  /** Total file size in bytes (set during download/conversion). */
  readonly fileSize?: number;
  /** Bytes downloaded so far (during `downloading` status). */
  readonly downloadedBytes?: number;
  /** Bytes processed by the transmuxer (during `converting` status). */
  readonly processedBytes?: number;
  /** Current conversion phase (during `converting` status). */
  readonly conversionPhase?: ConversionPhase;
  /** Number of Web Workers actively transmuxing (parallel mode only). */
  readonly workerCount?: number;
  /** Whether parallel (Web Worker) conversion was used. */
  readonly usedWorkers?: boolean;
}

/**
 * Phase of the TS→MP4 conversion pipeline, reported during the `converting`
 * status. Matches `ParallelConversionPhase` from the parallel progress tracker
 * but is duplicated here to avoid a cross-module import cycle in the type layer.
 */
export type ConversionPhase =
  | 'planning'
  | 'transmuxing'
  | 'merging'
  | 'validating'
  | 'done';

export interface DownloadProgress {
  readonly itemId: string;
  readonly status: DownloadStatus;
  readonly progress: number;
  readonly currentSegment?: number;
  readonly totalSegments?: number;
  readonly error?: string;
  /** Total size of the downloaded file in bytes (input.ts size). */
  readonly fileSize?: number;
  /** Bytes downloaded so far (during `downloading` status). */
  readonly downloadedBytes?: number;
  /** Bytes processed by the transmuxer so far (during `converting` status). */
  readonly processedBytes?: number;
  /** Current conversion phase (during `converting` status). */
  readonly conversionPhase?: ConversionPhase;
  /** Number of Web Workers actively transmuxing (parallel mode only). */
  readonly workerCount?: number;
  /** Whether parallel (Web Worker) conversion was used for this item. */
  readonly usedWorkers?: boolean;
  /** Download phase progress (0-100), separate from conversion. */
  readonly downloadProgress?: number;
  /** Conversion phase progress (0-100), separate from download. */
  readonly convertProgress?: number;
}

// === Settings Types ===

/** Conversion behavior for M3U8 downloads. */
export type ConvertToMp4Mode = 'always' | 'small-only' | 'never';

/**
 * Parallel conversion scaling mode for TS→MP4 transmuxing.
 *
 * - `'auto'`   — runtime decides worker count based on file size, CPU cores,
 *                 and safety analysis. Default.
 * - `'manual'` — user specifies a worker count; runtime still clamps to safe
 *                 bounds and may fallback to sequential if input is ineligible.
 * - `'off'`    — always use the current sequential transmuxer.
 */
export type ParallelConversionMode = 'auto' | 'manual' | 'off';

/**
 * Fallback strategy when parallel conversion fails.
 *
 * - `'sequential'` — retry the entire conversion sequentially.
 * - `'save-ts'`    — skip conversion, save the `.ts` file directly.
 */
export type ParallelFallbackMode = 'sequential' | 'retry-reduced' | 'save-ts' | 'fail';

/**
 * Source for naming downloaded files (video + subtitle).
 *
 * - `'title-fallback'` — Use the detected media title; if it is empty or
 *   generic ("video", "untitled", etc.), fall back to a beautified base
 *   name extracted from the URL. Default.
 * - `'title-only'`     — Always use the detected title; if empty/generic,
 *   use "untitled" as the base name.
 * - `'url-only'`       — Always use a beautified base name extracted from
 *   the URL path, ignoring the detected title entirely.
 */
export type FilenameSource = 'title-fallback' | 'title-only' | 'url-only';

export interface Settings {
  readonly concurrentDownloads: number;
  readonly defaultQuality: VideoQuality;
  /** @deprecated Use `selectedSubtitleLanguages` instead. Migrated on load. */
  readonly defaultSubtitleLanguage?: string;
  /** Multi-select subtitle languages (ISO 639-1 codes). `['all']` = any. */
  readonly selectedSubtitleLanguages: string[];
  readonly theme: 'light' | 'dark';
  /** When to attempt TS→MP4 conversion during M3U8 downloads. */
  readonly convertToMp4: ConvertToMp4Mode;
  /**
   * Parallel conversion scaling mode. Controls whether the offscreen
   * document attempts parallel segment-group transmuxing or uses the
   * sequential path. Default: `'auto'` (but auto only does dry-run
   * planning until experimental parallel is proven safe).
   */
  readonly parallelConversion: ParallelConversionMode;
  /**
   * User-requested worker count for manual mode. Clamped at runtime to
   * `[MIN_PARALLEL_WORKERS, MAX_PARALLEL_WORKERS]`. Default: 4.
   */
  readonly manualWorkerCount: number;
  /**
   * Fallback strategy when parallel conversion fails after partial work.
   * Default: `'save-ts'` for large files to avoid wasting time.
   */
  readonly parallelFallback: ParallelFallbackMode;
  /**
   * Number of M3U8 segments to fetch in parallel during a single download.
   * Higher values utilize network bandwidth better but risk server
   * throttling (403/429). Clamped to `[MIN_SEGMENT_CONCURRENCY,
   * MAX_SEGMENT_CONCURRENCY]`. Default: 6.
   */
  readonly segmentConcurrency: number;
  /**
   * Source for naming downloaded files. Default: `'title-fallback'`.
   */
  readonly filenameSource: FilenameSource;
  /** Preferred video format for auto-select. Fallback to other format if unavailable. */
  readonly preferredVideoFormat: 'mp4' | 'm3u8';
  /** When true, popup auto-selects media matching preferences on open. */
  readonly autoSelectEnabled: boolean;
}

/** Result of auto-selecting best media matching user preferences. */
export interface AutoSelectResult {
  readonly videoId: string;
  readonly subtitleIds: string[];
  readonly matchedFormat: 'mp4' | 'm3u8';
  readonly matchedQuality: VideoQuality;
  readonly fallbackReason?: 'format' | 'quality' | 'subtitle';
}

/** Whitelist entry for auto-download per URL. */
export interface WhitelistEntry {
  readonly url: string;
  readonly addedAt: number;
  readonly tabId?: number;
}

// === Network Request Types (for detectors) ===

export interface NetworkRequest {
  readonly url: string;
  readonly method: string;
  readonly tabId: number;
  readonly type: string; // resource type
  readonly timeStamp: number;
}
