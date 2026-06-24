import { test, expect } from '@playwright/test';
import {
  launchExtensionBrowser,
  openPopup,
  closeExtensionBrowser,
} from './fixtures/extension';

test.describe('redesigned popup UI', () => {
  test('renders sections (media + downloads) with empty states', async () => {
    const { context, extensionId } = await launchExtensionBrowser();

    try {
      const popup = await openPopup(context, extensionId);

      await expect(popup.locator('[data-testid="app-root"]')).toBeVisible();

      // Media section visible.
      await expect(popup.locator('[data-testid="media-section"]')).toBeVisible();

      // Downloads section visible.
      await expect(popup.locator('[data-testid="downloads-section"]')).toBeVisible();

      // Empty state should be visible (no media detected on blank tab).
      // Scope to media-section — downloads-section also has empty-media testid.
      await expect(
        popup.locator('[data-testid="media-section"] [data-testid="empty-media"]'),
      ).toBeVisible();

      await popup.close();
    } finally {
      await closeExtensionBrowser(context);
    }
  });

  test('toggles theme and persists it across popup reloads', async () => {
    const { context, extensionId } = await launchExtensionBrowser();

    try {
      let popup = await openPopup(context, extensionId);

      // Wait for the persisted settings to load.
      await popup.waitForFunction(() => {
        const root = document.querySelector('[data-testid="app-root"]');
        return root !== null;
      });

      // Initial theme should be light.
      await expect(popup.locator('html[data-theme="light"]')).toBeVisible();

      // Toggle theme via header button.
      await popup.locator('[aria-label="Toggle theme"]').click();
      await expect(popup.locator('html[data-theme="dark"]')).toBeVisible();

      await popup.close();

      // Re-open the popup and verify the dark theme persists.
      popup = await openPopup(context, extensionId);
      await expect(popup.locator('html[data-theme="dark"]')).toBeVisible();

      await popup.close();
    } finally {
      await closeExtensionBrowser(context);
    }
  });

  test('opens settings dialog and shows filename source dropdown', async () => {
    const { context, extensionId } = await launchExtensionBrowser();

    try {
      const popup = await openPopup(context, extensionId);

      // Open settings dialog.
      await popup.locator('[aria-label="Settings"]').click();
      await expect(popup.locator('[role="dialog"]')).toBeVisible();

      // Verify filename source dropdown exists.
      const dropdown = popup.locator('[data-testid="filename-source-select"]');
      await expect(dropdown).toBeVisible();

      // Verify default is title-fallback.
      await expect(dropdown.locator('button')).toContainText('Title (fallback URL)');

      // Close settings dialog.
      await popup.locator('[aria-label="Close settings"]').click();
      await expect(popup.locator('[role="dialog"]')).not.toBeVisible();

      await popup.close();
    } finally {
      await closeExtensionBrowser(context);
    }
  });
});
