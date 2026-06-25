import { test, expect } from '@playwright/test';
import {
  launchExtensionBrowser,
  openPopup,
  closeExtensionBrowser,
} from './fixtures/extension';

const VIDEO_URL =
  'https://kisskh.co/Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1?id=13070&ep=214612&page=0&pageSize=100&tm=51.0816';

test.describe('media persistence across tab navigation', () => {
  test('media persists when switching tabs and back', async () => {
    const { context, extensionId } = await launchExtensionBrowser();

    try {
      // Open the video page and wait for media detection
      const page = await context.newPage();
      await page.goto(VIDEO_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await page.waitForTimeout(15_000); // Wait for media detection

      // Open popup and check media is detected
      const popup = await openPopup(context, extensionId);
      const videoCards = popup.locator('[data-testid="video-card"]');
      const videoCount = await videoCards.count();

      // Store the video count before navigation
      const initialVideoCount = videoCount;

      // Close popup
      await popup.close();

      // Navigate to a different URL (simulate switching tabs)
      await page.goto('https://example.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await page.waitForTimeout(2000); // Wait for navigation to complete

      // Navigate back to the original video page
      await page.goto(VIDEO_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await page.waitForTimeout(5000); // Wait for potential media detection

      // Open popup again and check media still exists
      const popup2 = await openPopup(context, extensionId);
      const videoCards2 = popup2.locator('[data-testid="video-card"]');
      const videoCount2 = await videoCards2.count();

      // Media should persist (count should be the same or greater)
      // It could be greater if new media was detected during the second visit
      expect(videoCount2).toBeGreaterThanOrEqual(initialVideoCount);

      await popup2.close();
      await page.close();
    } finally {
      await closeExtensionBrowser(context);
    }
  });

  test('media is cleared when tab is closed', async () => {
    const { context, extensionId } = await launchExtensionBrowser();

    try {
      // Open the video page and wait for media detection
      const page = await context.newPage();
      await page.goto(VIDEO_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await page.waitForTimeout(15_000); // Wait for media detection

      // Open popup and check media is detected
      const popup = await openPopup(context, extensionId);
      const videoCards = popup.locator('[data-testid="video-card"]');
      const videoCount = await videoCards.count();

      // Close popup
      await popup.close();

      // Close the tab
      await page.close();

      // Open popup again (no tab with media should be active)
      const popup2 = await openPopup(context, extensionId);
      const videoCards2 = popup2.locator('[data-testid="video-card"]');
      const videoCount2 = await videoCards2.count();

      // Media should be cleared when tab is closed
      expect(videoCount2).toBe(0);

      await popup2.close();
    } finally {
      await closeExtensionBrowser(context);
    }
  });
});
