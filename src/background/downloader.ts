import { parseM3u8 } from '@/lib/parsers/m3u8Parser';
import { convertAssToSrt } from '@/lib/converters/assToSrt';
import { convertVttToSrt } from '@/lib/converters/vttToSrt';
import { normalizeSrt } from '@/lib/converters/srtNormalizer';
import { generateFileName } from '@/lib/utils/fileUtils';
import type {
  DetectedVideo,
  DetectedSubtitle,
  DownloadProgress,
} from '@/types/media';
import {
  MAX_RETRY,
  SEGMENT_TIMEOUT_MS,
  MAX_CONVERT_BYTES,
  DEFAULT_SEGMENT_CONCURRENCY,
} from '@/constants/config';
import type { ConvertToMp4Mode } from '@/types/media';
import {
  ensureDownloadSubdir,
  createOpfsWriter,
  readFile as opfsReadFile,
  deleteDownloadSubdir,
  isOpfsAvailable,
  isQuotaExceededError,
} from '@/lib/storage/opfsStorage';

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
 * Orchestrates downloading a video or subtitle: fetch segments → merge →
 * ffmpeg convert (optional) → chrome.downloads.
 */
export class Downloader {
  private progressCallback: ProgressCallback | null = null;
  private convertCallback: ConvertCallback | null = null;
  private saveOpfsFileCallback: SaveOpfsFileCallback | null = null;
  private cancelledIds: Set<string> = new Set();
  private convertMode: ConvertToMp4Mode = 'always';

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
   */
  async downloadSubtitle(
    subtitle: DetectedSubtitle,
    downloadId: string,
  ): Promise<void> {
    this.throwIfCancelled(downloadId);
    this.reportProgress(downloadId, 'downloading', 0);

    const response = await fetch(subtitle.url, { credentials: 'include' });
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
    const filename = generateFileName(extractBaseName(subtitle.url), 'srt');
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
   * Fetch a single segment with retry and timeout.
   *
   * Retries up to MAX_RETRY times on network/abort error. Each attempt is
   * aborted after SEGMENT_TIMEOUT_MS.
   */
  async fetchSegment(url: string): Promise<Blob> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SEGMENT_TIMEOUT_MS);
      try {
        // Use `credentials: 'same-origin'` for segment fetches. Most HLS
        // segment CDNs are cross-origin and do NOT send
        // `Access-Control-Allow-Credentials: true` — using `'include'` here
        // would cause the browser to BLOCK the response. Segment URLs rarely
        // need cookies; the playlist fetch (which may need auth from the
        // page's origin) still uses `'include'`.
        const response = await fetch(url, {
          signal: controller.signal,
          credentials: 'same-origin',
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
   * Fetch all .ts segments from an m3u8 media playlist.
   *
   * Calls `onSegmentProgress(current, total)` after each segment is fetched.
   */
  async fetchAllSegments(
    playlistUrl: string,
    onSegmentProgress: (current: number, total: number) => void,
  ): Promise<Blob[]> {
    const response = await fetch(playlistUrl, { credentials: 'include' });
    if (!response.ok) {
      throw new Error(`Failed to fetch playlist: ${response.status}`);
    }
    const content = await response.text();
    const playlist = parseM3u8(content, playlistUrl);

    const segments = playlist.segments;
    const blobs: Blob[] = [];
    for (let i = 0; i < segments.length; i++) {
      const blob = await this.fetchSegment(segments[i].url);
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
    await chrome.downloads.download({
      url,
      filename,
      saveAs: false,
    });
  }

  // --- internals ---

  private async downloadMp4Video(
    video: DetectedVideo,
    downloadId: string,
  ): Promise<void> {
    this.reportProgress(downloadId, 'downloading', 0);

    const response = await fetch(video.url, { credentials: 'include' });
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status}`);
    }
    const blob = await response.blob();

    this.throwIfCancelled(downloadId);
    this.reportProgress(downloadId, 'converting', 50);

    const filename = generateFileName(video.title, 'mp4');
    await this.saveBlob(blob, filename);

    this.throwIfCancelled(downloadId);
    this.reportProgress(downloadId, 'done', 100);
  }

  private async downloadM3u8Video(
    video: DetectedVideo,
    downloadId: string,
  ): Promise<void> {
    this.reportProgress(downloadId, 'downloading', 0);

    // Fetch + parse the (possibly master) playlist.
    const response = await fetch(video.url, { credentials: 'include' });
    if (!response.ok) {
      throw new Error(`Failed to fetch playlist: ${response.status}`);
    }
    let content = await response.text();
    let playlist = parseM3u8(content, video.url);

    // If master playlist, pick the first variant (highest quality) and parse it.
    if (playlist.isMasterPlaylist) {
      if (playlist.variants.length === 0) {
        throw new Error('Master playlist has no variants');
      }
      const variantUrl = playlist.variants[0].url;
      this.throwIfCancelled(downloadId);
      const variantResponse = await fetch(variantUrl, { credentials: 'include' });
      if (!variantResponse.ok) {
        throw new Error(`Failed to fetch variant playlist: ${variantResponse.status}`);
      }
      content = await variantResponse.text();
      playlist = parseM3u8(content, variantUrl);
    }

    this.throwIfCancelled(downloadId);

    const opfsAvailable = isOpfsAvailable();

    if (opfsAvailable) {
      await this.downloadM3u8Streaming(video, downloadId, playlist.segments);
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
    segments: { url: string }[],
  ): Promise<void> {
    const totalSegments = segments.length;
    const dirHandle = await ensureDownloadSubdir(downloadId);
    let totalBytes = 0;
    const downloadStartedAt = performance.now();

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
    console.debug(
      `[downloader] Starting parallel download: ${totalSegments} segments, concurrency=${DEFAULT_SEGMENT_CONCURRENCY}`,
    );
    const writer = await createOpfsWriter(dirHandle, 'input.ts');
    try {
      for (let start = 0; start < totalSegments; start += DEFAULT_SEGMENT_CONCURRENCY) {
        this.throwIfCancelled(downloadId);

        const batch = segments.slice(start, start + DEFAULT_SEGMENT_CONCURRENCY);
        const batchStart = performance.now();

        // Fetch all segments in the batch concurrently.
        const blobs = await Promise.all(
          batch.map((segment) => this.fetchSegment(segment.url)),
        );

        const fetchMs = Math.round(performance.now() - batchStart);

        // Write in original playlist order.
        for (let j = 0; j < blobs.length; j++) {
          this.throwIfCancelled(downloadId);
          const blob = blobs[j];
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

          const current = start + j + 1;
          const pct = Math.floor((current / totalSegments) * 80);
          this.reportProgress(downloadId, 'downloading', pct, current, totalSegments);
        }

        const batchEnd = start + blobs.length;
        console.debug(
          `[downloader] Fetched+wrote batch ${start}-${batchEnd - 1} in ${fetchMs}ms, total=${totalBytes} bytes`,
        );
      }
    } finally {
      await writer.close();
    }

    const downloadMs = Math.round(performance.now() - downloadStartedAt);
    console.debug(
      `[downloader] Downloaded ${totalSegments} segments (${totalBytes} bytes) in ${downloadMs}ms`,
    );

    this.throwIfCancelled(downloadId);

    // Determine whether to attempt conversion based on mode + size.
    const shouldConvert = this.shouldAttemptConversion(totalBytes);

    // Phase 2: Attempt conversion (85–98%) or save .ts directly.
    //
    // When `saveOpfsFileCallback` is set, the file is saved directly from OPFS
    // (via an offscreen-owned Blob URL) WITHOUT reading it into an ArrayBuffer
    // or converting to a data: URL. This avoids a ~1.4GB memory spike on a
    // 430MB file. If the callback is unset (e.g. in unit tests or browsers
    // without offscreen support), we fall back to the legacy `saveBlob` path
    // which materializes the file — acceptable only for small files.
    let savedFilename: string;

    if (shouldConvert && this.convertCallback) {
      this.reportProgress(downloadId, 'converting', 85);
      const convertStartedAt = performance.now();
      try {
        const result = await this.convertCallback(dirHandle, downloadId);
        const convertMs = Math.round(performance.now() - convertStartedAt);
        console.debug(`[downloader] Conversion succeeded in ${convertMs}ms`);
        savedFilename = generateFileName(video.title, 'mp4');
        this.reportProgress(downloadId, 'converting', 98);

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
        savedFilename = generateFileName(video.title, 'ts');
        this.throwIfCancelled(downloadId);
        await this.saveOpfsFile(
          downloadId,
          'input.ts',
          savedFilename,
          'video/mp2t',
        );
      }
    } else {
      // No conversion: save .ts directly from OPFS.
      savedFilename = generateFileName(video.title, 'ts');
      this.throwIfCancelled(downloadId);
      await this.saveOpfsFile(
        downloadId,
        'input.ts',
        savedFilename,
        'video/mp2t',
      );
    }

    this.throwIfCancelled(downloadId);

    // Phase 3: Cleanup OPFS temp files.
    await deleteDownloadSubdir(downloadId).catch((err: unknown) => {
      console.warn(`[downloader] OPFS cleanup failed for ${downloadId}:`, err);
    });

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
    segments: { url: string }[],
  ): Promise<void> {
    const totalSegments = segments.length;
    const blobs: Blob[] = [];
    for (let i = 0; i < totalSegments; i++) {
      this.throwIfCancelled(downloadId);
      const blob = await this.fetchSegment(segments[i].url);
      blobs.push(blob);
      const pct = Math.floor(((i + 1) / totalSegments) * 80);
      this.reportProgress(downloadId, 'downloading', pct, i + 1, totalSegments);
    }

    this.throwIfCancelled(downloadId);

    // Merge all segments into a single Blob (in-memory).
    const merged = new Blob(blobs, { type: 'video/mp2t' });
    const filename = generateFileName(video.title, 'ts');
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
  ): void {
    if (!this.progressCallback) return;
    this.progressCallback({
      itemId,
      status,
      progress,
      currentSegment,
      totalSegments,
    });
  }
}

/**
 * Extract a base filename (without extension) from a URL path.
 */
function extractBaseName(url: string): string {
  try {
    const path = new URL(url).pathname;
    const file = path.slice(path.lastIndexOf('/') + 1);
    const dot = file.lastIndexOf('.');
    return dot > 0 ? file.slice(0, dot) : file;
  } catch {
    return 'subtitle';
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
