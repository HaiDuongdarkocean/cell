import { test, expect } from '@playwright/test';
import {
  launchExtensionBrowser,
  openPopup,
  closeExtensionBrowser,
} from './fixtures/extension';

const VIDEO_URL =
  'https://kisskh.co/Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1?id=13070&ep=214612&page=0&pageSize=100&tm=51.0816';

test.describe('download controls', () => {
  test('pause + cancel buttons appear on active download', async () => {
    const { context, extensionId } = await launchExtensionBrowser();

    try {
      const page = await context.newPage();
      await page.goto(VIDEO_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await page.waitForTimeout(15_000);

      const popup = await openPopup(context, extensionId);

      const videoCards = popup.locator('[data-testid="video-card"]');
      const videoCount = await videoCards.count();
      test.skip(videoCount === 0, 'No video detected on page');

      // Start a download
      await popup.locator('[data-testid="download-button"]').first().click();

      // Wait for download item to appear
      const downloadItem = popup.locator('[data-testid="download-item"]');
      await expect(downloadItem.first()).toBeVisible({ timeout: 15_000 });

      // Verify pause + cancel buttons are visible on active download
      await expect(popup.locator('[data-testid="pause-btn"]').first()).toBeVisible({ timeout: 5_000 });
      await expect(popup.locator('[data-testid="cancel-btn"]').first()).toBeVisible();

      await popup.close();
      await page.close();
    } finally {
      await closeExtensionBrowser(context);
    }
  });

  test('cancel removes download from list', async () => {
    const { context, extensionId } = await launchExtensionBrowser();

    try {
      const page = await context.newPage();
      await page.goto(VIDEO_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await page.waitForTimeout(15_000);

      const popup = await openPopup(context, extensionId);

      const videoCards = popup.locator('[data-testid="video-card"]');
      const videoCount = await videoCards.count();
      test.skip(videoCount === 0, 'No video detected on page');

      await popup.locator('[data-testid="download-button"]').first().click();

      const downloadItem = popup.locator('[data-testid="download-item"]');
      await expect(downloadItem.first()).toBeVisible({ timeout: 15_000 });

      // Click cancel
      await popup.locator('[data-testid="cancel-btn"]').first().click();

      // Download item should be removed (optimistic UI)
      await expect(downloadItem).toHaveCount(0, { timeout: 5_000 });

      await popup.close();
      await page.close();
    } finally {
      await closeExtensionBrowser(context);
    }
  });

  test('selection bar appears when selecting media', async () => {
    const { context, extensionId } = await launchExtensionBrowser();

    try {
      const page = await context.newPage();
      await page.goto(VIDEO_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await page.waitForTimeout(15_000);

      const popup = await openPopup(context, extensionId);

      const videoCards = popup.locator('[data-testid="video-card"]');
      const videoCount = await videoCards.count();
      test.skip(videoCount === 0, 'No video detected on page');

      // Selection bar should not be visible initially
      await expect(popup.locator('[data-testid="selection-bar"]')).toHaveCount(0);

      // Click a video card to select it
      await videoCards.first().click();

      // Selection bar should appear
      await expect(popup.locator('[data-testid="selection-bar"]')).toBeVisible({ timeout: 5_000 });
      await expect(popup.locator('[data-testid="selection-count"]')).toContainText(/1 selected/);

      // Click clear button
      await popup.locator('[data-testid="selection-clear-btn"]').click();

      // Selection bar should disappear
      await expect(popup.locator('[data-testid="selection-bar"]')).toHaveCount(0);

      await popup.close();
      await page.close();
    } finally {
      await closeExtensionBrowser(context);
    }
  });
});
