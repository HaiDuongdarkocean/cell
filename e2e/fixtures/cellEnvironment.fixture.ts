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
import { randomUUID } from 'node:crypto';

const projectRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const sourceExtensionPath = resolve(projectRoot, 'dist');
const uBlockSource = resolve(projectRoot, 'data', 'extension', 'uBOLite');

const outputSuffix = process.env.PW_OUTPUT_DIR || '';
const testResultsDir = resolve(
  projectRoot,
  outputSuffix ? `test-results-${outputSuffix}` : 'test-results',
);
const portOffset = parseInt(process.env.PW_PORT_OFFSET || '0', 10);
const STREAMFLIX_URL = `http://127.0.0.1:${4321 + portOffset}/index.html`;

type CellEnvironmentFixtures = {
  cellContext: BrowserContext;
  streamFlixPage: Page;
};

/**
 * uBOLite ships with a `_metadata` directory that Chrome refuses when loading
 * unpacked via --load-extension. Copy the whole extension to a unique staging
 * path per worker and strip `_metadata` before launch. Using a unique path
 * avoids ENOTEMPTY if a previous Chrome process still holds the directory.
 */
function prepareUblockClean(workerIndex: number): string {
  const unique = `${workerIndex}-${Date.now()}-${randomUUID().slice(0, 8)}`;
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
  extensionDir: string,
): Promise<BrowserContext> =>
  chromium.launchPersistentContext(profileDir, {
    headless,
    args: [
      `--disable-extensions-except=${extensionDir},${uBlockClean}`,
      `--load-extension=${extensionDir},${uBlockClean}`,
      '--disable-blink-features=AutomationControlled',
    ],
  });

export const test = base.extend<CellEnvironmentFixtures>({
  cellContext: [
    async ({}, use, workerInfo) => {
      const uBlockClean = prepareUblockClean(workerInfo.workerIndex);
      const profileDir = resolve(
        testResultsDir,
        `.cell-profile-${workerInfo.workerIndex}-${Date.now()}-${randomUUID().slice(0, 8)}`,
      );
      const extensionDir = resolve(
        testResultsDir,
        `.extension-build-${workerInfo.workerIndex}-${Date.now()}-${randomUUID().slice(0, 8)}`,
      );

      if (!existsSync(sourceExtensionPath)) {
        throw new Error(
          `Extension build not found at ${sourceExtensionPath}. Run "npm run build" before extension E2E tests.`,
        );
      }
      cpSync(sourceExtensionPath, extensionDir, { recursive: true });

      // Note: headless Chrome cannot load extensions in this Playwright
      // version, so default is headed (visible). Set EXTENSION_HEADLESS=true
      // only if you are running under a virtual display.
      const headless = process.env.EXTENSION_HEADLESS === 'true';
      const context = await launchContext(headless, uBlockClean, profileDir, extensionDir);
      await use(context);
      // Worker-scoped teardown: close the persistent browser context after
      // all tests in this worker finish so a long pipeline does not keep
      // Chrome / temp profiles open.
      await context.close();
    },
    { scope: 'worker' },
  ],

  streamFlixPage: async ({ cellContext }, use) => {
    const page = await cellContext.newPage();
    await page.goto(STREAMFLIX_URL, { waitUntil: 'networkidle' });

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
