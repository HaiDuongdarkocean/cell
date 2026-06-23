import { parseM3u8 } from '@/lib/parsers/m3u8Parser';
import { mergeTsSegments } from '@/lib/converters/segmentMerger';
import { convertAssToSrt } from '@/lib/converters/assToSrt';
import { convertVttToSrt } from '@/lib/converters/vttToSrt';
import { generateFileName } from '@/lib/utils/fileUtils';
import type {
  DetectedVideo,
  DetectedSubtitle,
  DownloadProgress,
} from '@/types/media';
import { MAX_RETRY, SEGMENT_TIMEOUT_MS } from '@/constants/config';

/**
 * Callback invoked with progress updates during a download.
 */
export type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Callback invoked to convert merged TS segments (ArrayBuffers) into the final
 * container format (e.g. mp4 via offscreen ffmpeg). Returns the converted
 * ArrayBuffer.
 */
export type ConvertCallback = (
  segments: ArrayBuffer[],
  downloadId: string,
) => Promise<ArrayBuffer>;

/**
 * Orchestrates downloading a video or subtitle: fetch segments → merge →
 * ffmpeg convert (optional) → chrome.downloads.
 */
export class Downloader {
  private progressCallback: ProgressCallback | null = null;
  private convertCallback: ConvertCallback | null = null;
  private cancelledIds: Set<string> = new Set();

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

    const response = await fetch(subtitle.url);
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

    this.throwIfCancelled(downloadId);

    const blob = new Blob([srtContent], { type: 'application/x-subrip' });
    const filename = generateFileName(extractBaseName(subtitle.url), 'srt');
    await this.saveBlob(blob, filename);

    this.reportProgress(downloadId, 'done', 100);
  }

  /** Cancel a download by id. Subsequent steps for that id will throw. */
  cancel(downloadId: string): void {
    this.cancelledIds.add(downloadId);
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
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Segment fetch failed: ${response.status}`);
        }
        return await response.blob();
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
    const response = await fetch(playlistUrl);
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
   * Save a Blob via chrome.downloads.download. Creates an object URL, triggers
   * the download, then revokes the object URL.
   */
  async saveBlob(blob: Blob, filename: string): Promise<void> {
    const url = URL.createObjectURL(blob);
    try {
      await chrome.downloads.download({
        url,
        filename,
        saveAs: false,
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // --- internals ---

  private async downloadMp4Video(
    video: DetectedVideo,
    downloadId: string,
  ): Promise<void> {
    this.reportProgress(downloadId, 'downloading', 0);

    const response = await fetch(video.url);
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
    const response = await fetch(video.url);
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
      const variantResponse = await fetch(variantUrl);
      if (!variantResponse.ok) {
        throw new Error(`Failed to fetch variant playlist: ${variantResponse.status}`);
      }
      content = await variantResponse.text();
      playlist = parseM3u8(content, variantUrl);
    }

    this.throwIfCancelled(downloadId);

    const totalSegments = playlist.segments.length;
    const blobs: Blob[] = [];
    for (let i = 0; i < totalSegments; i++) {
      this.throwIfCancelled(downloadId);
      const blob = await this.fetchSegment(playlist.segments[i].url);
      blobs.push(blob);
      // Map segment fetching to 0–80% of overall progress.
      const pct = Math.floor(((i + 1) / totalSegments) * 80);
      this.reportProgress(downloadId, 'downloading', pct, i + 1, totalSegments);
    }

    this.throwIfCancelled(downloadId);
    const merged = mergeTsSegments(blobs);
    this.reportProgress(downloadId, 'converting', 85);

    let finalBlob: Blob;
    if (this.convertCallback) {
      const buffers: ArrayBuffer[] = [];
      for (const b of blobs) {
        buffers.push(await b.arrayBuffer());
      }
      const converted = await this.convertCallback(buffers, downloadId);
      finalBlob = new Blob([converted], { type: 'video/mp4' });
    } else {
      finalBlob = merged;
    }

    this.throwIfCancelled(downloadId);
    const filename = generateFileName(video.title, 'mp4');
    await this.saveBlob(finalBlob, filename);

    this.throwIfCancelled(downloadId);
    this.reportProgress(downloadId, 'done', 100);
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
