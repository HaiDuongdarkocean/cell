// Type definitions for message passing between popup, background, and content script

import type {
  DetectedVideo,
  DetectedSubtitle,
  DownloadItem,
  DownloadProgress,
  Settings,
  VideoQuality,
  ParallelConversionMode,
  ParallelFallbackMode,
  ConversionPhase,
} from './media';

// === Message Types ===

export type MessageType =
  | 'DETECT_MEDIA'
  | 'GET_DETECTED_MEDIA'
  | 'DETECTED_MEDIA_UPDATE'
  | 'DOWNLOAD_VIDEO'
  | 'DOWNLOAD_SUBTITLE'
  | 'DOWNLOAD_ALL'
  | 'CANCEL_DOWNLOAD'
  | 'PAUSE_DOWNLOAD'
  | 'RESUME_DOWNLOAD'
  | 'RETRY_DOWNLOAD'
  | 'REMOVE_DOWNLOAD'
  | 'GET_DOWNLOAD_PROGRESS'
  | 'DOWNLOAD_PROGRESS_UPDATE'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'GET_EXTENSION_STATUS'
  | 'TOGGLE_EXTENSION'
  | 'EXTENSION_STATUS_UPDATE'
  | 'UPDATE_SUBTITLE_LANGUAGE'
  | 'GET_SUBTITLE_FOR_OVERLAY'
  | 'CONVERT_TS_TO_MP4'
  | 'CONVERT_TS_TO_MP4_RESULT'
  | 'CONVERT_TS_TO_MP4_V2'
  | 'CONVERT_TS_TO_MP4_V2_RESULT'
  | 'CONVERSION_PROGRESS_UPDATE'
  | 'CREATE_OPFS_BLOB_URL'
  | 'REVOKE_OPFS_BLOB_URL'
  | 'OFFSCREEN_PING'
  | 'PAGE_SCAN_RESULT';

// === Message Request ===

export interface MessageRequest {
  readonly type: MessageType;
  readonly payload?: unknown;
}

// === Message Response ===

export interface MessageResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

// === Typed Payloads ===

export interface DetectMediaPayload {
  readonly tabId: number;
  readonly tabUrl: string;
}

export interface GetDetectedMediaPayload {
  readonly tabId: number;
}

export interface DetectedMediaUpdatePayload {
  readonly videos: DetectedVideo[];
  readonly subtitles: DetectedSubtitle[];
  /** Tab that produced this update. Popup filters by its own tabId. */
  readonly tabId: number;
}

export interface DownloadVideoPayload {
  readonly videoId: string;
  readonly variantId?: string;
  readonly quality?: VideoQuality;
}

export interface DownloadSubtitlePayload {
  readonly subtitleId: string;
}

export interface UpdateSubtitleLanguagePayload {
  readonly subtitleId: string;
  readonly language: string;
}

/** Request: content script asks background for subtitle matching target language. */
export interface GetSubtitleForOverlayPayload {
  readonly tabId: number;
}

/** Response: background returns matching subtitle URL + language, or null if no match. */
export interface SubtitleForOverlayResult {
  readonly url: string;
  readonly language: string;
  readonly format: string;
}

export interface DownloadAllPayload {
  readonly tabId?: number;
}

export interface GetDownloadProgressPayload {
  readonly tabId: number;
}

export interface CancelDownloadPayload {
  readonly downloadId: string;
}

export interface DownloadProgressUpdatePayload {
  readonly progress: DownloadProgress;
  /** Tab that owns this download. Popup filters by its own tabId. */
  readonly tabId: number;
}

export interface UpdateSettingsPayload {
  readonly settings: Partial<Settings>;
}

export interface ConvertTsToMp4Payload {
  readonly segments: ArrayBuffer[]; // serialized segments
  readonly downloadId: string;
}

export interface ConvertTsToMp4ResultPayload {
  readonly downloadId: string;
  readonly mp4Data: ArrayBuffer;
  readonly success: boolean;
  readonly error?: string;
}

/**
 * V2 conversion request: the offscreen document reads `input.ts` from OPFS
 * (shared within the extension origin) and writes `output.mp4` to OPFS.
 * No large ArrayBuffer payloads are sent via message.
 */
export interface ConvertTsToMp4V2Payload {
  readonly downloadId: string;
  readonly parallelConversion?: ParallelConversionMode;
  readonly manualWorkerCount?: number;
  readonly parallelFallback?: ParallelFallbackMode;
}

export interface ConvertTsToMp4V2ResultPayload {
  readonly downloadId: string;
  readonly outputName: string;
  readonly mimeType: string;
  readonly success: boolean;
  readonly error?: string;
  /** Number of workers used (parallel mode only). */
  readonly workerCount?: number;
  /** Whether Web Workers were used for conversion. */
  readonly usedWorkers?: boolean;
  /** Total conversion duration in milliseconds. */
  readonly durationMs?: number;
}

/**
 * Progress update emitted by the offscreen document during TS→MP4 conversion.
 *
 * The offscreen runner broadcasts this via `chrome.runtime.sendMessage` so the
 * background service worker can relay it to the popup. This is separate from
 * `DOWNLOAD_PROGRESS_UPDATE` because conversion runs in the offscreen document
 * (not the background), and the data shape is conversion-specific.
 */
export interface ConversionProgressUpdatePayload {
  readonly downloadId: string;
  /** Overall conversion progress: 0–100. */
  readonly percent: number;
  /** Current conversion phase. */
  readonly phase: ConversionPhase;
  /** Total input file size in bytes. */
  readonly fileSize: number;
  /** Bytes processed by the transmuxer so far. */
  readonly processedBytes: number;
  /** Number of Web Workers actively transmuxing (0 if sequential). */
  readonly workerCount: number;
  /** Whether parallel (Web Worker) conversion is being used. */
  readonly usedWorkers: boolean;
}

/**
 * Request the offscreen document to read an OPFS file and create a Blob URL
 * for it. The offscreen document owns the Blob URL (it is tied to the
 * offscreen document's lifetime) and tracks it until {@link REVOKE_OPFS_BLOB_URL}
 * is received.
 *
 * This avoids materializing large video files into `data:` URLs or
 * `ArrayBuffer`s in the service worker.
 */
export interface CreateOpfsBlobUrlPayload {
  readonly downloadId: string;
  readonly opfsFilename: string;
  readonly mimeType: string;
}

export interface CreateOpfsBlobUrlResultPayload {
  readonly url: string;
}

export interface RevokeOpfsBlobUrlPayload {
  readonly url: string;
}

export interface PageScanResultPayload {
  readonly tabId: number;
  readonly videoUrls: string[];
  readonly subtitleUrls: string[];
}

// === Typed Message Helpers ===

export type TypedMessageRequest<T extends MessageType, P = unknown> = {
  readonly type: T;
  readonly payload: P;
};

export type MessageHandler<T = unknown> = (
  request: MessageRequest,
) => Promise<MessageResponse<T>> | MessageResponse<T>;

// === Download List Response ===

export interface DownloadListResponse {
  readonly downloads: DownloadItem[];
}
