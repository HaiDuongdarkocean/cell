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

export interface Settings {
  readonly concurrentDownloads: number;
  readonly defaultQuality: VideoQuality;
  readonly defaultSubtitleLanguage: string;
  readonly theme: 'light' | 'dark';
  /** When to attempt TS→MP4 conversion during M3U8 downloads. */
  readonly convertToMp4: ConvertToMp4Mode;
}

// === Network Request Types (for detectors) ===

export interface NetworkRequest {
  readonly url: string;
  readonly method: string;
  readonly tabId: number;
  readonly type: string; // resource type
  readonly timeStamp: number;
}
