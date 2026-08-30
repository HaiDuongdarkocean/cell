import { expect } from '@playwright/test';
import { test } from './extension.fixture';

test.describe('Local pronunciation audio settings', () => {
  test('popup settings dialog has a Pronunciation card and can reorder engines', async ({
    popupPage,
  }) => {
    await expect(popupPage.getByRole('heading', { name: 'Cell' })).toBeVisible();

    popupPage.on('console', (msg) => console.log(`[popup console] ${msg.type()}: ${msg.text()}`));
    popupPage.on('pageerror', (err) => console.error(`[popup pageerror] ${err.message}`));

    // Open the settings dialog from the popup header.
    const settingsButton = popupPage.locator('[aria-label="Settings"]');
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();

    // Wait for the settings dialog to render the sidebar.
    await expect(popupPage.locator('[role="dialog"]')).toBeVisible({ timeout: 10_000 });

    // Navigate to the Pronunciation section.
    const navItem = popupPage.getByRole('button', { name: 'Pronunciation', exact: true });
    await expect(navItem).toBeVisible();
    await navItem.click();

    const card = popupPage.locator('[data-section="pronunciation"]');
    await expect(card).toBeVisible();

    // The default first engine is localFile.
    const firstItem = card.locator('[data-engine]').first();
    await expect(firstItem).toContainText('Local Forvo package');

    // Move it down.
    const downButton = firstItem.getByRole('button', { name: /down/i });
    await downButton.click();

    // After moving down, the first item should now be Community audio.
    await expect(card.locator('[data-engine]').first()).toContainText('Community audio (Wikimedia)');

    // The eSpeak download toggle is present.
    await expect(popupPage.getByText('Download eSpeak TTS data')).toBeVisible();
  });
});
