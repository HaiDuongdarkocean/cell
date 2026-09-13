/* global console, process, document, location */

import { chromium } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const DEFAULT_URL = 'http://localhost:5173/src/entrypoints/mock-streaming-page/index.html?theme=dark&player=same';
const url = process.argv[2] ?? DEFAULT_URL;
const outDir = resolve('test-results');

const extPath = resolve('dist');
const profile = mkdtempSync(resolve(tmpdir(), 'cell-playwright-'));

const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  args: [
    `--disable-extensions-except=${extPath}`,
    `--load-extension=${extPath}`,
  ],
});

const page = await context.newPage();
const logs = [];
page.on('console', (msg) => logs.push({ type: msg.type(), text: msg.text() }));
page.on('pageerror', (err) => logs.push({ type: 'pageerror', text: err.message }));

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.locator('video').waitFor({ state: 'visible', timeout: 30000 });
await page.waitForTimeout(3000);

const result = await page.evaluate(() => ({
  url: location.href,
  root: !!document.getElementById('cell-subtitle-root'),
  video: !!document.querySelector('video'),
  ready: document.querySelector('video')?.readyState,
}));

const screenshotPath = resolve(outDir, `audit-playwright-${Date.now()}.png`);
await page.screenshot({ path: screenshotPath, fullPage: false });
await context.close();

const output = { result, logs, screenshot: screenshotPath, profile };
console.log(JSON.stringify(output, null, 2));
