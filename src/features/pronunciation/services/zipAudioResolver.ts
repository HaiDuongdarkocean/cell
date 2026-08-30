/**
 * Resolve audio file paths from local `.dsl.files.zip` archives.
 *
 * Supports two package layouts:
 * - `single`: one `.dsl.files.zip` containing all audio files.
 * - `split`: many smaller zips named by the first letter of the term
 *   (e.g. `ForvoEnglish_h.zip`).
 *
 * Both resolvers use `unzipit` so only the central directory and the
 * requested entry are decompressed, keeping memory low for the 3.4 GB archive.
 */

import { unzip } from 'unzipit';
import type { ZipInfo, ZipEntry } from 'unzipit';

export interface ZipAudioResolver {
  /** Return the audio file as a Blob, or undefined if not found. */
  resolveAudio(term: string, audioPath: string): Promise<Blob | undefined>;
}

function basename(path: string): string {
  return path.replace(/^.*[/\\]/, '');
}

function findEntryByBasename(entries: Record<string, ZipEntry>, name: string): ZipEntry | undefined {
  const normalized = basename(name).toLowerCase();
  for (const [entryName, entry] of Object.entries(entries)) {
    if (!entry.isDirectory && basename(entryName).toLowerCase() === normalized) {
      return entry;
    }
  }
  return undefined;
}

/** Open and cache a single zip from a file provider. */
class LazyZip {
  private promise: Promise<ZipInfo> | null = null;

  constructor(private readonly getFile: () => Promise<File>) {}

  async entries(): Promise<Record<string, ZipEntry>> {
    if (!this.promise) {
      this.promise = (async () => {
        const file = await this.getFile();
        return unzip(file);
      })();
    }
    const info = await this.promise;
    return info.entries;
  }
}

/** Resolver for a single `.dsl.files.zip`. */
export class SingleZipAudioResolver implements ZipAudioResolver {
  private readonly zip: LazyZip;

  constructor(getFile: () => Promise<File>) {
    this.zip = new LazyZip(getFile);
  }

  async resolveAudio(_term: string, audioPath: string): Promise<Blob | undefined> {
    const entries = await this.zip.entries();
    const entry = entries[audioPath] ?? findEntryByBasename(entries, audioPath);
    if (!entry) return undefined;
    return entry.blob('audio/mpeg');
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

  async resolveAudio(term: string, audioPath: string): Promise<Blob | undefined> {
    const zip = await this.getArchive(term);
    if (!zip) return undefined;
    const entries = await zip.entries();
    const entry = entries[audioPath] ?? findEntryByBasename(entries, audioPath);
    if (!entry) return undefined;
    return entry.blob('audio/mpeg');
  }
}
