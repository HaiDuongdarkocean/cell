/**
 * launch-cell-context.mjs — shared environment prep + launch for Cell browser tests.
 *
 * Step 1 of every Cell browser test is ALWAYS environment preparation:
 *   prepareCellEnvironment() → warmUpCellContext() → launchCellContext()
 * Test scripts import these helpers instead of re-writing launcher boilerplate.
 *
 * uBlock is ALWAYS loaded together with Cell via --load-extension (comma-separated
 * dirs). External Extensions JSON / external_crx is blocked on Windows and must
 * not be relied on — the .crx pack step exists only for Linux/macOS real Chrome.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = resolve(SCRIPT_DIR, '../../../..');
export const CELL_DIST = resolve(PROJECT_ROOT, 'dist');
export const UBLOCK_DIR = resolve(PROJECT_ROOT, 'data/extension/uBOLite');
export const SETUP_PY = resolve(SCRIPT_DIR, 'setup-cell-profile.py');

const PLAYWRIGHT_CHROME =
  'C:\\Users\\The0cean\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
export const CHROME_EXE =
  process.env.CHROME_EXE ?? (existsSync(PLAYWRIGHT_CHROME) ? PLAYWRIGHT_CHROME : undefined);

export async function prepareCellEnvironment({ rebuild = false } = {}) {
  const args = [SETUP_PY, '--keep-profile'];
  if (rebuild) args.push('--rebuild');
  const stdout = await new Promise((resolvePromise, reject) => {
    const child = spawn('python', args, { cwd: PROJECT_ROOT });
    let out = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { process.stderr.write(c); });
    child.on('close', (code) => (code === 0 ? resolvePromise(out) : reject(new Error(out))));
  });
  const match = stdout.match(/CLONE_PATH=(.+)/);
  if (!match?.[1]) {
    throw new Error(`setup-cell-profile.py did not print CLONE_PATH:\n${stdout}`);
  }
  return match[1].trim();
}

export function cellExtensionArgs() {
  if (!existsSync(UBLOCK_DIR)) {
    throw new Error(
      `uBOLite not found at ${UBLOCK_DIR} — copy data/extension/uBOLite into the repo (it is gitignored).`,
    );
  }
  const dirs = [CELL_DIST, UBLOCK_DIR];
  return [
    '--disable-blink-features=AutomationControlled',
    `--disable-extensions-except=${dirs.join(',')}`,
    `--load-extension=${dirs.join(',')}`,
  ];
}

export async function launchCellContext(clonePath, { headless = false } = {}) {
  const { chromium } = await import('@playwright/test');
  return chromium.launchPersistentContext(clonePath, {
    headless,
    executablePath: CHROME_EXE,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: cellExtensionArgs(),
  });
}

export async function warmUpCellContext(clonePath) {
  const context = await launchCellContext(clonePath);
  const page = await context.newPage();
  await page.goto('chrome://extensions/');
  await new Promise((r) => setTimeout(r, 2500));
  await context.close();
}
