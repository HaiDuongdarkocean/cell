/**
 * CLI benchmark: download M3U8 → convert sequential vs parallel.
 *
 * Usage:
 *   node scripts/benchmark-m3u8.mjs <m3u8-url>
 *
 * Downloads all TS segments, builds input.ts, records byte ranges,
 * then runs both sequential and parallel transmux and compares timing.
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// mux.js
import muxjs from 'mux.js';
const { Transmuxer } = muxjs.mp4;

// ─── Helpers ───────────────────────────────────────────────────────

function parseM3u8(text) {
  const lines = text.split('\n').map(l => l.trim());
  const segments = [];
  let duration = 0;
  let baseUrl = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXTINF:')) {
      duration = parseFloat(line.slice(8).split(',')[0]);
    } else if (line && !line.startsWith('#')) {
      segments.push({ url: line, duration });
      duration = 0;
    }
  }
  return segments;
}

function resolveUrl(base, relative) {
  if (relative.startsWith('http')) return relative;
  const baseParts = base.split('/');
  baseParts.pop(); // remove filename
  if (relative.startsWith('/')) {
    const origin = baseParts.slice(0, 3).join('/');
    return origin + relative;
  }
  return baseParts.join('/') + '/' + relative;
}

// ─── HTTP helpers ──────────────────────────────────────────────────

/**
 * Default headers to mimic a browser request.
 * Many HLS servers reject requests without a browser User-Agent or Referer.
 */
const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Resolve the Referer/Origin from the m3u8 URL's origin.
 * Servers like streamfree.vip often require Referer to match.
 */
function headersFor(url, extra = {}) {
  const origin = new URL(url).origin;
  return {
    ...DEFAULT_HEADERS,
    Referer: origin + '/',
    Origin: origin,
    ...extra,
  };
}

async function fetchWithHeaders(url, extra = {}) {
  return fetch(url, { headers: headersFor(url, extra) });
}

async function downloadSegment(url) {
  const res = await fetchWithHeaders(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

// ─── Sequential transmux ───────────────────────────────────────────

function transmuxSequential(inputBuffer, label = 'sequential') {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const transmuxer = new Transmuxer();
    let bytesWritten = 0;
    const chunks = [];

    transmuxer.on('data', (segment) => {
      if (segment.initSegment && segment.initSegment.length > 0) {
        chunks.push(segment.initSegment);
        bytesWritten += segment.initSegment.length;
      }
      if (segment.data && segment.data.length > 0) {
        chunks.push(segment.data);
        bytesWritten += segment.data.length;
      }
    });

    transmuxer.on('done', () => {
      const durationMs = Math.round(performance.now() - start);
      const output = Buffer.concat(chunks.map(c => Buffer.from(c)));
      resolve({ durationMs, bytesWritten, outputSize: output.length, output });
    });

    const CHUNK_SIZE = 4 * 1024 * 1024;
    for (let offset = 0; offset < inputBuffer.length; offset += CHUNK_SIZE) {
      const end = Math.min(offset + CHUNK_SIZE, inputBuffer.length);
      transmuxer.push(inputBuffer.slice(offset, end));
    }
    transmuxer.flush();

    // Timeout
    setTimeout(() => {
      reject(new Error(`${label} timed out after 120s`));
    }, 120000);
  });
}

// ─── Parallel transmux (by segment groups) ─────────────────────────

function groupSegmentsByBytes(segmentRanges, workerCount) {
  if (segmentRanges.length === 0) return [];
  const totalBytes = segmentRanges.reduce((s, r) => s + r.size, 0);
  const targetBytesPerGroup = Math.ceil(totalBytes / workerCount);

  const groups = [];
  let currentGroup = { index: 0, startByte: 0, endByte: 0, size: 0, segmentIndices: [] };
  let currentBytes = 0;

  for (let i = 0; i < segmentRanges.length; i++) {
    const range = segmentRanges[i];
    if (currentGroup.segmentIndices.length > 0 && currentBytes + range.size > targetBytesPerGroup && groups.length < workerCount - 1) {
      currentGroup.endByte = range.startByte;
      groups.push(currentGroup);
      currentGroup = { index: groups.length, startByte: range.startByte, endByte: 0, size: 0, segmentIndices: [] };
      currentBytes = 0;
    }
    currentGroup.segmentIndices.push(i);
    currentGroup.size += range.size;
    currentBytes += range.size;
  }

  if (currentGroup.segmentIndices.length > 0) {
    currentGroup.endByte = segmentRanges[segmentRanges.length - 1].endByte;
    groups.push(currentGroup);
  }

  return groups;
}

function transmuxGroup(inputBuffer, group, groupIndex) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const transmuxer = new Transmuxer();
    const chunks = [];
    let bytesWritten = 0;

    transmuxer.on('data', (segment) => {
      if (segment.initSegment && segment.initSegment.length > 0) {
        chunks.push(segment.initSegment);
        bytesWritten += segment.initSegment.length;
      }
      if (segment.data && segment.data.length > 0) {
        chunks.push(segment.data);
        bytesWritten += segment.data.length;
      }
    });

    transmuxer.on('done', () => {
      const durationMs = Math.round(performance.now() - start);
      const output = Buffer.concat(chunks.map(c => Buffer.from(c)));
      resolve({ groupIndex, durationMs, bytesWritten, outputSize: output.length, output });
    });

    // Push only this group's byte range
    const groupData = inputBuffer.slice(group.startByte, group.endByte);
    const CHUNK_SIZE = 4 * 1024 * 1024;
    for (let offset = 0; offset < groupData.length; offset += CHUNK_SIZE) {
      const end = Math.min(offset + CHUNK_SIZE, groupData.length);
      transmuxer.push(groupData.slice(offset, end));
    }
    transmuxer.flush();

    setTimeout(() => {
      reject(new Error(`Group ${groupIndex} timed out after 120s`));
    }, 120000);
  });
}

async function transmuxParallel(inputBuffer, segmentRanges, workerCount) {
  const start = performance.now();
  const groups = groupSegmentsByBytes(segmentRanges, workerCount);

  console.log(`  Groups: ${groups.length} (requested ${workerCount} workers)`);
  groups.forEach((g, i) => {
    console.log(`    Group ${i}: bytes [${g.startByte}, ${g.endByte}), ${g.segmentIndices.length} segments, ${(g.size / 1024 / 1024).toFixed(1)}MB`);
  });

  // Transmux all groups in parallel
  const groupPromises = groups.map((g, i) => transmuxGroup(inputBuffer, g, i));
  const groupResults = await Promise.all(groupPromises);

  // Merge outputs
  const merged = Buffer.concat(groupResults.map(r => r.output));
  const totalDurationMs = Math.round(performance.now() - start);

  // Report per-group timing
  groupResults.forEach(r => {
    console.log(`    Group ${r.groupIndex}: ${r.durationMs}ms, ${(r.outputSize / 1024 / 1024).toFixed(1)}MB output`);
  });

  return {
    durationMs: totalDurationMs,
    bytesWritten: merged.length,
    outputSize: merged.length,
    output: merged,
    groupCount: groups.length,
    groupTimings: groupResults.map(r => r.durationMs),
  };
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  const m3u8Url = process.argv[2];
  if (!m3u8Url) {
    console.error('Usage: node scripts/benchmark-m3u8.mjs <m3u8-url>');
    process.exit(1);
  }

  const workerCounts = [2, 4];
  const tmpDir = join(__dirname, '..', 'tmp-benchmark');
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  console.log(`\n=== M3U8 Benchmark ===`);
  console.log(`URL: ${m3u8Url}\n`);

  // 1. Download and parse M3U8
  console.log('1. Downloading M3U8 playlist...');
  const res = await fetchWithHeaders(m3u8Url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const m3u8Text = await res.text();
  let segments = parseM3u8(m3u8Text);
  segments = segments.map(s => ({ ...s, url: resolveUrl(m3u8Url, s.url) }));
  console.log(`   Found ${segments.length} segments`);

  // 2. Download all segments, build input.ts, record byte ranges
  console.log('2. Downloading segments...');
  const downloadStart = performance.now();
  const segmentRanges = [];
  const chunks = [];
  let offset = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    process.stdout.write(`\r   Segment ${i + 1}/${segments.length}...`);
    const data = await downloadSegment(seg.url);
    chunks.push(data);
    segmentRanges.push({
      index: i,
      startByte: offset,
      endByte: offset + data.length,
      size: data.length,
      duration: seg.duration,
    });
    offset += data.length;
  }

  const inputBuffer = Buffer.concat(chunks);
  const downloadMs = Math.round(performance.now() - downloadStart);
  const totalMB = (inputBuffer.length / 1024 / 1024).toFixed(1);
  console.log(`\n   Downloaded ${totalMB}MB in ${downloadMs}ms (${(inputBuffer.length / 1024 / 1024 / (downloadMs / 1000)).toFixed(1)}MB/s)`);
  console.log(`   Segment count: ${segmentRanges.length}`);
  console.log(`   Avg segment size: ${(inputBuffer.length / segmentRanges.length / 1024).toFixed(0)}KB`);

  // Save input.ts for reference
  writeFileSync(join(tmpDir, 'input.ts'), inputBuffer);
  writeFileSync(join(tmpDir, 'segment-ranges.json'), JSON.stringify(segmentRanges, null, 2));

  // 3. Sequential transmux
  console.log('\n3. Sequential transmux...');
  const seqResult = await transmuxSequential(inputBuffer, 'sequential');
  const seqMBps = (inputBuffer.length / 1024 / 1024 / (seqResult.durationMs / 1000)).toFixed(1);
  console.log(`   Duration: ${seqResult.durationMs}ms`);
  console.log(`   Output: ${(seqResult.outputSize / 1024 / 1024).toFixed(1)}MB`);
  console.log(`   Throughput: ${seqMBps}MB/s`);
  writeFileSync(join(tmpDir, 'output-sequential.mp4'), seqResult.output);

  // 4. Parallel transmux with different worker counts
  const parallelResults = [];
  for (const wc of workerCounts) {
    console.log(`\n4. Parallel transmux (${wc} workers)...`);
    const parResult = await transmuxParallel(inputBuffer, segmentRanges, wc);
    const parMBps = (inputBuffer.length / 1024 / 1024 / (parResult.durationMs / 1000)).toFixed(1);
    console.log(`   Duration: ${parResult.durationMs}ms`);
    console.log(`   Output: ${(parResult.outputSize / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   Throughput: ${parMBps}MB/s`);
    console.log(`   Group timings: ${parResult.groupTimings.join('ms, ')}ms`);
    writeFileSync(join(tmpDir, `output-parallel-${wc}w.mp4`), parResult.output);
    parallelResults.push({ workerCount: wc, ...parResult });
  }

  // 5. Summary
  console.log('\n=== Summary ===');
  console.log(`Input: ${totalMB}MB, ${segmentRanges.length} segments`);
  console.log('');
  console.log(`${'Mode'.padEnd(20)} ${'Duration'.padEnd(12)} ${'Throughput'.padEnd(12)} ${'Speedup'}`);
  console.log(`${'─'.repeat(56)}`);
  console.log(`${'Sequential'.padEnd(20)} ${(seqResult.durationMs + 'ms').padEnd(12)} ${seqMBps + 'MB/s'.padEnd(12)} ${'1.00x'}`);
  for (const par of parallelResults) {
    const speedup = (seqResult.durationMs / par.durationMs).toFixed(2);
    const parMBps = (inputBuffer.length / 1024 / 1024 / (par.durationMs / 1000)).toFixed(1);
    console.log(`${`Parallel (${par.workerCount}w)`.padEnd(20)} ${(par.durationMs + 'ms').padEnd(12)} ${parMBps + 'MB/s'.padEnd(12)} ${speedup + 'x'}`);
  }
  console.log('');

  // 6. Output validation
  console.log('=== Output validation ===');
  for (const par of parallelResults) {
    const seqSize = seqResult.outputSize;
    const parSize = par.outputSize;
    const sizeDiff = Math.abs(seqSize - parSize);
    const sizeDiffPct = ((sizeDiff / seqSize) * 100).toFixed(1);
    console.log(`  ${par.workerCount}w: seq=${(seqSize/1024/1024).toFixed(1)}MB, par=${(parSize/1024/1024).toFixed(1)}MB, diff=${sizeDiffPct}%`);
  }

  console.log(`\nFiles saved to: ${tmpDir}`);
  console.log('');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
