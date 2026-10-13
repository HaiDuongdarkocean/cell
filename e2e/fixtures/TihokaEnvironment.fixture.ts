import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getE2EAgentPaths } from '../lib/agent-paths';

const { staging, projectRoot } = getE2EAgentPaths();
const sourceExtensionPath = resolve(projectRoot, 'dist');

const portOffset = parseInt(process.env.PW_PORT_OFFSET || '0', 10);
const STREAMFLIX_URL = `http://127.0.0.1:${4321 + portOffset}/index.html`;

type CellEnvironmentFixtures = {
  cellContext: BrowserContext;
  streamFlixPage: Page;
};

const launchContext = async (
  headless: boolean,
  extensionDir: string,
  profileDir: string,
): Promise<BrowserContext> =>
  chromium.launchPersistentContext(profileDir, {
    headless,
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
      '--disable-blink-features=AutomationControlled',
    ],
  });

export const test = base.extend<CellEnvironmentFixtures>({
  cellContext: [
    async ({}, use, workerInfo) => {
      const profileDir = resolve(
        staging,
        `.cell-profile-${workerInfo.workerIndex}-${Date.now()}-${randomUUID().slice(0, 8)}`,
      );
      const extensionDir = resolve(
        staging,
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
      const context = await launchContext(headless, extensionDir, profileDir);
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
