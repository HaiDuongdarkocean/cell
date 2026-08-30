import { test, expect } from '@playwright/test';

test.describe('PronunciationPanel e2e', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?showcase=pronunciation%20panel');
    await page.waitForFunction(() => {
      const main = document.querySelector('main');
      const h1 = main?.querySelector('h1');
      return document.readyState === 'complete' && !!h1 && h1.textContent !== '';
    });
  });

  test('renders eSpeak word button and phoneme list', async ({ page }) => {
    const button = page.getByRole('button', { name: /play espeak word/i });
    await expect(button).toBeVisible();

    const phonemes = page.locator('[data-cell-id="pronunciation-phoneme"]');
    await expect(phonemes).toHaveCount(5);
  });

  test('clicking a phoneme does not crash and shows no error', async ({ page }) => {
    const phoneme = page.locator('[data-cell-id="pronunciation-phoneme"]').first();
    await phoneme.click();
    const error = page.locator('[data-cell-id="pronunciation-audio-error"]');
    await expect(error).not.toBeVisible();
  });
});
