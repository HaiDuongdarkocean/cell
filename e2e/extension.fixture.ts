import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const projectRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
const sourceExtensionPath = resolve(projectRoot, 'dist');

const outputSuffix = process.env.PW_OUTPUT_DIR || '';
const testResultsDir = resolve(
  projectRoot,
  outputSuffix ? `test-results-${outputSuffix}` : 'test-results',
);
const portOffset = parseInt(process.env.PW_PORT_OFFSET || '0', 10);

const POPUP_PATH = 'src/entrypoints/popup/index.html';
const MOCK_URL = `http://127.0.0.1:${4322 + portOffset}/index.html`;

export type { Page };

type ExtensionFixtures = {
  extensionContext: BrowserContext;
  context: BrowserContext;
  worker: Worker;
  extensionId: string;
  popupPage: Page;
  mockPage: Page;
};

const createPersistentContext = (
  profileDir: string,
  extensionDir: string,
  headless: boolean,
): Promise<BrowserContext> =>
  chromium.launchPersistentContext(profileDir, {
    headless,
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
      '--disable-blink-features=AutomationControlled',
    ],
  });

const launchContext = async (
  profileDir: string,
  extensionDir: string,
): Promise<BrowserContext> => {
  const headless = process.env.EXTENSION_HEADLESS === 'true';
  if (headless) {
    return createPersistentContext(profileDir, extensionDir, true);
  }

  try {
    return await createPersistentContext(profileDir, extensionDir, false);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `[extension fixture] Headed launch failed (${reason}); falling back to headless.\n`,
    );
    return createPersistentContext(profileDir, extensionDir, true);
  }
};

export const test = base.extend<ExtensionFixtures>({
  // A persistent context is created once per Playwright worker and shared by
  // every test in that worker. Each worker gets its own profile directory so
  // multiple agents / workers do not collide.
  extensionContext: [
    async ({}, use, workerInfo) => {
      mkdirSync(testResultsDir, { recursive: true });
      const profileDir = resolve(
        testResultsDir,
        `.extension-profile-${workerInfo.workerIndex}-${Date.now()}-${randomUUID().slice(0, 8)}`,
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

      const context = await launchContext(profileDir, extensionDir);
      await use(context);
      await context.close();
    },
    { scope: 'worker' },
  ],

  // Expose the worker-scoped persistent context under the standard `context`
  // name so existing tests can call `context.newPage()` without redefining a
  // fixture with a different scope.
  context: async ({ extensionContext }, use) => {
    await use(extensionContext);
  },

  worker: async ({ context }, use) => {
    const [existing] = context.serviceWorkers();
    const worker =
      existing ??
      (await context.waitForEvent('serviceworker', { timeout: 30_000 }));
    await use(worker);
  },

  extensionId: async ({ worker }, use) => {
    const workerUrl = new URL(worker.url());
    const id = workerUrl.hostname;
    if (!/^[a-z]{32}$/.test(id)) {
      throw new Error(
        `Unexpected extension id derived from service worker URL: ${worker.url()}`,
      );
    }
    await use(id);
  },

  popupPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/${POPUP_PATH}`);
    await page.locator('body').waitFor({ state: 'visible' });
    await use(page);
    await page.close();
  },

  mockPage: async ({ context }, use) => {
    const page = await context.newPage();
    await page.goto(MOCK_URL, { waitUntil: 'domcontentloaded' });

    // The mock YouTube home view has no <video>. Click the first video card to
    // switch to the watch view where the player mounts a <video> element.
    // The video-grid cards are divs with hashed CSS-module classes; the first
    // lazy-loaded thumbnail inside the first card is a stable selector.
    const firstThumb = page.locator('img[loading="lazy"]').first();
    await firstThumb.waitFor({ state: 'visible' });
    await firstThumb.click();

    // Wait for the mock video element to mount (React app in the mock page).
    const video = page.locator('video');
    await expect(video).toBeVisible({ timeout: 30_000 });

    // Give the content script time to discover the video, finish overlay
    // initialization, and mount the Cell subtitle overlay host.
    const overlayHost = page.locator('#cell-subtitle-root');
    await expect(overlayHost).toBeAttached({ timeout: 15_000 });

    await use(page);
    await page.close();
  },
});
