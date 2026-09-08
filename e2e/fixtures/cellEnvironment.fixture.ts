import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const extensionPath = resolve(projectRoot, 'dist');
const uBlockSource = resolve(projectRoot, 'data', 'extension', 'uBOLite');
const testResultsDir = resolve(projectRoot, 'test-results');
const STREAMFLIX_URL = 'http://127.0.0.1:4321/index.html';

type CellEnvironmentFixtures = {
  cellContext: BrowserContext;
  streamFlixPage: Page;
};

let persistentContext: BrowserContext | null = null;
let isContextClosed = true;

/**
 * uBOLite ships with a `_metadata` directory that Chrome refuses when loading
 * unpacked via --load-extension. Copy the whole extension to a unique staging
 * path per worker and strip `_metadata` before launch. Using a unique path
 * avoids ENOTEMPTY if a previous Chrome process still holds the directory.
 */
function prepareUblockClean(workerIndex: number): string {
  const unique = `${workerIndex}-${Date.now()}`;
  const cleanPath = resolve(testResultsDir, `.ublock-clean-${unique}`);

  mkdirSync(testResultsDir, { recursive: true });
  if (existsSync(cleanPath)) {
    rmSync(cleanPath, { recursive: true, force: true });
  }
  cpSync(uBlockSource, cleanPath, { recursive: true });

  const metadataDir = resolve(cleanPath, '_metadata');
  if (existsSync(metadataDir)) {
    rmSync(metadataDir, { recursive: true, force: true });
  }

  return cleanPath;
}

const launchContext = async (
  headless: boolean,
  uBlockClean: string,
  profileDir: string,
): Promise<BrowserContext> =>
  chromium.launchPersistentContext(profileDir, {
    headless,
    args: [
      `--disable-extensions-except=${extensionPath},${uBlockClean}`,
      `--load-extension=${extensionPath},${uBlockClean}`,
      '--disable-blink-features=AutomationControlled',
    ],
  });

export const test = base.extend<CellEnvironmentFixtures>({
  cellContext: [
    async ({}, use, workerInfo) => {
      if (!persistentContext || isContextClosed) {
        const uBlockClean = prepareUblockClean(workerInfo.workerIndex);
        const profileDir = resolve(
          testResultsDir,
          `.extension-profile-${workerInfo.workerIndex}-${Date.now()}`,
        );
        // Note: headless Chrome cannot load extensions in this Playwright
        // version, so default is headed (visible). Set EXTENSION_HEADLESS=true
        // only if you are running under a virtual display.
        const headless = process.env.EXTENSION_HEADLESS === 'true';
        persistentContext = await launchContext(headless, uBlockClean, profileDir);
        isContextClosed = false;
        persistentContext.on('close', () => {
          isContextClosed = true;
        });
      }
      await use(persistentContext);
      // Worker-scoped teardown: close the persistent browser context after
      // all tests in this worker finish so a long pipeline does not keep
      // Chrome / temp profiles open.
      if (persistentContext) {
        await persistentContext.close();
        isContextClosed = true;
        persistentContext = null;
      }
    },
    { scope: 'worker' },
  ],

  streamFlixPage: async ({ cellContext }, use) => {
    const page = await cellContext.newPage();
    await page.goto(STREAMFLIX_URL, { waitUntil: 'domcontentloaded' });

    // Wait for the mock video and the Cell content-script overlay to mount.
    const video = page.locator('#player-wrapper video').first();
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
