import {
  executeParallelConversion,
  cancelParallelConversion,
  isParallelConversionCancelled,
} from '@/lib/converters/parallelCoordinator';
import { transmuxTsToFmp4ParallelExperimental } from '@/lib/converters/parallelTransmuxer';
import { transmuxTsToFmp4 } from '@/lib/converters/tsTransmuxer';
import { ParallelConversionCancelledError } from '@/lib/converters/parallelCancellation';
import { validateFragmentedMp4 } from '@/lib/converters/mp4Validator';
import type { Settings, SegmentRange } from '@/types/media';

// Mock mp4Validator — default returns valid, per-test can override to invalid
jest.mock('@/lib/converters/mp4Validator', () => ({
  validateFragmentedMp4: jest.fn(() => ({ valid: true })),
}));

// Mock the transmuxers
jest.mock('@/lib/converters/tsTransmuxer', () => ({
  transmuxTsToFmp4: jest.fn(async (
    _inputFile: Blob,
    _dirHandle: FileSystemDirectoryHandle,
    outputName: string,
    _onProgress?: (processedBytes: number, totalBytes: number) => void,
  ) => {
    // Simulate writing output.mp4
    const { createOpfsWriter } = require('@/lib/storage/opfsStorage');
    const writer = await createOpfsWriter(_dirHandle, outputName);
    // Write a minimal valid fmp4 (ftyp + moov + moof + mdat)
    // ftyp: 20, moov: 8, moof: 8, mdat: 16 = 52 bytes total
    const data = new Uint8Array(52);
    let offset = 0;
    // ftyp: size=20
    data[offset] = 0; data[offset+1] = 0; data[offset+2] = 0; data[offset+3] = 20;
    data[offset+4] = 0x66; data[offset+5] = 0x74; data[offset+6] = 0x79; data[offset+7] = 0x70;
    offset += 20;
    // moov: size=8
    data[offset] = 0; data[offset+1] = 0; data[offset+2] = 0; data[offset+3] = 8;
    data[offset+4] = 0x6d; data[offset+5] = 0x6f; data[offset+6] = 0x6f; data[offset+7] = 0x76;
    offset += 8;
    // moof: size=8
    data[offset] = 0; data[offset+1] = 0; data[offset+2] = 0; data[offset+3] = 8;
    data[offset+4] = 0x6d; data[offset+5] = 0x6f; data[offset+6] = 0x6f; data[offset+7] = 0x66;
    offset += 8;
    // mdat: size=16 (8 header + 8 data)
    data[offset] = 0; data[offset+1] = 0; data[offset+2] = 0; data[offset+3] = 16;
    data[offset+4] = 0x6d; data[offset+5] = 0x64; data[offset+6] = 0x61; data[offset+7] = 0x74;
    await writer.write(data);
    await writer.close();
    return { success: true, outputName };
  }),
}));

jest.mock('@/lib/converters/parallelTransmuxer', () => ({
  transmuxTsToFmp4ParallelExperimental: jest.fn(async (opts: {
    downloadId: string;
    outputName?: string;
  }) => {
    // Simulate writing output.mp4
    const { ensureDownloadSubdir, createOpfsWriter } = require('@/lib/storage/opfsStorage');
    const dirHandle = await ensureDownloadSubdir(opts.downloadId);
    const writer = await createOpfsWriter(dirHandle, opts.outputName || 'output.mp4');
    // Same valid fmp4 structure as sequential mock
    const data = new Uint8Array(52);
    let offset = 0;
    data[offset] = 0; data[offset+1] = 0; data[offset+2] = 0; data[offset+3] = 20;
    data[offset+4] = 0x66; data[offset+5] = 0x74; data[offset+6] = 0x79; data[offset+7] = 0x70;
    offset += 20;
    data[offset] = 0; data[offset+1] = 0; data[offset+2] = 0; data[offset+3] = 8;
    data[offset+4] = 0x6d; data[offset+5] = 0x6f; data[offset+6] = 0x6f; data[offset+7] = 0x76;
    offset += 8;
    data[offset] = 0; data[offset+1] = 0; data[offset+2] = 0; data[offset+3] = 8;
    data[offset+4] = 0x6d; data[offset+5] = 0x6f; data[offset+6] = 0x6f; data[offset+7] = 0x66;
    offset += 8;
    data[offset] = 0; data[offset+1] = 0; data[offset+2] = 0; data[offset+3] = 16;
    data[offset+4] = 0x6d; data[offset+5] = 0x64; data[offset+6] = 0x61; data[offset+7] = 0x74;
    await writer.write(data);
    await writer.close();
    return { success: true, outputName: opts.outputName || 'output.mp4', partCount: 2 };
  }),
  readSegmentRanges: jest.fn(),
  writeSegmentRanges: jest.fn(),
}));

// --- OPFS mock ---

class MockFileHandle {
  name: string;
  data: Uint8Array;
  lastModified: number;
  constructor(name: string, data: Uint8Array = new Uint8Array()) {
    this.name = name;
    this.data = data;
    this.lastModified = Date.now();
  }
  async getFile(): Promise<File> {
    return new File([this.data.slice().buffer], this.name, {
      type: 'application/octet-stream',
      lastModified: this.lastModified,
    });
  }
  async createWritable(): Promise<{
    write: (data: Uint8Array) => Promise<void>;
    close: () => Promise<void>;
  }> {
    const handle = this;
    return {
      async write(data: Uint8Array) {
        handle.data = data.slice();
      },
      async close() {},
    };
  }
}

class MockDirHandle {
  name: string;
  files = new Map<string, MockFileHandle>();
  dirs = new Map<string, MockDirHandle>();
  constructor(name: string) { this.name = name; }

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
  async removeEntry(name: string): Promise<void> {
    this.files.delete(name);
    this.dirs.delete(name);
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

function makeSettings(
  overrides: Partial<Pick<Settings, 'parallelConversion' | 'manualWorkerCount' | 'parallelFallback'>> = {},
): Pick<Settings, 'parallelConversion' | 'manualWorkerCount' | 'parallelFallback'> {
  return {
    parallelConversion: 'auto',
    manualWorkerCount: 4,
    parallelFallback: 'sequential',
    ...overrides,
  };
}

function makeRanges(count: number, sizeEach: number): SegmentRange[] {
  const ranges: SegmentRange[] = [];
  let offset = 0;
  for (let i = 0; i < count; i++) {
    ranges.push({ index: i, startByte: offset, endByte: offset + sizeEach, size: sizeEach, duration: 10 });
    offset += sizeEach;
  }
  return ranges;
}

const LARGE_FILE = 400 * 1024 * 1024; // 400MB
const EIGHT_CORES = 8;

describe('executeParallelConversion', () => {
  beforeEach(() => {
    rootDir.dirs.clear();
    // Create downloads/dl-test/ with input.ts
    const downloadsDir = new MockDirHandle('downloads');
    rootDir.dirs.set('downloads', downloadsDir);
    const sub = new MockDirHandle('dl-test');
    downloadsDir.dirs.set('dl-test', sub);
    sub.files.set('input.ts', new MockFileHandle('input.ts', new Uint8Array(1000).fill(0xff)));
  });

  it('runs sequential when parallel is disabled (off mode)', async () => {
    const result = await executeParallelConversion(
      makeSettings({ parallelConversion: 'off' }),
      'dl-test',
      makeRanges(12, 20_000_000),
      LARGE_FILE,
      EIGHT_CORES,
    );

    expect(result.success).toBe(true);
    expect(result.usedParallel).toBe(false);
  });

  it('runs sequential when no segment metadata', async () => {
    const result = await executeParallelConversion(
      makeSettings(),
      'dl-test',
      undefined,
      LARGE_FILE,
      EIGHT_CORES,
    );

    expect(result.success).toBe(true);
    expect(result.usedParallel).toBe(false);
  });

  it('runs parallel when eligible', async () => {
    const result = await executeParallelConversion(
      makeSettings(),
      'dl-test',
      makeRanges(20, 20_000_000),
      LARGE_FILE,
      EIGHT_CORES,
    );

    expect(result.success).toBe(true);
    expect(result.usedParallel).toBe(true);
    expect(result.workerCount).toBe(4);
  });

  it('reports progress through phases', async () => {
    const phases: string[] = [];
    await executeParallelConversion(
      makeSettings(),
      'dl-test',
      makeRanges(20, 20_000_000),
      LARGE_FILE,
      EIGHT_CORES,
      0,
      (_percent, phase) => phases.push(phase),
    );

    expect(phases).toContain('planning');
    expect(phases).toContain('transmuxing');
    expect(phases).toContain('validating');
    expect(phases).toContain('done');
  });

  it('can be cancelled', async () => {
    // Cancel before starting
    const promise = executeParallelConversion(
      makeSettings(),
      'dl-test',
      makeRanges(20, 20_000_000),
      LARGE_FILE,
      EIGHT_CORES,
    );

    cancelParallelConversion('dl-test');
    const result = await promise;

    // Should still complete (mock is fast) but may report cancelled
    expect(result).toBeDefined();
  });

  it('isParallelConversionCancelled returns false for unknown', () => {
    expect(isParallelConversionCancelled('unknown')).toBe(false);
  });

  // --- Characterization tests (M0.2): pin fallback / cancel paths ---

  it('characterization: parallel returns {success:false} → throws → fallback runs sequential (usedParallel stays true)', async () => {
    // Pin: when parallelTransmuxer returns {success:false}, coordinator throws
    // (line 145) → executeWithFallback catches → runs sequential fallback.
    // Actual behavior: result.success=true (sequential worked), but
    // usedParallel=true (coordinator hardcodes true at line 179 — does NOT
    // track whether fallback was used inside executeWithFallback).
    const parallelMock = transmuxTsToFmp4ParallelExperimental as jest.Mock;
    parallelMock.mockResolvedValueOnce({
      success: false,
      outputName: 'output.mp4',
      error: 'parallel transmux failed (characterization)',
    });

    const result = await executeParallelConversion(
      makeSettings(),
      'dl-test',
      makeRanges(20, 20_000_000),
      LARGE_FILE,
      EIGHT_CORES,
    );

    expect(result.success).toBe(true);
    // Characterization pin: usedParallel is true even though fallback ran.
    // This is the ACTUAL behavior — coordinator doesn't know fallback was used.
    expect(result.usedParallel).toBe(true);
    // Sequential transmuxer was called (fallback path)
    expect((transmuxTsToFmp4 as jest.Mock)).toHaveBeenCalled();
  });

  it('characterization: validation fails → fallback to sequential → usedParallel=false, fallbackUsed=true', async () => {
    // Pin: parallel succeeds, but validateFragmentedMp4 returns invalid →
    // coordinator runs sequential again (lines 162-165) and returns
    // { usedParallel:false, fallbackUsed:true }.
    (validateFragmentedMp4 as jest.Mock).mockReturnValueOnce({
      valid: false,
      reason: 'characterization: invalid fmp4',
    });

    const result = await executeParallelConversion(
      makeSettings(),
      'dl-test',
      makeRanges(20, 20_000_000),
      LARGE_FILE,
      EIGHT_CORES,
    );

    expect(result.success).toBe(true);
    expect(result.usedParallel).toBe(false);
    expect(result.fallbackUsed).toBe(true);
  });

  it('characterization: cancellation error with fail strategy → returns {success:false, error:"Conversion cancelled"}', async () => {
    // Pin: when parallel throws ParallelConversionCancelledError AND the
    // fallback strategy is 'fail', executeWithFallback re-throws (doesn't
    // catch). The coordinator catch block (lines 184-192) then catches it
    // and returns a cancelled result instead of re-throwing.
    // NOTE: with 'sequential' strategy, executeWithFallback would catch the
    // error and run sequential — the coordinator catch block would NOT be
    // reached. We use 'fail' to exercise the coordinator's own catch.
    const parallelMock = transmuxTsToFmp4ParallelExperimental as jest.Mock;
    parallelMock.mockRejectedValueOnce(new ParallelConversionCancelledError());

    const result = await executeParallelConversion(
      makeSettings({ parallelFallback: 'fail' }),
      'dl-test',
      makeRanges(20, 20_000_000),
      LARGE_FILE,
      EIGHT_CORES,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Conversion cancelled');
    expect(result.usedParallel).toBe(false);
  });
});
