import { test, expect } from '@playwright/test';
import {
  launchExtensionBrowser,
  openPopup,
  closeExtensionBrowser,
} from './fixtures/extension';

const VIDEO_URL =
  'https://kisskh.co/Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1?id=13070&ep=214612&page=0&pageSize=100&tm=51.0816';

test.describe('downloads list behaviour', () => {
  test('clicking subtitle download adds exactly one download item', async () => {
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

      const downloadButtons = popup.locator('[data-testid="subtitle-download"]');
      const count = await downloadButtons.count();
      test.skip(count === 0, 'No subtitles detected on this page');

      // Click the first download button.
      await downloadButtons.first().click();

      // Wait for the download to start and any progress messages to settle.
      await page.waitForTimeout(5_000);

      // Switch to the Downloads tab.
      await popup.locator('[data-testid="tab-downloads"]').click();
      await popup.waitForTimeout(500);

      const downloadItems = popup.locator('[data-testid="download-item"]');
      await expect(downloadItems).toHaveCount(1);

      // The single item should display the actual subtitle filename, not the
      // generic "Download" stub title.
      const title = await popup.locator('[data-testid="download-item"] h4').first().textContent();
      expect(title).not.toBe('Download');
      expect(title).toContain('.en');

      await popup.close();
      await page.close();
    } finally {
      await closeExtensionBrowser(context);
    }
  });
});
