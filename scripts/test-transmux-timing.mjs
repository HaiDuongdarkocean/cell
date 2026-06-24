/**
 * Test: does mux.js fire 'done' synchronously or asynchronously after flush()?
 *
 * This reproduces the bug in transmuxWorker.ts where 'done' listener is
 * registered AFTER flush(), causing the worker to time out.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import muxjs from 'mux.js';

const { Transmuxer } = muxjs.mp4;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const inputFile = join(__dirname, '..', 'tmp-benchmark', 'input.ts');
const inputBuffer = new Uint8Array(readFileSync(inputFile));

console.log(`Input: ${(inputBuffer.length / 1024 / 1024).toFixed(1)}MB`);

// Test 1: Register 'done' BEFORE flush() (correct pattern)
function testBeforeFlush() {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const transmuxer = new Transmuxer();
    let bytesWritten = 0;
    const chunks = [];

    transmuxer.on('data', (segment) => {
      if (segment.initSegment) { chunks.push(segment.initSegment); bytesWritten += segment.initSegment.length; }
      if (segment.data) { chunks.push(segment.data); bytesWritten += segment.data.length; }
    });

    // Register 'done' BEFORE flush
    transmuxer.on('done', () => {
      const ms = Math.round(performance.now() - start);
      console.log(`[BEFORE flush] done event fired in ${ms}ms, output=${(bytesWritten / 1024 / 1024).toFixed(1)}MB`);
      transmuxer.dispose();
      resolve({ ms, bytesWritten });
    });

    // Push data
    const CHUNK = 4 * 1024 * 1024;
    for (let i = 0; i < inputBuffer.length; i += CHUNK) {
      transmuxer.push(inputBuffer.subarray(i, Math.min(i + CHUNK, inputBuffer.length)));
    }

    transmuxer.flush();

    setTimeout(() => {
      reject(new Error('[BEFORE flush] timed out after 60s'));
    }, 60000);
  });
}

// Test 2: Register 'done' AFTER flush() (buggy pattern — same as transmuxWorker.ts)
function testAfterFlush() {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const transmuxer = new Transmuxer();
    let bytesWritten = 0;
    const chunks = [];

    transmuxer.on('data', (segment) => {
      if (segment.initSegment) { chunks.push(segment.initSegment); bytesWritten += segment.initSegment.length; }
      if (segment.data) { chunks.push(segment.data); bytesWritten += segment.data.length; }
    });

    // Push data
    const CHUNK = 4 * 1024 * 1024;
    for (let i = 0; i < inputBuffer.length; i += CHUNK) {
      transmuxer.push(inputBuffer.subarray(i, Math.min(i + CHUNK, inputBuffer.length)));
    }

    transmuxer.flush();

    // Register 'done' AFTER flush (this is the bug in transmuxWorker.ts)
    transmuxer.on('done', () => {
      const ms = Math.round(performance.now() - start);
      console.log(`[AFTER flush] done event fired in ${ms}ms, output=${(bytesWritten / 1024 / 1024).toFixed(1)}MB`);
      transmuxer.dispose();
      resolve({ ms, bytesWritten });
    });

    setTimeout(() => {
      transmuxer.dispose();
      reject(new Error('[AFTER flush] timed out after 60s — done event was missed!'));
    }, 60000);
  });
}

async function main() {
  console.log('\n=== Test 1: done listener BEFORE flush() ===');
  try {
    await testBeforeFlush();
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
  }

  console.log('\n=== Test 2: done listener AFTER flush() ===');
  try {
    await testAfterFlush();
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
  }
}

main().catch(console.error);
