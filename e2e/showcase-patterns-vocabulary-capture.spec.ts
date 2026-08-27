import { expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { test } from './showcase.fixture';

const SHOWCASE_TITLE = 'Pattern: Vocabulary capture';

function runAxe(page: Parameters<typeof AxeBuilder>[0]['page']) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

test.describe('Pattern: Vocabulary capture', () => {
  test.beforeEach(async ({ showcasePage }) => {
    await showcasePage.goto(`?showcase=${encodeURIComponent(SHOWCASE_TITLE)}`);
    await expect(showcasePage.locator('main h1').first()).toHaveText(SHOWCASE_TITLE);
  });

  test('clicking a word opens the lookup dialog', async ({ showcasePage }) => {
    await showcasePage.getByRole('button', { name: 'Look up quick' }).click();
    await expect(showcasePage.getByRole('dialog', { name: 'quick' })).toBeVisible();
    await expect(showcasePage.getByText('Moving fast or doing something in a short time.')).toBeVisible();
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });

  test('capturing a word adds it to the vocabulary list', async ({ showcasePage }) => {
    await showcasePage.getByRole('button', { name: 'Look up quick' }).click();
    await showcasePage.getByRole('button', { name: 'Word status' }).click();
    await showcasePage.getByRole('option', { name: 'Learning' }).click();
    await showcasePage.getByRole('button', { name: 'Capture' }).click();
    await expect(showcasePage.getByRole('listitem', { name: 'quick' })).toBeVisible();
    await expect(showcasePage.getByText('Learning')).toBeVisible();
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });

  test('closing the dialog without capturing does not add the word', async ({ showcasePage }) => {
    await showcasePage.getByRole('button', { name: 'Look up brown' }).click();
    await expect(showcasePage.getByRole('dialog', { name: 'brown' })).toBeVisible();
    await showcasePage.getByRole('button', { name: 'Cancel' }).click();
    await expect(showcasePage.getByRole('dialog', { name: 'brown' })).toBeHidden();
    await expect(showcasePage.getByRole('listitem')).toHaveCount(0);
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });

  test('lookup error state is shown for the magic word', async ({ showcasePage }) => {
    await showcasePage.getByRole('button', { name: 'Look up error' }).click();
    await expect(showcasePage.getByRole('dialog', { name: 'error' })).toBeVisible();
    await expect(showcasePage.getByText('Lookup failed')).toBeVisible();
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });

  test('keyboard can select and capture a word', async ({ showcasePage }) => {
    await showcasePage.getByRole('button', { name: 'Look up jumps' }).press('Enter');
    await expect(showcasePage.getByRole('dialog', { name: 'jumps' })).toBeVisible();
    await showcasePage.getByRole('button', { name: 'Word status' }).click();
    await showcasePage.getByRole('option', { name: 'Known' }).click();
    await showcasePage.getByRole('button', { name: 'Capture' }).click();
    await expect(showcasePage.getByRole('listitem', { name: 'jumps' })).toBeVisible();
    await expect(showcasePage.getByText('Known')).toBeVisible();
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });
});
