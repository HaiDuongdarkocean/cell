import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sleep } from './rdp.mjs';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

async function waitForPort(port, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const open = await new Promise((res) => {
      const s = createServer().once('error', () => res(true));
      s.listen(port, '127.0.0.1', () => s.close(() => res(false)));
    });
    if (open) return true;
    await sleep(500);
  }
  return false;
}

// web-ext picks the debugger-server port itself (findFreeTcpPort →
// `-start-debugger-server <port>`); --verbose prints "Firefox args: ..." on
// stderr which we parse to learn the port.
export async function launchWebExt({ startUrl, distDir = 'dist-firefox' }) {
  const source = join(repoRoot, distDir);
  if (!existsSync(join(source, 'manifest.json'))) {
    throw new Error(`${distDir} missing — run \`npm run build:firefox\` first`);
  }
  const npxCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
  const npx = existsSync(npxCli) ? [npxCli] : ['npx'];
  const argv = [
    ...npx,
    'web-ext',
    'run',
    `--source-dir=${source}`,
    '--no-reload',
    '--verbose',
    `--start-url=${startUrl}`,
    '--pref=devtools.debugger.show-content-scripts=true',
    '--pref=devtools.chrome.enabled=true',
  ];
  if (process.env.FIREFOX_BIN) argv.push(`--firefox=${process.env.FIREFOX_BIN}`);
  const proc = spawn(process.execPath, argv, {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  const logText = () => logs.join('');
  proc.stdout.on('data', (d) => logs.push(String(d)));
  proc.stderr.on('data', (d) => logs.push(String(d)));

  let rdpPort = null;
  const deadline = Date.now() + 120000;
  while (rdpPort === null) {
    const m = logText().match(/Firefox args:.*?-start-debugger-server[ =](\d+)/s);
    if (m) rdpPort = Number(m[1]);
    if (proc.exitCode !== null) {
      throw new Error(`web-ext exited (${proc.exitCode}) before firefox started:\n${logText().slice(-2000)}`);
    }
    if (Date.now() > deadline) {
      killTree(proc);
      throw new Error(`no "-start-debugger-server" in web-ext output within 120s:\n${logText().slice(-2000)}`);
    }
    if (rdpPort === null) await sleep(300);
  }

  const ready = await waitForPort(rdpPort, 60000);
  if (!ready) {
    killTree(proc);
    throw new Error(`Firefox RDP port ${rdpPort} never opened:\n${logText().slice(-2000)}`);
  }
  return { proc, rdpPort, logs };
}

export function killTree(proc) {
  if (!proc || proc.killed) return;
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {}
  } else {
    try {
      process.kill(-proc.pid, 'SIGKILL');
    } catch {
      try {
        proc.kill('SIGKILL');
      } catch {}
    }
  }
}
