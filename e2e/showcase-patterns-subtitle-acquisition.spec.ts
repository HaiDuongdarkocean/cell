import { expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { test } from './showcase.fixture';

const SHOWCASE_TITLE = 'Pattern: Subtitle acquisition';

function runAxe(page: Parameters<typeof AxeBuilder>[0]['page']) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

test.describe('Pattern: Subtitle acquisition', () => {
  test.beforeEach(async ({ showcasePage }) => {
    await showcasePage.goto(`?showcase=${encodeURIComponent(SHOWCASE_TITLE)}`);
    await expect(showcasePage.locator('main h1').first()).toHaveText(SHOWCASE_TITLE);
  });

  test('shows URL validation error when empty', async ({ showcasePage }) => {
    await showcasePage.getByRole('button', { name: 'Detect' }).click();
    await expect(showcasePage.getByText('Video URL is required')).toBeVisible();
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });

  test('detects candidates and acquires a subtitle', async ({ showcasePage }) => {
    await showcasePage.getByRole('textbox', { name: /Video URL/ }).fill('https://example.com/video');
    await showcasePage.getByRole('button', { name: 'Detect' }).click();
    await expect(showcasePage.getByText('3 subtitle candidates found')).toBeVisible();
    await showcasePage.getByRole('option', { name: 'Japanese' }).click();
    await expect(showcasePage.getByText('Acquiring Japanese')).toBeVisible();
    await expect(showcasePage.getByText('Subtitle acquired')).toBeVisible();
    await expect(showcasePage.getByText('Japanese', { exact: true })).toBeVisible();
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });

  test('keyboard selects a candidate with Enter', async ({ showcasePage }) => {
    await showcasePage.getByRole('textbox', { name: /Video URL/ }).fill('https://example.com/video');
    await showcasePage.getByRole('button', { name: 'Detect' }).click();
    await expect(showcasePage.getByRole('option', { name: 'English' })).toBeVisible();
    await showcasePage.getByRole('option', { name: 'English' }).press('Enter');
    await expect(showcasePage.getByText('Subtitle acquired')).toBeVisible();
  });

  test('shows empty state for the magic keyword', async ({ showcasePage }) => {
    await showcasePage.getByRole('textbox', { name: /Video URL/ }).fill('empty');
    await showcasePage.getByRole('button', { name: 'Detect' }).click();
    await expect(showcasePage.getByText('No subtitles found')).toBeVisible();
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });

  test('shows error alert for the magic keyword', async ({ showcasePage }) => {
    await showcasePage.getByRole('textbox', { name: /Video URL/ }).fill('error');
    await showcasePage.getByRole('button', { name: 'Detect' }).click();
    await expect(showcasePage.getByText('Detection failed')).toBeVisible();
    await expect(showcasePage.getByRole('button', { name: 'Retry' })).toBeVisible();
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });
});
