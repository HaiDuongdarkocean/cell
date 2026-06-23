/**
 * Unit tests for OPFS storage helpers.
 *
 * jsdom does not provide `navigator.storage.getDirectory()`, so we install a
 * minimal in-memory mock that implements the subset of the FileSystem API used
 * by `opfsStorage.ts`: `getDirectoryHandle`, `getFileHandle`, `createWritable`,
 * `removeEntry`, and the async `values()` iterator.
 */

// ---- In-memory OPFS mock ----

interface MockFile {
  data: Uint8Array;
  lastModified: number;
}

class MockFileHandle {
  constructor(public name: string, public file: MockFile) {}

  async getFile(): Promise<File> {
    return new File([this.file.data.slice().buffer], this.name, {
      type: 'application/octet-stream',
      lastModified: this.file.lastModified,
    });
  }

  /**
   * Simulate the real browser `createWritable()` semantics:
   *
   * - `keepExistingData: true` → the writable starts with the existing file
   *   content, but the **write cursor is at offset 0**, NOT at the end.
   *   Without an explicit `seek()`, `write()` overwrites from the beginning.
   * - `keepExistingData: false` (default) → the writable starts empty.
   *
   * `write()` writes at the current cursor position, overwriting existing
   * bytes and extending the buffer if the cursor goes past the end.
   * `seek()` moves the cursor.
   * `close()` commits the buffer to the file handle.
   */
  async createWritable(opts?: { keepExistingData?: boolean }): Promise<{
    write: (data: ArrayBuffer | Blob | Uint8Array) => Promise<void>;
    seek: (position: number) => Promise<void>;
    close: () => Promise<void>;
  }> {
    const keep = opts?.keepExistingData ?? false;
    // Start with a copy of existing data (if keeping) or empty.
    let buffer = keep ? this.file.data.slice() : new Uint8Array();
    let position = 0; // Cursor always starts at 0, even with keepExistingData.
    let closed = false;
    const handle = this;

    return {
      async write(data: ArrayBuffer | Blob | Uint8Array): Promise<void> {
        if (closed) throw new DOMException('Writable closed', 'InvalidStateError');
        let bytes: Uint8Array;
        if (data instanceof Uint8Array) {
          bytes = data;
        } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
          const ab = await data.arrayBuffer();
          bytes = new Uint8Array(ab);
        } else if (data instanceof ArrayBuffer) {
          bytes = new Uint8Array(data);
        } else {
          bytes = new Uint8Array(data as unknown as ArrayBuffer);
        }

        // If writing past the current buffer end, extend it.
        const endPos = position + bytes.length;
        if (endPos > buffer.length) {
          const extended = new Uint8Array(endPos);
          extended.set(buffer);
          buffer = extended;
        }
        // Write bytes at the current cursor position (overwrites existing).
        buffer.set(bytes, position);
        position = endPos;
      },
      async seek(pos: number): Promise<void> {
        if (closed) throw new DOMException('Writable closed', 'InvalidStateError');
        position = pos;
      },
      async close(): Promise<void> {
        if (closed) return;
        closed = true;
        handle.file.data = buffer;
        handle.file.lastModified = Date.now();
      },
    };
  }
}

class MockDirHandle {
  files = new Map<string, MockFileHandle>();
  dirs = new Map<string, MockDirHandle>();

  constructor(public name: string) {}

  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MockFileHandle> {
    const existing = this.files.get(name);
    if (existing) return existing;
    if (opts?.create) {
      const h = new MockFileHandle(name, { data: new Uint8Array(), lastModified: Date.now() });
      this.files.set(name, h);
      return h;
    }
    throw new DOMException(`File not found: ${name}`, 'NotFoundError');
  }

  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<MockDirHandle> {
    const existing = this.dirs.get(name);
    if (existing) return existing;
    if (opts?.create) {
      const d = new MockDirHandle(name);
      this.dirs.set(name, d);
      return d;
    }
    throw new DOMException(`Dir not found: ${name}`, 'NotFoundError');
  }

  async removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void> {
    if (this.files.delete(name)) return;
    if (this.dirs.has(name)) {
      if (!opts?.recursive) {
        const sub = this.dirs.get(name)!;
        if (sub.files.size > 0 || sub.dirs.size > 0) {
          throw new DOMException('Directory not empty', 'InvalidModificationError');
        }
      }
      this.dirs.delete(name);
      return;
    }
    throw new DOMException(`Entry not found: ${name}`, 'NotFoundError');
  }

  async *values(): AsyncIterableIterator<
    { kind: 'file'; name: string } | { kind: 'directory'; name: string }
  > {
    for (const name of this.files.keys()) yield { kind: 'file', name };
    for (const name of this.dirs.keys()) yield { kind: 'directory', name };
  }
}

const rootDir = new MockDirHandle('root');

const storageMock = {
  getDirectory: async () => rootDir,
};

// jsdom's Blob lacks `arrayBuffer()` (it only has the legacy `slice`/`text`).
// Polyfill it so the production code path that calls `blob.arrayBuffer()` works.
beforeAll(() => {
  Object.defineProperty(globalThis.navigator, 'storage', {
    value: storageMock,
    configurable: true,
  });
  if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
    Blob.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }
  // File extends Blob, but jsdom may not inherit the polyfill automatically.
  if (typeof File !== 'undefined' && typeof File.prototype.arrayBuffer !== 'function') {
    File.prototype.arrayBuffer = Blob.prototype.arrayBuffer as never;
  }
});

// Reset between tests so directory state doesn't leak.
beforeEach(() => {
  rootDir.files.clear();
  rootDir.dirs.clear();
});

import {
  ensureDownloadDir,
  ensureDownloadSubdir,
  appendChunk,
  createOpfsWriter,
  readFile,
  deleteFile,
  deleteDownloadSubdir,
  cleanupOrphanedDownloads,
  isOpfsAvailable,
} from '@/lib/storage/opfsStorage';

describe('opfsStorage', () => {
  describe('isOpfsAvailable', () => {
    it('returns true when navigator.storage.getDirectory exists', () => {
      expect(isOpfsAvailable()).toBe(true);
    });
  });

  describe('ensureDownloadDir', () => {
    it('creates and returns the downloads directory', async () => {
      const dir = await ensureDownloadDir();
      expect(dir).toBeInstanceOf(MockDirHandle);
      expect(dir.name).toBe('downloads');
    });

    it('returns the same directory on second call', async () => {
      const a = await ensureDownloadDir();
      const b = await ensureDownloadDir();
      expect(a).toBe(b);
    });
  });

  describe('ensureDownloadSubdir', () => {
    it('creates a per-download subdirectory', async () => {
      const sub = await ensureDownloadSubdir('dl-1');
      expect(sub.name).toBe('dl-1');
    });
  });

  describe('appendChunk', () => {
    it('appends multiple chunks into a single file', async () => {
      const sub = await ensureDownloadSubdir('dl-append');
      await appendChunk(sub, 'input.ts', new Uint8Array([1, 2, 3]));
      await appendChunk(sub, 'input.ts', new Uint8Array([4, 5]));
      const file = await readFile(sub, 'input.ts');
      const bytes = new Uint8Array(await file.arrayBuffer());
      expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5]);
    });

    it('appends many chunks simulating real M3U8 segment download', async () => {
      // Simulate 10 segments of 1KB each → file must be ~10KB, not ~1KB.
      const sub = await ensureDownloadSubdir('dl-multi');
      const segmentSize = 1024;
      const numSegments = 10;
      for (let i = 0; i < numSegments; i++) {
        const chunk = new Uint8Array(segmentSize).fill(i + 1);
        await appendChunk(sub, 'input.ts', chunk);
      }
      const file = await readFile(sub, 'input.ts');
      const bytes = new Uint8Array(await file.arrayBuffer());
      // Total size must be numSegments * segmentSize, not just the last segment.
      expect(bytes.length).toBe(numSegments * segmentSize);
      // First byte of each segment region must match the segment index.
      for (let i = 0; i < numSegments; i++) {
        expect(bytes[i * segmentSize]).toBe(i + 1);
      }
    });

    it('overwrites when keepExistingData is not set on first write', async () => {
      const sub = await ensureDownloadSubdir('dl-overwrite');
      await appendChunk(sub, 'input.ts', new Uint8Array([10, 20]));
      const file = await readFile(sub, 'input.ts');
      expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array([10, 20]));
    });

    it('accepts Blob chunks', async () => {
      const sub = await ensureDownloadSubdir('dl-blob');
      await appendChunk(sub, 'input.ts', new Blob([new Uint8Array([7, 8, 9])]));
      const file = await readFile(sub, 'input.ts');
      expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array([7, 8, 9]));
    });
  });

  describe('createOpfsWriter', () => {
    it('writes multiple chunks via a single open stream', async () => {
      const sub = await ensureDownloadSubdir('dl-writer');
      const writer = await createOpfsWriter(sub, 'input.ts');
      await writer.write(new Uint8Array([1, 2, 3]));
      await writer.write(new Uint8Array([4, 5]));
      await writer.write(new Uint8Array([6]));
      await writer.close();

      const file = await readFile(sub, 'input.ts');
      const bytes = new Uint8Array(await file.arrayBuffer());
      expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('accepts Blob chunks', async () => {
      const sub = await ensureDownloadSubdir('dl-writer-blob');
      const writer = await createOpfsWriter(sub, 'input.ts');
      await writer.write(new Blob([new Uint8Array([10, 20])]));
      await writer.write(new Blob([new Uint8Array([30, 40, 50])]));
      await writer.close();

      const file = await readFile(sub, 'input.ts');
      const bytes = new Uint8Array(await file.arrayBuffer());
      expect(Array.from(bytes)).toEqual([10, 20, 30, 40, 50]);
    });

    it('accepts ArrayBuffer chunks', async () => {
      const sub = await ensureDownloadSubdir('dl-writer-ab');
      const writer = await createOpfsWriter(sub, 'input.ts');
      await writer.write(new ArrayBuffer(3));
      await writer.close();

      const file = await readFile(sub, 'input.ts');
      expect(file.size).toBe(3);
    });

    it('produces empty file if no writes before close', async () => {
      const sub = await ensureDownloadSubdir('dl-writer-empty');
      const writer = await createOpfsWriter(sub, 'input.ts');
      await writer.close();

      const file = await readFile(sub, 'input.ts');
      expect(file.size).toBe(0);
    });

    it('writes 100 chunks simulating real segment download', async () => {
      const sub = await ensureDownloadSubdir('dl-writer-100');
      const writer = await createOpfsWriter(sub, 'input.ts');
      const chunkSize = 1024;
      const numChunks = 100;
      for (let i = 0; i < numChunks; i++) {
        await writer.write(new Uint8Array(chunkSize).fill(i + 1));
      }
      await writer.close();

      const file = await readFile(sub, 'input.ts');
      const bytes = new Uint8Array(await file.arrayBuffer());
      expect(bytes.length).toBe(numChunks * chunkSize);
      // Verify first byte of each chunk region matches chunk index.
      for (let i = 0; i < numChunks; i++) {
        expect(bytes[i * chunkSize]).toBe(i + 1);
      }
    });
  });

  describe('deleteFile', () => {
    it('deletes an existing file', async () => {
      const sub = await ensureDownloadSubdir('dl-del');
      await appendChunk(sub, 'input.ts', new Uint8Array([1]));
      await deleteFile(sub, 'input.ts');
      await expect(readFile(sub, 'input.ts')).rejects.toThrow();
    });

    it('is a no-op when the file does not exist', async () => {
      const sub = await ensureDownloadSubdir('dl-del-noop');
      await expect(deleteFile(sub, 'missing.ts')).resolves.not.toThrow();
    });
  });

  describe('deleteDownloadSubdir', () => {
    it('recursively removes a download subdirectory', async () => {
      await ensureDownloadSubdir('dl-rm');
      await deleteDownloadSubdir('dl-rm');
      const dir = await ensureDownloadDir();
      await expect(dir.getDirectoryHandle('dl-rm')).rejects.toThrow();
    });

    it('is a no-op when the subdirectory does not exist', async () => {
      await expect(deleteDownloadSubdir('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('cleanupOrphanedDownloads', () => {
    it('removes subdirectories whose files are older than maxAgeMs', async () => {
      const sub = await ensureDownloadSubdir('dl-old');
      await appendChunk(sub, 'input.ts', new Uint8Array([1]));
      // Manually backdate the file's lastModified.
      const subMock = sub as unknown as MockDirHandle;
      const fileHandle = subMock.files.get('input.ts')!;
      fileHandle.file.lastModified = Date.now() - 48 * 60 * 60 * 1000; // 2 days ago

      const fresh = await ensureDownloadSubdir('dl-fresh');
      await appendChunk(fresh, 'input.ts', new Uint8Array([2]));

      const removed = await cleanupOrphanedDownloads(24 * 60 * 60 * 1000);
      expect(removed).toContain('dl-old');
      expect(removed).not.toContain('dl-fresh');
    });

    it('removes empty subdirectories', async () => {
      await ensureDownloadSubdir('dl-empty');
      const removed = await cleanupOrphanedDownloads(60_000);
      expect(removed).toContain('dl-empty');
    });
  });
});
