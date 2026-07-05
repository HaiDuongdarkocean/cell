/**
 * CLI benchmark with REAL parallelism via worker_threads.
 *
 * Usage:
 *   node scripts/benchmark-m3u8-workers.mjs <m3u8-url>
 *
 * Uses Node.js worker_threads to run transmuxer instances on
 * separate CPU cores — true parallelism, not just concurrency.
 */

import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Worker } from 'worker_threads';
import { cpus } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── M3U8 parsing ──────────────────────────────────────────────────

function parseM3u8(text) {
  const lines = text.split('\n').map(l => l.trim());
  const segments = [];
  let duration = 0;
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
  baseParts.pop();
  if (relative.startsWith('/')) {
    return baseParts.slice(0, 3).join('/') + relative;
  }
  return baseParts.join('/') + '/' + relative;
}

async function downloadSegment(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

// ─── Segment grouping ──────────────────────────────────────────────

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

// ─── Worker thread code ────────────────────────────────────────────
// This runs in a separate thread with its own CPU core.

const WORKER_CODE = `
const { parentPort, workerData } = require('worker_threads');
const muxjs = require('mux.js');
const { Transmuxer } = muxjs.mp4;

parentPort.on('message', (msg) => {
  if (msg.type === 'transmux') {
    const { groupData, groupIndex } = msg;
    const start = performance.now();
    const transmuxer = new Transmuxer();
    const chunks = [];
    let bytesWritten = 0;

    transmuxer.on('data', (segment) => {
      if (segment.initSegment && segment.initSegment.length > 0) {
        chunks.push(Buffer.from(segment.initSegment));
        bytesWritten += segment.initSegment.length;
      }
      if (segment.data && segment.data.length > 0) {
        chunks.push(Buffer.from(segment.data));
        bytesWritten += segment.data.length;
      }
    });

    transmuxer.on('done', () => {
      const durationMs = Math.round(performance.now() - start);
      const output = Buffer.concat(chunks);
      parentPort.postMessage({
        type: 'done',
        groupIndex,
        durationMs,
        bytesWritten,
        outputSize: output.length,
        output,
      });
    });

    const CHUNK_SIZE = 4 * 1024 * 1024;
    for (let offset = 0; offset < groupData.length; offset += CHUNK_SIZE) {
      const end = Math.min(offset + CHUNK_SIZE, groupData.length);
      transmuxer.push(groupData.slice(offset, end));
    }
    transmuxer.flush();
  }
});
`;

// ─── Sequential transmux (in main thread) ──────────────────────────

function transmuxSequential(inputBuffer) {
  return new Promise((resolve, reject) => {
    // Dynamic import of mux.js
    import('mux.js').then(muxjs => {
      const { Transmuxer } = muxjs.default.mp4;
      const start = performance.now();
      const transmuxer = new Transmuxer();
      const chunks = [];
      let bytesWritten = 0;

      transmuxer.on('data', (segment) => {
        if (segment.initSegment && segment.initSegment.length > 0) {
          chunks.push(Buffer.from(segment.initSegment));
          bytesWritten += segment.initSegment.length;
        }
        if (segment.data && segment.data.length > 0) {
          chunks.push(Buffer.from(segment.data));
          bytesWritten += segment.data.length;
        }
      });

      transmuxer.on('done', () => {
        const durationMs = Math.round(performance.now() - start);
        const output = Buffer.concat(chunks);
        resolve({ durationMs, bytesWritten, outputSize: output.length, output });
      });

      const CHUNK_SIZE = 4 * 1024 * 1024;
      for (let offset = 0; offset < inputBuffer.length; offset += CHUNK_SIZE) {
        const end = Math.min(offset + CHUNK_SIZE, inputBuffer.length);
        transmuxer.push(inputBuffer.slice(offset, end));
      }
      transmuxer.flush();

      setTimeout(() => reject(new Error('Sequential timed out')), 120000);
    });
  });
}

// ─── Parallel transmux with worker_threads ─────────────────────────

function transmuxGroupInWorker(groupData, groupIndex) {
  return new Promise((resolve, reject) => {
    // Write worker code to a temp file
    const workerPath = join(__dirname, '_transmux-worker.cjs');
    writeFileSync(workerPath, WORKER_CODE);

    const worker = new Worker(workerPath, {
      workerData: { groupIndex },
    });

    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error(`Worker ${groupIndex} timed out`));
    }, 120000);

    worker.on('message', (msg) => {
      if (msg.type === 'done') {
        clearTimeout(timeout);
        worker.terminate();
        resolve({
          groupIndex: msg.groupIndex,
          durationMs: msg.durationMs,
          bytesWritten: msg.bytesWritten,
          outputSize: msg.outputSize,
          output: Buffer.from(msg.output),
        });
      }
    });

    worker.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    // Send the group data to the worker
    worker.postMessage({
      type: 'transmux',
      groupData: Buffer.from(groupData),
      groupIndex,
    });
  });
}

async function transmuxParallelWorkers(inputBuffer, segmentRanges, workerCount) {
  const start = performance.now();
  const groups = groupSegmentsByBytes(segmentRanges, workerCount);

  console.log(`  Groups: ${groups.length} (requested ${workerCount} workers)`);
  groups.forEach((g, i) => {
    console.log(`    Group ${i}: bytes [${g.startByte}, ${g.endByte}), ${g.segmentIndices.length} segments, ${(g.size / 1024 / 1024).toFixed(1)}MB`);
  });

  // Launch all workers in parallel (TRUE parallelism — separate threads)
  const groupPromises = groups.map((g, i) => {
    const groupData = inputBuffer.slice(g.startByte, g.endByte);
    return transmuxGroupInWorker(groupData, i);
  });

  const groupResults = await Promise.all(groupPromises);

  // Merge outputs
  const merged = Buffer.concat(groupResults.map(r => r.output));
  const totalDurationMs = Math.round(performance.now() - start);

  groupResults.forEach(r => {
    console.log(`    Group ${r.groupIndex}: ${r.durationMs}ms, ${(r.outputSize / 1024 / 1024).toFixed(1)}MB output`);
  });

  // Clean up temp worker file
  try { rmSync(join(__dirname, '_transmux-worker.cjs')); } catch { /* best-effort cleanup */ }

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
    console.error('Usage: node scripts/benchmark-m3u8-workers.mjs <m3u8-url>');
    process.exit(1);
  }

  const cpuCount = cpus().length;
  const workerCounts = [2, 4, Math.min(cpuCount - 1, 6)];
  const tmpDir = join(__dirname, '..', 'tmp-benchmark');
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  console.log(`\n=== M3U8 Benchmark (worker_threads — TRUE parallelism) ===`);
  console.log(`URL: ${m3u8Url}`);
  console.log(`CPU cores: ${cpuCount}`);
  console.log(`Worker counts to test: ${workerCounts.join(', ')}\n`);

  // 1. Download M3U8
  console.log('1. Downloading M3U8 playlist...');
  const res = await fetch(m3u8Url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const m3u8Text = await res.text();
  let segments = parseM3u8(m3u8Text);
  segments = segments.map(s => ({ ...s, url: resolveUrl(m3u8Url, s.url) }));
  console.log(`   Found ${segments.length} segments`);

  // 2. Download all segments
  console.log('2. Downloading segments...');
  const downloadStart = performance.now();
  const segmentRanges = [];
  const chunks = [];
  let offset = 0;

  for (let i = 0; i < segments.length; i++) {
    process.stdout.write(`\r   Segment ${i + 1}/${segments.length}...`);
    const data = await downloadSegment(segments[i].url);
    chunks.push(data);
    segmentRanges.push({
      index: i,
      startByte: offset,
      endByte: offset + data.length,
      size: data.length,
      duration: segments[i].duration,
    });
    offset += data.length;
  }

  const inputBuffer = Buffer.concat(chunks);
  const downloadMs = Math.round(performance.now() - downloadStart);
  const totalMB = (inputBuffer.length / 1024 / 1024).toFixed(1);
  console.log(`\n   Downloaded ${totalMB}MB in ${downloadMs}ms`);
  console.log(`   Segments: ${segmentRanges.length}, avg: ${(inputBuffer.length / segmentRanges.length / 1024).toFixed(0)}KB`);

  // 3. Sequential
  console.log('\n3. Sequential transmux (main thread)...');
  const seqResult = await transmuxSequential(inputBuffer);
  const seqMBps = (inputBuffer.length / 1024 / 1024 / (seqResult.durationMs / 1000)).toFixed(1);
  console.log(`   Duration: ${seqResult.durationMs}ms`);
  console.log(`   Output: ${(seqResult.outputSize / 1024 / 1024).toFixed(1)}MB`);
  console.log(`   Throughput: ${seqMBps}MB/s`);
  writeFileSync(join(tmpDir, 'output-sequential.mp4'), seqResult.output);

  // 4. Parallel with workers
  const parallelResults = [];
  for (const wc of workerCounts) {
    console.log(`\n4. Parallel transmux (${wc} workers, separate threads)...`);
    const parResult = await transmuxParallelWorkers(inputBuffer, segmentRanges, wc);
    const parMBps = (inputBuffer.length / 1024 / 1024 / (parResult.durationMs / 1000)).toFixed(1);
    console.log(`   Duration: ${parResult.durationMs}ms`);
    console.log(`   Output: ${(parResult.outputSize / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   Throughput: ${parMBps}MB/s`);
    console.log(`   Group timings: ${parResult.groupTimings.join('ms, ')}ms`);
    console.log(`   Max group time: ${Math.max(...parResult.groupTimings)}ms (theoretical minimum)`);
    writeFileSync(join(tmpDir, `output-parallel-${wc}w.mp4`), parResult.output);
    parallelResults.push({ workerCount: wc, ...parResult });
  }

  // 5. Summary
  console.log('\n=== Summary ===');
  console.log(`Input: ${totalMB}MB, ${segmentRanges.length} segments, ${cpuCount} CPU cores`);
  console.log('');
  console.log(`${'Mode'.padEnd(25)} ${'Duration'.padEnd(12)} ${'Throughput'.padEnd(12)} ${'Speedup'}`);
  console.log(`${'─'.repeat(61)}`);
  console.log(`${'Sequential'.padEnd(25)} ${(seqResult.durationMs + 'ms').padEnd(12)} ${seqMBps + 'MB/s'.padEnd(12)} ${'1.00x'}`);
  for (const par of parallelResults) {
    const speedup = (seqResult.durationMs / par.durationMs).toFixed(2);
    const parMBps = (inputBuffer.length / 1024 / 1024 / (par.durationMs / 1000)).toFixed(1);
    const maxGroup = Math.max(...par.groupTimings);
    const efficiency = ((maxGroup / par.durationMs) * 100).toFixed(0);
    console.log(`${`Parallel (${par.workerCount}w, threads)`.padEnd(25)} ${(par.durationMs + 'ms').padEnd(12)} ${parMBps + 'MB/s'.padEnd(12)} ${speedup + 'x'}`);
    console.log(`${'  → max group time:'.padEnd(25)} ${(maxGroup + 'ms').padEnd(12)} ${'efficiency: ' + efficiency + '%'}`);
  }
  console.log('');

  // 6. Validation
  console.log('=== Output validation ===');
  for (const par of parallelResults) {
    const sizeDiff = Math.abs(seqResult.outputSize - par.outputSize);
    const sizeDiffPct = ((sizeDiff / seqResult.outputSize) * 100).toFixed(1);
    console.log(`  ${par.workerCount}w: seq=${(seqResult.outputSize/1024/1024).toFixed(1)}MB, par=${(par.outputSize/1024/1024).toFixed(1)}MB, diff=${sizeDiffPct}%`);
  }

  console.log(`\nFiles saved to: ${tmpDir}\n`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
