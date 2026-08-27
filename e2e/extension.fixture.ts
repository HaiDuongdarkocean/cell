import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
const extensionPath = resolve(projectRoot, 'dist');
const profileDir = resolve(projectRoot, 'test-results', '.extension-profile');

const POPUP_PATH = 'src/entrypoints/popup/index.html';
const MOCK_URL = 'http://127.0.0.1:4322/index.html';

export type { Page };

type ExtensionFixtures = {
  context: BrowserContext;
  worker: Worker;
  extensionId: string;
  popupPage: Page;
  mockPage: Page;
};

let persistentContext: BrowserContext | null = null;
let isContextClosed = true;

const createPersistentContext = async (
  headless: boolean,
): Promise<BrowserContext> =>
  chromium.launchPersistentContext(profileDir, {
    headless,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--disable-blink-features=AutomationControlled',
    ],
  });

const launchContext = async (): Promise<BrowserContext> => {
  if (process.env.EXTENSION_HEADLESS === 'true') {
    return createPersistentContext(true);
  }

  try {
    return await createPersistentContext(false);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `[extension fixture] Headed launch failed (${reason}); falling back to headless.\n`,
    );
    return createPersistentContext(true);
  }
};

export const test = base.extend<ExtensionFixtures>({
  // The persistent browser context is shared across all tests in this file and
  // closed explicitly in `test.afterAll` from `extension.spec.ts`.
  context: async ({}, use) => {
    if (!persistentContext || isContextClosed) {
      persistentContext = await launchContext();
      isContextClosed = false;
      persistentContext.on('close', () => {
        isContextClosed = true;
      });
    }
    await use(persistentContext);
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
