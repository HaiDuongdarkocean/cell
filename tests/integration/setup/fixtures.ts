/**
 * Shared fixtures for the integration test files (sequential, parallel, compare).
 *
 * Provides:
 *  - OPFS mock (MockFileHandle / MockDirHandle / root dir + navigator.storage)
 *  - MP4 box parsing helpers (parseBoxes / countBoxes)
 *  - loadCachedSegments(): reads the TS buffer + segmentRanges written by
 *    globalSetup.ts (so each split test file does NOT re-download).
 *  - setupOpfsWithInput(tsData): creates a fresh `downloads/dl-int` dir in the
 *    mock OPFS and writes `input.ts` into it. Returns the testDir handle.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import type { SegmentRange } from '@/types/media';

const CACHE_DIR = join(__dirname, '..', '.cache');
const TS_PATH = join(CACHE_DIR, 'input.ts');
const RANGES_PATH = join(CACHE_DIR, 'segmentRanges.json');

export function loadCachedSegments(): { tsData: Uint8Array; ranges: SegmentRange[] } {
  const tsData = new Uint8Array(readFileSync(TS_PATH));
  const ranges: SegmentRange[] = JSON.parse(readFileSync(RANGES_PATH, 'utf8'));
  return { tsData, ranges };
}

// --- OPFS mock ---

interface MockFile {
  data: Uint8Array;
  lastModified: number;
}

export class MockFileHandle {
  constructor(public name: string, public file: MockFile) {}

  async getFile(): Promise<File> {
    return new File([this.file.data.slice().buffer], this.name, {
      type: 'application/octet-stream',
      lastModified: this.file.lastModified,
    });
  }

  async createWritable(opts?: { keepExistingData?: boolean }): Promise<{
    write: (d: ArrayBuffer | Blob | Uint8Array | string) => Promise<void>;
    seek: (p: number) => Promise<void>;
    close: () => Promise<void>;
  }> {
    const keep = opts?.keepExistingData ?? false;
    let buffer = keep ? this.file.data.slice() : new Uint8Array();
    let position = 0;
    let closed = false;
    return {
      write: async (data) => {
        if (closed) throw new DOMException('Closed', 'InvalidStateError');
        let bytes: Uint8Array;
        if (typeof data === 'string')
          bytes = new Uint8Array(data.split('').map((c) => c.charCodeAt(0)));
        else if (data instanceof Uint8Array) bytes = data;
        else if (typeof Blob !== 'undefined' && data instanceof Blob)
          bytes = new Uint8Array(await data.arrayBuffer());
        else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
        else bytes = new Uint8Array(data as unknown as ArrayBuffer);
        const end = position + bytes.length;
        if (end > buffer.length) {
          const ext = new Uint8Array(end);
          ext.set(buffer);
          buffer = ext;
        }
        buffer.set(bytes, position);
        position = end;
      },
      seek: async (pos) => {
        if (closed) throw new DOMException('Closed', 'InvalidStateError');
        position = pos;
      },
      close: async () => {
        if (closed) return;
        closed = true;
        this.file.data = buffer;
        this.file.lastModified = Date.now();
      },
    };
  }
}

export class MockDirHandle {
  files = new Map<string, MockFileHandle>();
  dirs = new Map<string, MockDirHandle>();
  constructor(public name: string) {}

  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MockFileHandle> {
    const ex = this.files.get(name);
    if (ex) return ex;
    if (opts?.create) {
      const h = new MockFileHandle(name, { data: new Uint8Array(), lastModified: Date.now() });
      this.files.set(name, h);
      return h;
    }
    throw new DOMException(`Not found: ${name}`, 'NotFoundError');
  }

  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<MockDirHandle> {
    const ex = this.dirs.get(name);
    if (ex) return ex;
    if (opts?.create) {
      const d = new MockDirHandle(name);
      this.dirs.set(name, d);
      return d;
    }
    throw new DOMException(`Not found: ${name}`, 'NotFoundError');
  }

  async removeEntry(name: string): Promise<void> {
    if (this.files.delete(name)) return;
    if (this.dirs.has(name)) {
      this.dirs.delete(name);
      return;
    }
    throw new DOMException(`Not found: ${name}`, 'NotFoundError');
  }

  async *values() {
    for (const n of this.files.keys()) yield { kind: 'file' as const, name: n };
    for (const n of this.dirs.keys()) yield { kind: 'directory' as const, name: n };
  }
}

export const rootDir = new MockDirHandle('root');

/** Install the OPFS mock + Blob.arrayBuffer polyfill on the global navigator. */
export function installOpfsMock(): void {
  Object.defineProperty(globalThis.navigator, 'storage', {
    value: { getDirectory: async () => rootDir },
    configurable: true,
  });
  if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
    Blob.prototype.arrayBuffer = function () {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as ArrayBuffer);
        r.onerror = () => reject(r.error);
        r.readAsArrayBuffer(this);
      });
    };
  }
}

/**
 * Reset the mock OPFS and create `downloads/dl-int` with `input.ts` pre-filled.
 * Returns the testDir handle (`downloads/dl-int`).
 */
export function setupOpfsWithInput(tsData: Uint8Array): MockDirHandle {
  rootDir.dirs.clear();
  const downloadsDir = new MockDirHandle('downloads');
  rootDir.dirs.set('downloads', downloadsDir);
  const testDir = new MockDirHandle('dl-int');
  downloadsDir.dirs.set('dl-int', testDir);
  testDir.files.set(
    'input.ts',
    new MockFileHandle('input.ts', { data: tsData.slice(), lastModified: Date.now() }),
  );
  return testDir;
}

// --- MP4 box parsing helpers ---

export function parseBoxes(buf: Uint8Array): Array<{ type: string; offset: number; size: number }> {
  const boxes: Array<{ type: string; offset: number; size: number }> = [];
  let offset = 0;
  while (offset + 8 <= buf.length) {
    const size =
      (buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3];
    const type = String.fromCharCode(
      buf[offset + 4],
      buf[offset + 5],
      buf[offset + 6],
      buf[offset + 7],
    );
    if (size < 8 || offset + size > buf.length) break;
    boxes.push({ type, offset, size });
    offset += size;
  }
  return boxes;
}

export function countBoxes(buf: Uint8Array): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const b of parseBoxes(buf)) counts[b.type] = (counts[b.type] || 0) + 1;
  return counts;
}
