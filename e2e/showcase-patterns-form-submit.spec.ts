import { expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { test } from './showcase.fixture';

const SHOWCASE_TITLE = 'Pattern: Form submit';

function runAxe(page: Parameters<typeof AxeBuilder>[0]['page']) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

test.describe('Pattern: Form submit', () => {
  test.beforeEach(async ({ showcasePage }) => {
    await showcasePage.goto(`?showcase=${encodeURIComponent(SHOWCASE_TITLE)}`);
    await expect(showcasePage.locator('main h1').first()).toHaveText(SHOWCASE_TITLE);
  });

  test('shows inline validation errors when required fields are empty', async ({ showcasePage }) => {
    await showcasePage.getByRole('button', { name: 'Save profile' }).click();
    await expect(showcasePage.getByText('Profile name is required')).toBeVisible();
    await expect(showcasePage.getByText('Language is required')).toBeVisible();
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });

  test('submits successfully and shows confirmation', async ({ showcasePage }) => {
    await showcasePage.getByRole('textbox', { name: /Profile name/ }).fill('Japanese beginner');
    await showcasePage.getByRole('button', { name: 'Language' }).click();
    await showcasePage.getByRole('option', { name: 'Japanese' }).click();
    await showcasePage.getByRole('button', { name: 'Save profile' }).click();
    await expect(showcasePage.getByText('Profile saved')).toBeVisible();
    await expect(showcasePage.getByText('Japanese beginner', { exact: true })).toBeVisible();
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });

  test('shows error alert for the magic keyword', async ({ showcasePage }) => {
    await showcasePage.getByRole('textbox', { name: /Profile name/ }).fill('error');
    await showcasePage.getByRole('button', { name: 'Language' }).click();
    await showcasePage.getByRole('option', { name: 'Vietnamese' }).click();
    await showcasePage.getByRole('button', { name: 'Save profile' }).click();
    await expect(showcasePage.getByText('Save failed')).toBeVisible();
    await expect(showcasePage.getByRole('button', { name: 'Retry' })).toBeVisible();
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });

  test('opens and cancels delete confirmation dialog', async ({ showcasePage }) => {
    await showcasePage.getByRole('button', { name: 'Delete' }).click();
    await expect(showcasePage.getByRole('dialog', { name: 'Delete profile?' })).toBeVisible();
    await showcasePage.getByRole('button', { name: 'Cancel' }).click();
    await expect(showcasePage.getByRole('dialog', { name: 'Delete profile?' })).toBeHidden();
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });

  test('confirms delete dialog resets form', async ({ showcasePage }) => {
    await showcasePage.getByRole('textbox', { name: /Profile name/ }).fill('Temp');
    await showcasePage.getByRole('button', { name: 'Language' }).click();
    await showcasePage.getByRole('option', { name: 'English' }).click();
    await showcasePage.getByRole('button', { name: 'Delete' }).click();
    await showcasePage.getByRole('dialog', { name: 'Delete profile?' }).getByRole('button', { name: 'Delete' }).click();
    await expect(showcasePage.getByRole('textbox', { name: /Profile name/ })).toHaveValue('');
    await expect(showcasePage.getByRole('button', { name: 'Language' })).toHaveText('Choose a language');
    const results = await runAxe(showcasePage);
    expect(results.violations).toEqual([]);
  });
});
