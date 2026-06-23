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

export interface TsSegment {
  readonly url: string;
  readonly duration: number;
  readonly sequence?: number;
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
  readonly status: DownloadStatus;
  readonly progress: number; // 0-100
  readonly error?: string;
  readonly startedAt?: number;
  readonly completedAt?: number;
  readonly savedFilename?: string;
  readonly videoId?: string;
}

export interface DownloadProgress {
  readonly itemId: string;
  readonly status: DownloadStatus;
  readonly progress: number;
  readonly currentSegment?: number;
  readonly totalSegments?: number;
  readonly error?: string;
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
export type ParallelFallbackMode = 'sequential' | 'save-ts';

export interface Settings {
  readonly concurrentDownloads: number;
  readonly defaultQuality: VideoQuality;
  readonly defaultSubtitleLanguage: string;
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
}

// === Network Request Types (for detectors) ===

export interface NetworkRequest {
  readonly url: string;
  readonly method: string;
  readonly tabId: number;
  readonly type: string; // resource type
  readonly timeStamp: number;
}
