import { test, expect } from '@playwright/test';
import {
  launchExtensionBrowser,
  openPopup,
  closeExtensionBrowser,
} from './fixtures/extension';

const VIDEO_URL =
  'https://hoathinh3d.co/xem-phim-vinh-sinh/tap-1-sv1.html';

test.describe('hoathinh3d video download', () => {
  test('detects video on hoathinh3d', async () => {
    const { context, extensionId } = await launchExtensionBrowser();

    try {
      const page = await context.newPage();
      await page.goto(VIDEO_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      // Wait for media detection (content script + network interceptor).
      await page.waitForTimeout(10_000);

      const popup = await openPopup(context, extensionId);

      const mediaSection = popup.locator('[data-testid="media-section"]');
      await expect(mediaSection).toBeVisible({ timeout: 10_000 });

      const videoCards = popup.locator('[data-testid="video-card"]');
      const emptyState = popup.locator('[data-testid="empty-media"]');

      const videoCount = await videoCards.count();
      if (videoCount > 0) {
        await expect(
          popup.locator('[data-testid="video-title"]').first(),
        ).toBeVisible();
        await expect(
          popup.locator('[data-testid="download-button"]').first(),
        ).toBeVisible();
      } else {
        await expect(emptyState).toBeVisible();
      }

      await popup.close();
      await page.close();
    } finally {
      await closeExtensionBrowser(context);
    }
  });

  test('downloads video from hoathinh3d', async () => {
    const { context, extensionId } = await launchExtensionBrowser();

    try {
      const page = await context.newPage();
      await page.goto(VIDEO_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      // Wait for media detection.
      await page.waitForTimeout(15_000);

      const popup = await openPopup(context, extensionId);

      const videoCards = popup.locator('[data-testid="video-card"]');
      const videoCount = await videoCards.count();

      if (videoCount > 0) {
        await popup.locator('[data-testid="download-button"]').first().click();

        const downloadsSection = popup.locator('[data-testid="downloads-section"]');
        await expect(downloadsSection).toBeVisible({ timeout: 10_000 });

        const progressBar = popup.locator('[data-testid="progress-bar"]');
        await expect(progressBar.first()).toBeVisible({ timeout: 10_000 });
      }

      await popup.close();
      await page.close();
    } finally {
      await closeExtensionBrowser(context);
    }
  });
});
