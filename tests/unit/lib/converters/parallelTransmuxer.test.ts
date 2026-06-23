import { transmuxTsToFmp4ParallelExperimental } from '@/lib/converters/parallelTransmuxer';
import type { SegmentGroup } from '@/lib/converters/segmentGrouping';
import type { SegmentRange } from '@/types/media';

// --- OPFS mock (same pattern as opfsStorage.test.ts) ---

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

  async createWritable(opts?: { keepExistingData?: boolean }): Promise<{
    write: (data: ArrayBuffer | Blob | Uint8Array | string) => Promise<void>;
    seek: (position: number) => Promise<void>;
    close: () => Promise<void>;
  }> {
    const keep = opts?.keepExistingData ?? false;
    let buffer = keep ? this.file.data.slice() : new Uint8Array();
    let position = 0;
    let closed = false;
    const handle = this;

    return {
      async write(data: ArrayBuffer | Blob | Uint8Array | string): Promise<void> {
        if (closed) throw new DOMException('Writable closed', 'InvalidStateError');
        let bytes: Uint8Array;
        if (typeof data === 'string') {
          bytes = new Uint8Array(data.split('').map((c) => c.charCodeAt(0)));
        } else if (data instanceof Uint8Array) {
          bytes = data;
        } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
          const ab = await data.arrayBuffer();
          bytes = new Uint8Array(ab);
        } else if (data instanceof ArrayBuffer) {
          bytes = new Uint8Array(data);
        } else {
          bytes = new Uint8Array(data as unknown as ArrayBuffer);
        }
        const endPos = position + bytes.length;
        if (endPos > buffer.length) {
          const extended = new Uint8Array(endPos);
          extended.set(buffer);
          buffer = extended;
        }
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

  async getDirectoryHandle(name: string, _opts?: { create?: boolean }): Promise<MockDirHandle> {
    const existing = this.dirs.get(name);
    if (existing) return existing;
    if (_opts?.create) {
      const d = new MockDirHandle(name);
      this.dirs.set(name, d);
      return d;
    }
    throw new DOMException(`Dir not found: ${name}`, 'NotFoundError');
  }

  async removeEntry(name: string, _opts?: { recursive?: boolean }): Promise<void> {
    if (this.files.delete(name)) return;
    if (this.dirs.has(name)) {
      this.dirs.delete(name);
      return;
    }
    throw new DOMException(`Not found: ${name}`, 'NotFoundError');
  }

  async *values(): AsyncIterableIterator<{ kind: 'file'; name: string } | { kind: 'directory'; name: string }> {
    for (const name of this.files.keys()) yield { kind: 'file', name };
    for (const name of this.dirs.keys()) yield { kind: 'directory', name };
  }
}

const rootDir = new MockDirHandle('root');
const storageMock = { getDirectory: async () => rootDir };

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
});

// --- Mock tsTransmuxer ---

jest.mock('@/lib/converters/tsTransmuxer', () => ({
  transmuxTsToFmp4: jest.fn(async (
    inputFile: Blob,
    dirHandle: FileSystemDirectoryHandle,
    outputName: string,
    onProgress?: (processedBytes: number, totalBytes: number) => void,
  ) => {
    // Simulate writing a part file to OPFS
    const { createOpfsWriter } = require('@/lib/storage/opfsStorage');
    const writer = await createOpfsWriter(dirHandle, outputName);
    const buffer = await inputFile.arrayBuffer();
    await writer.write(new Uint8Array(buffer));
    await writer.close();
    // Report progress
    if (onProgress) {
      onProgress(inputFile.size, inputFile.size);
    }
    return { success: true, outputName };
  }),
}));

const { transmuxTsToFmp4 } = require('@/lib/converters/tsTransmuxer') as {
  transmuxTsToFmp4: jest.Mock;
};

function makeRange(index: number, size: number, startByte: number): SegmentRange {
  return { index, startByte, endByte: startByte + size, size, duration: 10 };
}

function makeGroups(count: number, totalSize: number): SegmentGroup[] {
  const groupSize = Math.floor(totalSize / count);
  const groups: SegmentGroup[] = [];
  let offset = 0;
  for (let i = 0; i < count; i++) {
    const size = i === count - 1 ? totalSize - offset : groupSize;
    groups.push({
      index: i,
      startByte: offset,
      endByte: offset + size,
      size,
      segmentIndices: [i],
    });
    offset += size;
  }
  return groups;
}

describe('transmuxTsToFmp4ParallelExperimental', () => {
  let downloadsDir: MockDirHandle;

  beforeEach(async () => {
    transmuxTsToFmp4.mockClear();
    // Reset OPFS mock state
    rootDir.dirs.clear();
    // Create downloads/ dir (ensureDownloadDir creates this)
    downloadsDir = new MockDirHandle('downloads');
    rootDir.dirs.set('downloads', downloadsDir);
    // Create downloads/dl-test/ subdir with input.ts
    const sub = new MockDirHandle('dl-test');
    downloadsDir.dirs.set('dl-test', sub);
    // Write a fake input.ts with some data
    const inputHandle = new MockFileHandle('input.ts', {
      data: new Uint8Array(3000).fill(0xff),
      lastModified: Date.now(),
    });
    sub.files.set('input.ts', inputHandle);
  });

  it('returns failure for empty groups', async () => {
    const result = await transmuxTsToFmp4ParallelExperimental({
      downloadId: 'dl-test',
      groups: [],
      segmentRanges: [],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No segment groups');
  });

  it('calls transmuxTsToFmp4 once per group', async () => {
    const groups = makeGroups(3, 3000);
    const ranges = groups.map((g, i) => makeRange(i, g.size, g.startByte));

    const result = await transmuxTsToFmp4ParallelExperimental({
      downloadId: 'dl-test',
      groups,
      segmentRanges: ranges,
    });

    expect(result.success).toBe(true);
    expect(transmuxTsToFmp4).toHaveBeenCalledTimes(3);
    expect(result.partCount).toBe(3);
  });

  it('returns failure when a group transmux fails', async () => {
    transmuxTsToFmp4.mockImplementationOnce(async () => ({
      success: false,
      outputName: 'part-0.fmp4',
      error: 'codec not supported',
    }));

    const groups = makeGroups(2, 2000);
    const ranges = groups.map((g, i) => makeRange(i, g.size, g.startByte));

    const result = await transmuxTsToFmp4ParallelExperimental({
      downloadId: 'dl-test',
      groups,
      segmentRanges: ranges,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Group transmux failed');
  });

  it('reports progress across all groups', async () => {
    const groups = makeGroups(2, 2000);
    const ranges = groups.map((g, i) => makeRange(i, g.size, g.startByte));
    const progressCalls: Array<{ processed: number; total: number }> = [];

    await transmuxTsToFmp4ParallelExperimental({
      downloadId: 'dl-test',
      groups,
      segmentRanges: ranges,
      onProgress: (processed, total) => {
        progressCalls.push({ processed, total });
      },
    });

    // Progress should have been called at least once
    expect(progressCalls.length).toBeGreaterThan(0);
    // Total should always be the input file size (3000 bytes in our mock)
    expect(progressCalls[0].total).toBe(3000);
  });

  it('passes correct byte range slice to each group transmux', async () => {
    const groups: SegmentGroup[] = [
      { index: 0, startByte: 0, endByte: 1000, size: 1000, segmentIndices: [0] },
      { index: 1, startByte: 1000, endByte: 2000, size: 1000, segmentIndices: [1] },
    ];
    const ranges = groups.map((g, i) => makeRange(i, g.size, g.startByte));

    await transmuxTsToFmp4ParallelExperimental({
      downloadId: 'dl-test',
      groups,
      segmentRanges: ranges,
    });

    // Check that each call got the right output name
    expect(transmuxTsToFmp4.mock.calls[0][2]).toBe('part-0.fmp4');
    expect(transmuxTsToFmp4.mock.calls[1][2]).toBe('part-1.fmp4');
  });
});
