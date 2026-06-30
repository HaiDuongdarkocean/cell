import { transmuxTsToFmp4ParallelExperimental, findFirstMoofOffset } from '@/lib/converters/parallelTransmuxer';
import type { SegmentGroup } from '@/features/transmux/planning/segmentGrouping';
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


// Default mock: write a valid synthetic fMP4 part so mergePartFiles can find
// the first moof box and strip ftyp+moov from subsequent parts.
jest.mock('@/lib/converters/tsTransmuxer', () => ({
  transmuxTsToFmp4: jest.fn(async (
    _inputFile: Blob,
    dirHandle: FileSystemDirectoryHandle,
    outputName: string,
    onProgress?: (processedBytes: number, totalBytes: number) => void,
  ) => {
    const { createOpfsWriter } = require('@/shared/lib/storage/opfsStorage');
    const writer = await createOpfsWriter(dirHandle, outputName);
    const part = makeFmp4Part();
    await writer.write(part);
    await writer.close();
    if (onProgress) {
      onProgress(part.length, part.length);
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

// --- Helpers for synthetic fMP4 box data ---
// MP4 box: 4 bytes big-endian size + 4 bytes type + content

function makeBox(type: string, content: Uint8Array = new Uint8Array()): Uint8Array {
  const size = 8 + content.length;
  const box = new Uint8Array(size);
  box[0] = (size >> 24) & 0xff;
  box[1] = (size >> 16) & 0xff;
  box[2] = (size >> 8) & 0xff;
  box[3] = size & 0xff;
  for (let i = 0; i < 4; i++) box[4 + i] = type.charCodeAt(i);
  box.set(content, 8);
  return box;
}

/** Build a synthetic fMP4 part: ftyp + moov + moof + mdat */
function makeFmp4Part(moofContent?: Uint8Array, mdatContent?: Uint8Array): Uint8Array {
  const ftyp = makeBox('ftyp', new Uint8Array(12));
  const moov = makeBox('moov', new Uint8Array(8));
  const moof = makeBox('moof', moofContent ?? new Uint8Array(8));
  const mdat = makeBox('mdat', mdatContent ?? new Uint8Array(8));
  const total = ftyp.length + moov.length + moof.length + mdat.length;
  const result = new Uint8Array(total);
  let off = 0;
  result.set(ftyp, off); off += ftyp.length;
  result.set(moov, off); off += moov.length;
  result.set(moof, off); off += moof.length;
  result.set(mdat, off);
  return result;
}

describe('findFirstMoofOffset', () => {
  it('returns offset of first moof box in a valid fMP4 part', () => {
    const part = makeFmp4Part();
    // ftyp = 20 bytes, moov = 16 bytes → moof at offset 36
    const ftypSize = 20;
    const moovSize = 16;
    expect(findFirstMoofOffset(part)).toBe(ftypSize + moovSize);
  });

  it('returns 0 when moof is the first box (no ftyp/moov)', () => {
    const moof = makeBox('moof', new Uint8Array(8));
    const mdat = makeBox('mdat', new Uint8Array(8));
    const buf = new Uint8Array(moof.length + mdat.length);
    buf.set(moof, 0);
    buf.set(mdat, moof.length);
    expect(findFirstMoofOffset(buf)).toBe(0);
  });

  it('returns -1 when no moof box exists', () => {
    const ftyp = makeBox('ftyp', new Uint8Array(12));
    const mdat = makeBox('mdat', new Uint8Array(8));
    const buf = new Uint8Array(ftyp.length + mdat.length);
    buf.set(ftyp, 0);
    buf.set(mdat, ftyp.length);
    expect(findFirstMoofOffset(buf)).toBe(-1);
  });

  it('handles multiple moof+mdat pairs (finds first moof)', () => {
    const ftyp = makeBox('ftyp', new Uint8Array(12));
    const moov = makeBox('moov', new Uint8Array(8));
    const moof1 = makeBox('moof', new Uint8Array(8));
    const mdat1 = makeBox('mdat', new Uint8Array(8));
    const moof2 = makeBox('moof', new Uint8Array(8));
    const mdat2 = makeBox('mdat', new Uint8Array(8));
    const total = ftyp.length + moov.length + moof1.length + mdat1.length + moof2.length + mdat2.length;
    const buf = new Uint8Array(total);
    let off = 0;
    buf.set(ftyp, off); off += ftyp.length;
    buf.set(moov, off); off += moov.length;
    buf.set(moof1, off); off += moof1.length;
    buf.set(mdat1, off); off += mdat1.length;
    buf.set(moof2, off); off += moof2.length;
    buf.set(mdat2, off);
    expect(findFirstMoofOffset(buf)).toBe(ftyp.length + moov.length);
  });

  it('returns -1 for empty buffer', () => {
    expect(findFirstMoofOffset(new Uint8Array())).toBe(-1);
  });

  it('returns -1 for buffer too small to contain a box header', () => {
    expect(findFirstMoofOffset(new Uint8Array(7))).toBe(-1);
  });

  it('returns -1 when box size is invalid (smaller than header)', () => {
    const buf = new Uint8Array(16);
    buf[0] = 0; buf[1] = 0; buf[2] = 0; buf[3] = 4;
    buf[4] = 0x66; buf[5] = 0x74; buf[6] = 0x79; buf[7] = 0x70; // "ftyp"
    expect(findFirstMoofOffset(buf)).toBe(-1);
  });
});

describe('mergePartFiles — ftyp+moov stripping', () => {
  let downloadsDir: MockDirHandle;

  beforeEach(async () => {
    transmuxTsToFmp4.mockClear();
    rootDir.dirs.clear();
    downloadsDir = new MockDirHandle('downloads');
    rootDir.dirs.set('downloads', downloadsDir);
    const sub = new MockDirHandle('dl-merge');
    downloadsDir.dirs.set('dl-merge', sub);
    // Write a fake input.ts
    const inputHandle = new MockFileHandle('input.ts', {
      data: new Uint8Array(3000).fill(0xff),
      lastModified: Date.now(),
    });
    sub.files.set('input.ts', inputHandle);
  });

  it('produces output with only one ftyp+moov when merging multiple parts', async () => {
    // Mock transmuxTsToFmp4 to write synthetic fMP4 data (ftyp+moov+moof+mdat)
    transmuxTsToFmp4.mockImplementation(async (
      _inputFile: Blob,
      dirHandle: FileSystemDirectoryHandle,
      outputName: string,
    ) => {
      const { createOpfsWriter } = require('@/shared/lib/storage/opfsStorage');
      const writer = await createOpfsWriter(dirHandle, outputName);
      const part = makeFmp4Part();
      await writer.write(part);
      await writer.close();
      return { success: true, outputName };
    });

    const groups = makeGroups(3, 3000);
    const ranges = groups.map((g, i) => makeRange(i, g.size, g.startByte));

    const result = await transmuxTsToFmp4ParallelExperimental({
      downloadId: 'dl-merge',
      groups,
      segmentRanges: ranges,
    });

    expect(result.success).toBe(true);

    // Read the output file and verify box structure
    const sub = downloadsDir.dirs.get('dl-merge')!;
    const outputFile = await sub.files.get('output.mp4')!.getFile();
    const output = new Uint8Array(await outputFile.arrayBuffer());

    // Count ftyp and moov boxes in the output
    let ftypCount = 0;
    let moovCount = 0;
    let moofCount = 0;
    let offset = 0;
    while (offset + 8 <= output.length) {
      const size = (output[offset] << 24) | (output[offset + 1] << 16) |
                   (output[offset + 2] << 8) | output[offset + 3];
      const type = String.fromCharCode(
        output[offset + 4], output[offset + 5],
        output[offset + 6], output[offset + 7],
      );
      if (type === 'ftyp') ftypCount++;
      if (type === 'moov') moovCount++;
      if (type === 'moof') moofCount++;
      if (size < 8 || offset + size > output.length) break;
      offset += size;
    }

    // CRITICAL: output must have exactly ONE ftyp and ONE moov
    expect(ftypCount).toBe(1);
    expect(moovCount).toBe(1);
    // Should have 3 moof boxes (one per group)
    expect(moofCount).toBe(3);
  });

  it('preserves all moof+mdat data from all parts', async () => {
    // Each part gets unique moof content so we can verify it's in the output
    const part0Moof = new Uint8Array([0xaa, 0xaa, 0xaa, 0xaa]);
    const part1Moof = new Uint8Array([0xbb, 0xbb, 0xbb, 0xbb]);
    const part2Moof = new Uint8Array([0xcc, 0xcc, 0xcc, 0xcc]);
    const moofContents = [part0Moof, part1Moof, part2Moof];

    transmuxTsToFmp4.mockImplementation(async (
      _inputFile: Blob,
      dirHandle: FileSystemDirectoryHandle,
      outputName: string,
    ) => {
      const { createOpfsWriter } = require('@/shared/lib/storage/opfsStorage');
      const writer = await createOpfsWriter(dirHandle, outputName);
      const partIndex = parseInt(outputName.match(/part-(\d+)/)?.[1] ?? '0', 10);
      const part = makeFmp4Part(moofContents[partIndex]);
      await writer.write(part);
      await writer.close();
      return { success: true, outputName };
    });

    const groups = makeGroups(3, 3000);
    const ranges = groups.map((g, i) => makeRange(i, g.size, g.startByte));

    const result = await transmuxTsToFmp4ParallelExperimental({
      downloadId: 'dl-merge',
      groups,
      segmentRanges: ranges,
    });

    expect(result.success).toBe(true);

    const sub = downloadsDir.dirs.get('dl-merge')!;
    const outputFile = await sub.files.get('output.mp4')!.getFile();
    const output = new Uint8Array(await outputFile.arrayBuffer());

    // Verify all 3 unique moof contents are present in the output
    const outputStr = Array.from(output).map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(outputStr).toContain('aaaaaaaa');
    expect(outputStr).toContain('bbbbbbbb');
    expect(outputStr).toContain('cccccccc');
  });
});

// --- Helpers for realistic fMP4 with moof/tfdt ---

function makeBoxWithSize(type: string, content: Uint8Array = new Uint8Array()): Uint8Array {
  const size = 8 + content.length;
  const box = new Uint8Array(size);
  box[0] = (size >> 24) & 0xff;
  box[1] = (size >> 16) & 0xff;
  box[2] = (size >> 8) & 0xff;
  box[3] = size & 0xff;
  for (let i = 0; i < 4; i++) box[4 + i] = type.charCodeAt(i);
  box.set(content, 8);
  return box;
}

function makeU32(val: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = (val >>> 24) & 0xff;
  buf[1] = (val >>> 16) & 0xff;
  buf[2] = (val >>> 8) & 0xff;
  buf[3] = val & 0xff;
  return buf;
}

/** Build a synthetic moof box with tfhd + tfdt + trun for one track. */
function makeMoof(trackId: number, tfdtValue: number, sampleDuration: number, sampleCount: number): Uint8Array {
  // tfhd: version(1)=0 + flags(3)=0 + track_id(4) + (no optional fields)
  const tfhdBody = new Uint8Array(8);
  tfhdBody[4] = (trackId >>> 24) & 0xff;
  tfhdBody[5] = (trackId >>> 16) & 0xff;
  tfhdBody[6] = (trackId >>> 8) & 0xff;
  tfhdBody[7] = trackId & 0xff;
  const tfhd = makeBoxWithSize('tfhd', tfhdBody);

  // tfdt: version(1)=0 + flags(3)=0 + baseMediaDecodeTime(4)
  const tfdtBody = new Uint8Array(8);
  tfdtBody[4] = (tfdtValue >>> 24) & 0xff;
  tfdtBody[5] = (tfdtValue >>> 16) & 0xff;
  tfdtBody[6] = (tfdtValue >>> 8) & 0xff;
  tfdtBody[7] = tfdtValue & 0xff;
  const tfdt = makeBoxWithSize('tfdt', tfdtBody);

  // trun: version(1)=0 + flags(3)=0x000101 (data-offset + sample-duration) + sample_count(4) + data_offset(4) + sample_durations
  const trunBody = new Uint8Array(8 + 4 + sampleCount * 4);
  trunBody[0] = 0; trunBody[1] = 0; trunBody[2] = 0x01; trunBody[3] = 0x01;
  // sample count
  trunBody[4] = (sampleCount >>> 24) & 0xff;
  trunBody[5] = (sampleCount >>> 16) & 0xff;
  trunBody[6] = (sampleCount >>> 8) & 0xff;
  trunBody[7] = sampleCount & 0xff;
  // data offset (4 bytes, value doesn't matter for test)
  // sample durations
  for (let i = 0; i < sampleCount; i++) {
    const off = 12 + i * 4;
    trunBody[off] = (sampleDuration >>> 24) & 0xff;
    trunBody[off + 1] = (sampleDuration >>> 16) & 0xff;
    trunBody[off + 2] = (sampleDuration >>> 8) & 0xff;
    trunBody[off + 3] = sampleDuration & 0xff;
  }
  const trun = makeBoxWithSize('trun', trunBody);

  // traf: tfhd + tfdt + trun
  const trafContent = new Uint8Array(tfhd.length + tfdt.length + trun.length);
  let off = 0;
  trafContent.set(tfhd, off); off += tfhd.length;
  trafContent.set(tfdt, off); off += tfdt.length;
  trafContent.set(trun, off);
  const traf = makeBoxWithSize('traf', trafContent);

  // mfhd: version(1)=0 + flags(3)=0 + sequence_number(4)
  const mfhdBody = new Uint8Array(8);
  const mfhd = makeBoxWithSize('mfhd', mfhdBody);

  // moof: mfhd + traf
  const moofContent = new Uint8Array(mfhd.length + traf.length);
  moofContent.set(mfhd, 0);
  moofContent.set(traf, mfhd.length);
  return makeBoxWithSize('moof', moofContent);
}

/** Build a minimal moov with timescale for one track. */
function makeMoov(trackId: number, timescale: number, duration: number): Uint8Array {
  // mdhd: version(1)=0 + flags(3)=0 + creation(4) + modification(4) + timescale(4) + duration(4)
  const mdhdBody = new Uint8Array(20);
  mdhdBody.set(makeU32(timescale), 8);
  mdhdBody.set(makeU32(duration), 12);
  const mdhd = makeBoxWithSize('mdhd', mdhdBody);

  // mdia: mdhd + (empty hdlr + minf)
  const mdia = makeBoxWithSize('mdia', mdhd);

  // tkhd: version(1)=0 + flags(3)=0 + creation(4) + modification(4) + track_id(4) + ...
  const tkhdBody = new Uint8Array(80);
  tkhdBody.set(makeU32(trackId), 12);
  const tkhd = makeBoxWithSize('tkhd', tkhdBody);

  // trak: tkhd + mdia
  const trakContent = new Uint8Array(tkhd.length + mdia.length);
  trakContent.set(tkhd, 0);
  trakContent.set(mdia, tkhd.length);
  const trak = makeBoxWithSize('trak', trakContent);

  // mvhd: version(1)=0 + flags(3)=0 + creation(4) + modification(4) + timescale(4) + duration(4)
  const mvhdBody = new Uint8Array(20);
  mvhdBody.set(makeU32(timescale), 8);
  mvhdBody.set(makeU32(duration), 12);
  const mvhd = makeBoxWithSize('mvhd', mvhdBody);

  // moov: mvhd + trak
  const moovContent = new Uint8Array(mvhd.length + trak.length);
  moovContent.set(mvhd, 0);
  moovContent.set(trak, mvhd.length);
  return makeBoxWithSize('moov', moovContent);
}

/** Build a realistic fMP4 part with ftyp + moov + moof + mdat. */
function makeRealisticFmp4Part(
  trackId: number,
  timescale: number,
  moovDuration: number,
  tfdtValue: number,
  sampleDuration: number,
  sampleCount: number,
): Uint8Array {
  const ftyp = makeBoxWithSize('ftyp', new Uint8Array(12));
  const moov = makeMoov(trackId, timescale, moovDuration);
  const moof = makeMoof(trackId, tfdtValue, sampleDuration, sampleCount);
  const mdat = makeBoxWithSize('mdat', new Uint8Array(8));
  const total = ftyp.length + moov.length + moof.length + mdat.length;
  const result = new Uint8Array(total);
  let off = 0;
  result.set(ftyp, off); off += ftyp.length;
  result.set(moov, off); off += moov.length;
  result.set(moof, off); off += moof.length;
  result.set(mdat, off);
  return result;
}

describe('mergePartFiles — tfdt offset fix', () => {
  let downloadsDir: MockDirHandle;

  beforeEach(async () => {
    transmuxTsToFmp4.mockClear();
    rootDir.dirs.clear();
    downloadsDir = new MockDirHandle('downloads');
    rootDir.dirs.set('downloads', downloadsDir);
    const sub = new MockDirHandle('dl-tfdt');
    downloadsDir.dirs.set('dl-tfdt', sub);
    const inputHandle = new MockFileHandle('input.ts', {
      data: new Uint8Array(3000).fill(0xff),
      lastModified: Date.now(),
    });
    sub.files.set('input.ts', inputHandle);
  });

  it('offsets tfdt in parts 1+ so fragments do not overlap', async () => {
    // Simulate 3 parts where mux.js rebased PTS to 0 for each:
    // Part 0: tfdt=0, duration=1000 → end=1000
    // Part 1: tfdt=0, duration=1000 → end=1000 (should be 1000-2000)
    // Part 2: tfdt=0, duration=1000 → end=1000 (should be 2000-3000)
    const trackId = 256;
    const timescale = 90000;
    const sampleDur = 100;
    const sampleCount = 10; // total duration = 1000

    const parts = [
      makeRealisticFmp4Part(trackId, timescale, 1000, 0, sampleDur, sampleCount),
      makeRealisticFmp4Part(trackId, timescale, 1000, 0, sampleDur, sampleCount),
      makeRealisticFmp4Part(trackId, timescale, 1000, 0, sampleDur, sampleCount),
    ];

    transmuxTsToFmp4.mockImplementation(async (
      _inputFile: Blob,
      dirHandle: FileSystemDirectoryHandle,
      outputName: string,
    ) => {
      const { createOpfsWriter } = require('@/shared/lib/storage/opfsStorage');
      const writer = await createOpfsWriter(dirHandle, outputName);
      const partIndex = parseInt(outputName.match(/part-(\d+)/)?.[1] ?? '0', 10);
      await writer.write(parts[partIndex]);
      await writer.close();
      return { success: true, outputName };
    });

    const groups = makeGroups(3, 3000);
    const ranges = groups.map((g, i) => makeRange(i, g.size, g.startByte));

    const result = await transmuxTsToFmp4ParallelExperimental({
      downloadId: 'dl-tfdt',
      groups,
      segmentRanges: ranges,
    });

    expect(result.success).toBe(true);

    // Read output and extract tfdt values from moof boxes
    const sub = downloadsDir.dirs.get('dl-tfdt')!;
    const outputFile = await sub.files.get('output.mp4')!.getFile();
    const output = new Uint8Array(await outputFile.arrayBuffer());

    // Parse moof boxes and extract tfdt
    const tfdtValues: number[] = [];
    let offset = 0;
    while (offset + 8 <= output.length) {
      const size = (output[offset] << 24) | (output[offset + 1] << 16) |
                   (output[offset + 2] << 8) | output[offset + 3];
      const type = String.fromCharCode(
        output[offset + 4], output[offset + 5],
        output[offset + 6], output[offset + 7],
      );
      if (type === 'moof') {
        // Find tfdt inside moof → traf → tfdt
        let innerOff = offset + 8;
        while (innerOff + 8 <= offset + size) {
          const innerSize = (output[innerOff] << 24) | (output[innerOff + 1] << 16) |
                            (output[innerOff + 2] << 8) | output[innerOff + 3];
          const innerType = String.fromCharCode(
            output[innerOff + 4], output[innerOff + 5],
            output[innerOff + 6], output[innerOff + 7],
          );
          if (innerType === 'traf') {
            let trafOff = innerOff + 8;
            while (trafOff + 8 <= innerOff + innerSize) {
              const trafBoxSize = (output[trafOff] << 24) | (output[trafOff + 1] << 16) |
                                  (output[trafOff + 2] << 8) | output[trafOff + 3];
              const trafBoxType = String.fromCharCode(
                output[trafOff + 4], output[trafOff + 5],
                output[trafOff + 6], output[trafOff + 7],
              );
              if (trafBoxType === 'tfdt') {
                const tfdtVal = (output[trafOff + 12] << 24) | (output[trafOff + 13] << 16) |
                                (output[trafOff + 14] << 8) | output[trafOff + 15];
                tfdtValues.push(tfdtVal);
              }
              if (trafBoxSize < 8) break;
              trafOff += trafBoxSize;
            }
          }
          if (innerSize < 8) break;
          innerOff += innerSize;
        }
      }
      if (size < 8 || offset + size > output.length) break;
      offset += size;
    }

    // Should have 3 moof boxes (one per part), each with one tfdt
    expect(tfdtValues.length).toBe(3);
    // Part 0: tfdt=0 (unchanged)
    expect(tfdtValues[0]).toBe(0);
    // Part 1: tfdt=1000 (offset by part 0's duration)
    expect(tfdtValues[1]).toBe(1000);
    // Part 2: tfdt=2000 (offset by part 0+1's duration)
    expect(tfdtValues[2]).toBe(2000);
  });

  it('updates mvhd duration to total across all parts', async () => {
    const trackId = 256;
    const timescale = 90000;
    const sampleDur = 100;
    const sampleCount = 10; // total duration = 1000 per part

    const parts = [
      makeRealisticFmp4Part(trackId, timescale, 1000, 0, sampleDur, sampleCount),
      makeRealisticFmp4Part(trackId, timescale, 1000, 0, sampleDur, sampleCount),
      makeRealisticFmp4Part(trackId, timescale, 1000, 0, sampleDur, sampleCount),
    ];

    transmuxTsToFmp4.mockImplementation(async (
      _inputFile: Blob,
      dirHandle: FileSystemDirectoryHandle,
      outputName: string,
    ) => {
      const { createOpfsWriter } = require('@/shared/lib/storage/opfsStorage');
      const writer = await createOpfsWriter(dirHandle, outputName);
      const partIndex = parseInt(outputName.match(/part-(\d+)/)?.[1] ?? '0', 10);
      await writer.write(parts[partIndex]);
      await writer.close();
      return { success: true, outputName };
    });

    const groups = makeGroups(3, 3000);
    const ranges = groups.map((g, i) => makeRange(i, g.size, g.startByte));

    const result = await transmuxTsToFmp4ParallelExperimental({
      downloadId: 'dl-tfdt',
      groups,
      segmentRanges: ranges,
    });

    expect(result.success).toBe(true);

    const sub = downloadsDir.dirs.get('dl-tfdt')!;
    const outputFile = await sub.files.get('output.mp4')!.getFile();
    const output = new Uint8Array(await outputFile.arrayBuffer());

    // Find moov → mvhd and read duration
    let offset = 0;
    let mvhdDuration = -1;
    while (offset + 8 <= output.length) {
      const size = (output[offset] << 24) | (output[offset + 1] << 16) |
                   (output[offset + 2] << 8) | output[offset + 3];
      const type = String.fromCharCode(
        output[offset + 4], output[offset + 5],
        output[offset + 6], output[offset + 7],
      );
      if (type === 'moov') {
        let mooff = offset + 8;
        while (mooff + 8 <= offset + size) {
          const msize = (output[mooff] << 24) | (output[mooff + 1] << 16) |
                        (output[mooff + 2] << 8) | output[mooff + 3];
          const mtype = String.fromCharCode(
            output[mooff + 4], output[mooff + 5],
            output[mooff + 6], output[mooff + 7],
          );
          if (mtype === 'mvhd') {
            // version 0: timescale at +12, duration at +16
            mvhdDuration = (output[mooff + 24] << 24) | (output[mooff + 25] << 16) |
                           (output[mooff + 26] << 8) | output[mooff + 27];
          }
          if (msize < 8) break;
          mooff += msize;
        }
      }
      if (size < 8 || offset + size > output.length) break;
      offset += size;
    }

    // mvhd duration should be 3000 (3 parts × 1000 each)
    expect(mvhdDuration).toBe(3000);
  });
});
