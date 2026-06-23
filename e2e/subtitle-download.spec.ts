import { test, expect } from '@playwright/test';
import {
  launchExtensionBrowser,
  openPopup,
  closeExtensionBrowser,
} from './fixtures/extension';

const VIDEO_URL =
  'https://kisskh.co/Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1?id=13070&ep=214612&page=0&pageSize=100&tm=51.0816';

test.describe('subtitle download behaviour', () => {
  test('clicking download does not create duplicate subtitle entries', async () => {
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

      // Switch to the Subtitles tab.
      await popup.locator('[data-testid="tab-subtitles"]').click();

      const subtitleItems = popup.locator('[data-testid="subtitle-item"]');
      const initialCount = await subtitleItems.count();

      test.skip(initialCount === 0, 'No subtitles detected on this page');

      // Click the first download button.
      await popup.locator('[data-testid="subtitle-download"]').first().click();

      // Wait briefly for any potential re-detection to occur.
      await page.waitForTimeout(5_000);

      // Re-count subtitles after clicking download.
      const finalCount = await subtitleItems.count();

      expect(finalCount).toBe(initialCount);

      await popup.close();
      await page.close();
    } finally {
      await closeExtensionBrowser(context);
    }
  });
});
