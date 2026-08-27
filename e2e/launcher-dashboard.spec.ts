import { expect } from '@playwright/test';
import { test } from '@playwright/test';

test.describe('Launcher Dashboard', () => {
  test('loads the launcher and shows all tiles', async ({ page }) => {
    await page.goto('/');

    const search = page.getByRole('searchbox');
    await expect(search).toBeVisible();

    const tiles = ['Dictionary', 'Subtitle Manager', 'Reader', 'Local Player', 'History', 'Settings', 'Help'];
    for (const tile of tiles) {
      await expect(page.locator('main').getByRole('button', { name: tile })).toBeVisible();
    }
  });

  test('filters tiles by search query', async ({ page }) => {
    await page.goto('/');

    const search = page.getByRole('searchbox');
    await search.fill('sub');

    await expect(page.locator('main').getByRole('button', { name: 'Subtitle Manager' })).toBeVisible();
    await expect(page.locator('main').getByRole('button', { name: 'Dictionary' })).not.toBeVisible();
  });

  test('cycles presets when preset button is clicked', async ({ page }) => {
    await page.goto('/');

    const getPreset = () => page.evaluate(() => document.documentElement.getAttribute('data-preset'));
    await expect.poll(getPreset).toBe('dawn');

    const presetButton = page.getByRole('button', { name: /^Preset:/i });
    await presetButton.click();
    await expect.poll(getPreset).toBe('forest');

    await presetButton.click();
    await expect.poll(getPreset).toBe('ocean');
  });
});
