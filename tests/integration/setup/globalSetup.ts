/**
 * Jest globalSetup for the integration project.
 *
 * Downloads the m3u8 playlist + first N TS segments ONCE per `test:integration`
 * run and caches them on disk so the 3 split test files (sequential, parallel,
 * compare) can read from disk instead of each re-downloading.
 *
 * Runs in Node context (not jsdom). Uses curl.exe because the test environment
 * has no fetch.
 *
 * Set FORCE_DOWNLOAD=1 to re-download even when a cache exists.
 */
import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { SegmentRange } from '@/types/media';

const CACHE_DIR = join(__dirname, '..', '.cache');
const TS_PATH = join(CACHE_DIR, 'input.ts');
const RANGES_PATH = join(CACHE_DIR, 'segmentRanges.json');
const META_PATH = join(CACHE_DIR, 'meta.json');

const M3U8_URL =
  'https://tmp.cdnvideo11.shop/tmp/A-Good-Girls-Guide-to-Murder---Season-2-Ep5/index.m3u8?v=4215f7e0-495e-4d0a-acf1-cfbb3c24a9fb';
const NUM_SEGMENTS = 12;

function downloadUrl(url: string): Buffer {
  return execSync(`curl.exe -s "${url}"`, { maxBuffer: 50 * 1024 * 1024 });
}

export default async function integrationGlobalSetup(): Promise<void> {
  const force = process.env.FORCE_DOWNLOAD === '1';
  const cacheValid =
    !force &&
    existsSync(TS_PATH) &&
    existsSync(RANGES_PATH) &&
    existsSync(META_PATH);

  if (cacheValid) {
    console.log('[integration:globalSetup] Using cached segments from', CACHE_DIR);
    return;
  }

  console.log('[integration:globalSetup] Downloading m3u8 + segments via curl...');

  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  const m3u8Buf = downloadUrl(M3U8_URL);
  const text = m3u8Buf.toString('utf8');
  const urls = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  const segments: Buffer[] = [];
  let totalBytes = 0;
  for (let i = 0; i < Math.min(NUM_SEGMENTS, urls.length); i++) {
    const segBuf = downloadUrl(urls[i]);
    segments.push(segBuf);
    totalBytes += segBuf.length;
  }

  // Concatenate into single TS buffer
  const tsData = Buffer.concat(segments, totalBytes);
  writeFileSync(TS_PATH, tsData);

  // Build segmentRanges (one per segment, contiguous) — mimics downloader.ts
  const ranges: SegmentRange[] = [];
  let byteOff = 0;
  for (let i = 0; i < segments.length; i++) {
    ranges.push({
      index: i,
      startByte: byteOff,
      endByte: byteOff + segments[i].length,
      size: segments[i].length,
      duration: 10,
    });
    byteOff += segments[i].length;
  }
  writeFileSync(RANGES_PATH, JSON.stringify(ranges));
  writeFileSync(
    META_PATH,
    JSON.stringify({ segmentCount: segments.length, totalBytes, m3u8Url: M3U8_URL }),
  );

  console.log(
    `[integration:globalSetup] Cached ${segments.length} segments (${totalBytes} bytes) to ${CACHE_DIR}`,
  );
}

// Re-export for test files to read the cached data paths.
export const CACHE = { CACHE_DIR, TS_PATH, RANGES_PATH, META_PATH };

// Provide a loader usable from test files (jsdom context).
export function loadCachedSegments(): { tsData: Uint8Array; ranges: SegmentRange[] } {
  const tsData = new Uint8Array(readFileSync(TS_PATH));
  const ranges: SegmentRange[] = JSON.parse(readFileSync(RANGES_PATH, 'utf8'));
  return { tsData, ranges };
}
