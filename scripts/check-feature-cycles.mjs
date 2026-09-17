#!/usr/bin/env node
/**
 * Feature-graph guard for the FSD layout.
 *
 * - Builds a feature-level dependency graph from src/features/* slices by
 *   resolving '@/features/x' alias imports and relative escapes into sibling
 *   features, then fails on NEW circular dependencies. Pre-existing cycles
 *   live in KNOWN_CYCLES as a ratchet — remove entries as debt lands, never
 *   add new ones.
 * - Fails on any file under src/features (or a stray top-level dir like the
 *   dissolved src/stores) importing from src/entrypoints — entrypoints consume
 *   features, never the reverse.
 *
 * Type-only edges count too: a type import cycle is still coupling the graph
 * should not contain.
 *
 * Usage: node scripts/check-feature-cycles.mjs [srcRoot]
 * Exit:  0 = clean, 1 = new cycles / entrypoint imports / unreadable tree.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_ROOT = resolve(process.argv[2] ?? join(ROOT, 'src'));
const FEATURES_DIR = join(SRC_ROOT, 'features');
const ENTRYPOINTS_DIR = join(SRC_ROOT, 'entrypoints');
const KNOWN_LAYERS = new Set(['app', 'entities', 'entrypoints', 'features', 'shared', 'types']);
const SOURCE_RE = /\.[cm]?[jt]sx?$/;
const SPECIFIER_RE = /\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

// Pre-existing feature cycles (audit 20260916 wave-2+ debt). Canonical form:
// cycle nodes rotated so the lexicographically smallest name leads, joined
// with '→'. A reported cycle 'a → b → a' canonicalizes to 'a→b'.
const KNOWN_CYCLES = new Set([]);

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

function canonicalCycleKey(cycle) {
  const nodes = cycle.slice(0, -1);
  let start = 0;
  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i] < nodes[start]) start = i;
  }
  return [...nodes.slice(start), ...nodes.slice(0, start)].join('→');
}

function findCycles(graph) {
  const cycles = [];
  const seen = new Set();
  const state = new Map();
  const stack = [];

  function dfs(node) {
    state.set(node, 1);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (state.get(next) === 1) {
        const cycle = [...stack.slice(stack.indexOf(next)), next];
        const key = canonicalCycleKey(cycle);
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(cycle);
        }
      } else if (!state.get(next)) {
        dfs(next);
      }
    }
    stack.pop();
    state.set(node, 2);
  }

  for (const node of graph.keys()) {
    if (!state.get(node)) dfs(node);
  }
  return cycles;
}

if (!existsSync(FEATURES_DIR)) {
  console.error(`check-feature-cycles: features dir not found at ${FEATURES_DIR}`);
  process.exit(1);
}

const graph = new Map();
const entrypointViolations = [];

function scanFile(file, owner) {
  for (const specifier of specifiersOf(file)) {
    const resolved = resolveSpecifier(specifier, file);
    if (!resolved) continue;
    if (isInside(ENTRYPOINTS_DIR, resolved)) {
      entrypointViolations.push({ file, specifier });
      continue;
    }
    if (isInside(FEATURES_DIR, resolved)) {
      const target = topSegment(FEATURES_DIR, resolved);
      if (target === owner) continue;
      if (!graph.get(owner)?.has(target)) {
        if (!graph.has(owner)) graph.set(owner, new Set());
        graph.get(owner).add(target);
      }
    }
  }
}

for (const file of walk(FEATURES_DIR)) {
  const rel = relative(FEATURES_DIR, file);
  const owner = rel.includes(sep) ? topSegment(FEATURES_DIR, file) : '(features)';
  scanFile(file, owner);
}

for (const entry of readdirSync(SRC_ROOT, { withFileTypes: true })) {
  if (!entry.isDirectory() || KNOWN_LAYERS.has(entry.name)) continue;
  for (const file of walk(join(SRC_ROOT, entry.name))) {
    scanFile(file, entry.name);
  }
}

for (const entry of readdirSync(FEATURES_DIR, { withFileTypes: true })) {
  if (entry.isDirectory() && !graph.has(entry.name)) {
    graph.set(entry.name, new Set());
  }
}

const cycles = findCycles(graph);
const knownHit = new Set();
const newCycles = [];

for (const cycle of cycles) {
  const key = canonicalCycleKey(cycle);
  if (KNOWN_CYCLES.has(key)) {
    knownHit.add(key);
    console.log(`KNOWN CYCLE  ${cycle.join(' → ')}`);
  } else {
    newCycles.push(cycle);
    console.error(`CYCLE  ${cycle.join(' → ')}`);
  }
}
for (const key of KNOWN_CYCLES) {
  if (!knownHit.has(key)) {
    console.log(`STALE ALLOWLIST  ${key.split('→').join(' → ')} — resolved, remove from KNOWN_CYCLES`);
  }
}

for (const { file, specifier } of entrypointViolations) {
  console.error(`ENTRYPOINT IMPORT  ${relative(ROOT, file)} → '${specifier}'`);
}

let failed = false;
if (entrypointViolations.length > 0 || newCycles.length > 0) {
  console.error(`check-feature-cycles: ${newCycles.length} new cycle(s), ${entrypointViolations.length} entrypoint import(s)`);
  failed = true;
} else {
  const edgeCount = [...graph.values()].reduce((sum, targets) => sum + targets.size, 0);
  console.log(`check-feature-cycles: ${graph.size} features, ${edgeCount} cross-feature edges — clean`);
}

// Deep-import ratchet: same feature graph, separate baseline. The script is
// standalone (`node scripts/check-deep-imports.mjs`) so it can be tested and
// re-baselined independently; running it from here keeps `npm run check:cycles`
// and the prebuild wiring covering both checks without a new npm script.
const deepResult = spawnSync(
  process.execPath,
  [join(ROOT, 'scripts', 'check-deep-imports.mjs'), SRC_ROOT],
  { stdio: 'inherit' },
);
if (deepResult.status !== 0) failed = true;

if (failed) process.exit(1);
