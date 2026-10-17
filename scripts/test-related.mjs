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
const mode = args.length ? 'explicit' : targets.length ? 'git-dirty' : 'fallback-full';
const jestArgs = targets.length
  ? ['--selectProjects', 'unit', '--findRelatedTests', ...targets, '--passWithNoTests']
  : ['--selectProjects', 'unit', '--passWithNoTests'];

console.error(`test:related [${mode}] ${targets.length ? targets.join(', ') : 'full unit suite'}`);
const bin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
process.exit(spawnSync(bin, ['jest', ...jestArgs], { cwd: ROOT, stdio: 'inherit' }).status ?? 1);
