/**
 * Resolve audio file paths from local `.dsl.files.zip` archives.
 *
 * Supports two package layouts:
 * - `single`: one `.dsl.files.zip` containing all audio files.
 * - `split`: many smaller zips named by the first letter of the term
 *   (e.g. `ForvoEnglish_h.zip`).
 *
 * Lookups never parse the whole archive: the central directory region is
 * read once per archive (and kept for the resolver's lifetime), each
 * requested path is located by a byte-level scan of that region, and the
 * entry payload is fetched with a ranged `File.slice()` plus raw-deflate
 * decompression. `unzipit` remains as a fallback for archives the scanner
 * rejects.
 */

import { unzip } from 'unzipit';
import type { ZipEntry } from 'unzipit';
import {
  matchCentralDirectoryEntries,
  readCentralDirectory,
  readRange,
  type ZipEntryMeta,
} from './zipDirectoryScanner';

export interface ZipAudioResolver {
  /** Return the audio file as raw bytes, or undefined if not found. */
  resolveAudio(term: string, audioPath: string): Promise<Uint8Array | undefined>;
  /** Batch variant: resolves many paths with a single archive scan. */
  resolveAudios?(
    term: string,
    audioPaths: readonly string[],
  ): Promise<(Uint8Array | undefined)[]>;
}

function basename(path: string): string {
  return path.replace(/^.*[/\\]/, '');
}

const LOCAL_HEADER_SIZE = 30;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;

async function inflateRawDeflate(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const writeDone = writer.write(data).then(() => writer.close());
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await writeDone;
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

async function readEntryBytes(file: File, meta: ZipEntryMeta): Promise<Uint8Array | undefined> {
  try {
    const head = await readRange(file, meta.offset, meta.offset + LOCAL_HEADER_SIZE);
    if (head.length < LOCAL_HEADER_SIZE) return undefined;
    const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
    if (view.getUint32(0, true) !== LOCAL_HEADER_SIGNATURE) return undefined;
    const dataStart =
      meta.offset + LOCAL_HEADER_SIZE + view.getUint16(26, true) + view.getUint16(28, true);
    const raw = await readRange(file, dataStart, dataStart + meta.compressedSize);
    return meta.method === 8 ? inflateRawDeflate(raw) : raw;
  } catch {
    return undefined;
  }
}

function localHeaderOffset(entry: ZipEntry): number | undefined {
  const raw = (entry as unknown as { _rawEntry?: { relativeOffsetOfLocalHeader?: number } })
    ._rawEntry;
  return raw?.relativeOffsetOfLocalHeader;
}

function collectEntryMeta(entries: Record<string, ZipEntry>): Record<string, ZipEntryMeta> {
  const out: Record<string, ZipEntryMeta> = {};
  for (const [name, entry] of Object.entries(entries)) {
    const offset = localHeaderOffset(entry);
    if (entry.isDirectory || entry.encrypted) continue;
    if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8) continue;
    if (offset === undefined) continue;
    out[name] = { offset, compressedSize: entry.compressedSize, method: entry.compressionMethod };
  }
  return out;
}

/**
 * Lazily resolves entries from one archive. The central directory bytes are
 * fetched once and reused for every lookup; when the scanner cannot parse
 * the archive, `unzipit` provides a fallback entry table.
 */
class LazyZip {
  private filePromise: Promise<File> | null = null;
  private cdPromise: Promise<Uint8Array<ArrayBuffer>> | null = null;
  private fallbackDirPromise: Promise<Record<string, ZipEntryMeta>> | null = null;
  private basenameIndex: Map<string, ZipEntryMeta> | null = null;
  private readonly metaCache = new Map<string, ZipEntryMeta | null>();

  constructor(private readonly getFile: () => Promise<File>) {}

  private file(): Promise<File> {
    if (!this.filePromise) this.filePromise = this.getFile();
    return this.filePromise;
  }

  private centralDirectory(file: File): Promise<Uint8Array<ArrayBuffer>> {
    if (!this.cdPromise) this.cdPromise = readCentralDirectory(file);
    return this.cdPromise;
  }

  private fallbackDir(file: File): Promise<Record<string, ZipEntryMeta>> {
    if (!this.fallbackDirPromise) {
      this.fallbackDirPromise = unzip(file).then((info) => collectEntryMeta(info.entries));
    }
    return this.fallbackDirPromise;
  }

  private lookupMeta(
    entries: Record<string, ZipEntryMeta>,
    path: string,
  ): ZipEntryMeta | undefined {
    const exact = entries[path];
    if (exact) return exact;
    if (!this.basenameIndex) {
      this.basenameIndex = new Map();
      for (const [name, meta] of Object.entries(entries)) {
        this.basenameIndex.set(basename(name).toLowerCase(), meta);
      }
    }
    return this.basenameIndex.get(basename(path).toLowerCase());
  }

  async readMany(paths: readonly string[]): Promise<(Uint8Array | undefined)[]> {
    const file = await this.file();
    try {
      const uncached = paths.filter((path) => !this.metaCache.has(path));
      if (uncached.length > 0) {
        const found = matchCentralDirectoryEntries(
          await this.centralDirectory(file),
          uncached,
        );
        uncached.forEach((path, i) => this.metaCache.set(path, found[i] ?? null));
      }
      return Promise.all(
        paths.map(async (path) => {
          const meta = this.metaCache.get(path);
          return meta ? readEntryBytes(file, meta) : undefined;
        }),
      );
    } catch {
      const entries = await this.fallbackDir(file);
      return Promise.all(
        paths.map(async (path) => {
          const meta = this.lookupMeta(entries, path);
          return meta ? readEntryBytes(file, meta) : undefined;
        }),
      );
    }
  }

  async read(path: string): Promise<Uint8Array | undefined> {
    return (await this.readMany([path]))[0];
  }
}

/** Resolver for a single `.dsl.files.zip`. */
export class SingleZipAudioResolver implements ZipAudioResolver {
  private readonly zip: LazyZip;

  constructor(getFile: () => Promise<File>) {
    this.zip = new LazyZip(getFile);
  }

  async resolveAudio(_term: string, audioPath: string): Promise<Uint8Array | undefined> {
    return this.zip.read(audioPath);
  }

  async resolveAudios(
    _term: string,
    audioPaths: readonly string[],
  ): Promise<(Uint8Array | undefined)[]> {
    return this.zip.readMany(audioPaths);
  }
}

/** Resolver for a split package: one zip per first-letter of term. */
export class SplitZipAudioResolver implements ZipAudioResolver {
  private readonly cache = new Map<string, LazyZip>();

  constructor(
    private readonly directoryHandle: FileSystemDirectoryHandle,
    private readonly pattern: string,
  ) {}

  private firstLetter(term: string): string {
    const normalized = term.normalize('NFC').trim().toLowerCase();
    // For non-Latin scripts the first code point is used; the user is expected
    // to pre-split packages with the right pattern.
    for (const char of normalized) {
      if (/\p{L}/u.test(char)) return char;
    }
    return '_';
  }

  private archiveName(term: string): string {
    return this.pattern.replaceAll('{firstLetter}', this.firstLetter(term));
  }

  private async getArchive(term: string): Promise<LazyZip | undefined> {
    const name = this.archiveName(term);
    let zip = this.cache.get(name);
    if (!zip) {
      let handle: FileSystemFileHandle;
      try {
        handle = await this.directoryHandle.getFileHandle(name);
      } catch {
        return undefined;
      }
      zip = new LazyZip(() => handle.getFile());
      this.cache.set(name, zip);
    }
    return zip;
  }

  async resolveAudio(term: string, audioPath: string): Promise<Uint8Array | undefined> {
    const zip = await this.getArchive(term);
    if (!zip) return undefined;
    return zip.read(audioPath);
  }

  async resolveAudios(
    term: string,
    audioPaths: readonly string[],
  ): Promise<(Uint8Array | undefined)[]> {
    const zip = await this.getArchive(term);
    if (!zip) return audioPaths.map(() => undefined);
    return zip.readMany(audioPaths);
  }
}
