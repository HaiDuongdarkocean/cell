// fileDetector — validate, magic bytes, gunzip, unzip (ADR-023 D4, spec F8).
//
// fflate cho cả gzip + zip (1 lib ~30KB, fewer code paths). Pure functions,
// content-script-safe (no DOM). 500MB boundary reject before parse.

import { gunzipSync, unzipSync, strFromU8 } from 'fflate';
import type { ImportFormat } from '@/entities/dictionary';

/** Max file size: 500MB (spec F8). */
export const MAX_FILE_SIZE = 500 * 1024 * 1024;

/** Magic bytes signatures. */
const MAGIC = {
  GZIP: [0x1f, 0x8b],
  ZIP: [0x50, 0x4b, 0x03, 0x04],
  ZIP_EMPTY: [0x50, 0x4b, 0x05, 0x06],
  ZIP_SPANNED: [0x50, 0x4b, 0x07, 0x08],
  SQLITE: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00],
} as const;

/** Validate file size ≤ 500MB. Throws RangeError if exceeded. */
export function validateFile(file: { size: number; name: string }): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new RangeError(
      `File "${file.name}" is ${formatBytes(file.size)} — exceeds 500MB limit (spec F8).`,
    );
  }
}

/** Format bytes as human-readable string. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

/** Read first N magic bytes from a Uint8Array. */
export function readMagicBytes(data: Uint8Array, count: number): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < Math.min(count, data.length); i++) {
    bytes.push(data[i]!);
  }
  return bytes;
}

/** Check if data starts with given magic bytes. */
function startsWith(data: Uint8Array, magic: readonly number[]): boolean {
  if (data.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (data[i] !== magic[i]) return false;
  }
  return true;
}

/** Detect gzip via magic bytes 1F 8B. */
export function isGzip(data: Uint8Array): boolean {
  return startsWith(data, MAGIC.GZIP);
}

/** Detect zip via magic bytes PK\x03\x04 (or empty/spanned variants). */
export function isZip(data: Uint8Array): boolean {
  return (
    startsWith(data, MAGIC.ZIP) ||
    startsWith(data, MAGIC.ZIP_EMPTY) ||
    startsWith(data, MAGIC.ZIP_SPANNED)
  );
}

/** Detect SQLite via magic bytes "SQLite format 1\0". */
export function isSqlite(data: Uint8Array): boolean {
  return startsWith(data, MAGIC.SQLITE);
}

/** Gunzip a Uint8Array (fflate). Throws if not gzip or corrupt. */
export function gunzipFile(compressed: Uint8Array): Uint8Array {
  if (!isGzip(compressed)) {
    throw new Error('Not a gzip file (magic bytes 1F 8B missing).');
  }
  try {
    return gunzipSync(compressed);
  } catch (e) {
    throw new CorruptedFileError('gunzip failed — corrupt gzip data', e);
  }
}

/** Unzip a Uint8Array → { [path]: Uint8Array } (fflate). Throws if not zip or corrupt. */
export function unzipAll(compressed: Uint8Array): Record<string, Uint8Array> {
  if (!isZip(compressed)) {
    throw new Error('Not a zip file (magic bytes PK missing).');
  }
  try {
    return unzipSync(compressed);
  } catch (e) {
    throw new CorruptedFileError('unzip failed — corrupt zip data', e);
  }
}

/** List zip entry paths (without extracting). */
export function listZipEntries(compressed: Uint8Array): string[] {
  const files = unzipAll(compressed);
  return Object.keys(files);
}

/** Extract a single file from a zip by path. Throws if not found. */
export function extractZipFile(compressed: Uint8Array, path: string): Uint8Array {
  const files = unzipAll(compressed);
  const file = files[path];
  if (!file) {
    throw new Error(`Zip entry "${path}" not found. Available: ${Object.keys(files).join(', ')}`);
  }
  return file;
}

/** Decode Uint8Array to string (UTF-8). */
export function decodeText(data: Uint8Array): string {
  return strFromU8(data);
}

/** Get file extension (without dot, lowercase). */
export function getExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot < 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

/** Remove extension from filename. */
export function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return name;
  return name.slice(0, dot);
}

/** Custom error for corrupt compressed files (rollback trigger). */
export class CorruptedFileError extends Error {
  readonly cause: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'CorruptedFileError';
    this.cause = cause;
  }
}

/** Minimal file-like interface for reading bytes. */
export interface ReadableFile {
  readonly size: number;
  readonly name: string;
  slice(start: number, end: number): { arrayBuffer(): Promise<ArrayBuffer> };
}

/** Read file as Uint8Array (from File/Blob or ReadableFile). */
export async function readFileBytes(file: ReadableFile): Promise<Uint8Array> {
  const buffer = await file.slice(0, file.size).arrayBuffer();
  return new Uint8Array(buffer);
}

/** Read first 1MB of a file as Uint8Array (for signature — ADR-023 D7). */
export async function readFileHead(file: ReadableFile, maxBytes = 1024 * 1024): Promise<Uint8Array> {
  const slice = file.slice(0, Math.min(maxBytes, file.size));
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

/** Detect format by file extension (fallback when magic bytes inconclusive). */
export function detectByExtension(name: string): ImportFormat | null {
  const ext = getExtension(name);
  // .gz → check inner extension
  if (ext === 'gz') {
    const inner = getExtension(stripExtension(name));
    if (inner === 'db') return 'sqlite';
    return null;
  }
  if (ext === 'txt') return 'txt';
  if (ext === 'json') return 'json-array';
  if (ext === 'zip') return 'yomitan'; // zip → yomitan or txt-zipped, decide by content
  if (ext === 'db') return 'sqlite';
  return null;
}
