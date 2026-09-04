import { parseM3u8 } from '@/shared/lib/parsers/m3u8Parser';
import { convertAssToSrt } from '@/shared/lib/parsers/assToSrt';
import { convertVttToSrt } from '@/shared/lib/parsers/vttToSrt';
import { convertTtmlToSrt } from '@/shared/lib/parsers/ttmlToSrt';
import { normalizeSrt } from '@/shared/lib/parsers/srtNormalizer';
import { generateFileName, resolveFilenameBase, buildSubtitleFileName } from '@/shared/utils/fileUtils';
import type {
  ByteRange,
  DetectedVideo,
  DetectedSubtitle,
  DownloadProgress,
  HlsEncryption,
  M3u8Playlist,
  SegmentRange,
  TsSegment,
} from '@/entities/media';
import {
  MAX_RETRY,
  SEGMENT_TIMEOUT_MS,
  MAX_CONVERT_BYTES,
  DEFAULT_SEGMENT_CONCURRENCY,
  MIN_SEGMENT_CONCURRENCY,
  MAX_SEGMENT_CONCURRENCY,
} from '@/shared/config/config';
import type { ConvertToMp4Mode, FilenameSource } from '@/entities/media';
import {
  ensureDownloadSubdir,
  createOpfsWriter,
  readFile as opfsReadFile,
  deleteDownloadSubdir,
  isOpfsAvailable,
  isQuotaExceededError,
  writeJsonFile,
} from '@/shared/lib/storage/opfsStorage';
import { download as chromeDownload, searchDownloads } from '@/shared/lib/chrome-apis/downloads';
import { setRefererRule, removeRefererRule } from '@/shared/lib/chrome-apis/declarativeNetRequest';

/**
 * Callback invoked with progress updates during a download.
 */
export type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Result of a conversion: the converted file is in OPFS, identified by name.
 * The caller reads it from the same OPFS directory.
 */
export interface ConvertResult {
  readonly outputName: string;
  readonly mimeType: string;
}

/**
 * Callback invoked to convert a `.ts` file (stored in OPFS) into the final
 * container format (e.g. mp4 via mux.js transmuxer in the offscreen document).
 *
 * The callback receives the OPFS directory handle (so it can read `input.ts`)
 * and the download id. It writes the converted file into the same directory
 * and returns its name + mime type. If conversion fails, it should throw — the
 * downloader will fall back to saving the `.ts` file.
 */
export type ConvertCallback = (
  dirHandle: FileSystemDirectoryHandle,
  downloadId: string,
) => Promise<ConvertResult>;

/**
 * Callback invoked to save an OPFS file (already written by the download or
 * convert phase) to the user's Downloads folder via `chrome.downloads.download`.
 *
 * This indirection exists because:
 *  - MV3 service workers cannot use `URL.createObjectURL` (per MDN, it is
 *    unavailable in Service Workers), so a Blob URL must be created in the
 *    offscreen document.
 *  - We must NOT materialize a 430MB file into a `data:` URL or an
 *    `ArrayBuffer` in the service worker — that creates a ~1.4GB memory spike.
 *
 * The callback receives only identifiers (downloadId + OPFS filename) plus the
 * final download filename and mime type. The implementor reads the file from
 * OPFS directly (in the offscreen document) and creates a Blob URL there.
 */
export type SaveOpfsFileCallback = (
  downloadId: string,
  opfsFilename: string,
  downloadFilename: string,
  mimeType: string,
) => Promise<void>;

/**
 * Build request headers that match the browser's page context.
 *
 * Many streaming CDNs return 403 when the video URL is fetched without the
 * same `Referer` and `Origin` as the page that loaded the player. This helper
 * derives both headers from the original tab URL so the extension's fetch
 * requests look like they came from the browser tab.
 *
 * @param tabUrl - URL of the tab where the media was detected
 * @returns Headers object with `Referer` and `Origin`, or `undefined` if tabUrl is missing/invalid
 */
export function buildFetchHeaders(tabUrl?: string): Record<string, string> | undefined {
  if (!tabUrl) return undefined;
  try {
    const origin = new URL(tabUrl).origin;
    return {
      Referer: tabUrl,
      Origin: origin,
    };
  } catch {
    return undefined;
  }
}

/**
 * Parse an IV hex string (e.g. "0x1234567890ABCDEF...") into a 16-byte Uint8Array.
 * The "0x" prefix is stripped if present. The hex string must be exactly 32 chars
 * (16 bytes) after stripping the prefix.
 */
function parseIvFromHex(ivHex: string): Uint8Array {
  const hex = ivHex.startsWith('0x') || ivHex.startsWith('0X')
    ? ivHex.slice(2)
    : ivHex;
  if (hex.length !== 32) {
    throw new Error(
      `AES-128 IV must be 16 bytes (32 hex chars), got ${hex.length} chars`,
    );
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Derive a 16-byte IV from a segment sequence number per RFC 8216 §4.3.2.4.
 * The sequence number is placed in the rightmost (least significant) bytes
 * of a 16-byte big-endian integer, with all preceding bytes set to zero.
 */
function deriveIvFromSequence(sequence: number): Uint8Array {
  const bytes = new Uint8Array(16);
  // Write sequence as big-endian in the last 8 bytes (safe for sequences < 2^53)
  const view = new DataView(bytes.buffer);
  view.setUint32(12, Math.floor(sequence / 0x100000000));
  view.setUint32(8, sequence >>> 0);
  return bytes;
}

/**
 * Orchestrates downloading a video or subtitle: fetch segments → merge →
 * ffmpeg convert (optional) → chrome.downloads.
 */
export class Downloader {
  private progressCallback: ProgressCallback | null = null;
  private convertCallback: ConvertCallback | null = null;
  private saveOpfsFileCallback: SaveOpfsFileCallback | null = null;
  private cancelledIds: Set<string> = new Set();
  private convertMode: ConvertToMp4Mode = 'always';
  /**
   * Current filename source mode. Updated via `setFilenameSource()` when the
   * user changes settings. Controls whether downloads use the detected title,
   * a beautified URL base name, or title-with-URL-fallback.
   */
  private filenameSource: FilenameSource = 'title-fallback';
  /**
   * Number of segments to fetch in parallel during M3U8 downloads.
   * Configurable via settings; defaults to DEFAULT_SEGMENT_CONCURRENCY.
   */
  private segmentConcurrency: number = DEFAULT_SEGMENT_CONCURRENCY;
  /**
   * Segment byte ranges for the most recent download. Keyed by downloadId.
   * Used by the parallel conversion engine to split `input.ts` at safe
   * segment boundaries. Populated during `downloadM3u8Streaming`.
   */
  private readonly segmentRangesMap = new Map<string, SegmentRange[]>();
  /**
   * Cache for AES-128 decryption keys, keyed by key URI.
   * Avoids re-fetching the same key for every segment in an encrypted stream.
   */
  private readonly keyCache = new Map<string, CryptoKey>();

  /**
   * The filename the next extension-initiated download should use.
   *
   * Edge (and some Chrome versions) ignore the `filename` parameter of
   * `chrome.downloads.download` when the URL is a `data:` URL — there is no
   * Content-Disposition header and no URL path to derive a name from, so the
   * browser falls back to the generic name "download" with no extension.
   * `chrome.downloads.onDeterminingFilename` is the only way to force the
   * filename in that case (see Chrome docs:
   * https://developer.chrome.com/docs/extensions/reference/api/downloads#event-onDeterminingFilename).
   *
   * `saveBlob` sets this before calling `chrome.downloads.download`; the
   * background service worker registers a single `onDeterminingFilename`
   * listener that reads it and calls `suggest({ filename })` for downloads
   * initiated by this extension. The field is cleared after the download
   * starts so subsequent non-extension downloads are unaffected.
   */
  private pendingFilename: string | null = null;

  /** Get the pending filename (used by the onDeterminingFilename listener). */
  getPendingFilename(): string | null {
    return this.pendingFilename;
  }

  /** Clear the pending filename (called by the listener after suggesting). */
  clearPendingFilename(): void {
    this.pendingFilename = null;
  }

  constructor() {}

  /** Set the progress callback invoked during download. */
  onProgress(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  /** Set the convert callback used for offscreen ffmpeg ts→mp4 conversion. */
  setConvertCallback(callback: ConvertCallback): void {
    this.convertCallback = callback;
  }

  /**
   * Set the callback used to save an OPFS file to the user's Downloads folder
   * without materializing it into a `data:` URL or `ArrayBuffer` in the
   * service worker. Required for large M3U8 downloads; if unset, the
   * downloader falls back to `saveBlob` (data URL) which is only safe for
   * small files.
   */
  setSaveOpfsFileCallback(callback: SaveOpfsFileCallback): void {
    this.saveOpfsFileCallback = callback;
  }

  /** Set the conversion mode (always / small-only / never). */
  setConvertMode(mode: ConvertToMp4Mode): void {
    this.convertMode = mode;
  }

  /** Set the filename source mode (title-fallback / title-only / url-only). */
  setFilenameSource(mode: FilenameSource): void {
    this.filenameSource = mode;
  }

  /**
   * Set the number of segments to fetch in parallel during M3U8 downloads.
   * Clamped to [MIN_SEGMENT_CONCURRENCY, MAX_SEGMENT_CONCURRENCY].
   */
  setSegmentConcurrency(count: number): void {
    this.segmentConcurrency = Math.max(
      MIN_SEGMENT_CONCURRENCY,
      Math.min(MAX_SEGMENT_CONCURRENCY, count || DEFAULT_SEGMENT_CONCURRENCY),
    );
  }

  /**
   * Get the segment byte ranges recorded during the most recent download
   * for the given downloadId. Returns an empty array if no ranges were
   * recorded (e.g. non-M3U8 download or download not yet started).
   */
  getSegmentRanges(downloadId: string): SegmentRange[] {
    return this.segmentRangesMap.get(downloadId) ?? [];
  }

  /**
   * Download a video.
   *
   * For m3u8: parse playlist → fetch all .ts segments → merge → convert to
   * mp4 (if convertCallback set) → save. For mp4: fetch directly → save.
   */
  async downloadVideo(video: DetectedVideo, downloadId: string): Promise<void> {
    this.throwIfCancelled(downloadId);

    if (video.format === 'm3u8') {
      await this.downloadM3u8Video(video, downloadId);
    } else if (video.format === 'mp4') {
      await this.downloadMp4Video(video, downloadId);
    } else {
      throw new Error(`Unsupported video format: ${video.format}`);
    }
  }

  /**
   * Download a subtitle. Fetch → convert (ass/vtt → srt) → save as .srt.
   *
   * When `videoTitle` and `videoTabUrl` are provided (linked from the
   * detected video via `subtitle.videoId`), the subtitle filename uses the
   * same base name as the video — e.g. `See_You_at_Work_Tomorrow!.en.srt`.
   * When no video is linked, falls back to the subtitle's own URL base name
   * (e.g. `sub.en.srt`). The language tag is appended as a suffix before the
   * extension (VLC/community convention for auto-loading).
   */
  async downloadSubtitle(
    subtitle: DetectedSubtitle,
    downloadId: string,
    videoContext?: { videoTitle?: string; videoTabUrl?: string },
  ): Promise<void> {
    this.throwIfCancelled(downloadId);
    this.reportProgress(downloadId, 'downloading', 0);

    // Prefer the request `initiator` (iframe player origin) as the Referer —
    // many subtitle CDNs (e.g. lostproject.club behind megaplay.buzz) reject
    // the top-level tab URL and return 403. Fall back to the linked video's
    // tabUrl (top-level page) when initiator is unavailable.
    //
    // `fetch()` from the extension SW cannot set `Referer` (forbidden header —
    // browser strips it). We register a `declarativeNetRequest` dynamic rule
    // scoped to this exact URL + extension origin so the browser rewrites
    // `Referer` before the request leaves the network stack. The rule is
    // removed after the fetch completes (success or failure).
    const refererSource = subtitle.initiator ?? videoContext?.videoTabUrl;
    let ruleId: number | undefined;
    if (refererSource) {
      try {
        ruleId = await setRefererRule(subtitle.url, refererSource);
      } catch (err) {
        console.warn('[downloadSubtitle] setRefererRule failed, proceeding without DNR rule:', err);
      }
    }

    let response: Response;
    try {
      response = await fetch(subtitle.url, { credentials: 'same-origin' });
    } finally {
      if (ruleId !== undefined) {
        void removeRefererRule(ruleId).catch(() => {});
      }
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch subtitle: ${response.status}`);
    }
    const content = await response.text();

    this.throwIfCancelled(downloadId);
    this.reportProgress(downloadId, 'converting', 50);

    let srtContent: string;
    if (subtitle.format === 'ass') {
      srtContent = convertAssToSrt(content);
    } else if (subtitle.format === 'vtt') {
      srtContent = convertVttToSrt(content);
    } else if (subtitle.format === 'ttml') {
      // ADR-029: Netflix serves IMSC1.1 TTML. convertTtmlToSrt is regex-based
      // (no DOMParser) so it works in the service worker where this runs.
      srtContent = convertTtmlToSrt(content);
    } else if (subtitle.format === 'srt') {
      srtContent = content;
    } else {
      throw new Error(`Unsupported subtitle format: ${subtitle.format}`);
    }

    // Always normalize the final output to clean, standard-compliant SRT —
    // regardless of source format. This catches non-standard SRT from
    // servers (VTT tags in .srt, dot timestamps, missing sequence numbers,
    // WEBVTT header in .srt, etc.) and also guards against any tags that
    // slip through the upstream converters.
    srtContent = normalizeSrt(srtContent);

    this.throwIfCancelled(downloadId);

    const blob = new Blob([srtContent], { type: 'application/x-subrip' });
    // Resolve the base name: use the linked video's title/URL when available
    // (same mechanism as video downloads), otherwise fall back to the
    // subtitle's own URL.
    const base = videoContext?.videoTabUrl
      ? resolveFilenameBase(
          this.filenameSource,
          videoContext.videoTitle,
          videoContext.videoTabUrl,
        )
      : resolveFilenameBase(this.filenameSource, undefined, subtitle.url);
    const filename = buildSubtitleFileName(base, subtitle.language, 'srt');
    await this.saveBlob(blob, filename);

    this.reportProgress(downloadId, 'done', 100);
  }

  /** Cancel a download by id. Subsequent steps for that id will throw. */
  cancel(downloadId: string): void {
    this.cancelledIds.add(downloadId);
    // Best-effort OPFS cleanup for the cancelled download.
    void deleteDownloadSubdir(downloadId).catch((err: unknown) => {
      console.warn(`[downloader] OPFS cleanup on cancel failed for ${downloadId}:`, err);
    });
  }

  /**
   * Pause a download by id. Adds the id to `cancelledIds` so the current
   * fetch/convert loop throws and stops. The queue will set the item's status
   * to 'paused'. To resume, call `resume()` which clears the cancel flag and
   * lets the queue re-queue the item (it will restart from the beginning).
   */
  pause(downloadId: string): void {
    this.cancelledIds.add(downloadId);
  }

  /**
   * Resume a paused download. Clears the cancel flag so the downloader can
   * process the item again. The queue's `resume()` method re-queues the item,
   * which triggers a fresh download from segment 0.
   */
  resume(downloadId: string): void {
    this.cancelledIds.delete(downloadId);
  }

  /**
   * Retry a failed download. Clears the cancel flag (in case it was set by a
   * prior cancel/pause) and cleans up any partial OPFS files so the retry
   * starts fresh. The queue's `retry()` method resets the item state and
   * re-queues it.
   */
  retry(downloadId: string): void {
    this.cancelledIds.delete(downloadId);
    // Best-effort OPFS cleanup for the failed download's partial files.
    void deleteDownloadSubdir(downloadId).catch((err: unknown) => {
      console.warn(`[downloader] OPFS cleanup on retry failed for ${downloadId}:`, err);
    });
  }

  /**
   * Fetch a single segment with retry and timeout.
   *
   * Retries up to MAX_RETRY times on network/abort error. Each attempt is
   * aborted after SEGMENT_TIMEOUT_MS.
   */
  async fetchSegment(url: string, tabUrl?: string): Promise<Blob> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SEGMENT_TIMEOUT_MS);
      try {
        // Use `credentials: 'same-origin'` for ALL cross-origin CDN fetches.
        // Most CDNs return `Access-Control-Allow-Origin: *` without
        // `Access-Control-Allow-Credentials: true` — using `'include'` would
        // cause the browser to BLOCK the response (CORS policy violation).
        // CDN auth is typically via Referer/signed-URL, not cookies.
        //
        // Add Referer/Origin headers from the source tab to avoid 403 hotlink
        // protection on some CDNs.
        const response = await fetch(url, {
          signal: controller.signal,
          credentials: 'same-origin',
          headers: buildFetchHeaders(tabUrl),
        });
        if (!response.ok) {
          throw new Error(`Segment fetch failed: ${response.status}`);
        }
        const blob = await response.blob();
        if (blob.size === 0) {
          throw new Error('Segment response was empty');
        }
        return blob;
      } catch (err: unknown) {
        lastError = err;
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Failed to fetch segment');
  }

  /**
   * Fetch an AES-128 decryption key from the URI specified in `#EXT-X-KEY`.
   * The key is a 16-byte raw ArrayBuffer. Uses the same headers as the
   * playlist fetch (Referer/Origin) to pass hotlink protection on key CDNs.
   *
   * Results are cached per `cacheKey` (typically the keyUri) to avoid
   * re-fetching the same key for every segment.
   */
  async fetchKey(
    keyUri: string,
    tabUrl?: string,
    cacheKey?: string,
  ): Promise<CryptoKey> {
    const cacheMap = this.keyCache;
    const ck = cacheKey ?? keyUri;
    const cached = cacheMap.get(ck);
    if (cached) return cached;

    const response = await fetch(keyUri, {
      credentials: 'same-origin',
      headers: buildFetchHeaders(tabUrl),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch AES-128 key: ${response.status}`);
    }
    const keyBuffer = await response.arrayBuffer();
    if (keyBuffer.byteLength !== 16) {
      throw new Error(
        `AES-128 key must be 16 bytes, got ${keyBuffer.byteLength}`,
      );
    }
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-CBC' },
      false,
      ['decrypt'],
    );
    cacheMap.set(ck, cryptoKey);
    return cryptoKey;
  }

  /**
   * Decrypt an AES-128-CBC encrypted segment blob.
   *
   * IV handling:
   * - If `encryption.iv` is present, parse it as a hex string → 16-byte Uint8Array.
   * - If absent, derive from segment sequence number (16-byte big-endian per RFC 8216 §4.3.2.4).
   *
   * @returns Decrypted Blob (video/mp2t)
   */
  async decryptSegment(
    encryptedBlob: Blob,
    key: CryptoKey,
    encryption: HlsEncryption,
    sequence?: number,
  ): Promise<Blob> {
    const encryptedData = new Uint8Array(await encryptedBlob.arrayBuffer());

    let iv: Uint8Array;
    if (encryption.iv) {
      iv = parseIvFromHex(encryption.iv);
    } else {
      iv = deriveIvFromSequence(sequence ?? 0);
    }

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: iv as BufferSource },
      key,
      encryptedData,
    );

    return new Blob([decryptedBuffer], { type: 'video/mp2t' });
  }

  /**
   * Fetch a segment with optional byte-range support.
   *
   * When `byteRange` is provided, adds a `Range: bytes=start-end` header.
   * Accepts both 206 (Partial Content) and 200 (full content) responses.
   */
  async fetchSegmentWithRange(
    url: string,
    tabUrl: string | undefined,
    byteRange?: ByteRange,
  ): Promise<Blob> {
    if (!byteRange) {
      return this.fetchSegment(url, tabUrl);
    }

    const start = byteRange.offset ?? 0;
    const end = start + byteRange.length - 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEGMENT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: 'same-origin',
        headers: {
          ...buildFetchHeaders(tabUrl),
          Range: `bytes=${start}-${end}`,
        },
      });
      if (!response.ok && response.status !== 206) {
        throw new Error(`Byte-range fetch failed: ${response.status}`);
      }
      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Byte-range response was empty');
      }
      return blob;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Fetch all .ts segments from an m3u8 media playlist.
   *
   * Calls `onSegmentProgress(current, total)` after each segment is fetched.
   */
  async fetchAllSegments(
    playlistUrl: string,
    onSegmentProgress: (current: number, total: number) => void,
    tabUrl?: string,
  ): Promise<Blob[]> {
    const response = await fetch(playlistUrl, {
      credentials: 'same-origin',
      headers: buildFetchHeaders(tabUrl),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch playlist: ${response.status}`);
    }
    const content = await response.text();
    const playlist = parseM3u8(content, playlistUrl);

    const segments = playlist.segments;
    const blobs: Blob[] = [];
    for (let i = 0; i < segments.length; i++) {
      const blob = await this.fetchSegment(segments[i].url, tabUrl);
      blobs.push(blob);
      onSegmentProgress(i + 1, segments.length);
    }
    return blobs;
  }

  /**
   * Save a Blob via chrome.downloads.download.
   *
   * NOTE: In Manifest V3 the background runs as a service worker, where
   * `URL.createObjectURL` is unavailable. We therefore convert the blob to a
   * base64 `data:` URL (using `btoa`, which IS available in service workers)
   * and hand that to chrome.downloads.download.
   */
  async saveBlob(blob: Blob, filename: string): Promise<void> {
    const url = await blobToDataUrl(blob);
    // Set pendingFilename BEFORE calling chrome.downloads.download so the
    // onDeterminingFilename listener (registered in background init) can
    // force Edge to use it. Edge ignores the `filename` param for data: URLs.
    this.pendingFilename = filename;
    try {
      const downloadId = await chromeDownload({
        url,
        filename,
        saveAs: false,
      });
      // Verify what filename Edge actually used.
      searchDownloads({ id: downloadId }).catch((err) =>
        console.warn('[downloader] Failed to verify download filename:', err),
      );
    } catch (err) {
      this.pendingFilename = null;
      console.error(`[downloader] saveBlob FAILED for filename="${filename}":`, err);
      throw err;
    }
  }

  // --- internals ---

  private async downloadMp4Video(
    video: DetectedVideo,
    downloadId: string,
  ): Promise<void> {
    this.reportProgress(downloadId, 'downloading', 0);

    const response = await fetch(video.url, {
      credentials: 'same-origin',
      headers: buildFetchHeaders(video.tabUrl),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status}`);
    }
    const blob = await response.blob();

    this.throwIfCancelled(downloadId);
    this.reportProgress(downloadId, 'converting', 50);

    const filename = generateFileName(
      resolveFilenameBase(this.filenameSource, video.title, video.tabUrl || video.url),
      'mp4',
    );
    await this.saveBlob(blob, filename);

    this.throwIfCancelled(downloadId);
    this.reportProgress(downloadId, 'done', 100);
  }

  private async downloadM3u8Video(
    video: DetectedVideo,
    downloadId: string,
  ): Promise<void> {
    this.reportProgress(downloadId, 'downloading', 0);

    const videoHeaders = buildFetchHeaders(video.tabUrl);

    // Fetch + parse the (possibly master) playlist.
    const response = await fetch(video.url, {
      credentials: 'same-origin',
      headers: videoHeaders,
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch playlist: ${response.status}`);
    }
    let content = await response.text();
    let playlist = parseM3u8(content, video.url);

    // If master playlist, pick the first variant (highest quality) and parse it.
    // Handle nested master playlists (master → master → media) with max depth 3.
    const MAX_MASTER_DEPTH = 3;
    let masterDepth = 0;
    while (playlist.isMasterPlaylist && masterDepth < MAX_MASTER_DEPTH) {
      if (playlist.variants.length === 0) {
        throw new Error('Master playlist has no variants');
      }
      const variantUrl = playlist.variants[0].url;
      this.throwIfCancelled(downloadId);
      const variantResponse = await fetch(variantUrl, {
        credentials: 'same-origin',
        headers: videoHeaders,
      });
      if (!variantResponse.ok) {
        throw new Error(`Failed to fetch variant playlist: ${variantResponse.status}`);
      }
      content = await variantResponse.text();
      playlist = parseM3u8(content, variantUrl);
      masterDepth++;
    }
    if (playlist.isMasterPlaylist) {
      throw new Error(`Nested playlist depth exceeded (${MAX_MASTER_DEPTH}) — unable to find media playlist`);
    }

    // Guard: if no segments were found, the playlist may be invalid or the
    // server returned an error page (e.g. HTML instead of m3u8). Abort early
    // instead of saving a 0-byte file.
    if (playlist.segments.length === 0) {
      throw new Error(
        'No segments found in playlist — the URL may be expired or invalid',
      );
    }

    this.throwIfCancelled(downloadId);

    const opfsAvailable = isOpfsAvailable();

    if (opfsAvailable) {
      await this.downloadM3u8Streaming(video, downloadId, playlist);
    } else {
      // Fallback: legacy in-memory flow for browsers without OPFS.
      await this.downloadM3u8Legacy(video, downloadId, playlist.segments);
    }
  }

  /**
   * Streaming download: fetch each segment and append it to OPFS `input.ts`,
   * keeping only ~1 segment in memory. Then attempt conversion (best-effort)
   * and save the result. If conversion fails, the `.ts` backup is saved.
   */
  private async downloadM3u8Streaming(
    video: DetectedVideo,
    downloadId: string,
    playlist: M3u8Playlist,
  ): Promise<void> {
    const segments = playlist.segments;
    const dirHandle = await ensureDownloadSubdir(downloadId);
    let totalBytes = 0;
    const segmentRanges: SegmentRange[] = [];

    // --- AES-128 decryption setup ---
    // If the playlist is encrypted, fetch the key once before the segment loop.
    // Each segment will be decrypted after fetch and before OPFS write.
    let aesKey: CryptoKey | undefined;
    if (playlist.encryption && playlist.encryption.method === 'AES-128') {
      this.throwIfCancelled(downloadId);
      aesKey = await this.fetchKey(
        playlist.encryption.keyUri,
        video.tabUrl,
        downloadId,
      );
    }

    // --- fMP4 / CMAF setup ---
    // If the playlist has an init segment (#EXT-X-MAP), fetch it and write it
    // to OPFS first. The .m4s segments are concatenated after the init segment
    // to produce a valid fragmented MP4 file — no transmuxing needed.
    const isFmp4 = !!playlist.initSegment;
    const opfsFilename = isFmp4 ? 'input.mp4' : 'input.ts';
    const outputMimeType = isFmp4 ? 'video/mp4' : 'video/mp2t';

    if (isFmp4 && playlist.initSegment) {
      this.throwIfCancelled(downloadId);
      const initBlob = await this.fetchSegmentWithRange(
        playlist.initSegment.uri,
        video.tabUrl,
        playlist.initSegment.byteRange,
      );
      // Write init segment to OPFS first (before any .m4s segments)
      const initWriter = await createOpfsWriter(dirHandle, opfsFilename);
      try {
        await initWriter.write(initBlob);
        totalBytes += initBlob.size;
      } finally {
        await initWriter.close();
      }
    }

    // Phase 1: Fetch segments in parallel batches, write sequentially to OPFS
    // via a single open writable stream (0–80%).
    //
    // - Fetch: `DEFAULT_SEGMENT_CONCURRENCY` segments are fetched concurrently
    //   via `Promise.all` to utilize network bandwidth.
    // - Write: segments are written to OPFS in original playlist order to
    //   preserve the MPEG-TS stream. Writing is sequential because the single
    //   writable stream is not safe for concurrent writes.
    // - The writable stream is opened once and closed once, avoiding the
    //   per-segment open/seek/write/close overhead of `appendChunk()`.
    // Filter out ad segments using discontinuity-based ad break detection.
    // #EXT-X-DISCONTINUITY separates sections. Even sections (0, 2, 4...) are
    // content; odd sections (1, 3, 5...) are ad breaks. A segment with
    // `discontinuity: true` starts a new section.
    let sectionIndex = 0;
    const contentSegments = segments.filter((s) => {
      if (s.discontinuity) sectionIndex++;
      return sectionIndex % 2 === 0;
    });
    if (contentSegments.length === 0) {
      throw new Error('All segments are in ad breaks — no content to download');
    }
    const effectiveTotal = contentSegments.length;

    const writer = await createOpfsWriter(dirHandle, opfsFilename);
    try {
      for (let start = 0; start < effectiveTotal; start += this.segmentConcurrency) {
        this.throwIfCancelled(downloadId);

        const batch = contentSegments.slice(start, start + this.segmentConcurrency);

        const blobs = await Promise.all(
          batch.map((segment) =>
            this.fetchSegmentWithRange(segment.url, video.tabUrl, segment.byteRange),
          ),
        );

        // Write in original playlist order.
        for (let j = 0; j < blobs.length; j++) {
          this.throwIfCancelled(downloadId);
          let blob = blobs[j];
          const segmentIndex = start + j;

          // Decrypt if AES-128 encryption is active.
          if (aesKey && playlist.encryption) {
            blob = await this.decryptSegment(
              blob,
              aesKey,
              playlist.encryption,
              segmentIndex,
            );
            if (blob.size === 0) {
              throw new Error('Decrypted segment was empty');
            }
          }

          const segmentStartByte = totalBytes;
          totalBytes += blob.size;
          try {
            await writer.write(blob);
          } catch (writeErr: unknown) {
            if (isQuotaExceededError(writeErr)) {
              // Clean up partial OPFS data and surface a clear error.
              await deleteDownloadSubdir(downloadId).catch((cleanupErr) => {
                console.warn(
                  `[downloader] OPFS cleanup after quota error failed:`,
                  cleanupErr,
                );
              });
              throw new Error(
                'Không đủ dung lượng lưu tạm thời. Hãy giải phóng ổ đĩa và thử lại.',
              );
            }
            throw writeErr;
          }

          // Record the byte range for this segment.
          segmentRanges.push({
            index: segmentIndex,
            startByte: segmentStartByte,
            endByte: totalBytes,
            size: blob.size,
            duration: contentSegments[segmentIndex]?.duration,
          });

          const current = start + j + 1;
          const pct = Math.floor((current / effectiveTotal) * 80);
          this.reportProgress(downloadId, 'downloading', pct, current, effectiveTotal, totalBytes, totalBytes);
        }

      }
    } finally {
      await writer.close();
    }


    // Store segment ranges for this download so the conversion phase
    // (and future parallel engine) can access them.
    this.segmentRangesMap.set(downloadId, segmentRanges);

    // Persist segment ranges to OPFS so the offscreen document can read
    // them without receiving a large payload via message passing.
    try {
      await writeJsonFile(dirHandle, 'segment-ranges.json', segmentRanges);
    } catch (err: unknown) {
      // Non-fatal: if persistence fails, the in-memory map is still available
      // for the current download. The offscreen conversion will fallback to
      // sequential if it can't read the metadata.
      console.warn(
        `[downloader] Failed to persist segment ranges for ${downloadId}:`,
        err,
      );
    }

    this.throwIfCancelled(downloadId);

    // Determine whether to attempt conversion based on mode + size.
    const shouldConvert = this.shouldAttemptConversion(totalBytes);

    // Phase 2: Save the file.
    //
    // For fMP4 (.m4s) playlists: the concatenated init + segments already form
    // a valid fragmented MP4 file — NO transmuxing needed. Save as .mp4 directly.
    //
    // For .ts playlists: attempt transmux conversion (TS→MP4) if configured.
    // Fallback to .ts if conversion fails or is disabled.
    let savedFilename: string;

    if (isFmp4) {
      // fMP4 path: save directly as .mp4 (no transmux needed).
      this.reportProgress(downloadId, 'converting', 98, undefined, undefined, totalBytes, totalBytes);
      savedFilename = generateFileName(
        resolveFilenameBase(this.filenameSource, video.title, video.tabUrl || video.url),
        'mp4',
      );
      this.throwIfCancelled(downloadId);
      await this.saveOpfsFile(
        downloadId,
        opfsFilename,
        savedFilename,
        outputMimeType,
      );
    } else if (shouldConvert && this.convertCallback) {
      this.reportProgress(downloadId, 'converting', 85, undefined, undefined, totalBytes, totalBytes);
      const convertStartedAt = performance.now();
      try {
        const result = await this.convertCallback(dirHandle, downloadId);
        savedFilename = generateFileName(
          resolveFilenameBase(this.filenameSource, video.title, video.tabUrl || video.url),
          'mp4',
        );
        this.reportProgress(downloadId, 'converting', 98, undefined, undefined, totalBytes, totalBytes);

        this.throwIfCancelled(downloadId);
        await this.saveOpfsFile(
          downloadId,
          result.outputName,
          savedFilename,
          result.mimeType,
        );
      } catch (convertError) {
        const convertMs = Math.round(performance.now() - convertStartedAt);
        console.warn(
          `[downloader] MP4 conversion failed after ${convertMs}ms for ${downloadId}, saving .ts fallback:`,
          convertError instanceof Error ? convertError.message : convertError,
        );
        // Fallback: save the .ts file from OPFS (without materializing it).
        savedFilename = generateFileName(
          resolveFilenameBase(this.filenameSource, video.title, video.tabUrl || video.url),
          'ts',
        );
        this.throwIfCancelled(downloadId);
        await this.saveOpfsFile(
          downloadId,
          opfsFilename,
          savedFilename,
          'video/mp2t',
        );
      }
    } else {
      // No conversion: save .ts directly from OPFS.
      savedFilename = generateFileName(
        resolveFilenameBase(this.filenameSource, video.title, video.tabUrl || video.url),
        'ts',
      );
      this.throwIfCancelled(downloadId);
      await this.saveOpfsFile(
        downloadId,
        opfsFilename,
        savedFilename,
        'video/mp2t',
      );
    }

    this.throwIfCancelled(downloadId);

    // Phase 3: Cleanup OPFS temp files.
    await deleteDownloadSubdir(downloadId).catch((err: unknown) => {
      console.warn(`[downloader] OPFS cleanup failed for ${downloadId}:`, err);
    });
    this.segmentRangesMap.delete(downloadId);

    this.reportProgress(downloadId, 'done', 100);
  }

  /**
   * Save an OPFS file to the user's Downloads folder.
   *
   * Uses `saveOpfsFileCallback` (offscreen-owned Blob URL) when available to
   * avoid materializing large files into memory. Falls back to `saveBlob`
   * (data URL) only when the callback is unset — which is only safe for small
   * files and is primarily used in unit tests.
   */
  private async saveOpfsFile(
    downloadId: string,
    opfsFilename: string,
    downloadFilename: string,
    mimeType: string,
  ): Promise<void> {
    if (this.saveOpfsFileCallback) {
      await this.saveOpfsFileCallback(
        downloadId,
        opfsFilename,
        downloadFilename,
        mimeType,
      );
      return;
    }

    // Legacy fallback: read the OPFS file into memory and save via data URL.
    // This path is only safe for small files; large M3U8 downloads must wire
    // `saveOpfsFileCallback` to avoid a memory spike.
    const dirHandle = await ensureDownloadSubdir(downloadId);
    const file = await opfsReadFile(dirHandle, opfsFilename);
    const blob = new Blob([await file.arrayBuffer()], { type: mimeType });
    await this.saveBlob(blob, downloadFilename);
  }

  /**
   * Legacy in-memory flow for browsers without OPFS support.
   * Fetches all segments into memory, merges, and saves.
   */
  private async downloadM3u8Legacy(
    video: DetectedVideo,
    downloadId: string,
    segments: TsSegment[],
  ): Promise<void> {
    const totalSegments = segments.length;
    const blobs: Blob[] = [];
    let legacyTotalBytes = 0;
    for (let i = 0; i < totalSegments; i++) {
      this.throwIfCancelled(downloadId);
      const blob = await this.fetchSegment(segments[i].url, video.tabUrl);
      blobs.push(blob);
      legacyTotalBytes += blob.size;
      const pct = Math.floor(((i + 1) / totalSegments) * 80);
      this.reportProgress(downloadId, 'downloading', pct, i + 1, totalSegments, legacyTotalBytes, legacyTotalBytes);
    }

    this.throwIfCancelled(downloadId);

    // Merge all segments into a single Blob (in-memory).
    const merged = new Blob(blobs, { type: 'video/mp2t' });
    const filename = generateFileName(
      resolveFilenameBase(this.filenameSource, video.title, video.tabUrl || video.url),
      'ts',
    );
    await this.saveBlob(merged, filename);

    this.throwIfCancelled(downloadId);
    this.reportProgress(downloadId, 'done', 100);
  }

  /**
   * Determine whether to attempt TS→MP4 conversion based on the current
   * `convertMode` setting and the total downloaded size.
   *
   * - `'always'`: always attempt (conversion may still fail → .ts fallback)
   * - `'small-only'`: only attempt if totalBytes ≤ MAX_CONVERT_BYTES
   * - `'never'`: never attempt, save .ts directly
   */
  private shouldAttemptConversion(totalBytes: number): boolean {
    switch (this.convertMode) {
      case 'never':
        return false;
      case 'small-only':
        return totalBytes <= MAX_CONVERT_BYTES;
      case 'always':
      default:
        return true;
    }
  }

  private throwIfCancelled(downloadId: string): void {
    if (this.cancelledIds.has(downloadId)) {
      throw new Error('Download cancelled');
    }
  }

  private reportProgress(
    itemId: string,
    status: DownloadProgress['status'],
    progress: number,
    currentSegment?: number,
    totalSegments?: number,
    fileSize?: number,
    downloadedBytes?: number,
  ): void {
    if (!this.progressCallback) return;
    // Set downloadProgress / convertProgress based on the current phase.
    // During 'downloading': downloadProgress = progress, convertProgress = 0.
    // During 'converting': downloadProgress = 100, convertProgress is NOT set
    //   here — the offscreen document broadcasts actual convert progress via
    //   CONVERSION_PROGRESS_UPDATE, which the background relays with
    //   convertProgress set. For subtitles (no offscreen), convertProgress
    //   stays undefined and DownloadCard renders single-phase (acceptable
    //   since subtitle conversion is instant).
    // During 'done': both = 100.
    const downloadProgress =
      status === 'downloading' ? progress :
      status === 'converting' || status === 'done' ? 100 :
      undefined;
    const convertProgress =
      status === 'done' ? 100 :
      undefined;
    this.progressCallback({
      itemId,
      status,
      progress,
      currentSegment,
      totalSegments,
      ...(fileSize !== undefined ? { fileSize } : {}),
      ...(downloadedBytes !== undefined ? { downloadedBytes } : {}),
      ...(downloadProgress !== undefined ? { downloadProgress } : {}),
      ...(convertProgress !== undefined ? { convertProgress } : {}),
    });
  }
}

/**
 * Convert a Blob to a base64 `data:` URL.
 *
 * Used instead of `URL.createObjectURL`, which is unavailable in Manifest V3
 * service workers. `btoa` and `Blob.arrayBuffer()` are both available in the
 * service worker global scope.
 */
async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Base64-encode in chunks to avoid call-stack overflow on large inputs.
  let binary = '';
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);

  const mimeType = blob.type || 'application/octet-stream';
  return `data:${mimeType};base64,${base64}`;
}

