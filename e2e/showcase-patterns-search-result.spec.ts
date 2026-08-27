import { expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { test } from './showcase.fixture';

const SHOWCASE_TITLE = 'Pattern: Search → result';

function runAxe(page: Parameters<typeof AxeBuilder>[0]['page']) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

test.describe('Pattern: Search → result', () => {
  test.beforeEach(async ({ showcasePage }) => {
    await showcasePage.goto(`?showcase=${encodeURIComponent(SHOWCASE_TITLE)}`);
    await expect(showcasePage.locator('main h1').first()).toHaveText(SHOWCASE_TITLE);
  });

  test('searches and shows filtered results', async ({ showcasePage }) => {
    const search = showcasePage.getByRole('searchbox', { name: 'Search subtitles by title' });
    await search.fill('witcher');
    await showcasePage.getByRole('button', { name: 'Search' }).click();
    await expect(showcasePage.locator('[aria-label="Searching"]')).toBeVisible();
    await expect(showcasePage.getByText('The Witcher - S01E01')).toBeVisible();
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });

  test('tabs filter results and show empty when no match', async ({ showcasePage }) => {
    const search = showcasePage.getByRole('searchbox', { name: 'Search subtitles by title' });
    await search.fill('witcher');
    await showcasePage.getByRole('button', { name: 'Search' }).click();
    await expect(showcasePage.getByText('The Witcher - S01E01')).toBeVisible();

    await showcasePage.getByRole('tab', { name: 'Japanese' }).click();
    await expect(showcasePage.getByText('No results')).toBeVisible();
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });

  test('empty state is shown for unknown query', async ({ showcasePage }) => {
    const search = showcasePage.getByRole('searchbox', { name: 'Search subtitles by title' });
    await search.fill('nothing');
    await showcasePage.getByRole('button', { name: 'Search' }).click();
    await expect(showcasePage.getByText('No results')).toBeVisible();
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });

  test('error state is shown for the magic keyword', async ({ showcasePage }) => {
    const search = showcasePage.getByRole('searchbox', { name: 'Search subtitles by title' });
    await search.fill('error');
    await showcasePage.getByRole('button', { name: 'Search' }).click();
    await expect(showcasePage.getByText('Search failed')).toBeVisible();
    await expect(showcasePage.getByRole('button', { name: 'Retry' })).toBeVisible();
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });

  test('keyboard can submit search with Enter', async ({ showcasePage }) => {
    const search = showcasePage.getByRole('searchbox', { name: 'Search subtitles by title' });
    await search.fill('demon');
    await search.press('Enter');
    await expect(showcasePage.getByText('Demon Slayer - Mugen Train')).toBeVisible();
  });
});
