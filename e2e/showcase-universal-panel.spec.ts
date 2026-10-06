import { expect } from '@playwright/test';
import { test } from './showcase.fixture';

const PAGE_URL = '?showcase=Universal+Panel+Page';

test.describe('Design System Showcase — Universal Panel (A2 L-shape)', () => {
  test('desktop sidebar has tabs, tools and a collapse toggle', async ({ showcasePage }) => {
    await showcasePage.goto(`${PAGE_URL}&viewport=1200`);
    const frame = showcasePage.frameLocator('iframe[title="Viewport preview"]');

    const sidebar = frame.locator('[data-cell-id="universal-panel-tab-bar"]');
    await expect(sidebar).toBeVisible();

    for (const label of ['Dictionary', 'Study Modes', 'Settings']) {
      const btn = sidebar.locator(`button:has-text("${label}")`).first();
      await expect(btn).toBeVisible();
    }

    const toggle = sidebar.locator('[data-cell-id="collapsible-sidebar-toggle"]');
    await expect(toggle).toBeVisible();
  });

  test('desktop sidebar collapses to icon-only width', async ({ showcasePage }) => {
    await showcasePage.goto(`${PAGE_URL}&viewport=1200`);
    const frame = showcasePage.frameLocator('iframe[title="Viewport preview"]');

    const sidebar = frame.locator('[data-cell-id="universal-panel-tab-bar"]');
    const toggle = sidebar.locator('[data-cell-id="collapsible-sidebar-toggle"]');
    await toggle.click();

    await expect(sidebar).toHaveCSS('width', '64px');
  });

  test('mobile switches to bottom navigation and tools sheet', async ({ showcasePage }) => {
    await showcasePage.goto(`${PAGE_URL}&viewport=390`);
    const frame = showcasePage.frameLocator('iframe[title="Viewport preview"]');

    const bottomNav = frame.locator('[data-cell-id="universal-panel-bottom-nav"]');
    await expect(bottomNav).toBeVisible();

    const tools = frame.locator('[data-cell-id="universal-panel-mobile-tools"]');
    await tools.click();

    const sheet = frame.locator('[data-cell-id="universal-panel-tools-sheet"]');
    await expect(sheet).toBeVisible();

    for (const testId of ['universal-panel-reader', 'universal-panel-srs-study', 'universal-panel-tab-local-player']) {
      const row = sheet.locator(`[data-cell-id="${testId}"]`);
      await expect(row).toBeVisible();
    }
  });
});
