import { expect } from '@playwright/test';
import { test } from './extension.fixture';

test.describe('Cell MV3 extension', () => {
  test('service worker is running and exposes a valid extension id', async ({
    worker,
    extensionId,
  }) => {
    expect(extensionId).toMatch(/^[a-z]{32}$/);
    expect(worker.url()).toContain(extensionId);
  });

  test('popup page loads without errors', async ({ popupPage }) => {
    await expect(popupPage.locator('body')).toBeVisible();

    // Wait for React to hydrate and the popup shell to render.
    await expect(popupPage.getByRole('heading', { name: 'Cell' })).toBeVisible();
    await expect(popupPage.getByRole('tab', { name: 'Media' })).toBeVisible();
    await expect(popupPage.getByRole('tab', { name: 'Downloads' })).toBeVisible();
  });

  test('content script loads on a mock video page', async ({ mockPage }) => {
    // The mock page mounts a <video>; wait for the content script to attach
    // the Cell subtitle overlay shadow host to the player container.
    const overlayHost = mockPage.locator('#cell-subtitle-root');
    await expect(overlayHost).toBeAttached({ timeout: 15_000 });

    // The host is injected into the video container by the content-script
    // overlay controller, which is the strongest proof that the extension
    // content script ran and initialized on the mock page.
    const hostCount = await mockPage.evaluate(
      () => document.querySelectorAll('#cell-subtitle-root').length,
    );
    expect(hostCount).toBe(1);

    // The content script records a scan marker on <html> once it finds the
    // video. Wait until it reports at least one video on the mock page.
    const scanHandle = await mockPage.waitForFunction(
      () => {
        const raw = document.documentElement.getAttribute('data-cell-runscan');
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw) as { videos?: number };
          if ((parsed.videos ?? 0) > 0) return raw;
        } catch {
          /* not ready yet */
        }
        return null;
      },
      { timeout: 15_000 },
    );
    const runScan = (await scanHandle.jsonValue()) as string;
    const scanResult = JSON.parse(runScan) as {
      pageUrl: string;
      videos: number;
      subtitles: number;
    };
    expect(scanResult.pageUrl).toMatch(/127\.0\.0\.1:\d+/);
    expect(scanResult.videos).toBeGreaterThanOrEqual(1);
  });
});
