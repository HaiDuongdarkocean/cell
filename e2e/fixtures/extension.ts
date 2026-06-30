import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type BrowserContext, type Page } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));

const pathToExtension = resolve(__dirname, '../../dist');

export interface ExtensionBrowser {
  context: BrowserContext;
  extensionId: string;
}

/**
 * Launch a persistent Chrome context with the built extension loaded.
 *
 * Chrome extensions only run in headed (non-headless) mode, so `headless`
 * is forced to `false`. The extension ID is derived from the registered
 * service worker URL (`chrome-extension://<id>/...`).
 */
export async function launchExtensionBrowser(): Promise<ExtensionBrowser> {
  const context = await chromium.launchPersistentContext('', {
    headless: false, // Extensions only work in headed mode
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  let extensionId = '';

  // Navigate to the extensions page so the extension is initialised.
  const page = await context.newPage();
  await page.goto('chrome://extensions');
  await page.waitForTimeout(2000);

  // Prefer an already-registered service worker.
  const workers = context.serviceWorkers();
  if (workers.length > 0) {
    const url = workers[0].url();
    // URL format: chrome-extension://<id>/service-worker.js
    extensionId = url.split('/')[2] ?? '';
  }

  if (!extensionId) {
    // Wait for the service worker to register.
    const worker = await context.waitForEvent('serviceworker', { timeout: 10_000 });
    const url = worker.url();
    extensionId = url.split('/')[2] ?? '';
  }

  await page.close();

  if (!extensionId) {
    await context.close();
    throw new Error('Could not determine extension ID: no service worker registered');
  }

  return { context, extensionId };
}

/**
 * Open the extension popup by navigating directly to its HTML page.
 *
 * Playwright cannot click the toolbar icon, so we load the popup URL
 * directly inside a new tab.
 */
export async function openPopup(
  context: BrowserContext,
  extensionId: string,
): Promise<Page> {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/entrypoints/popup/index.html`, {
    waitUntil: 'domcontentloaded',
  });
  return popup;
}

/**
 * Close the persistent browser context, tearing down the extension.
 */
export async function closeExtensionBrowser(context: BrowserContext): Promise<void> {
  await context.close();
}
