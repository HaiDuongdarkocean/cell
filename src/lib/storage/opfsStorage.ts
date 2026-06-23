/**
 * Origin Private File System (OPFS) helpers for streaming download + convert.
 *
 * OPFS is shared within the extension origin, so the service worker (downloader)
 * and the offscreen document (transmuxer) can read/write the same files without
 * passing large buffers through `chrome.runtime.sendMessage` (which is capped
 * at ~64MB).
 *
 * All temp files live under `downloads/{downloadId}/` and are cleaned up after
 * `chrome.downloads.download` completes (or on cancel / startup orphan sweep).
 */

const DOWNLOADS_DIR = 'downloads';

/**
 * The TypeScript DOM lib types for `FileSystemDirectoryHandle` include async
 * iterator methods but with a type that is awkward to use. We cast to a
 * minimal interface for the cleanup function's `for await` loops.
 */
type AsyncIterableDir = {
  values(): AsyncIterableIterator<FileSystemHandle>;
};

/** Ensure the top-level `downloads` directory exists and return its handle. */
export async function ensureDownloadDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DOWNLOADS_DIR, { create: true });
}

/** Ensure a per-download subdirectory exists and return its handle. */
export async function ensureDownloadSubdir(
  downloadId: string,
): Promise<FileSystemDirectoryHandle> {
  const dir = await ensureDownloadDir();
  return dir.getDirectoryHandle(downloadId, { create: true });
}

/**
 * Append a chunk (`ArrayBuffer | Blob | Uint8Array`) to a file inside OPFS,
 * creating the file if it does not yet exist.
 *
 * **Important:** `createWritable({ keepExistingData: true })` preserves the
 * existing file content but resets the write cursor to offset 0. Without an
 * explicit `seek()` to the end of the file, each call would **overwrite** the
 * beginning of the file instead of appending — resulting in a file that only
 * contains the last chunk written. We must read the current file size and
 * `seek()` to that offset before writing.
 */
export async function appendChunk(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
  chunk: ArrayBuffer | Blob | Uint8Array,
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });

  // Read the current file size so we can seek to the end before writing.
  // On first call the file is empty (size 0), so seek(0) is a no-op.
  const existingFile = await fileHandle.getFile();
  const writeOffset = existingFile.size;

  const writable = await fileHandle.createWritable({ keepExistingData: true });
  try {
    // Seek to end of existing data so the new chunk is appended, not
    // overwriting from offset 0.
    await writable.seek(writeOffset);

    // Pass the chunk directly — FileSystemWritableFileStream.write() accepts
    // BufferSource (Uint8Array) and Blob without wrapping. Cast to satisfy
    // the TS lib's strict SharedArrayBuffer vs ArrayBuffer distinction.
    await writable.write(chunk as unknown as ArrayBuffer);
  } finally {
    await writable.close();
  }
}

/**
 * A writable stream to an OPFS file that stays open across multiple `write()`
 * calls. This avoids the per-chunk overhead of `appendChunk()` (which opens,
 * seeks, writes, and closes the stream for every single segment).
 *
 * Created by {@link createOpfsWriter}. Call `close()` exactly once when done.
 */
export interface OpfsWriter {
  /** Append a chunk to the end of the open writable stream. */
  write(chunk: ArrayBuffer | Blob | Uint8Array): Promise<void>;
  /** Flush and close the stream. Must be called exactly once. */
  close(): Promise<void>;
}

/**
 * Open a single writable stream to an OPFS file for sequential appends.
 *
 * Unlike {@link appendChunk}, which opens/closes the stream per chunk, this
 * keeps the stream open so callers can write many chunks efficiently. The
 * stream starts empty (no `keepExistingData`); all content is written via
 * `write()` calls.
 *
 * @returns An {@link OpfsWriter} — call `write()` for each chunk, then
 *          `close()` once at the end.
 */
export async function createOpfsWriter(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
): Promise<OpfsWriter> {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();

  return {
    async write(chunk: ArrayBuffer | Blob | Uint8Array): Promise<void> {
      // FileSystemWritableFileStream.write() accepts BufferSource (Uint8Array)
      // or Blob directly. Passing the raw Uint8Array avoids creating a Blob
      // object per write — for a 430MB file this saves thousands of Blob
      // allocations and significant GC pressure.
      if (chunk instanceof Blob) {
        await writable.write(chunk);
      } else if (chunk instanceof ArrayBuffer) {
        await writable.write(chunk);
      } else {
        // Uint8Array — pass directly as BufferSource. Cast to satisfy the
        // TS lib's strict SharedArrayBuffer vs ArrayBuffer distinction.
        await writable.write(chunk as unknown as ArrayBuffer);
      }
    },
    async close(): Promise<void> {
      await writable.close();
    },
  };
}

/** Read a file from OPFS as a `File` (can be sliced for chunked reading). */
export async function readFile(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
): Promise<File> {
  const fileHandle = await dirHandle.getFileHandle(filename);
  return fileHandle.getFile();
}

/** Delete a file from OPFS. No-op if the file does not exist. */
export async function deleteFile(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
): Promise<void> {
  try {
    await dirHandle.removeEntry(filename);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'NotFoundError') {
      return;
    }
    throw err;
  }
}

/** Recursively delete a per-download subdirectory. No-op if missing. */
export async function deleteDownloadSubdir(
  downloadId: string,
): Promise<void> {
  try {
    const dir = await ensureDownloadDir();
    await dir.removeEntry(downloadId, { recursive: true });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'NotFoundError') {
      return;
    }
    throw err;
  }
}

/**
 * Sweep the `downloads/` directory and remove subdirectories older than
 * `maxAgeMs`. Used on extension startup to clean up orphaned temp files from
 * crashed sessions.
 */
export async function cleanupOrphanedDownloads(
  maxAgeMs: number = 24 * 60 * 60 * 1000,
): Promise<string[]> {
  const removed: string[] = [];
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await ensureDownloadDir();
  } catch {
    return removed;
  }

  const now = Date.now();
  // `values()` async iterator yields directory handles (subdirs per download).
  // Cast to `AsyncIterableDir` because the TS lib's iterator type is awkward.
  for await (const entry of (dir as unknown as AsyncIterableDir).values()) {
    if (entry.kind !== 'directory') continue;
    try {
      const subdir = await dir.getDirectoryHandle(entry.name);
      // Check the newest file's lastModified as the proxy for "last activity".
      let newest = 0;
      for await (const fileEntry of (subdir as unknown as AsyncIterableDir).values()) {
        if (fileEntry.kind !== 'file') continue;
        const file = await (
          await subdir.getFileHandle(fileEntry.name)
        ).getFile();
        if (file.lastModified > newest) newest = file.lastModified;
      }
      if (newest === 0 || now - newest > maxAgeMs) {
        await dir.removeEntry(entry.name, { recursive: true });
        removed.push(entry.name);
      }
    } catch {
      // Best-effort; skip entries we can't inspect.
    }
  }
  return removed;
}

/** Feature-detect OPFS availability (some older Chrome versions lack it). */
export function isOpfsAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage !== 'undefined' &&
    typeof navigator.storage.getDirectory === 'function'
  );
}

/**
 * Returns true if the error is an OPFS / disk quota exceeded error.
 *
 * Browsers throw a `DOMException` with `name === 'QuotaExceededError'` when
 * OPFS storage limits are hit (typically ~10% of free disk space). Callers
 * should catch this, clean up partial files, and surface a clear message.
 */
export function isQuotaExceededError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'QuotaExceededError';
}
