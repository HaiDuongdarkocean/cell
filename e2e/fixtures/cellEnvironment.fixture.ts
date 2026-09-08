import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const extensionPath = resolve(projectRoot, 'dist');
const uBlockSource = resolve(projectRoot, 'data', 'extension', 'uBOLite');
const uBlockCleanPath = resolve(projectRoot, 'test-results', '.ublock-clean');
const STREAMFLIX_URL = 'http://127.0.0.1:4321/index.html';

type CellEnvironmentFixtures = {
  cellContext: BrowserContext;
  streamFlixPage: Page;
};

let persistentContext: BrowserContext | null = null;
let isContextClosed = true;

/**
 * uBOLite ships with a `_metadata` directory that Chrome refuses when loading
 * unpacked via --load-extension. Copy the extension to a clean staging path and
 * strip that folder before launch.
 */
function prepareUblockClean(): string {
  if (existsSync(uBlockCleanPath)) {
    rmSync(uBlockCleanPath, { recursive: true, force: true });
  }
  mkdirSync(uBlockCleanPath, { recursive: true });

  const entries = ['_locales', 'css', 'dashboard.html', 'img', 'js', 'lib', 'manifest.json'];
  for (const entry of entries) {
    const src = resolve(uBlockSource, entry);
    if (!existsSync(src)) continue;
    const dst = resolve(uBlockCleanPath, entry);
    const stats = statSync(src);
    if (stats.isDirectory()) {
      cpSync(src, dst, { recursive: true });
    } else {
      cpSync(src, dst);
    }
  }
  return uBlockCleanPath;
}

const launchContext = async (headless: boolean): Promise<BrowserContext> =>
  chromium.launchPersistentContext(
    resolve(projectRoot, 'test-results', '.extension-profile'),
    {
      headless,
      args: [
        `--disable-extensions-except=${extensionPath},${uBlockCleanPath}`,
        `--load-extension=${extensionPath},${uBlockCleanPath}`,
        '--disable-blink-features=AutomationControlled',
      ],
    },
  );

export const test = base.extend<CellEnvironmentFixtures>({
  cellContext: [
    async ({}, use) => {
      if (!persistentContext || isContextClosed) {
        prepareUblockClean();
        const headless = process.env.EXTENSION_HEADLESS === 'true';
        persistentContext = await launchContext(headless);
        isContextClosed = false;
        persistentContext.on('close', () => {
          isContextClosed = true;
        });
      }
      await use(persistentContext);
    },
    { scope: 'worker' },
  ],

  streamFlixPage: async ({ cellContext }, use) => {
    const page = await cellContext.newPage();
    await page.goto(STREAMFLIX_URL, { waitUntil: 'domcontentloaded' });

    // Wait for the mock video and the Cell content-script overlay to mount.
    const video = page.locator('video').first();
    await expect(video).toBeVisible({ timeout: 30_000 });
    const overlayHost = page.locator('#cell-subtitle-root');
    await expect(overlayHost).toBeAttached({ timeout: 30_000 });

    // Orbital badge is the user-facing entry point for the Universal Panel.
    const badge = page.locator('[data-cell-id="orbital-badge"]');
    await expect(badge).toBeVisible({ timeout: 15_000 });

    await use(page);
    await page.close();
  },
});
