import type {
  DetectedVideo,
  DownloadProgress,
  M3u8Playlist,
  SegmentRange,
} from '@/entities/media';
import { parseM3u8 } from '@/shared/lib/parsers/m3u8Parser';
import {
  ensureDownloadSubdir,
  createOpfsWriter,
  deleteDownloadSubdir,
  isQuotaExceededError,
  writeJsonFile,
} from '@/shared/lib/storage/opfsStorage';
import { buildFetchHeaders, fetchSegmentWithRange } from './segmentFetch';
import { decryptSegment, fetchAes128Key, type Aes128KeyCache } from './hlsCrypto';
import type { ConvertCallback } from './downloadTypes';

const MAX_MASTER_DEPTH = 3;

/**
 * Dependencies the m3u8 pipeline needs from the orchestrating Downloader:
 * settings, shared caches, cancellation/progress hooks bound to the
 * download id, and the save + conversion callbacks.
 */
export interface M3u8DownloadDeps {
  /** Number of segments to fetch in parallel per batch. */
  readonly segmentConcurrency: number;
  /** AES-128 key cache shared across downloads (keyed by key URI). */
  readonly keyCache: Aes128KeyCache;
  /**
   * Segment byte ranges keyed by downloadId, consumed by the conversion
   * phase (and the parallel engine) to split `input.ts` at safe boundaries.
   * The pipeline sets the entry after the write phase and deletes it during
   * cleanup.
   */
  readonly segmentRanges: Map<string, SegmentRange[]>;
  /** Offscreen TS→MP4 conversion callback; null disables conversion. */
  readonly convertCallback: ConvertCallback | null;
  /** Whether conversion should be attempted for the given total size. */
  readonly shouldConvert: (totalBytes: number) => boolean;
  /** Resolve the final download filename for the given extension. */
  readonly resolveFilename: (extension: string) => string;
  /** Throw 'Download cancelled' when this download was cancelled/aborted. */
  readonly throwIfCancelled: (signal?: AbortSignal) => void;
  /** Report progress for this download. */
  readonly reportProgress: (
    status: DownloadProgress['status'],
    progress: number,
    currentSegment?: number,
    totalSegments?: number,
    fileSize?: number,
    downloadedBytes?: number,
  ) => void;
  /** Persist an OPFS file to the user's Downloads folder. */
  readonly saveOpfsFile: (
    opfsFilename: string,
    downloadFilename: string,
    mimeType: string,
  ) => Promise<void>;
}

/**
 * Fetch and parse the (possibly master) playlist. Master playlists are
 * resolved by following the first variant (highest quality); nested master
 * playlists (master → master → media) are handled up to MAX_MASTER_DEPTH.
 */
async function resolveMediaPlaylist(
  video: DetectedVideo,
  deps: Pick<M3u8DownloadDeps, 'throwIfCancelled'>,
  signal?: AbortSignal,
): Promise<M3u8Playlist> {
  const videoHeaders = buildFetchHeaders(video.tabUrl);

  const response = await fetch(video.url, {
    credentials: 'same-origin',
    headers: videoHeaders,
    signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch playlist: ${response.status}`);
  }
  let content = await response.text();
  let playlist = parseM3u8(content, video.url);

  let masterDepth = 0;
  while (playlist.isMasterPlaylist && masterDepth < MAX_MASTER_DEPTH) {
    if (playlist.variants.length === 0) {
      throw new Error('Master playlist has no variants');
    }
    const variantUrl = playlist.variants[0].url;
    deps.throwIfCancelled(signal);
    const variantResponse = await fetch(variantUrl, {
      credentials: 'same-origin',
      headers: videoHeaders,
      signal,
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

  return playlist;
}

interface StreamedMedia {
  readonly dirHandle: FileSystemDirectoryHandle;
  readonly totalBytes: number;
  readonly opfsFilename: string;
  readonly outputMimeType: string;
  readonly isFmp4: boolean;
}

/**
 * Streaming download: fetch each segment and append it to the OPFS input
 * file, keeping only ~1 segment in memory.
 *
 * - Fetch: `deps.segmentConcurrency` segments are fetched concurrently via
 *   `Promise.all` to utilize network bandwidth.
 * - Write: segments are written to OPFS in original playlist order to
 *   preserve the MPEG-TS stream. Writing is sequential because the single
 *   writable stream is not safe for concurrent writes.
 * - The writable stream is opened once and closed once, avoiding the
 *   per-segment open/seek/write/close overhead of `appendChunk()`.
 *
 * Ad segments are filtered out using discontinuity-based ad break detection:
 * #EXT-X-DISCONTINUITY separates sections; even sections (0, 2, 4…) are
 * content, odd sections (1, 3, 5…) are ad breaks.
 *
 * If the playlist is AES-128 encrypted, the key is fetched once before the
 * loop and each segment is decrypted after fetch and before the OPFS write.
 * For fMP4/CMAF playlists (#EXT-X-MAP) the init segment is written first so
 * the concatenated .m4s segments form a valid fragmented MP4 — no
 * transmuxing needed.
 *
 * Segment byte ranges are recorded into `deps.segmentRanges` and persisted
 * to OPFS so the offscreen document can read them without a large
 * message-passing payload.
 */
async function streamSegmentsToOpfs(
  video: DetectedVideo,
  downloadId: string,
  playlist: M3u8Playlist,
  deps: M3u8DownloadDeps,
  signal?: AbortSignal,
): Promise<StreamedMedia> {
  const segments = playlist.segments;
  const dirHandle = await ensureDownloadSubdir(downloadId);
  let totalBytes = 0;
  const segmentRanges: SegmentRange[] = [];

  let aesKey: CryptoKey | undefined;
  if (playlist.encryption && playlist.encryption.method === 'AES-128') {
    deps.throwIfCancelled(signal);
    aesKey = await fetchAes128Key(
      deps.keyCache,
      playlist.encryption.keyUri,
      video.tabUrl,
      downloadId,
      signal,
    );
  }

  const isFmp4 = !!playlist.initSegment;
  const opfsFilename = isFmp4 ? 'input.mp4' : 'input.ts';
  const outputMimeType = isFmp4 ? 'video/mp4' : 'video/mp2t';

  if (isFmp4 && playlist.initSegment) {
    deps.throwIfCancelled(signal);
    const initBlob = await fetchSegmentWithRange(
      playlist.initSegment.uri,
      video.tabUrl,
      playlist.initSegment.byteRange,
      signal,
    );
    const initWriter = await createOpfsWriter(dirHandle, opfsFilename);
    try {
      await initWriter.write(initBlob);
      totalBytes += initBlob.size;
    } finally {
      await initWriter.close();
    }
  }

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
    for (let start = 0; start < effectiveTotal; start += deps.segmentConcurrency) {
      deps.throwIfCancelled(signal);

      const batch = contentSegments.slice(start, start + deps.segmentConcurrency);

      const blobs = await Promise.all(
        batch.map((segment) =>
          fetchSegmentWithRange(segment.url, video.tabUrl, segment.byteRange, signal),
        ),
      );

      for (let j = 0; j < blobs.length; j++) {
        deps.throwIfCancelled(signal);
        let blob = blobs[j];
        const segmentIndex = start + j;

        if (aesKey && playlist.encryption) {
          blob = await decryptSegment(
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
            await deleteDownloadSubdir(downloadId).catch((cleanupErr) => {
              console.warn(
                `[downloader] OPFS cleanup after quota error failed:`,
                cleanupErr,
              );
            });
            throw new Error(
              'Không đủ dung lượng lưu tạm thời. Hãy giải phóng ổ đĩa và thử lại.',
              { cause: writeErr },
            );
          }
          throw writeErr;
        }

        segmentRanges.push({
          index: segmentIndex,
          startByte: segmentStartByte,
          endByte: totalBytes,
          size: blob.size,
          duration: contentSegments[segmentIndex]?.duration,
        });

        const current = start + j + 1;
        const pct = Math.floor((current / effectiveTotal) * 80);
        deps.reportProgress('downloading', pct, current, effectiveTotal, totalBytes, totalBytes);
      }
    }
  } finally {
    await writer.close();
  }

  deps.segmentRanges.set(downloadId, segmentRanges);

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

  return { dirHandle, totalBytes, opfsFilename, outputMimeType, isFmp4 };
}

/**
 * Save the streamed file to the user's Downloads folder.
 *
 * For fMP4 (.m4s) playlists: the concatenated init + segments already form
 * a valid fragmented MP4 file — NO transmuxing needed. Save as .mp4 directly.
 *
 * For .ts playlists: attempt transmux conversion (TS→MP4) if configured.
 * Fallback to .ts if conversion fails or is disabled.
 */
async function saveStreamedMedia(
  downloadId: string,
  streamed: StreamedMedia,
  deps: M3u8DownloadDeps,
  signal?: AbortSignal,
): Promise<void> {
  deps.throwIfCancelled(signal);
  const shouldConvert = deps.shouldConvert(streamed.totalBytes);

  if (streamed.isFmp4) {
    deps.reportProgress('converting', 98, undefined, undefined, streamed.totalBytes, streamed.totalBytes);
    const savedFilename = deps.resolveFilename('mp4');
    deps.throwIfCancelled(signal);
    await deps.saveOpfsFile(
      streamed.opfsFilename,
      savedFilename,
      streamed.outputMimeType,
    );
  } else if (shouldConvert && deps.convertCallback) {
    deps.reportProgress('converting', 85, undefined, undefined, streamed.totalBytes, streamed.totalBytes);
    const convertStartedAt = performance.now();
    try {
      const result = await deps.convertCallback(streamed.dirHandle, downloadId);
      const savedFilename = deps.resolveFilename('mp4');
      deps.reportProgress('converting', 98, undefined, undefined, streamed.totalBytes, streamed.totalBytes);

      deps.throwIfCancelled(signal);
      await deps.saveOpfsFile(
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
      const savedFilename = deps.resolveFilename('ts');
      deps.throwIfCancelled(signal);
      await deps.saveOpfsFile(
        streamed.opfsFilename,
        savedFilename,
        'video/mp2t',
      );
    }
  } else {
    const savedFilename = deps.resolveFilename('ts');
    deps.throwIfCancelled(signal);
    await deps.saveOpfsFile(
      streamed.opfsFilename,
      savedFilename,
      'video/mp2t',
    );
  }
}

/**
 * Download an m3u8 video: resolve the media playlist → stream segments into
 * OPFS → convert (optional) → save → cleanup OPFS temp files.
 */
export async function downloadM3u8Video(
  video: DetectedVideo,
  downloadId: string,
  deps: M3u8DownloadDeps,
  signal?: AbortSignal,
): Promise<void> {
  deps.reportProgress('downloading', 0);

  const playlist = await resolveMediaPlaylist(video, deps, signal);

  deps.throwIfCancelled(signal);

  const streamed = await streamSegmentsToOpfs(video, downloadId, playlist, deps, signal);

  await saveStreamedMedia(downloadId, streamed, deps, signal);

  deps.throwIfCancelled(signal);

  await deleteDownloadSubdir(downloadId).catch((err: unknown) => {
    console.warn(`[downloader] OPFS cleanup failed for ${downloadId}:`, err);
  });
  deps.segmentRanges.delete(downloadId);

  deps.reportProgress('done', 100);
}
