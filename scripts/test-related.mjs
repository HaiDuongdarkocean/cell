#!/usr/bin/env node
// test:related — jest scoped to tests related to what changed.
//   args given   → jest --findRelatedTests <args>
//   no args      → git-dirty source files
//   neither      → full unit suite (fallback: never silently runs zero tests)
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.env.DEVIN_PROJECT_DIR || process.cwd();
const SRC_RE = /^(src|tests)\/.+\.(ts|tsx|js|jsx)$/;

const dirtySources = () => {
  const st = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  if (st.status !== 0) return [];
  return (st.stdout ?? '').split('\n').filter(Boolean)
    .map((l) => l.slice(3).replace(/ -> .+$/, '').replace(/^"|"$/g, ''))
    .filter((f) => SRC_RE.test(f) && existsSync(join(ROOT, f)));
};

const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const targets = args.length ? args : dirtySources();
const allTestFiles = targets.length && targets.every((t) => /\.test\.tsx?$/.test(t));
const mode = allTestFiles ? 'explicit-tests' : args.length ? 'explicit' : targets.length ? 'git-dirty' : 'fallback-full';
const jestArgs = allTestFiles
  ? ['--selectProjects', 'unit', '--runTestsByPath', ...targets]
  : targets.length
    ? ['--selectProjects', 'unit', '--findRelatedTests', ...targets, '--passWithNoTests']
    : ['--selectProjects', 'unit', '--passWithNoTests'];

console.error(`test:related [${mode}] ${targets.length ? targets.join(', ') : 'full unit suite'}`);
const jestBin = join(ROOT, 'node_modules', 'jest', 'bin', 'jest.js');
process.exit(spawnSync(process.execPath, [jestBin, ...jestArgs], { cwd: ROOT, stdio: 'inherit' }).status ?? 1);
