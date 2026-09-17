#!/usr/bin/env node
/**
 * Deep-import ratchet for the FSD layout.
 *
 * Cross-feature imports must go through the feature's public barrel
 * (`@/features/B` → src/features/B/index.ts). A specifier that resolves
 * deeper than the feature root — `@/features/B/inner/x` or a relative
 * `../B/inner/x` escape — bypasses the public API and is counted as a
 * deep import.
 *
 * The current set of deep imports is compared against a committed
 * baseline JSON (`importerFile -> specifier` pairs). New pairs FAIL the
 * check; baseline pairs that no longer exist print a STALE BASELINE
 * nudge without failing — a ratchet, same posture as KNOWN_CYCLES in
 * check-feature-cycles.mjs.
 *
 * Baseline resolution: `<dirname(srcRoot)>/scripts/baselines/deep-imports.json`
 * so the real run uses `scripts/baselines/deep-imports.json` while test
 * fixtures carry their own per-fixture baseline. Override with
 * `--baseline <path>`.
 *
 * Usage:
 *   node scripts/check-deep-imports.mjs [srcRoot] [--baseline <path>]
 *   node scripts/check-deep-imports.mjs [srcRoot] --write-baseline
 *
 * Exit: 0 = no new deep imports, 1 = new deep imports / unreadable tree /
 *       missing baseline.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
let srcRootArg;
let baselineArg;
let writeBaseline = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--baseline') baselineArg = args[++i];
  else if (args[i] === '--write-baseline') writeBaseline = true;
  else srcRootArg = args[i];
}

const SRC_ROOT = resolve(srcRootArg ?? join(ROOT, 'src'));
const FEATURES_DIR = join(SRC_ROOT, 'features');
const BASELINE_PATH = resolve(
  baselineArg ?? join(dirname(SRC_ROOT), 'scripts', 'baselines', 'deep-imports.json'),
);

const SOURCE_RE = /\.[cm]?[jt]sx?$/;
const SPECIFIER_RE = /\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
    } else if (SOURCE_RE.test(entry.name)) {
      yield path;
    }
  }
}

function isInside(dir, path) {
  return path === dir || path.startsWith(dir + sep);
}

function topSegment(dir, path) {
  return relative(dir, path).split(sep)[0];
}

function resolveSpecifier(specifier, file) {
  if (specifier.startsWith('@/')) return join(SRC_ROOT, specifier.slice(2));
  if (specifier.startsWith('.')) return resolve(dirname(file), specifier);
  return null;
}

function specifiersOf(file) {
  const text = readFileSync(file, 'utf8');
  const specs = [];
  let match;
  SPECIFIER_RE.lastIndex = 0;
  while ((match = SPECIFIER_RE.exec(text)) !== null) {
    specs.push(match[1]);
  }
  return specs;
}

function toPosix(path) {
  return path.split(sep).join('/');
}

// importer rel path (posix, relative to srcRoot) -> Set of specifiers
function collectDeepImports() {
  const entries = new Map();
  for (const file of walk(FEATURES_DIR)) {
    const rel = relative(FEATURES_DIR, file);
    const owner = rel.includes(sep) ? topSegment(FEATURES_DIR, file) : '(features)';
    for (const specifier of specifiersOf(file)) {
      const resolved = resolveSpecifier(specifier, file);
      if (!resolved || !isInside(FEATURES_DIR, resolved)) continue;
      const target = topSegment(FEATURES_DIR, resolved);
      if (target === owner) continue;
      // resolved === <features>/<B> means a barrel import ('@/features/B').
      const insideFeature = relative(join(FEATURES_DIR, target), resolved);
      if (insideFeature === '') continue;
      const importer = toPosix(relative(SRC_ROOT, file));
      if (!entries.has(importer)) entries.set(importer, new Set());
      entries.get(importer).add(specifier);
    }
  }
  return entries;
}

function loadBaseline() {
  const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const map = new Map();
  for (const [importer, specifiers] of Object.entries(raw.entries ?? {})) {
    map.set(importer, new Set(specifiers));
  }
  return map;
}

function writeBaselineFile(entries) {
  const obj = {};
  for (const importer of [...entries.keys()].sort()) {
    obj[importer] = [...entries.get(importer)].sort();
  }
  mkdirSync(dirname(BASELINE_PATH), { recursive: true });
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ entries: obj }, null, 2)}\n`, 'utf8');
}

if (!existsSync(FEATURES_DIR)) {
  console.error(`check-deep-imports: features dir not found at ${FEATURES_DIR}`);
  process.exit(1);
}

const current = collectDeepImports();

if (writeBaseline) {
  writeBaselineFile(current);
  const total = [...current.values()].reduce((sum, specs) => sum + specs.size, 0);
  console.log(`check-deep-imports: wrote ${total} deep-import pair(s) across ${current.size} file(s) to ${relative(ROOT, BASELINE_PATH)}`);
  process.exit(0);
}

if (!existsSync(BASELINE_PATH)) {
  console.error(`check-deep-imports: baseline not found at ${relative(ROOT, BASELINE_PATH)} — run with --write-baseline to seed the ratchet`);
  process.exit(1);
}

const baseline = loadBaseline();
const newEntries = [];
const staleEntries = [];

for (const [importer, specifiers] of current) {
  for (const specifier of specifiers) {
    if (!baseline.get(importer)?.has(specifier)) {
      newEntries.push({ importer, specifier });
      console.error(`DEEP IMPORT  ${importer} → '${specifier}'`);
    }
  }
}

let baselineTotal = 0;
for (const [importer, specifiers] of baseline) {
  for (const specifier of specifiers) {
    baselineTotal++;
    if (!current.get(importer)?.has(specifier)) {
      staleEntries.push({ importer, specifier });
      console.log(`STALE BASELINE  ${importer} → '${specifier}' — resolved, remove from ${relative(ROOT, BASELINE_PATH)}`);
    }
  }
}

if (newEntries.length > 0) {
  console.error(`check-deep-imports: ${newEntries.length} new deep import(s) not in baseline — route through the feature's index.ts barrel`);
  process.exit(1);
}

console.log(`check-deep-imports: ${baselineTotal} baseline pair(s), ${staleEntries.length} stale — clean`);
