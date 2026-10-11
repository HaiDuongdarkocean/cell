import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from './hook-pipeline-common.mjs';
import { findPluginFile } from './ponytail-plugin.mjs';

const TIMEOUT_MS = 3000;

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', run);
setTimeout(run, TIMEOUT_MS).unref();

let done = false;
function run() {
  if (done) return;
  done = true;

  const tracker = findPluginFile(join('hooks', 'ponytail-mode-tracker.js'));
  if (!tracker) process.exit(0);

  const result = spawnSync('node', [tracker], {
    input,
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
        hookEventName: 'UserPromptSubmit',
        additionalContext: out,
      },
    }));
  }
  process.exit(0);
}
