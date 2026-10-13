import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PS1 = path.join(SCRIPT_DIR, 'session.ps1');
const REG_DIR = 'C:\\Tihoka-browser-sessions\\sessions';

export function sessionId() {
  return execFileSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS1],
    { encoding: 'utf8' },
  ).trim().split('\n').pop().trim();
}

export function requireSession() {
  const id = sessionId();
  const file = path.join(REG_DIR, `${id}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(
      `no browser registered for session "${id}" - run script/launch-brave-debug.ps1`,
    );
  }
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cmdline = execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `(Get-CimInstance Win32_Process -Filter "ProcessId=${s.pid}" -ErrorAction SilentlyContinue).CommandLine`,
    ],
    { encoding: 'utf8' },
  ).trim();
  if (
    !cmdline.includes(`--user-data-dir=${s.profile}`) ||
    !cmdline.includes(`--remote-debugging-port=${s.port}`)
  ) {
    throw new Error(
      `pid ${s.pid} on :${s.port} is not session "${id}"'s browser ` +
        '(died or pid reused) - relaunch via script/launch-brave-debug.ps1',
    );
  }
  return { ...s, id };
}
