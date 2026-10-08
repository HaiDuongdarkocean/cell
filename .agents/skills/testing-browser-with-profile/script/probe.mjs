/* global chrome, location */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '../../../..');
const PORT = process.env.CELL_DEBUG_PORT ?? '9223';
const OUT = path.join(ROOT, 'tmp', process.env.CELL_DEBUG_OUT ?? 'debug-brave');
const args = process.argv.slice(2);
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();

if (args[0] === '--list') {
  targets.forEach((t, i) => console.log(i, t.type, '|', (t.title ?? '').slice(0, 60), '|', t.url.slice(0, 140)));
  process.exit(0);
}

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const ctx = browser.contexts()[0];

if (args.includes('--ext')) {
  const sws = ctx.serviceWorkers().filter((w) => w.url().startsWith('chrome-extension://'));
  for (const sw of sws) {
    await sw.evaluate(() => chrome.runtime.reload()).catch(() => {});
    console.log('reloaded ext', sw.url().slice(0, 80));
  }
  await new Promise((r) => setTimeout(r, 1500));
}

const pageTargets = targets.filter((t) => t.type === 'page' && !t.url.startsWith('chrome://'));
const mi = args.indexOf('--match');
const match = mi >= 0 ? args[mi + 1] : null;
const pi = args.indexOf('--page');
const idx = pi >= 0 ? +args[pi + 1] : 0;
const wanted = match ? pageTargets.find((t) => t.url.includes(match))?.url : pageTargets[idx]?.url;
const page = ctx.pages().find((p) => p.url() === wanted) ?? ctx.pages()[0];

if (args.includes('--reload')) {
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('reloaded', page.url().slice(0, 100));
}

const fi = args.indexOf('--fmatch');
let target = page;
if (fi >= 0) {
  const m = args[fi + 1];
  target = page.frames().find((f) => f.url().includes(m)) ?? page.mainFrame();
  for (const f of page.frames()) {
    if (f.url().includes(m)) continue;
    const real = await f.evaluate(() => location.href).catch(() => '');
    if (real.includes(m)) { target = f; break; }
  }
}

const ei = args.indexOf('--eval');
if (ei >= 0) console.log(JSON.stringify(await target.evaluate(args[ei + 1]), null, 1));
const si = args.indexOf('--shot');
if (si >= 0) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, args[si + 1]), fullPage: false });
}
process.exit(0);
