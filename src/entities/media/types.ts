// Media types: download, subtitle format, parsed subtitles, bilingual,
// auto-select, whitelist, network request (entities/media)

import type { VideoQuality } from '@/entities/video/types';
// SubtitleFormat consolidated to @/entities/subtitle/types (more complete:
// includes 'ssa' | 'unknown'). Re-exported here for backward compatibility.
import type { SubtitleFormat } from '@/entities/subtitle/types';
export type { SubtitleFormat };

// === Subtitle Types ===

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

// === Bilingual Subtitle Types (floating panel) ===

/** Bilingual SRT cue: target language (prominent) + native language (muted). */
export interface BilingualCue {
  readonly index: number;
  readonly start: number; // milliseconds
  readonly end: number;   // milliseconds
  readonly targetText: string;
  readonly nativeText: string;
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
