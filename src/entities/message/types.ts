// Type definitions for message passing between popup, background, and content script

import type {
  DetectedVideo,
  VideoQuality,
} from '@/entities/video/types';
import type {
  Settings,
  ParallelConversionMode,
  ParallelFallbackMode,
} from '@/entities/settings/types';
import type {
  DetectedSubtitle,
  DownloadItem,
  DownloadProgress,
  ConversionPhase,
  BilingualCue,
} from '@/entities/media/types';

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
  | 'PAGE_SCAN_RESULT'
  | 'AUTO_LOAD_SUBTITLES'
  | 'REQUEST_AUTO_LOAD_SUBTITLES'
  | 'FETCH_SUBTITLE_CONTENT'
  | 'OPEN_SIDE_PANEL'
  | 'CLOSE_SIDE_PANEL'
  | 'SUBTITLE_CUES_LOADED'
  | 'REQUEST_SUBTITLE_CUES'
  | 'VIDEO_TIME_UPDATE'
  | 'VIDEO_PLAY_STATE'
  | 'SEEK_TO'
  | 'TOGGLE_PLAY'
  | 'SHORTCUT_ACTION'
  | 'VIDEO_EPISODE_CHANGED'
  | 'DETECTED_SUBTITLE_URL'
  | 'DETECTED_SUBTITLES'
  | 'INNERTUBE_FALLBACK_REQUEST'
  | 'FETCH_REQUEST'
  | 'FETCH_RESPONSE';

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
  readonly isAsr?: boolean; // ADR-020: YouTube auto-generated captions
  readonly displayName?: string; // ADR-020: YouTube "English (auto-generated)"
}

/**
 * Result of `findSubtitlesForOverlay`: target + native subtitle matches.
 * Either may be null (partial load when only one language matches).
 * The whole result is null when auto-load is off or both languages are empty.
 */
export interface SubtitlesForOverlayResult {
  readonly target: SubtitleForOverlayResult | null;
  readonly native: SubtitleForOverlayResult | null;
  /** All target-language matches (≥2 only, for dropdown — ADR-014 D3). */
  readonly targetMatches?: readonly SubtitleForOverlayResult[];
  /** All native-language matches (≥2 only, for dropdown — ADR-014 D3). */
  readonly nativeMatches?: readonly SubtitleForOverlayResult[];
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

/**
 * Pushed by background → content-script when subtitles matching the user's
 * target/native overlay languages are detected and auto-load is on.
 * Either `target` or `native` may be null (partial load).
 */
export interface AutoLoadSubtitlesPayload {
  readonly tabId: number;
  readonly target: SubtitleForOverlayResult | null;
  readonly native: SubtitleForOverlayResult | null;
  /**
   * All subtitles matching target language (ADR-014 D3, V2 subtitle selector).
   * Empty when only 1 match (V1 behavior, no dropdown needed).
   * Content-script uses this to render dropdown when ≥2 matches.
   */
  readonly targetMatches?: readonly SubtitleForOverlayResult[];
  /**
   * All subtitles matching native language (ADR-014 D3).
   * Same semantics as targetMatches.
   */
  readonly nativeMatches?: readonly SubtitleForOverlayResult[];
}

/** Content-script → background: re-push AUTO_LOAD_SUBTITLES if already detected
 * (handles race: background pushed before content-script was ready). */
export interface RequestAutoLoadSubtitlesPayload {
  readonly tabId: number;
}

/** Content-script → background: fetch subtitle content (CORS fallback).
 * Background resolves relative URLs from `tabUrl` before fetching. */
export interface FetchSubtitleContentPayload {
  readonly url: string;
  readonly tabUrl?: string;
}

/** Background → content-script: fetched subtitle text (or error). */
export interface FetchSubtitleContentResult {
  readonly content: string;
  readonly finalUrl: string;
}

/** Background → offscreen: delegate a fetch() call (M15 — SW idle eviction safety). */
export interface FetchRequestPayload {
  readonly url: string;
  readonly options?: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly credentials?: RequestCredentials;
  };
}

/** Offscreen → background: fetched response (text body, not ArrayBuffer — subtitle/m3u8 only). */
export interface FetchResponsePayload {
  readonly ok: boolean;
  readonly status: number;
  readonly content: string;
  readonly finalUrl: string;
  readonly error?: string;
}

// === Side Panel messages ===

/** Content-script → background: open the side panel for this tab. */
export interface OpenSidePanelPayload {
  readonly tabId?: number; // background resolves from sender.tab.id
}

/** Content-script → background: close the side panel for this tab. */
export interface CloseSidePanelPayload {
  readonly tabId?: number; // background resolves from sender.tab.id
}

/** Content-script → background → side panel: bilingual cues loaded. */
export interface SubtitleCuesLoadedPayload {
  readonly tabId?: number;
  readonly cues: BilingualCue[];
}

/** Side panel → background: request the last cached cues (panel opened
 *  after cues were already relayed and dropped because panel was closed).
 *  Background responds with the last `SUBTITLE_CUES_LOADED` payload it cached,
 *  or `{ success: true, data: { cues: [] } }` if none cached yet. */
export interface RequestSubtitleCuesPayload {
  readonly tabId?: number;
}

/** Content-script → background → side panel: video time update. */
export interface VideoTimeUpdatePayload {
  readonly tabId?: number;
  readonly currentTimeMs: number;
  readonly durationMs: number;
  /** ADR-019 sync: subtitle offset so side panel highlights the overlay cue. */
  readonly offsetMs?: number;
}

/** Content-script → background → side panel: play/pause state. */
export interface VideoPlayStatePayload {
  readonly tabId?: number;
  readonly isPlaying: boolean;
}

/** Side panel → background → content-script: seek video to time. */
export interface SeekToPayload {
  readonly tabId?: number;
  readonly timeMs: number;
}

/** Side panel → background → content-script: trigger a keyboard shortcut
 *  action (prev-cue / next-cue / replay-cue / toggle-overlay). The side
 *  panel reads the user's configured shortcuts from storage and maps the
 *  pressed key to an action, then sends it here. The content-script
 *  already has the cue-seeking + overlay logic for these actions. */
export interface ShortcutActionPayload {
  readonly tabId?: number;
  readonly action: 'prev-cue' | 'next-cue' | 'replay-cue' | 'toggle-overlay';
}

/** Content-script → background: the active `<video>` element was REPLACED by
 *  a new one in-page (e.g. themoviebox.org swaps the entire `<video>` element
 *  on episode switch — same element for quality switches, verified). This is
 *  the only reliable signal for an in-page episode/movie switch on SPAs that
 *  change the video without reloading the page or updating the tab URL, so
 *  `chrome.tabs.onUpdated` never fires and the background cannot detect it
 *  via the normal navigation lifecycle. The background responds by clearing
 *  the tab's detected media so the new episode starts fresh instead of
 *  accumulating media from the previous episode.
 *
 *  Triggering on element replacement (not `loadedmetadata` duration-diff) is
 *  deliberate: the replacement fires BEFORE the new video's network requests,
 *  so the clear runs before the new episode's media is detected — no race
 *  that would wipe the new media. Quality switches keep the same `<video>`
 *  element (only `src` changes), so they do not trigger a clear and the
 *  subtitle list is preserved.
 *
 *  ponytail: element-replacement heuristic. Ceiling: (1) sites that replace
 *  the `<video>` element on quality switch would spuriously clear; (2) pages
 *  with multiple `<video>` elements (e.g. ad-supported) may clear on the
 *  second element's mount. Upgrade path: combine with video-URL path
 *  heuristic or an explicit episode-click watcher. */
export interface VideoEpisodeChangedPayload {
  readonly tabId?: number; // background resolves from sender.tab.id
}

/** Content-script → background: a subtitle URL was detected by the main-world
 *  fetch interceptor (ADR-011). This fires for subtitle fetches that page
 *  Service Workers serve from cache — `chrome.webRequest` does NOT fire for
 *  cached responses, so the network interceptor misses them. The main-world
 *  fetchInterceptor.iife.ts patches `window.fetch` and posts the URL via
 *  `window.postMessage`; the isolated-world content-script relays it here.
 *  The background runs the URL through `detectSubtitle` (same detector as
 *  webRequest path) and stores it in the network interceptor's subtitle map.
 *
 *  ponytail: only `fetch` is patched (verified themoviebox uses fetch). Ceiling:
 *  sites using XMLHttpRequest for subtitle fetch won't be caught. Upgrade: also
 *  patch XMLHttpRequest.prototype.open/send. */
export interface DetectedSubtitleUrlPayload {
  readonly tabId?: number; // background resolves from sender.tab.id
  readonly url: string;
}

/**
 * YouTube caption tracks detected by the MAIN-world script (ADR-020).
 * The isolated content-script relays this to the background, which maps
 * the raw tracks to `DetectedSubtitle[]` and triggers auto-load.
 */
export interface DetectedSubtitlesPayload {
  readonly tabId?: number; // background resolves from sender.tab.id
  readonly tracks: readonly unknown[]; // YouTubeCaptionTrack[] (untyped at boundary)
  readonly videoId: string;
}

/**
 * InnerTube fallback request — the MAIN-world script cannot fetch with a
 * `User-Agent` override (forbidden header), so it asks the background SW
 * to call InnerTube (ADR-020 Contract 5).
 */
export interface InnertubeFallbackPayload {
  readonly tabId?: number; // background resolves from sender.tab.id
  readonly videoId: string;
  readonly apiKey: string;
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
