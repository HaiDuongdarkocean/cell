#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from './hook-pipeline-common.mjs';
import { findPluginFile } from './ponytail-plugin.mjs';

const TIMEOUT_MS = 10000;

const script = findPluginFile(join('hooks', 'ponytail-activate.js'));
if (!script) process.exit(0);

const result = spawnSync('node', [script], {
  cwd: ROOT,
  env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
  timeout: TIMEOUT_MS,
  encoding: 'utf8',
});

const out = (result.stdout || '').trim();
if (!out) process.exit(0);
try {
  JSON.parse(out);
  process.stdout.write(out);
} catch {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: out,
    },
  }));
}
process.exit(0);
