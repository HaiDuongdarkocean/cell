/**
 * Integration: compare sequential vs parallel transmux output on real m3u8 TS
 * segments. Verifies both produce exactly 1 ftyp + 1 moov and that the parallel
 * moof count is >= sequential (multiple groups contribute fragments).
 *
 * Segments are downloaded once by globalSetup.ts and cached on disk; this file
 * only reads the cache (no network). Runs in its own jest worker in parallel
 * with sequential.integration.test.ts and parallel.integration.test.ts.
 */
import { transmuxTsToFmp4 } from '@/lib/converters/tsTransmuxer';
import { transmuxTsToFmp4ParallelExperimental } from '@/lib/converters/parallelTransmuxer';
import { groupSegmentsByBytes } from '@/lib/converters/segmentGrouping';
import { validateFragmentedMp4 } from '@/lib/converters/mp4Validator';
import {
  countBoxes,
  installOpfsMock,
  loadCachedSegments,
  setupOpfsWithInput,
  type MockDirHandle,
} from './setup/fixtures';
import type { SegmentRange } from '@/types/media';

const NUM_WORKERS = 3;

let tsData: Uint8Array;
let ranges: SegmentRange[];
let testDir: MockDirHandle;

beforeAll(() => {
  installOpfsMock();
  const cached = loadCachedSegments();
  tsData = cached.tsData;
  ranges = cached.ranges;
});

beforeEach(() => {
  testDir = setupOpfsWithInput(tsData);
});

describe('m3u8 → mp4 (sequential vs parallel comparison)', () => {
  it('parallel output duration/structure matches sequential output', async () => {
    // Sequential
    const inputFile = await testDir.files.get('input.ts')!.getFile();
    const seqResult = await transmuxTsToFmp4(
      inputFile,
      testDir as unknown as FileSystemDirectoryHandle,
      'cmp-seq.mp4',
    );
    expect(seqResult.success).toBe(true);
    const seqFile = await testDir.files.get('cmp-seq.mp4')!.getFile();
    const seqOut = new Uint8Array(await seqFile.arrayBuffer());

    // Parallel
    const groups = groupSegmentsByBytes(ranges, NUM_WORKERS);
    const parResult = await transmuxTsToFmp4ParallelExperimental({
      downloadId: 'dl-int',
      groups,
      segmentRanges: ranges,
      outputName: 'cmp-par.mp4',
    });
    expect(parResult.success).toBe(true);
    const parFile = await testDir.files.get('cmp-par.mp4')!.getFile();
    const parOut = new Uint8Array(await parFile.arrayBuffer());

    // Both should have exactly 1 ftyp + 1 moov
    const seqCounts = countBoxes(seqOut);
    const parCounts = countBoxes(parOut);
    expect(seqCounts.ftyp).toBe(1);
    expect(parCounts.ftyp).toBe(1);
    expect(seqCounts.moov).toBe(1);
    expect(parCounts.moov).toBe(1);

    // Both should pass validation
    expect(validateFragmentedMp4(seqOut).valid).toBe(true);
    expect(validateFragmentedMp4(parOut).valid).toBe(true);

    // moof count: parallel should have >= sequential (multiple groups)
    expect(parCounts.moof).toBeGreaterThanOrEqual(seqCounts.moof);

    console.log(`[compare] seq: ${JSON.stringify(seqCounts)}, par: ${JSON.stringify(parCounts)}`);
  }, 120_000);
});
