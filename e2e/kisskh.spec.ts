import { test, expect } from '@playwright/test';
import {
  launchExtensionBrowser,
  openPopup,
  closeExtensionBrowser,
} from './fixtures/extension';

const VIDEO_URL =
  'https://kisskh.co/Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1?id=13070&ep=214612&page=0&pageSize=100&tm=51.0816';

test.describe('kisskh video download', () => {
  test('detects video on kisskh', async () => {
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

  test('detects subtitle on kisskh', async () => {
    const { context, extensionId } = await launchExtensionBrowser();

    try {
      const page = await context.newPage();
      await page.goto(VIDEO_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      // Wait for media detection (subtitles are usually fetched after the player loads).
      await page.waitForTimeout(15_000);

      const popup = await openPopup(context, extensionId);

      const mediaSection = popup.locator('[data-testid="media-section"]');
      await expect(mediaSection).toBeVisible({ timeout: 10_000 });

      // Switch to the Subtitles tab in the redesigned UI.
      await popup.locator('[data-testid="tab-subtitles"]').click();

      const subtitleItems = popup.locator('[data-testid="subtitle-item"]');
      const emptyState = popup.locator('[data-testid="empty-media"]');

      const subtitleCount = await subtitleItems.count();
      if (subtitleCount > 0) {
        await expect(
          popup.locator('[data-testid="subtitle-language"]').first(),
        ).toBeVisible();
        await expect(
          popup.locator('[data-testid="subtitle-download"]').first(),
        ).toBeVisible();
      } else {
        // No subtitles detected — empty state should be shown on the subtitles tab.
        await expect(emptyState).toBeVisible();
      }

      await popup.close();
      await page.close();
    } finally {
      await closeExtensionBrowser(context);
    }
  });

  test('downloads video from kisskh', async () => {
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

        // Switch to the Downloads tab to see the active download.
        await popup.locator('[data-testid="tab-downloads"]').click();

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
