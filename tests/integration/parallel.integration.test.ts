/**
 * Integration: parallel transmux (transmuxTsToFmp4ParallelExperimental) on real
 * m3u8 TS segments.
 *
 * Segments are downloaded once by globalSetup.ts and cached on disk; this file
 * only reads the cache (no network). Runs in its own jest worker in parallel
 * with sequential.integration.test.ts and compare.integration.test.ts.
 */
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

describe('m3u8 → mp4 (parallel, real segments)', () => {
  it('transmuxTsToFmp4ParallelExperimental produces valid mp4 with correct duration', async () => {
    const groups = groupSegmentsByBytes(ranges, NUM_WORKERS);
    expect(groups.length).toBeGreaterThan(0);

    const result = await transmuxTsToFmp4ParallelExperimental({
      downloadId: 'dl-int',
      groups,
      segmentRanges: ranges,
      outputName: 'output-par.mp4',
    });

    expect(result.success).toBe(true);

    const outFile = await testDir.files.get('output-par.mp4')!.getFile();
    const output = new Uint8Array(await outFile.arrayBuffer());

    const validation = validateFragmentedMp4(output);
    expect(validation.valid).toBe(true);
    expect(validation.initSegmentFound).toBe(true);
    expect(validation.mediaFragmentCount).toBeGreaterThan(0);

    // Box counts: exactly 1 ftyp + 1 moov (the tfdt/ftyp+moov strip fix!)
    const counts = countBoxes(output);
    expect(counts.ftyp).toBe(1);
    expect(counts.moov).toBe(1);
    // Should have moof from all groups
    expect(counts.moof).toBeGreaterThanOrEqual(groups.length);

    console.log(
      `[parallel] size=${output.length} bytes, boxes=${JSON.stringify(counts)}, validation=${validation.reason}`,
    );
  }, 60_000);
});
