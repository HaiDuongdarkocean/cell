import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '../../../..');
const PORT = process.env.CELL_DEBUG_PORT ?? '9223';
const OUT = path.join(ROOT, 'tmp', 'debug-brave');
const args = process.argv.slice(2);
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();

if (args[0] === '--list') {
  targets.forEach((t, i) => console.log(i, t.type, '|', (t.title ?? '').slice(0, 60), '|', t.url.slice(0, 140)));
  process.exit(0);
}

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const pageTargets = targets.filter((t) => t.type === 'page' && !t.url.startsWith('chrome://'));
const pi = args.indexOf('--page');
const idx = pi >= 0 ? +args[pi + 1] : 0;
const wanted = pageTargets[idx]?.url;
const page = browser.contexts()[0].pages().find((p) => p.url() === wanted) ?? browser.contexts()[0].pages()[0];

const ei = args.indexOf('--eval');
if (ei >= 0) console.log(JSON.stringify(await page.evaluate(args[ei + 1]), null, 1));
const si = args.indexOf('--shot');
if (si >= 0) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, args[si + 1]), fullPage: false });
}
process.exit(0);
