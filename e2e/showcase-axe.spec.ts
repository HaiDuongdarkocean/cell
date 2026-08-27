import { expect, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { test } from './showcase.fixture';

/**
 * Stable components that are part of the public shared/ui catalog and have
 * reached a documented, non-experimental state. AxE scans use WCAG 2.1 AA tags.
 */
const STABLE_COMPONENTS = ['Button', 'Card', 'Dialog', 'Input', 'Select', 'Tabs'];

function runAxe(page: Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

test.describe('Design System Showcase — accessibility', () => {
  for (const name of STABLE_COMPONENTS) {
    test(`${name} showcase has no WCAG 2.1 AA violations`, async ({ showcasePage }) => {
      await showcasePage.goto(`?showcase=${name}`);
      await expect(showcasePage.locator('main h1')).toBeVisible();
      const results = await runAxe(showcasePage);
      expect(results.violations).toEqual([]);
    });
  }
});
