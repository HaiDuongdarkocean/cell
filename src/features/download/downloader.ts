import type {
  ByteRange,
  DetectedVideo,
  DetectedSubtitle,
  DownloadProgress,
  HlsEncryption,
  SegmentRange,
} from '@/entities/media';
import type { ConvertToMp4Mode, FilenameSource } from '@/entities/media';
import {
  MAX_CONVERT_BYTES,
  DEFAULT_SEGMENT_CONCURRENCY,
  MIN_SEGMENT_CONCURRENCY,
  MAX_SEGMENT_CONCURRENCY,
} from '@/shared/config/config';
import { deleteDownloadSubdir } from '@/shared/lib/storage/opfsStorage';
import { generateFileName, resolveFilenameBase } from '@/shared/utils/fileUtils';
import {
  buildFetchHeaders,
  fetchSegment as fetchSegmentBlob,
  fetchSegmentWithRange as fetchSegmentBlobWithRange,
} from './segmentFetch';
import { decryptSegment as decryptSegmentData, fetchAes128Key } from './hlsCrypto';
import { downloadM3u8Video as runM3u8VideoDownload } from './m3u8Download';
import {
  convertSubtitleToSrt,
  fetchSubtitleContent,
  resolveSubtitleFilename,
  type SubtitleVideoContext,
} from './subtitleDownload';
import {
  PendingFilenameRegistry,
  saveBlobToDownloads,
  saveOpfsFileToDownloads,
} from './downloadSaver';
import { buildDownloadProgress } from './downloadProgress';
import type {
  ConvertCallback,
  ConvertResult,
  ProgressCallback,
  SaveOpfsFileCallback,
} from './downloadTypes';

export { buildFetchHeaders } from './segmentFetch';
export type {
  ConvertCallback,
  ConvertResult,
  ProgressCallback,
  SaveOpfsFileCallback,
};

/**
 * Orchestrates downloading a video or subtitle: fetch segments → merge →
 * ffmpeg convert (optional) → chrome.downloads.
 *
 * Mechanics live in sibling modules; this class owns per-instance state
 * (callbacks, settings, cancellation flags, caches) and progress routing:
 * - segmentFetch.ts — CDN fetch with Referer/Origin, retry + byte ranges
 * - hlsCrypto.ts — AES-128 key fetch + segment decryption
 * - m3u8Download.ts — playlist resolution + streaming segment pipeline
 * - subtitleDownload.ts — subtitle fetch + format conversion to SRT
 * - downloadSaver.ts — blob/OPFS → chrome.downloads persistence
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
  private readonly pendingFilenames = new PendingFilenameRegistry();

  /**
   * Consume the pending filename registered for `url` (used by the
   * onDeterminingFilename listener). Returns null when no extension-initiated
   * download with that URL is pending.
   */
  consumePendingFilename(url: string): string | null {
    return this.pendingFilenames.consume(url);
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
  async downloadVideo(
    video: DetectedVideo,
    downloadId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    this.throwIfCancelled(downloadId, signal);

    if (video.format === 'm3u8') {
      await this.downloadM3u8Video(video, downloadId, signal);
    } else if (video.format === 'mp4') {
      await this.downloadMp4Video(video, downloadId, signal);
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
    videoContext?: SubtitleVideoContext,
    signal?: AbortSignal,
  ): Promise<void> {
    this.throwIfCancelled(downloadId, signal);
    this.reportProgress(downloadId, 'downloading', 0);

    const content = await fetchSubtitleContent(subtitle, videoContext, signal);

    this.throwIfCancelled(downloadId, signal);
    this.reportProgress(downloadId, 'converting', 50);

    const srtContent = convertSubtitleToSrt(content, subtitle.format);

    this.throwIfCancelled(downloadId, signal);

    const blob = new Blob([srtContent], { type: 'application/x-subrip' });
    const filename = resolveSubtitleFilename(
      this.filenameSource,
      subtitle,
      videoContext,
    );
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

  /** Fetch a single segment with retry and timeout. */
  async fetchSegment(
    url: string,
    tabUrl?: string,
    signal?: AbortSignal,
  ): Promise<Blob> {
    return fetchSegmentBlob(url, tabUrl, signal);
  }

  /**
   * Fetch an AES-128 decryption key, cached per `cacheKey` (typically the
   * keyUri) to avoid re-fetching the same key for every segment.
   */
  async fetchKey(
    keyUri: string,
    tabUrl?: string,
    cacheKey?: string,
    signal?: AbortSignal,
  ): Promise<CryptoKey> {
    return fetchAes128Key(this.keyCache, keyUri, tabUrl, cacheKey, signal);
  }

  /**
   * Decrypt an AES-128-CBC encrypted segment blob.
   *
   * @returns Decrypted Blob (video/mp2t)
   */
  async decryptSegment(
    encryptedBlob: Blob,
    key: CryptoKey,
    encryption: HlsEncryption,
    sequence?: number,
  ): Promise<Blob> {
    return decryptSegmentData(encryptedBlob, key, encryption, sequence);
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
    signal?: AbortSignal,
  ): Promise<Blob> {
    return fetchSegmentBlobWithRange(url, tabUrl, byteRange, signal);
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
    return saveBlobToDownloads(blob, filename, this.pendingFilenames);
  }

  // --- internals ---

  private async downloadMp4Video(
    video: DetectedVideo,
    downloadId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    this.reportProgress(downloadId, 'downloading', 0);

    const response = await fetch(video.url, {
      credentials: 'same-origin',
      headers: buildFetchHeaders(video.tabUrl),
      signal,
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status}`);
    }
    const blob = await response.blob();

    this.throwIfCancelled(downloadId, signal);
    this.reportProgress(downloadId, 'converting', 50);

    const filename = this.resolveVideoFilename(video, 'mp4');
    await this.saveBlob(blob, filename);

    this.throwIfCancelled(downloadId, signal);
    this.reportProgress(downloadId, 'done', 100);
  }

  private async downloadM3u8Video(
    video: DetectedVideo,
    downloadId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    await runM3u8VideoDownload(
      video,
      downloadId,
      {
        segmentConcurrency: this.segmentConcurrency,
        keyCache: this.keyCache,
        segmentRanges: this.segmentRangesMap,
        convertCallback: this.convertCallback,
        shouldConvert: (totalBytes) => this.shouldAttemptConversion(totalBytes),
        resolveFilename: (extension) => this.resolveVideoFilename(video, extension),
        throwIfCancelled: (cancelSignal) =>
          this.throwIfCancelled(downloadId, cancelSignal),
        reportProgress: (status, progress, currentSegment, totalSegments, fileSize, downloadedBytes) =>
          this.reportProgress(downloadId, status, progress, currentSegment, totalSegments, fileSize, downloadedBytes),
        saveOpfsFile: (opfsFilename, downloadFilename, mimeType) =>
          this.saveOpfsFile(downloadId, opfsFilename, downloadFilename, mimeType),
      },
      signal,
    );
  }

  /**
   * Save an OPFS file to the user's Downloads folder via the offscreen-owned
   * Blob URL callback when available, else the data-URL fallback.
   */
  private async saveOpfsFile(
    downloadId: string,
    opfsFilename: string,
    downloadFilename: string,
    mimeType: string,
  ): Promise<void> {
    return saveOpfsFileToDownloads(
      downloadId,
      opfsFilename,
      downloadFilename,
      mimeType,
      this.saveOpfsFileCallback,
      this.pendingFilenames,
    );
  }

  private resolveVideoFilename(video: DetectedVideo, extension: string): string {
    return generateFileName(
      resolveFilenameBase(this.filenameSource, video.title, video.tabUrl || video.url),
      extension,
    );
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

  private throwIfCancelled(downloadId: string, signal?: AbortSignal): void {
    if (this.cancelledIds.has(downloadId) || signal?.aborted) {
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
    this.progressCallback(
      buildDownloadProgress(itemId, status, progress, {
        currentSegment,
        totalSegments,
        fileSize,
        downloadedBytes,
      }),
    );
  }
}
