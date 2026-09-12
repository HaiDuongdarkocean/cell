import { expect } from '@playwright/test';
import { test } from './showcase.fixture';

test.describe('Design System Showcase', () => {
  test('loads the gallery and shows the first showcase', async ({ showcasePage }) => {
    await expect(showcasePage.getByRole('heading', { name: /Design System/i })).toBeVisible();
    await expect(showcasePage.locator('main h1').first()).toBeVisible();

    const theme = await showcasePage.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme).toBe('light');
  });

  test('toggles between light and dark mode', async ({ showcasePage }) => {
    const getTheme = () => showcasePage.evaluate(() => document.documentElement.getAttribute('data-theme'));

    await expect.poll(getTheme).toBe('light');
    await showcasePage.getByRole('button', { name: /Switch to/i }).click();
    await expect.poll(getTheme).toBe('dark');
    await showcasePage.getByRole('button', { name: /Switch to/i }).click();
    await expect.poll(getTheme).toBe('light');
  });

  test('navigates to a component route via query param', async ({ showcasePage }) => {
    await showcasePage.goto('?showcase=Button');

    await expect(showcasePage.getByRole('heading', { name: 'Button', level: 1 })).toBeVisible();
    await expect(showcasePage.locator('main').first()).toContainText('Primary');
  });

  test('loads the Study Modes Panel showcase', async ({ showcasePage }) => {
    await showcasePage.goto('?showcase=Study Modes Panel');

    await expect(showcasePage.getByRole('heading', { name: 'Study Modes Panel', level: 1 })).toBeVisible();

    // Preset section visible with all expected cards.
    const presets = showcasePage.getByLabel('Preset study modes');
    await expect(presets).toBeVisible();
    await expect(presets.getByText('Normal', { exact: true })).toBeVisible();
    await expect(presets.getByText('Listen', { exact: true })).toBeVisible();
    await expect(presets.getByText('Read', { exact: true })).toBeVisible();

    // Custom section visible and the "New mode" button is offered.
    await expect(showcasePage.getByRole('heading', { name: 'Custom' })).toBeVisible();
    await expect(showcasePage.locator('[data-cell-id="new-mode-button"]')).toBeVisible();

    // Advanced section is collapsed by default; toggle it on.
    const advancedToggle = showcasePage.locator('[data-cell-id="advanced-toggle"]');
    await expect(advancedToggle).toBeVisible();

    const advancedSection = showcasePage.locator('[data-cell-id="advanced-settings"]');
    await expect(advancedSection).not.toBeVisible();

    await advancedToggle.click();
    await expect(advancedSection).toBeVisible();
    await expect(showcasePage.getByText('Skip when there is no dialogue')).toBeVisible();

    await advancedToggle.click();
    await expect(advancedSection).not.toBeVisible();
  });

  test('creates a custom study mode from the builder', async ({ showcasePage }) => {
    await showcasePage.goto('?showcase=Study Modes Panel');

    await expect(showcasePage.getByRole('heading', { name: 'Study Modes Panel', level: 1 })).toBeVisible();

    await showcasePage.locator('[data-cell-id="new-mode-button"]').click();

    await expect(showcasePage.getByRole('dialog')).toBeVisible();

    await showcasePage.locator('[data-cell-id="builder-title-input"]').fill('Shadowing');

    // Add an extra step via the cue strip, then save.
    await showcasePage.locator('[data-cell-id="cue-add-step"]').click();

    await showcasePage.locator('[data-cell-id="builder-save"]').click();

    await expect(showcasePage.getByRole('dialog')).not.toBeVisible();

    await expect(showcasePage.getByLabel('Custom study modes')).toContainText('Shadowing');
    await expect(
      showcasePage.locator('[data-cell-id^="mode-card-custom-"]', { hasText: 'Shadowing' }),
    ).toHaveCount(1);
  });
});
