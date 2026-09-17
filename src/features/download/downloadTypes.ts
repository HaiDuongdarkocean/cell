import type { DownloadProgress } from '@/entities/media';

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
