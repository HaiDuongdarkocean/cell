#!/usr/bin/env node
/**
 * Real-Chrome Playwright verification for the keyboard fix.
 *
 * Launches a real Chromium/Chrome-for-Testing profile (--load-extension with
 * the unpacked dist or a cloned profile), navigates to the StreamFlix mock
 * page, opens dictation practice, types "hello 1 world 2" inside the input,
 * asserts the value, presses Escape, and asserts the practice layer closes.
 */

import { spawn, execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function buildMockPages() {
  execSync('npm run build:mock', { cwd: ROOT, stdio: 'inherit' });
}

const PLAYWRIGHT_CHROME = 'C:\\Users\\The0cean\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
const CHROME_EXE = process.env.CHROME_EXE ?? (existsSync(PLAYWRIGHT_CHROME) ? PLAYWRIGHT_CHROME : 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
const Tihoka_CLONE_PATH = process.env.Tihoka_CLONE_PATH;
const KEEP_PROFILE = process.env.KEEP_PROFILE === '1';
const SETUP_PY = resolve(
  ROOT,
  '.agents/skills/testing-extension-browser/script/setup-Tihoka-profile.py',
);
const MOCK_SCRIPT = resolve(ROOT, 'scripts/serve-mock-pages.mjs');
const STREAM_URL = 'http://127.0.0.1:4321/index.html';
const EXTENSION_DIR = resolve(ROOT, 'dist');

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
async function isServerRunning(url, timeoutMs = 3000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => { controller.abort(); }, timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
}

/**
 * @param {string} label
 * @param {string} cmd
 * @param {readonly string[]} args
 * @returns {Promise<{ ok: boolean; stdout: string; stderr: string }>}
 */
function runCommand(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => {
      resolve({ ok: code === 0, stdout, stderr });
    });
  });
}

/**
 * @returns {Promise<string>}
 */
async function setupClone() {
  if (Tihoka_CLONE_PATH) {
    if (!existsSync(Tihoka_CLONE_PATH)) {
      throw new Error(`Tihoka_CLONE_PATH does not exist: ${Tihoka_CLONE_PATH}`);
    }
    console.log(`[setup] Using Tihoka_CLONE_PATH: ${Tihoka_CLONE_PATH}`);
    return Tihoka_CLONE_PATH;
  }

  console.log('[setup] Packing .crx and cloning profile...');
  const { ok, stdout, stderr } = await runCommand('python', [
    SETUP_PY,
    '--no-ublock',
  ]);
  if (!ok) {
    throw new Error(`setup-Tihoka-profile.py failed:\n${stderr}\n${stdout}`);
  }

  const match = stdout.match(/CLONE_PATH=(.+)/);
  if (!match?.[1]) {
    throw new Error(`setup-Tihoka-profile.py did not print CLONE_PATH:\n${stdout}`);
  }

  const clonePath = match[1].trim();
  console.log(`[setup] CLONE_PATH=${clonePath}`);
  return clonePath;
}

/**
 * @param {readonly string[]} extraArgs
 * @param {string} label
 * @returns {Promise<import('node:child_process').ChildProcess>}
 */
async function startMockServer(extraArgs, label) {
  const args = [MOCK_SCRIPT, ...extraArgs];
  console.log(`[mock] Starting ${label}: node ${args.join(' ')}`);
  const child = spawn('node', args, {
    cwd: ROOT,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (data) => {
    const text = data.toString();
    if (text.includes('error') || text.includes('✗')) {
      process.stdout.write(`[${label}] ${text}`);
    }
  });
  child.stderr.on('data', (data) => {
    process.stderr.write(`[${label}] ${data}`);
  });

  // Wait for the server to bind and respond.
  const startTimeout = 60_000;
  const startTime = Date.now();
  const url = `http://127.0.0.1:${label === 'YouTube' ? 4322 : 4321}/index.html`;
  while (Date.now() - startTime < startTimeout) {
    await sleep(500);
    if (child.exitCode !== null) {
      throw new Error(`Mock server ${label} exited early with code ${child.exitCode}`);
    }
    if (await isServerRunning(url, 2000)) {
      console.log(`[mock] ${label} ready at ${url}`);
      return child;
    }
  }

  throw new Error(`Mock server ${label} did not become ready within ${startTimeout}ms`);
}

/**
 * @param {string} clonePath
 * @returns {Promise<void>}
 */
async function warmUpClone(clonePath) {
  const { chromium, expect } = await import('@playwright/test');
  const ctx = await chromium.launchPersistentContext(clonePath, {
    headless: false,
    executablePath: existsSync(CHROME_EXE) ? CHROME_EXE : undefined,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      '--disable-blink-features=AutomationControlled',
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
    ],
  });
  const page = await ctx.newPage();
  await page.goto(STREAM_URL, { waitUntil: 'networkidle' });
  await expect(page.locator('#Tihoka-subtitle-root')).toBeAttached({ timeout: 60_000 });
  await ctx.close();
  console.log('[launch] Warm-up complete, re-launching for verification');
}

/**
 * @param {string} clonePath
 * @returns {Promise<import('@playwright/test').BrowserContext>}
 */
async function launchChrome(clonePath) {
  const { chromium } = await import('@playwright/test');
  console.log('[launch] Opening Playwright persistent context...');
  const context = await chromium.launchPersistentContext(clonePath, {
    headless: false,
    executablePath: existsSync(CHROME_EXE) ? CHROME_EXE : undefined,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      '--disable-blink-features=AutomationControlled',
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
    ],
  });
  return context;
}

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function seekToCue(page) {
  const video = page.locator('#player-wrapper video').first();
  await video.evaluate((v) => {
    v.muted = true;
    v.pause();
    v.currentTime = 20.5;
  });
}

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function verifyKeyboardFix(page) {
  const { expect } = await import('@playwright/test');

  console.log('[verify] Waiting for Tihoka overlay...');
  await expect(page.locator('#Tihoka-subtitle-root')).toBeAttached({ timeout: 60_000 });
  const badge = page.locator('[data-tihoka-id="orbital-badge"]');
  await expect(badge).toBeVisible({ timeout: 30_000 });

  console.log('[verify] Entering Player Mode (shortcut: g)...');
  await page.keyboard.press('g');
  await expect(page.locator('[data-tihoka-id="cue-item"]').first()).toBeVisible({ timeout: 15_000 });

  console.log('[verify] Seeking to active cue...');
  await seekToCue(page);

  console.log('[verify] Switching to Dictation practice...');
  const modeButton = page.locator('[data-tihoka-id="practice-mode-dictation"]');
  await expect(modeButton).toBeVisible({ timeout: 10_000 });
  await modeButton.click();

  const input = page.locator('[data-tihoka-id="practice-input"]');
  await expect(input).toBeVisible({ timeout: 20_000 });
  await expect(input).toBeEnabled({ timeout: 15_000 });

  console.log('[verify] Typing "hello 1 world 2" inside practice input...');
  await input.click();
  await page.keyboard.type('hello 1 world 2');

  const value = await input.inputValue();
  if (value !== 'hello 1 world 2') {
    throw new Error(`Input value mismatch: expected "hello 1 world 2", got "${value}"`);
  }
  console.log('[verify] Input captured correctly:', value);

  console.log('[verify] Sending Escape...');
  await page.keyboard.press('Escape');

  // Player mode / practice sheet should close; the input and practice root disappear.
  await expect(page.locator('[data-tihoka-id="subtitle-practice"]')).toHaveCount(0, { timeout: 10_000 });
  console.log('[verify] Practice layer/sheet closed after Escape.');
}

/**
 * @param {string} clonePath
 * @returns {Promise<void>}
 */
async function cleanupClone(clonePath) {
  if (KEEP_PROFILE) {
    console.log(`[cleanup] KEEP_PROFILE=1 — not deleting ${clonePath}`);
    return;
  }
  try {
    rmSync(clonePath, { recursive: true, force: true });
    console.log(`[cleanup] Deleted clone ${clonePath}`);
  } catch (err) {
    console.warn(`[cleanup] Could not delete clone: ${err.message}`);
  }
}

async function main() {
  buildMockPages();

  const streamRunning = await isServerRunning(STREAM_URL);
  /** @type {import('node:child_process').ChildProcess | null} */
  let streamChild = null;
  /** @type {import('node:child_process').ChildProcess | null} */
  let youtubeChild = null;
  /** @type {import('@playwright/test').BrowserContext | null} */
  let context = null;

  try {
    if (!streamRunning) {
      streamChild = await startMockServer(['--stream', '--no-build'], 'StreamFlix');
      youtubeChild = await startMockServer(['--youtube', '--no-build'], 'YouTube');

      const ready = await isServerRunning(STREAM_URL, 15_000);
      if (!ready) {
        throw new Error('StreamFlix mock server did not become ready');
      }
    } else {
      console.log('[mock] StreamFlix already running');
    }

    const clonePath = await setupClone();

    if (!existsSync(resolve(clonePath, 'Default', 'External Extensions'))) {
      console.warn('[setup] Clone is missing External Extensions JSON; relying on --load-extension fallback');
    }

    await warmUpClone(clonePath);
    context = await launchChrome(clonePath);
    const page = await context.newPage();
    console.log(`[navigate] ${STREAM_URL}`);
    await page.goto(STREAM_URL, { waitUntil: 'networkidle' });

    await verifyKeyboardFix(page);

    await context.close();
    context = null;

    await cleanupClone(clonePath);

    console.log('[PASS] Real-Chrome keyboard verification passed.');
    process.exitCode = 0;
  } catch (err) {
    console.error('[FAIL]', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    if (context) {
      try { await context.close(); } catch { /* ignore */ }
    }
    if (streamChild) {
      streamChild.kill();
    }
    if (youtubeChild) {
      youtubeChild.kill();
    }
  }
}

main();
