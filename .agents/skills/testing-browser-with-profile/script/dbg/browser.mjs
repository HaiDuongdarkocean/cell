import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { requireSession } from '../session.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '../../../../..');

export async function connectBrowser() {
  const session = requireSession();
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${session.port}`);
  return { session, browser, ctx: browser.contexts()[0] };
}

export function outDir(session) {
  const dir = path.join(ROOT, 'tmp', session.out);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Find a page whose URL contains `match`, else open `url ?? match`.
// `settleMs` gives the site + extension time to mount before steps run.
export async function openPage(ctx, match, { url, settleMs = 0 } = {}) {
  const target = url ?? match;
  let page = ctx.pages().find((p) => p.url().includes(match));
  if (!page) {
    page = await ctx.newPage();
    await page.goto(target, { waitUntil: 'domcontentloaded' });
  } else if (url && page.url() !== url) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }
  if (settleMs) await page.waitForTimeout(settleMs);
  return page;
}

export async function shot(page, session, name) {
  const file = path.join(outDir(session), name);
  await page.bringToFront().catch(() => {});
  await page.screenshot({ path: file });
  return file;
}

export const evalJson = (page, fn, arg) => page.evaluate(fn, arg);
