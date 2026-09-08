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
import type {
  SubtitleSearchResult,
  SearchError,
  KeyQuotaInfo,
} from '@/features/subtitle/logic/subtitleSearchTypes';
import type { StudyMode, StudyModeAdvancedSettings } from '@/entities/studyMode';

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
  | 'FETCH_SUBTITLE_PAGE_CONTEXT'
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
  | 'FETCH_RESPONSE'
  | 'TRANSLATE'
  | 'CARD_CREATOR_REQUEST'
  | 'FETCH_COMMUNITY_AUDIO'
  | 'FETCH_LOCAL_AUDIO'
  | 'FETCH_IMAGES'
  | 'TTS_SPEAK'
  | 'TTS_FETCH_AUDIO'
  | 'TTS_SPEAK_LOCAL'
  | 'TTS_DOWNLOAD_VOICE'
  | 'TTS_DOWNLOAD_PROGRESS'
  | 'FETCH_MEDIA_URL'
  | 'PRONUNCIATION_ESPEAK_TTS'
  | 'WORD_STATUS_GET'
  | 'WORD_STATUSES_GET'
  | 'WORD_STATUS_SET'
  | 'FREQUENCY_GET'
  | 'QUICK_ADD'
  | 'LOOKUP_REQUEST'
  | 'LOOKUP_RESULT'
  | 'LOOKUP_CANCEL'
  | 'CAPTURE_TAB_SCREENSHOT'
  | 'SUBTITLE_DISCOVERY_SIGNAL'
  | 'SEARCH_SUBTITLES'
  | 'RESOLVE_SUBTITLE_DOWNLOAD'
  | 'GET_KEY_QUOTA'
  // Local Player (spec: local-video-player.md)
  | 'OPEN_LOCAL_PLAYER'
  | 'SAVE_RESUME_POSITION'
  | 'GET_RESUME_POSITION'
  | 'GET_HISTORY'
  | 'SAVE_HISTORY'
  | 'GET_LIBRARY'
  | 'LOCAL_PLAYER_VIDEO_OPENED'
  // OCR (spec: orca-ocr-layer.md)
  | 'OCR_INIT'
  | 'OCR_RECOGNIZE'
  | 'OCR_DISPOSE'
  | 'OCR_GET_STATE'
  | 'OCR_SET_STATE'
  | 'OCR_REGION_COMMAND'
  | 'OPEN_READER'
  // Study Modes (spec media-study-modes.md)
  | 'APPLY_STUDY_MODE'
  // Ocean SRS (spec ocean-language-acquisition-srs.md)
  | 'SRS_ADD_NOTE'
  | 'SRS_GET_DECKS_NOTETYPES'
  | 'SRS_OPEN_STUDY_PAGE'
  // Dictionary resources — proxied to background because IndexedDB is
  // origin-isolated: in-page panels must not touch the page's IDB.
  | 'RESOURCE_LIST'
  | 'RESOURCE_DELETE'
  | 'RESOURCE_REORDER'
  | 'RESOURCE_SET_ENABLED'
  | 'RESOURCE_SET_PROFILES'
  | 'RESOURCE_SAMPLE'
  | 'RESOURCE_FIND'
  | 'RESOURCE_IMPORT_CHUNK'
  | 'RESOURCE_IMPORT_PROGRESS';

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
  /**
   * The request initiator (iframe player origin) — used as `Referer` when
   * fetching the subtitle to pass CDN hotlink protection. See
   * `DetectedSubtitle.initiator` for details.
   */
  readonly initiator?: string;
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

export interface ScannedTrackPayload {
  readonly url: string;
  readonly label: string;
  readonly language: string;
  readonly isDefault: boolean;
}

export interface PageScanResultPayload {
  readonly tabId: number;
  /** frameId of the sender, injected by the background from chrome.runtime sender. */
  readonly frameId?: number;
  readonly videoUrls: string[];
  readonly subtitleUrls: string[];
  readonly trackSubtitles?: ScannedTrackPayload[];
  /**
   * The URL of the frame the content-script is running in
   * (`window.location.href`). Used as the request `initiator` for scanned media
   * so the DNR Referer/Origin rewrite targets the frame origin that owns the
   * `<track>`/`<source>` element — not the extension origin. Origin-checking
   * subtitle CDNs (e.g. `prox.anicore.tv` behind `anikage.cc`) return 403
   * "forbidden origin" without this.
   */
  readonly pageUrl: string;
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
  /** frameId of the requesting frame, injected by the background. */
  readonly frameId?: number;
}

/** Content-script → background: fetch subtitle content (CORS fallback).
 * Background resolves relative URLs from `tabUrl` before fetching.
 * `initiator` (iframe player origin) is used as the `Referer` source to pass
 * CDN hotlink protection — many subtitle CDNs reject the top-level tab URL. */
export interface FetchSubtitleContentPayload {
  readonly url: string;
  readonly tabUrl?: string;
  readonly initiator?: string;
}

/** Background → content-script: fetched subtitle text (or error). */
export interface FetchSubtitleContentResult {
  readonly content: string;
  readonly finalUrl: string;
}

/**
 * Content-script → background: translate text via Google Translate unofficial
 * endpoint (ADR-021 D2). Background SW fetch bypasses CORS. `sl`/`tl` = ISO 639-1
 * source/target language codes. `text` = multi-line joined cues (chunk ≤ 1500 chars).
 */
export interface TranslatePayload {
  readonly tabId: number;
  readonly text: string;
  readonly sl: string;
  readonly tl: string;
}

/** Background → content-script: translated text segments (1 per input line). */
export interface TranslateResult {
  readonly translated: string[];
}

/** Background → offscreen: delegate a fetch() call (M15 — SW idle eviction safety). */
export interface FetchRequestPayload {
  readonly url: string;

  readonly options?: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly credentials?: RequestCredentials;
    /** If 'arraybuffer', offscreen returns content as base64-encoded string. */
    readonly responseType?: 'text' | 'arraybuffer';
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
  readonly action: 'prev-cue' | 'next-cue' | 'replay-cue' | 'toggle-overlay' | 'play-pause';
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
  // The URL of the player frame after the switch. Used by the background to
  // avoid clearing media that a PAGE_SCAN_RESULT already replaced.
  readonly pageUrl?: string;
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
 * Caption tracks detected by the MAIN-world script (ADR-020 YouTube, ADR-028 iQIYI).
 * The isolated content-script relays this to the background, which maps
 * the raw tracks to `DetectedSubtitle[]` and triggers auto-load.
 *
 * `source` discriminates the adapter for the unified `detectionDispatch.ts`
 * handler (ADR-028 — `messageBus.on()` overwrites, so only one handler may
 * register `DETECTED_SUBTITLES`). `source === undefined` is backward-compatible
 * with ADR-020 YouTube posts (treated as 'youtube').
 *
 * `videoId` is YouTube-specific; iQIYI uses `tvid` + `origin` instead.
 */
export interface DetectedSubtitlesPayload {
  readonly tabId?: number; // background resolves from sender.tab.id
  readonly tracks: readonly unknown[]; // YouTubeCaptionTrack[] | IqiyiSubtitleTrack[] | NetflixSubtitleTrack[] (untyped at boundary)
  readonly source?: 'youtube' | 'iqiyi' | 'netflix'; // adapter discriminator (ADR-028 + ADR-029)
  // YouTube (ADR-020)
  readonly videoId?: string;
  // iQIYI (ADR-028)
  readonly tvid?: string;     // dedup key (clone YouTube videoId)
  readonly origin?: string;   // data.dstl — base URL for relative srt path
  // Netflix (ADR-029)
  readonly movieId?: number | string; // dedup key (clone YouTube videoId / iQIYI tvid)
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
  readonly visitorData?: string; // from ytcfg INNERTUBE_CONTEXT.client.visitorData
}

// === Card Creator (AnkiConnect) messages ===

/** AnkiConnect action invoked by Card Creator. Sent content-script → background;
 *  background performs the HTTP fetch to AnkiConnect (host_permissions <all_urls>)
 *  and returns the raw result. */
export interface CardCreatorRequestPayload {
  /** AnkiConnect base URL, e.g. 'http://localhost:8765'. */
  readonly url: string;
  /** AnkiConnect action name, e.g. 'version', 'deckNames', 'addNote'. */
  readonly action: string;
  /** Action params (action-specific). */
  readonly params?: Record<string, unknown>;
  /** Request timeout in ms. Default 10000. */
  readonly timeoutMs?: number;
}

/** Background → content-script: AnkiConnect raw response.
 *  `result` is the raw `result` field from AnkiConnect JSON response (action-specific).
 *  On error, `success` is false and `error` describes the failure. */
export interface CardCreatorResponseData {
  readonly result: unknown;
}

// === Popup Dictionary messages (spec §9.4 B) ===
//
// These ride the MV3 fan-out bus (payload always carries `tabId` on responses).
// The worker dict-match path does NOT use these — it uses the dedicated
// requestId bridge defined in `@/features/dictionaryPopup/types.ts`.

/** Content → background: fetch community audio for a term. */
export interface FetchCommunityAudioPayload {
  readonly tabId?: number; // background resolves from sender.tab.id
  readonly term: string;
  readonly langCode: string;
}

/** Background → content: community audio items. */
export interface FetchCommunityAudioResult {
  readonly audios: readonly unknown[]; // AudioItem[] — typed at consumer via schema
}

/** Content → background: fetch images for a term. */
export interface FetchImagesPayload {
  readonly tabId?: number;
  readonly term: string;
  readonly langCode: string;
}

/** Background → content: image items. */
export interface FetchImagesResult {
  readonly images: readonly unknown[]; // ImageItem[] — typed at consumer via schema
}

/** Content → background: speak text via chrome.tts (system TTS). */
export interface TtsSpeakPayload {
  readonly tabId?: number;
  readonly text: string;
  readonly langCode: string;
  readonly rate?: number;
  readonly pitch?: number;
  readonly voiceName?: string;
}

/** Content → background: fetch TTS audio as a data URL (Google Translate TTS). */
export interface TtsFetchAudioPayload {
  readonly tabId?: number;
  readonly text: string;
  readonly langCode: string;
}

/** Background → content: TTS audio result. */
export interface TtsFetchAudioResponse {
  readonly url: string;
}

/** Content → background: fetch a media URL (image/audio) as a data URL.
 *  Used when the content script can't fetch directly due to page CSP. */
export interface FetchMediaUrlPayload {
  readonly tabId?: number;
  readonly url: string;
  readonly kind: 'image' | 'audio';
}

/** Background → content: media fetch result (data URL). */
export interface FetchMediaUrlResponse {
  readonly url: string;
}

/** Content → background → offscreen: synthesize eSpeak TTS audio. */
export interface PronunciationEspeakTtsPayload {
  readonly text: string;
  readonly langCode: string;
}

/** Offscreen → background → content: eSpeak TTS result. */
export interface PronunciationEspeakTtsResult {
  readonly audioBytes: Uint8Array;
}

/** Content → background: get word status. */
export interface WordStatusGetPayload {
  readonly tabId?: number;
  readonly term: string;
  readonly langCode: string;
}

/** Background → content: word status result. */
export interface WordStatusResult {
  readonly term: string;
  readonly langCode: string;
  readonly status: 'unknown' | 'known' | 'tracking' | 'ignore';
}

/** Content → background: set word status. */
export interface WordStatusSetPayload {
  readonly tabId?: number;
  readonly term: string;
  readonly langCode: string;
  readonly status: 'unknown' | 'known' | 'tracking' | 'ignore';
}

/** Content → background: Quick Add to Anki. */
export interface QuickAddPayload {
  readonly tabId?: number;
  // Payload shape defined in @/features/dictionaryPopup/types.ts QuickAddPayload;
  // kept as unknown at the MV3 boundary — consumer validates via QuickAddPayloadSchema.
  readonly payload: unknown;
}

/** Background → content: Quick Add result. */
export interface QuickAddResult {
  readonly ok: boolean;
  readonly noteId?: number;
  readonly error?: string;
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

// === Subtitle Search messages (spec subtitle-search.md) ===

/** Content-script → background: search subtitles from external providers. */
export interface SearchSubtitlesPayload {
  readonly query: string;
  readonly languages: readonly string[];
  readonly season?: number;
  readonly episode?: number;
}

/** Background → content-script: search results or error. */
export interface SearchSubtitlesResult {
  readonly results?: SubtitleSearchResult[];
  readonly error?: SearchError;
}

/** Content-script → background: resolve download for a search result. */
export interface ResolveSubtitleDownloadPayload {
  readonly result: SubtitleSearchResult;
  readonly role: 'target' | 'native';
}

/** Background → content-script: downloaded subtitle content or error. */
export interface ResolveSubtitleDownloadResult {
  readonly content?: string;
  readonly format?: 'srt' | 'vtt' | 'ass';
  readonly error?: SearchError;
}

/** Content-script → background: get key quota info for UI display. */
export interface GetKeyQuotaPayload {
  readonly provider?: 'subdl' | 'opensubtitles';
}

/** Background → content-script: key quota info. */
export interface GetKeyQuotaResult {
  readonly quotas: KeyQuotaInfo[];
}

// === Local Player messages (spec: local-video-player.md) ===
//
// Player page ↔ background service worker. The player page is a standalone
// extension page (src/entrypoints/local-player) that uses the background as a
// persistence/coordination layer for IndexedDB library + history + resume.

/** Popup/background → background: open the local player page.
 *  Background calls chrome.tabs.create with the player HTML. `videoId` is
 *  optional — when present, the player opens straight to that video. */
export interface OpenLocalPlayerPayload {
  readonly videoId?: string;
}

/** Background: open the Reader page. `bookId` optional — when present, open that book. */
export interface OpenReaderPayload {
  readonly bookId?: string;
}

/** Player → background: save current playback position for resume.
 *  Spec: `{ videoId, timeMs, durationMs }` → `{ success }`. */
export interface SaveResumePositionPayload {
  readonly videoId: string;
  readonly timeMs: number;
  readonly durationMs: number;
}

/** Player → background: retrieve saved resume position for a video. */
export interface GetResumePositionPayload {
  readonly videoId: string;
}

/** Background → player: saved resume position (all null if never watched). */
export interface GetResumePositionResult {
  readonly resumePositionMs: number | null;
  readonly durationMs: number | null;
  readonly lastWatchedAt: number | null;
}

/** Player → background: get watch history list (sorted by watchedAt desc). */
export interface GetHistoryPayload {
  readonly limit?: number;
}

/** Background → player: history entries.
 *  `history` is `HistoryEntry[]` — typed at consumer via
 *  mediaLibraryRepository (T9); kept as `unknown[]` at the MV3 message
 *  boundary, same convention as FetchCommunityAudioResult. */
export interface GetHistoryResult {
  readonly history: readonly unknown[];
}

/** Player → background: save a history entry.
 *  Spec history schema: `{ id, videoId, watchedAt, durationWatchedMs }`. */
export interface SaveHistoryPayload {
  readonly videoId: string;
  readonly watchedAt: number;
  readonly durationWatchedMs: number;
}

/** Player → background: get all library videos.
 *  Spec: `{ sortBy? }` → `{ videos: VideoMeta[] }`. */
export interface GetLibraryPayload {
  readonly sortBy?: 'recent' | 'title' | 'added';
}

/** Background → player: library videos.
 *  `videos` is `VideoMeta[]` — typed at consumer via
 *  mediaLibraryRepository (T9); kept as `unknown[]` at the MV3 message
 *  boundary, same convention as FetchImagesResult. */
export interface GetLibraryResult {
  readonly videos: readonly unknown[];
}

/** Player → background: notify that a video was opened (for history/tracking).
 *  Background upserts the library entry + records a history open event. */
export interface LocalPlayerVideoOpenedPayload {
  readonly videoId: string;
  readonly filename: string;
  readonly title: string;
  readonly durationMs: number;
}

// === Study Modes messages (spec media-study-modes.md) ===

/** Panel → content/background: apply active study mode to the current player. */
export interface ApplyStudyModePayload {
  readonly activeMode: StudyMode;
  readonly advanced: StudyModeAdvancedSettings;
}

// === Ocean SRS messages (spec ocean-language-acquisition-srs.md) ===

/** Content/dictionary → background → srs-study: create a note + 3-component card. */
export interface SrsAddNotePayload {
  /** Target language, used to find or auto-create the collection. */
  readonly targetLanguage: string;
  /** Optional collection id; if omitted, defaults to the active collection for targetLanguage. */
  readonly collectionId?: string;
  /** Optional deck id; if omitted, defaults to the collection's default deck. */
  readonly deckId?: string;
  /** Canonical target word/phrase. */
  readonly targetWord: string;
  /** Notetype id; if omitted, defaults to the collection's default notetype. */
  readonly notetypeId?: string;
  /** Field values keyed by field id. */
  readonly fields: Record<string, import('@/entities/srs/types').SrsFieldValue>;
}

/** Background → caller: result of SRS_ADD_NOTE. */
export interface SrsAddNoteResult {
  readonly noteId: string;
  readonly cardId: string;
}

/** Content/dictionary → background: open the srs-study page in a new tab. */
export interface SrsOpenStudyPagePayload {
  /** Optional deck id to scope the study session. */
  readonly deckId?: string;
}

/** Background → srs-study: list decks and notetypes for a collection. */
export interface SrsGetDecksNotetypesPayload {
  readonly collectionId: string;
}

/** Background → caller: decks and notetypes. */
export interface SrsGetDecksNotetypesResult {
  readonly decks: readonly { id: string; name: string }[];
  readonly notetypes: readonly { id: string; name: string }[];
}
