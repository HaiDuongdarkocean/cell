import {
  appendChunk,
  createOpfsWriter,
  deleteFile,
  isOpfsAvailable,
  readFile,
  type OpfsWriter,
} from '@/shared/lib/storage/opfsStorage';

const CONDENSED_DIR = 'condensed';

export async function ensureCondensedDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(CONDENSED_DIR, { create: true });
}

export function outputNameFor(recordId: string, ext: string): string {
  return `${recordId}.${ext}`;
}

export function partNameFor(recordId: string, ext = 'part.webm'): string {
  return `${recordId}.${ext}`;
}

export async function readCondensedFile(recordId: string, ext: string): Promise<File> {
  const dir = await ensureCondensedDir();
  return readFile(dir, outputNameFor(recordId, ext));
}

export async function appendPartChunk(
  recordId: string,
  chunk: ArrayBuffer | Uint8Array,
): Promise<void> {
  const dir = await ensureCondensedDir();
  await appendChunk(dir, partNameFor(recordId), chunk);
}

export async function createPartWriter(recordId: string): Promise<OpfsWriter> {
  const dir = await ensureCondensedDir();
  return createOpfsWriter(dir, partNameFor(recordId));
}

export async function writeOutputFile(
  recordId: string,
  ext: string,
  data: Uint8Array,
): Promise<void> {
  const dir = await ensureCondensedDir();
  const fileHandle = await dir.getFileHandle(outputNameFor(recordId, ext), { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(data as unknown as ArrayBuffer);
  } finally {
    await writable.close();
  }
}

export async function condensedFileExists(recordId: string, ext: string): Promise<boolean> {
  try {
    const dir = await ensureCondensedDir();
    await dir.getFileHandle(outputNameFor(recordId, ext));
    return true;
  } catch {
    return false;
  }
}

export async function readPartFile(recordId: string): Promise<File> {
  const dir = await ensureCondensedDir();
  return readFile(dir, partNameFor(recordId));
}

export async function partFileExists(recordId: string): Promise<boolean> {
  try {
    const dir = await ensureCondensedDir();
    await dir.getFileHandle(partNameFor(recordId));
    return true;
  } catch {
    return false;
  }
}

export async function deletePartFile(recordId: string): Promise<void> {
  const dir = await ensureCondensedDir();
  await deleteFile(dir, partNameFor(recordId)).catch(() => undefined);
}

export async function deleteCondensedFiles(recordId: string): Promise<void> {
  const dir = await ensureCondensedDir();
  const candidates = [partNameFor(recordId), outputNameFor(recordId, 'mp3'), outputNameFor(recordId, 'm4a'), outputNameFor(recordId, 'opus')];
  for (const name of candidates) {
    await deleteFile(dir, name).catch(() => undefined);
  }
}

export { isOpfsAvailable };
