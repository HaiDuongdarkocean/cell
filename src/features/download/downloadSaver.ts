import { download as chromeDownload, searchDownloads } from '@/shared/lib/chrome-apis/downloads';
import {
  ensureDownloadSubdir,
  readFile as opfsReadFile,
} from '@/shared/lib/storage/opfsStorage';
import type { SaveOpfsFileCallback } from './downloadTypes';

/**
 * Filenames for extension-initiated downloads, keyed by the download URL.
 *
 * Edge (and some Chrome versions) ignore the `filename` parameter of
 * `chrome.downloads.download` when the URL is a `data:` URL — there is no
 * Content-Disposition header and no URL path to derive a name from, so the
 * browser falls back to the generic name "download" with no extension.
 * `chrome.downloads.onDeterminingFilename` is the only way to force the
 * filename in that case (see Chrome docs:
 * https://developer.chrome.com/docs/extensions/reference/api/downloads#event-onDeterminingFilename).
 *
 * `saveBlobToDownloads` records the desired filename under the exact URL it
 * passes to `chrome.downloads.download`; the background service worker
 * registers a single `onDeterminingFilename` listener that consumes the entry
 * keyed by `downloadItem.url` and calls `suggest({ filename })`. Keying by URL
 * keeps overlapping downloads from cross-assigning filenames, and entries are
 * consumed on first use so subsequent non-extension downloads are unaffected.
 *
 * Each URL maps to a FIFO queue of filenames rather than a single value:
 * `data:` URLs are content-derived, so two concurrent downloads of identical
 * content produce the same key. A plain Map would let the second registration
 * overwrite the first, leaving one download to fall back to the generic
 * "download" name once the shared entry is consumed. The queue preserves one
 * suggestion per `chrome.downloads.download` call, in registration order.
 */
export class PendingFilenameRegistry {
  private readonly queues = new Map<string, string[]>();

  /** Register the desired filename for an upcoming download of `url`. */
  register(url: string, filename: string): void {
    const queue = this.queues.get(url);
    if (queue) {
      queue.push(filename);
    } else {
      this.queues.set(url, [filename]);
    }
  }

  /**
   * Consume the oldest pending filename registered for `url` (used by the
   * onDeterminingFilename listener). Returns null when no extension-initiated
   * download with that URL is pending.
   */
  consume(url: string): string | null {
    const queue = this.queues.get(url);
    if (!queue || queue.length === 0) return null;
    const filename = queue.shift() as string;
    if (queue.length === 0) {
      this.queues.delete(url);
    }
    return filename;
  }

  /**
   * Drop a previously registered filename for `url` when the download request
   * itself fails (the onDeterminingFilename listener will never fire for it).
   * Removes the most recently registered matching entry.
   */
  release(url: string, filename: string): void {
    const queue = this.queues.get(url);
    if (!queue) return;
    const index = queue.lastIndexOf(filename);
    if (index >= 0) {
      queue.splice(index, 1);
    }
    if (queue.length === 0) {
      this.queues.delete(url);
    }
  }
}

/**
 * Convert a Blob to a base64 `data:` URL.
 *
 * Used instead of `URL.createObjectURL`, which is unavailable in Manifest V3
 * service workers. `btoa` and `Blob.arrayBuffer()` are both available in the
 * service worker global scope.
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
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

/**
 * Save a Blob via chrome.downloads.download.
 *
 * NOTE: In Manifest V3 the background runs as a service worker, where
 * `URL.createObjectURL` is unavailable. We therefore convert the blob to a
 * base64 `data:` URL (using `btoa`, which IS available in service workers)
 * and hand that to chrome.downloads.download.
 */
export async function saveBlobToDownloads(
  blob: Blob,
  filename: string,
  registry: PendingFilenameRegistry,
): Promise<void> {
  const url = await blobToDataUrl(blob);
  // Register the filename under this exact URL BEFORE calling
  // chrome.downloads.download so the onDeterminingFilename listener
  // (registered in background init) can force Edge to use it — Edge ignores
  // the `filename` param for data: URLs.
  registry.register(url, filename);
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
    registry.release(url, filename);
    console.error(`[downloader] saveBlob FAILED for filename="${filename}":`, err);
    throw err;
  }
}

/**
 * Save an OPFS file to the user's Downloads folder.
 *
 * Uses `saveViaBlobUrl` (offscreen-owned Blob URL) when available to avoid
 * materializing large files into memory. Falls back to `saveBlobToDownloads`
 * (data URL) only when the callback is unset — which is only safe for small
 * files and is primarily used in unit tests.
 */
export async function saveOpfsFileToDownloads(
  downloadId: string,
  opfsFilename: string,
  downloadFilename: string,
  mimeType: string,
  saveViaBlobUrl: SaveOpfsFileCallback | null,
  registry: PendingFilenameRegistry,
): Promise<void> {
  if (saveViaBlobUrl) {
    await saveViaBlobUrl(
      downloadId,
      opfsFilename,
      downloadFilename,
      mimeType,
    );
    return;
  }

  // Legacy fallback: read the OPFS file into memory and save via data URL.
  // This path is only safe for small files; large M3U8 downloads must wire
  // `saveViaBlobUrl` to avoid a memory spike.
  const dirHandle = await ensureDownloadSubdir(downloadId);
  const file = await opfsReadFile(dirHandle, opfsFilename);
  const blob = new Blob([await file.arrayBuffer()], { type: mimeType });
  await saveBlobToDownloads(blob, downloadFilename, registry);
}
