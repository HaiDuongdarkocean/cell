import { test as base, type Page } from '@playwright/test';

export type { Page };

type ShowcaseFixtures = {
  showcasePage: Page;
};

/**
 * Fixture that navigates to the design-system showcase and waits for the app
 * to be fully ready (document complete + first showcase heading rendered + fonts loaded).
 */
export const test = base.extend<ShowcaseFixtures>({
  showcasePage: async ({ page }, providePage) => {
    await page.goto('/design-system-showcase.html');

    await page.waitForFunction(() => {
      const main = document.querySelector('main');
      const h1 = main?.querySelector('h1');
      return document.readyState === 'complete' && !!h1 && h1.textContent !== '';
    });

    await page.evaluate(() => document.fonts.ready);

    await providePage(page);
  },
});
