// Type definitions for message passing between popup, background, and content script

import type {
  DetectedVideo,
  DetectedSubtitle,
  DownloadItem,
  DownloadProgress,
  Settings,
  VideoQuality,
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
  | 'GET_DOWNLOAD_PROGRESS'
  | 'DOWNLOAD_PROGRESS_UPDATE'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'GET_EXTENSION_STATUS'
  | 'TOGGLE_EXTENSION'
  | 'EXTENSION_STATUS_UPDATE'
  | 'CONVERT_TS_TO_MP4'
  | 'CONVERT_TS_TO_MP4_RESULT'
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
}

export interface DownloadVideoPayload {
  readonly videoId: string;
  readonly variantId?: string;
  readonly quality?: VideoQuality;
}

export interface DownloadSubtitlePayload {
  readonly subtitleId: string;
}

export interface DownloadAllPayload {
  readonly tabId: number;
}

export interface CancelDownloadPayload {
  readonly downloadId: string;
}

export interface DownloadProgressUpdatePayload {
  readonly progress: DownloadProgress;
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
