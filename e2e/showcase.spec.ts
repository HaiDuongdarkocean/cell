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
});
