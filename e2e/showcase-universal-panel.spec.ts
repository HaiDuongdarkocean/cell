import { expect } from '@playwright/test';
import { test } from './showcase.fixture';

test.describe('Design System Showcase — Universal Panel (A2 L-shape)', () => {
  test.beforeEach(async ({ showcasePage }) => {
    await showcasePage.goto('?showcase=UniversalPanelPage');
    await showcasePage.waitForTimeout(300); // allow entrance animation
  });

  test('desktop sidebar has tabs, tools and a collapse toggle', async ({ showcasePage }) => {
    await showcasePage.setViewportSize({ width: 1200, height: 800 });

    const sidebar = showcasePage.locator('[data-cell-id="universal-panel-tab-bar"]');
    await expect(sidebar).toBeVisible();

    for (const label of ['Dictionary', 'Study Modes', 'Settings']) {
      const btn = sidebar.locator(`button:has-text("${label}")`).first();
      await expect(btn).toBeVisible();
    }

    const toggle = sidebar.locator('[data-cell-id="collapsible-sidebar-toggle"]');
    await expect(toggle).toBeVisible();
  });

  test('desktop sidebar collapses to icon-only width', async ({ showcasePage }) => {
    await showcasePage.setViewportSize({ width: 1200, height: 800 });

    const sidebar = showcasePage.locator('[data-cell-id="universal-panel-tab-bar"]');
    const toggle = sidebar.locator('[data-cell-id="collapsible-sidebar-toggle"]');
    await toggle.click();

    await expect(sidebar).toHaveCSS('width', '64px');
  });

  test('mobile switches to bottom navigation and tools sheet', async ({ showcasePage }) => {
    await showcasePage.setViewportSize({ width: 390, height: 844 });

    const bottomNav = showcasePage.locator('[data-cell-id="universal-panel-bottom-nav"]');
    await expect(bottomNav).toBeVisible();

    const tools = showcasePage.locator('[data-cell-id="universal-panel-mobile-tools"]');
    await tools.click();

    const sheet = showcasePage.locator('[data-cell-id="universal-panel-tools-sheet"]');
    await expect(sheet).toBeVisible();

    for (const testId of ['universal-panel-reader', 'universal-panel-srs-study', 'universal-panel-tab-local-player']) {
      const row = sheet.locator(`[data-cell-id="${testId}"]`);
      await expect(row).toBeVisible();
    }
  });
});
