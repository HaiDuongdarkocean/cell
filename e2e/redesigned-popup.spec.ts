import { test, expect } from '@playwright/test';
import {
  launchExtensionBrowser,
  openPopup,
  closeExtensionBrowser,
} from './fixtures/extension';

test.describe('redesigned popup UI', () => {
  test('renders tabs and defaults to the videos tab', async () => {
    const { context, extensionId } = await launchExtensionBrowser();

    try {
      const popup = await openPopup(context, extensionId);

      await expect(popup.locator('[data-testid="app-root"]')).toBeVisible();
      await expect(popup.locator('[data-testid="tab-videos"]')).toBeVisible();
      await expect(popup.locator('[data-testid="tab-subtitles"]')).toBeVisible();
      await expect(popup.locator('[data-testid="tab-downloads"]')).toBeVisible();

      // Default tab should be videos (empty state visible).
      await expect(popup.locator('[data-testid="empty-media"]')).toBeVisible();

      await popup.close();
    } finally {
      await closeExtensionBrowser(context);
    }
  });

  test('switches between tabs', async () => {
    const { context, extensionId } = await launchExtensionBrowser();

    try {
      const popup = await openPopup(context, extensionId);

      // Switch to Subtitles tab.
      await popup.locator('[data-testid="tab-subtitles"]').click();
      await expect(popup.locator('[data-testid="empty-media"]')).toBeVisible();

      // Switch to Downloads tab.
      await popup.locator('[data-testid="tab-downloads"]').click();
      await expect(popup.locator('[data-testid="empty-media"]')).toBeVisible();

      // Switch back to Videos tab.
      await popup.locator('[data-testid="tab-videos"]').click();
      await expect(popup.locator('[data-testid="empty-media"]')).toBeVisible();

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
      await popup.locator('[aria-label="Switch to dark theme"]').click();
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

  test('opens settings dialog and saves theme from dropdown', async () => {
    const { context, extensionId } = await launchExtensionBrowser();

    try {
      const popup = await openPopup(context, extensionId);

      await popup.locator('[aria-label="Open settings"]').click();
      await expect(popup.locator('[role="dialog"]')).toBeVisible();

      // Change theme to dark via the settings dropdown.
      await popup.locator('[data-testid="theme-select"]').selectOption('dark');
      await expect(popup.locator('html[data-theme="dark"]')).toBeVisible();

      // Close settings dialog.
      await popup.locator('[aria-label="Close settings"]').click();
      await expect(popup.locator('[role="dialog"]')).not.toBeVisible();

      await popup.close();
    } finally {
      await closeExtensionBrowser(context);
    }
  });
});
