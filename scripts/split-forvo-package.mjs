#!/usr/bin/env node
/**
 * Split a Forvo `.dsl.files.zip` into smaller zips by the first
 * alphabetic character of each audio filename.
 *
 * Output files are named `ForvoEnglish_{firstLetter}.zip` and contain
 * only the audio entries whose basename starts with that letter (case
 * insensitive). Non-alphabetic first characters are grouped under `_`.
 *
 * Usage:
 *   node scripts/split-forvo-package.mjs <input.zip> <output-dir>
 */

import fs from 'node:fs';
import path from 'node:path';
import { unzip } from 'unzipit';
import { Zip, ZipPassThrough } from 'fflate';

const INPUT_PATTERN = /ForvoEnglish\.dsl\.files\.zip$/i;

function firstLetter(filename) {
  const base = path.basename(filename);
  const match = base.match(/\p{L}/u);
  return match ? match[0].toLowerCase() : '_';
}

function groupFiles(entries) {
  const groups = new Map();
  for (const [name, entry] of Object.entries(entries)) {
    if (entry.isDirectory) continue;
    const letter = firstLetter(name);
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push({ name, entry });
  }
  return groups;
}

async function writeSplitZip(outPath, files) {
  const writeStream = fs.createWriteStream(outPath);
  const zip = new Zip();
  let terminated = false;

  zip.ondata = (err, data, final) => {
    if (err) {
      writeStream.destroy(err);
      return;
    }
    if (data) writeStream.write(data);
    if (final && !terminated) {
      terminated = true;
      writeStream.end();
    }
  };

  for (const { name, entry } of files) {
    const stream = new ZipPassThrough(name);
    zip.add(stream);
    const buffer = await entry.arrayBuffer();
    stream.push(new Uint8Array(buffer), true);
  }

  zip.end();

  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

async function splitPackage(inputPath, outputDir) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }
  if (!INPUT_PATTERN.test(path.basename(inputPath))) {
    console.warn(`Input does not match expected name ForvoEnglish.dsl.files.zip: ${inputPath}`);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const buffer = await fs.promises.readFile(inputPath);
  const { entries } = await unzip(new Uint8Array(buffer));
  const groups = groupFiles(entries);

  for (const [letter, files] of groups) {
    const outPath = path.join(outputDir, `ForvoEnglish_${letter}.zip`);
    await writeSplitZip(outPath, files);
    console.log(`Wrote ${outPath} with ${files.length} entries`);
  }
}

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node scripts/split-forvo-package.mjs <input.zip> <output-dir>');
  process.exit(1);
}

splitPackage(input, output).catch((err) => {
  console.error(err);
  process.exit(1);
});
