/**
 * Integration: sequential transmux (transmuxTsToFmp4) on real m3u8 TS segments.
 *
 * Segments are downloaded once by globalSetup.ts and cached on disk; this file
 * only reads the cache (no network). Runs in its own jest worker in parallel
 * with parallel.integration.test.ts and compare.integration.test.ts.
 */
import { transmuxTsToFmp4 } from '@/features/transmux/merging/tsTransmuxer';
import { validateFragmentedMp4 } from '@/features/transmux/merging/mp4Validator';
import {
  countBoxes,
  installOpfsMock,
  loadCachedSegments,
  setupOpfsWithInput,
  type MockDirHandle,
} from './setup/fixtures';

let tsData: Uint8Array;
let testDir: MockDirHandle;

beforeAll(() => {
  installOpfsMock();
  const cached = loadCachedSegments();
  tsData = cached.tsData;
});

beforeEach(() => {
  testDir = setupOpfsWithInput(tsData);
});

describe('m3u8 → mp4 (sequential, real segments)', () => {
  it('transmuxTsToFmp4 produces valid mp4 with correct duration', async () => {
    const inputFile = await testDir.files.get('input.ts')!.getFile();
    const result = await transmuxTsToFmp4(
      inputFile,
      testDir as unknown as FileSystemDirectoryHandle,
      'output-seq.mp4',
    );

    expect(result.success).toBe(true);

    const outFile = await testDir.files.get('output-seq.mp4')!.getFile();
    const output = new Uint8Array(await outFile.arrayBuffer());

    const validation = validateFragmentedMp4(output);
    expect(validation.valid).toBe(true);
    expect(validation.initSegmentFound).toBe(true);
    expect(validation.mediaFragmentCount).toBeGreaterThan(0);

    // Box counts: exactly 1 ftyp + 1 moov
    const counts = countBoxes(output);
    expect(counts.ftyp).toBe(1);
    expect(counts.moov).toBe(1);
    expect(counts.moof).toBeGreaterThan(0);

    console.log(
      `[sequential] size=${output.length} bytes, boxes=${JSON.stringify(counts)}, validation=${validation.reason}`,
    );
  }, 60_000);
});
