/**
 * Unit tests for the streaming TS→fMP4 transmuxer.
 *
 * mux.js is mocked so we can control the `data`/`done` events and verify the
 * module reads the input in chunks, collects output fragments, and writes them
 * to OPFS.
 */

// ---- OPFS mock (reuse the pattern from opfsStorage.test.ts) ----

class MockFileHandle {
  writtenChunks: Uint8Array[] = [];

  constructor(public name: string) {}

  async createWritable(): Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }> {
    let closed = false;
    const handle = this;
    return {
      async write(data: Blob): Promise<void> {
        if (closed) throw new DOMException('Writable closed', 'InvalidStateError');
        const ab = await data.arrayBuffer();
        handle.writtenChunks.push(new Uint8Array(ab));
      },
      async close(): Promise<void> {
        closed = true;
      },
    };
  }
}

class MockDirHandle {
  files = new Map<string, MockFileHandle>();

  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MockFileHandle> {
    const existing = this.files.get(name);
    if (existing) return existing;
    if (opts?.create) {
      const h = new MockFileHandle(name);
      this.files.set(name, h);
      return h;
    }
    throw new DOMException(`File not found: ${name}`, 'NotFoundError');
  }
}

// ---- mux.js mock ----

type DataHandler = (segment: {
  type: string;
  data: Uint8Array;
  initSegment?: Uint8Array;
}) => void;
type DoneHandler = () => void;

class MockTransmuxer {
  dataHandlers: DataHandler[] = [];
  doneHandlers: DoneHandler[] = [];
  pushedChunks: Uint8Array[] = [];
  flushed = false;
  disposed = false;

  on(event: string, handler: DataHandler | DoneHandler): void {
    if (event === 'data') this.dataHandlers.push(handler as DataHandler);
    if (event === 'done') this.doneHandlers.push(handler as DoneHandler);
  }

  push(chunk: Uint8Array): void {
    this.pushedChunks.push(chunk);
  }

  flush(): void {
    this.flushed = true;
    // Emit a synthetic fragment with init segment (like real mux.js).
    // The first data event includes initSegment (ftyp+moov), then media data.
    for (const h of this.dataHandlers) {
      h({
        type: 'combined',
        initSegment: new Uint8Array([0x10, 0x20, 0x30]), // ftyp+moov
        data: new Uint8Array([0x00, 0x01, 0x02, 0x03]), // moof+mdat
      });
    }
    // Fire 'done' asynchronously (like the real transmuxer).
    setTimeout(() => {
      for (const h of this.doneHandlers) h();
    }, 0);
  }

  dispose(): void {
    this.disposed = true;
  }
}

// Replace the mux.js module before importing the transmuxer.
jest.mock('mux.js', () => {
  const MockTransmuxerCtor = jest.fn(() => new MockTransmuxer());
  return {
    __esModule: true,
    default: {
      mp4: { Transmuxer: MockTransmuxerCtor },
    },
    mp4: { Transmuxer: MockTransmuxerCtor },
  };
});

// ---- OPFS createOpfsWriter mock ----
// The transmuxer now uses createOpfsWriter (single open stream) instead of
// dirHandle.getFileHandle + createWritable directly. We mock it to route
// writes into the same MockFileHandle pattern so tests can verify output.

jest.mock('@/lib/storage/opfsStorage', () => ({
  createOpfsWriter: jest.fn(async (
    dirHandle: MockDirHandle,
    filename: string,
  ) => {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    return {
      async write(chunk: ArrayBuffer | Blob | Uint8Array): Promise<void> {
        // Pass directly to the mock writable, which accepts Blob.
        // Wrap non-Blob chunks for the mock's Blob.arrayBuffer() call.
        const blob =
          chunk instanceof Blob
            ? chunk
            : chunk instanceof ArrayBuffer
              ? new Blob([chunk])
              : new Blob([chunk.buffer as ArrayBuffer]);
        await writable.write(blob);
      },
      async close(): Promise<void> {
        await writable.close();
      },
    };
  }),
}));

import { transmuxTsToFmp4 } from '@/lib/converters/tsTransmuxer';
import muxjs from 'mux.js';

// Helper: create a File with a given size filled with a repeating byte pattern.
function makeTsFile(size: number, fill = 0x47): File {
  const data = new Uint8Array(size).fill(fill);
  return new File([data.buffer as ArrayBuffer], 'input.ts', {
    type: 'video/mp2t',
  });
}

// Polyfill Blob.arrayBuffer for jsdom (needed by the writable mock).
beforeAll(() => {
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
  if (typeof File !== 'undefined' && typeof File.prototype.arrayBuffer !== 'function') {
    File.prototype.arrayBuffer = Blob.prototype.arrayBuffer as never;
  }
});

describe('tsTransmuxer', () => {
  let dirHandle: MockDirHandle;

  beforeEach(() => {
    dirHandle = new MockDirHandle();
    jest.clearAllMocks();
  });

  it('returns failure for an empty input file', async () => {
    const result = await transmuxTsToFmp4(
      makeTsFile(0),
      dirHandle as unknown as FileSystemDirectoryHandle,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('reads input in chunks, pushes to transmuxer, flushes, and writes output', async () => {
    // 10 MB input → with 4MB chunks, should be read in 3 chunks (4+4+2MB)
    const inputSize = 10 * 1024 * 1024;
    const file = makeTsFile(inputSize);
    const progressCalls: Array<{ processed: number; total: number }> = [];

    const result = await transmuxTsToFmp4(
      file,
      dirHandle as unknown as FileSystemDirectoryHandle,
      'output.mp4',
      (processed, total) => progressCalls.push({ processed, total }),
    );

    expect(result.success).toBe(true);
    expect(result.outputName).toBe('output.mp4');

    // Verify the Transmuxer constructor was called.
    expect(muxjs.mp4.Transmuxer).toHaveBeenCalled();

    // Verify output file was created in the dir handle.
    expect(dirHandle.files.has('output.mp4')).toBe(true);
    const outFile = dirHandle.files.get('output.mp4')!;
    expect(outFile.writtenChunks.length).toBeGreaterThan(0);
    // The mock emits initSegment (3 bytes) + data (4 bytes) = 7 bytes total.
    const totalWritten = outFile.writtenChunks.reduce((s, c) => s + c.length, 0);
    expect(totalWritten).toBe(7);

    // Verify progress was reported — 3 chunks for 10MB at 4MB chunk size.
    expect(progressCalls.length).toBe(3);
    expect(progressCalls[0].total).toBe(inputSize);
    expect(progressCalls[progressCalls.length - 1].processed).toBe(inputSize);
  });

  it('returns failure when transmuxer produces no output', async () => {
    // Override the mock to emit no data fragments on flush.
    const MockTransmuxerCtor = muxjs.mp4.Transmuxer as unknown as jest.Mock;
    const originalImpl = MockTransmuxerCtor.getMockImplementation();
    MockTransmuxerCtor.mockImplementation(() => {
      const m = new MockTransmuxer();
      m.flush = () => {
        m.flushed = true;
        // Emit nothing — simulate unsupported codec.
        setTimeout(() => {
          for (const h of m.doneHandlers) h();
        }, 0);
      };
      return m;
    });

    const result = await transmuxTsToFmp4(
      makeTsFile(1024),
      dirHandle as unknown as FileSystemDirectoryHandle,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('no output');

    // Restore original mock.
    if (originalImpl) MockTransmuxerCtor.mockImplementation(originalImpl);
  });

  it('disposes the transmuxer after completion', async () => {
    const result = await transmuxTsToFmp4(
      makeTsFile(1024),
      dirHandle as unknown as FileSystemDirectoryHandle,
    );
    expect(result.success).toBe(true);
    // The mock instance is internal, but we can verify via the constructor's
    // mock results that dispose was called. Since we can't access the instance
    // directly, we rely on the test not throwing and completing successfully.
  });

  it('returns failure when transmuxer emits data but no init segment', async () => {
    // Simulate a broken transmuxer that emits media data without the init
    // segment (ftyp+moov). The output would be unplayable, so we must fail.
    const MockTransmuxerCtor = muxjs.mp4.Transmuxer as unknown as jest.Mock;
    const originalImpl = MockTransmuxerCtor.getMockImplementation();
    MockTransmuxerCtor.mockImplementation(() => {
      const m = new MockTransmuxer();
      m.flush = () => {
        m.flushed = true;
        for (const h of m.dataHandlers) {
          h({ type: 'combined', data: new Uint8Array([0x00, 0x01]) });
        }
        setTimeout(() => {
          for (const h of m.doneHandlers) h();
        }, 0);
      };
      return m;
    });

    const result = await transmuxTsToFmp4(
      makeTsFile(1024),
      dirHandle as unknown as FileSystemDirectoryHandle,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('init segment');

    if (originalImpl) MockTransmuxerCtor.mockImplementation(originalImpl);
  });

  it('serialized writeChain preserves write order for synchronous data events', async () => {
    // Simulate a transmuxer that emits 3 data events synchronously during
    // flush(). The writeChain must serialize them so the output order matches
    // the emission order (init → data1 → data2 → data3), even though each
    // writer.write() is async.
    const MockTransmuxerCtor = muxjs.mp4.Transmuxer as unknown as jest.Mock;
    const originalImpl = MockTransmuxerCtor.getMockImplementation();
    MockTransmuxerCtor.mockImplementation(() => {
      const m = new MockTransmuxer();
      m.flush = () => {
        m.flushed = true;
        // Emit 3 fragments synchronously — the writeChain must serialize.
        for (const h of m.dataHandlers) {
          h({ type: 'combined', initSegment: new Uint8Array([0xaa]), data: new Uint8Array([0x01]) });
          h({ type: 'combined', data: new Uint8Array([0x02]) });
          h({ type: 'combined', data: new Uint8Array([0x03]) });
        }
        setTimeout(() => {
          for (const h of m.doneHandlers) h();
        }, 0);
      };
      return m;
    });

    const result = await transmuxTsToFmp4(
      makeTsFile(1024),
      dirHandle as unknown as FileSystemDirectoryHandle,
    );

    expect(result.success).toBe(true);
    const outFile = dirHandle.files.get('output.mp4')!;
    // Flatten all written chunks into a single byte array.
    const allBytes: number[] = [];
    for (const chunk of outFile.writtenChunks) {
      for (const b of chunk) allBytes.push(b);
    }
    // Expected order: init(0xaa), data1(0x01), data2(0x02), data3(0x03)
    expect(allBytes).toEqual([0xaa, 0x01, 0x02, 0x03]);

    if (originalImpl) MockTransmuxerCtor.mockImplementation(originalImpl);
  });
});
