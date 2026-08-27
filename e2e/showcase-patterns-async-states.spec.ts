import { expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { test } from './showcase.fixture';

const SHOWCASE_TITLE = 'Pattern: Async states';

function runAxe(page: Parameters<typeof AxeBuilder>[0]['page']) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

test.describe('Pattern: Async states', () => {
  test.beforeEach(async ({ showcasePage }) => {
    await showcasePage.goto(`?showcase=${encodeURIComponent(SHOWCASE_TITLE)}`);
    await expect(showcasePage.locator('main h1').first()).toHaveText(SHOWCASE_TITLE);
  });

  test('loading state renders spinner and skeleton placeholders', async ({ showcasePage }) => {
    await showcasePage.getByRole('button', { name: 'Loading' }).click();
    await expect(showcasePage.locator('[aria-label="Loading results"]')).toBeVisible();
    await expect(showcasePage.locator('[data-cell-id="skeleton-list"] [aria-hidden="true"]')).toHaveCount(3);
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });

  test('empty state renders an actionable empty state', async ({ showcasePage }) => {
    await showcasePage.getByRole('button', { name: 'Empty' }).click();
    await expect(showcasePage.getByText('No results')).toBeVisible();
    await expect(showcasePage.getByRole('button', { name: 'Back to search' })).toBeVisible();
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });

  test('error state renders alert with role alert and retry button', async ({ showcasePage }) => {
    await showcasePage.getByRole('button', { name: 'Error' }).click();
    await expect(showcasePage.getByText('Network error')).toBeVisible();
    await expect(showcasePage.getByRole('button', { name: 'Retry' })).toBeVisible();
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });

  test('success state renders results and no violations', async ({ showcasePage }) => {
    await showcasePage.getByRole('button', { name: 'Success' }).click();
    await expect(showcasePage.getByText('3 results found')).toBeVisible();
    await expect(showcasePage.getByText('Result one')).toBeVisible();
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });

  test('keyboard can cycle through state buttons', async ({ showcasePage }) => {
    await showcasePage.getByRole('button', { name: 'Idle' }).focus();
    await showcasePage.keyboard.press('Tab');
    await expect(showcasePage.getByRole('button', { name: 'Loading' })).toBeFocused();
    await showcasePage.keyboard.press('Enter');
    await expect(showcasePage.locator('[aria-label="Loading results"]')).toBeVisible();
  });
});
