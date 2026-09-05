import { expect } from '@playwright/test';
import { test } from './showcase.fixture';

/**
 * Regression tests for visual/overwrite bugs found during the
 * Universal Panel Atomic Design audit + visual verification (2026-09-05).
 *
 * These tests are intentionally written as RED-first: they should fail until
 * the corresponding fixes land (Task T8, T9, T6, etc. in
 * `tasks/plan-universal-panel-atomic-design-audit.md`).
 */
test.describe('Universal Panel — regression bugs from atomic design + visual audit', () => {
  test.beforeEach(async ({ showcasePage }) => {
    await showcasePage.goto('?showcase=Universal%20Panel%20Page');
    await showcasePage.waitForTimeout(300); // allow entrance animation
  });

  test('panel root is shielded from dictionary lookup (data-no-lookup or host selector)', async ({ showcasePage }) => {
    const panel = showcasePage.locator('[data-cell-id="universal-panel"]');
    await expect(panel).toBeVisible();

    // The panel must be marked so WebTriggerController skips it even when the
    // component is used outside #cell-universal-panel-host (e.g. in the
    // design-system showcase or any third-party mount).
    // Mirrors CELL_UI_HOST_SELECTORS in src/shared/lib/dom/cellUiHosts.ts.
    const isShielded = await panel.evaluate((el) => {
      const hostSelectors =
        '.js-cell-popup-host, .js-cell-orbital-badge-host, .js-cell-token-badge-host, ' +
        '.js-cell-universal-panel, ' +
        '#cell-settings-dialog-host, #cell-card-creator-host, #cell-universal-panel-host, ' +
        '#cell-subtitle-root';
      return (
        el.matches('[data-no-lookup]') ||
        el.matches(hostSelectors) ||
        el.closest(hostSelectors) !== null
      );
    });

    expect(isShielded).toBe(true);
  });

  test('clicking nav items inside the panel does not open a dictionary popup overlay', async ({ showcasePage }) => {
    await showcasePage.setViewportSize({ width: 1200, height: 800 });
    const popup = showcasePage.locator('[data-cell-id="popup-dictionary"]');

    // Click each panel tab (desktop sidebar).
    const tabIds = ['universal-panel-tab-dictionary', 'universal-panel-tab-studyModes', 'universal-panel-tab-settings'];
    for (const id of tabIds) {
      const tab = showcasePage.locator(`[data-cell-id="${id}"]`);
      if ((await tab.count()) === 0) continue;
      await tab.click();
      await showcasePage.waitForTimeout(200);
      await expect(popup).not.toBeVisible();
    }

    // Click each Settings nav item (inner sidebar).
    await showcasePage.click('[data-cell-id="universal-panel-tab-settings"]');
    await expect(showcasePage.locator('[data-cell-id="settings-tab"]')).toBeVisible();
    const sectionIds = ['media', 'block', 'languageProfile', 'shortcuts', 'download', 'cardCreator', 'dictionaryPopup', 'pronunciation', 'localPronunciation', 'localPlayer', 'theme', 'tts', 'resources'];
    for (const sectionId of sectionIds) {
      const item = showcasePage.locator(`[data-cell-id="settings-tab"] [data-section-id="${sectionId}"]`);
      if ((await item.count()) === 0) continue;
      await item.click();
      await showcasePage.waitForTimeout(100);
      await expect(popup).not.toBeVisible();
    }
  });

  test('Settings tab does not overwrite the host document data-theme', async ({ showcasePage }) => {
    await showcasePage.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.setAttribute('data-preset', 'dawn');
    });

    await showcasePage.click('[data-cell-id="universal-panel-tab-settings"]');
    await expect(showcasePage.locator('[data-cell-id="settings-tab"]')).toBeVisible();

    const themeAfter = await showcasePage.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const presetAfter = await showcasePage.evaluate(() => document.documentElement.getAttribute('data-preset'));

    // ThemePanel must apply its theme to the panel/shadow root only — never
    // to document.documentElement of the host page (or the showcase shell).
    expect(themeAfter).toBe('light');
    expect(presetAfter).toBe('dawn');
  });

  test('Settings tab shows at most one "Settings" heading inside the panel', async ({ showcasePage }) => {
    await showcasePage.goto('?showcase=Universal%20Panel%20Page&tab=settings');
    await expect(showcasePage.locator('[data-cell-id="settings-tab"]')).toBeVisible();

    // The outer CollapsibleSidebar already shows "Settings" as the active tab.
    // The inner SettingsDialogContent sidebar must not repeat it.
    const settingsHeadings = showcasePage
      .locator('[data-cell-id="settings-tab"]')
      .getByText('Settings', { exact: true });
    await expect(settingsHeadings).toHaveCount(0);
  });

  test('Study Modes tab renders the real StudyModesTab (not a placeholder)', async ({ showcasePage }) => {
    await showcasePage.goto('?showcase=Universal%20Panel%20Page&tab=studyModes');
    await expect(showcasePage.locator('[data-cell-id="universal-panel-content-studyModes"]')).toBeVisible();

    // Real StudyModesTab contains these sections; the current placeholder only
    // shows a bare "Study Modes" text.
    await expect(showcasePage.locator('text=Play mode')).toBeVisible();
    await expect(showcasePage.locator('text=Custom')).toBeVisible();
    await expect(showcasePage.locator('text=Advanced')).toBeVisible();
    await expect(showcasePage.locator('[data-cell-id="study-modes-tab"]')).toBeVisible();
  });

  test('NavItem active and hover states are visually distinguishable', async ({ showcasePage }) => {
    await showcasePage.goto('?showcase=Universal%20Panel%20Page&tab=settings');
    await expect(showcasePage.locator('[data-cell-id="settings-tab"]')).toBeVisible();

    const activeItem = showcasePage.locator('[data-cell-id="universal-panel-tab-settings"]');
    const inactiveItem = showcasePage.locator('[data-cell-id="universal-panel-tab-dictionary"]');

    // Compare computed styles for active vs inactive nav item.
    const activeStyles = await activeItem.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { background: cs.backgroundColor, color: cs.color, filter: cs.filter };
    });
    const inactiveStyles = await inactiveItem.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { background: cs.backgroundColor, color: cs.color, filter: cs.filter };
    });

    // Active and inactive should differ in more than a 5% brightness shift.
    // We assert they are not identical (the current bug makes them nearly identical).
    expect(activeStyles).not.toEqual(inactiveStyles);
  });

  test('sidebar tokens --sidebar-bg/--sidebar-fg are actually consumed by the sidebar', async ({ showcasePage }) => {
    await showcasePage.goto('?showcase=Universal%20Panel%20Page&tab=settings');
    await expect(showcasePage.locator('[data-cell-id="settings-tab"]')).toBeVisible();

    // The user added --sidebar-bg / --sidebar-fg in tokens.json. The inner
    // Settings sidebar must resolve its background/color to those tokens.
    const sidebar = showcasePage.locator('[data-cell-id="settings-tab"] aside').first();
    await expect(sidebar).toBeVisible();

    const { sidebarBg, sidebarColor, expectedBg, expectedColor } = await sidebar.evaluate((el) => {
      const elStyle = getComputedStyle(el);
      const resolve = (value: string) => {
        const probe = document.createElement('div');
        probe.style.backgroundColor = value;
        document.body.appendChild(probe);
        const resolved = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return resolved;
      };
      return {
        sidebarBg: elStyle.backgroundColor,
        sidebarColor: elStyle.color,
        expectedBg: resolve(`var(--sidebar-bg)`),
        expectedColor: resolve(`var(--sidebar-fg)`),
      };
    });

    expect(sidebarBg).toBe(expectedBg);
    expect(sidebarColor).toBe(expectedColor);
  });
});
