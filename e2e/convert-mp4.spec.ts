import { test, expect } from '@playwright/test';
import {
  launchExtensionBrowser,
  openPopup,
  closeExtensionBrowser,
} from './fixtures/extension';

const VIDEO_URL =
  'https://kisskh.co/Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1?id=13070&ep=214612&page=0&pageSize=100&tm=51.0816';

test.describe('convert to mp4', () => {
  test('download video reaches converting phase (two-phase progress)', async () => {
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

      // Poll for converting or done status (up to 5 minutes for large files).
      let reachedConverting = false;
      let reachedDone = false;
      let lastItemText = '';
      for (let i = 0; i < 1500; i++) {
        await popup.waitForTimeout(200);
        lastItemText = (await downloadItem.first().textContent()) ?? '';
        if (lastItemText.includes('Done')) {
          reachedDone = true;
          break;
        }
        if (lastItemText.includes('Converting') || lastItemText.includes('Transmuxing')) {
          reachedConverting = true;
        }
        if (lastItemText.includes('Error') || lastItemText.includes('Failed')) {
          break;
        }
      }

      // The conversion must at least reach the "Converting" phase, proving:
      // 1. The TDZ bug is fixed (parallelResult not referenced before init)
      // 2. The offscreen document received the CONVERT_TS_TO_MP4_V2 message
      // 3. Two-phase progress is broadcast to the popup
      expect(reachedConverting || reachedDone).toBeTruthy();

      await popup.close();
      await page.close();
    } finally {
      await closeExtensionBrowser(context);
    }
  });

  test('download card shows two-phase progress (Download + Converting)', async () => {
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

      // Wait until the card shows "Download 100%" (download phase complete)
      // and "Converting" (convert phase started), or "Done".
      let sawTwoPhase = false;
      let lastItemText = '';
      for (let i = 0; i < 1500; i++) {
        await popup.waitForTimeout(200);
        lastItemText = (await downloadItem.first().textContent()) ?? '';
        if (lastItemText.includes('Done')) {
          // Done implies both phases completed.
          sawTwoPhase = true;
          break;
        }
        // Two-phase: "Download 100%" + "Converting" visible simultaneously.
        if (lastItemText.includes('Download') && lastItemText.includes('100%') &&
            lastItemText.includes('Converting')) {
          sawTwoPhase = true;
          break;
        }
        if (lastItemText.includes('Error') || lastItemText.includes('Failed')) {
          break;
        }
      }

      expect(sawTwoPhase).toBeTruthy();
      expect(lastItemText).toContain('424.1 MB');

      await popup.close();
      await page.close();
    } finally {
      await closeExtensionBrowser(context);
    }
  });
});
