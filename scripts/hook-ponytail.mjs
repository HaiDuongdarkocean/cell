import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const TIMEOUT_MS = 3000;

function findModeTracker() {
  const cacheDir = join(
    process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'),
    'devin', 'cli', 'plugins', 'cache',
  );
  if (!existsSync(cacheDir)) return null;
  const candidates = [];
  for (const pluginDir of readdirSync(cacheDir)) {
    if (!pluginDir.includes('ponytail')) continue;
    const pluginPath = join(cacheDir, pluginDir);
    for (const versionDir of readdirSync(pluginPath)) {
      const tracker = join(pluginPath, versionDir, 'hooks', 'ponytail-mode-tracker.js');
      if (existsSync(tracker)) candidates.push({ tracker, versionDir });
    }
  }
  const byVersion = (a, b) => {
    const pa = a.versionDir.split('.').map(Number);
    const pb = b.versionDir.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  };
  return candidates.sort(byVersion).pop()?.tracker || null;
}

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', run);
setTimeout(run, TIMEOUT_MS).unref();

let done = false;
function run() {
  if (done) return;
  done = true;

  const tracker = findModeTracker();
  if (!tracker) process.exit(0);

  const result = spawnSync('node', [tracker], {
    input,
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
