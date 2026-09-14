import type { Page } from '@playwright/test';
import { test } from '../fixtures/cellEnvironment.fixture';

const widths = [280, 320, 360, 390, 480, 768, 1024];

async function enterPlayerMode(page: Page): Promise<void> {
  await page.keyboard.press('g');
  await page.waitForSelector('[data-cell-id="cue-item"]', { timeout: 20_000 });
}

async function selectStudyMode(page: Page, selector: string): Promise<void> {
  const locator = page.locator(selector);
  await locator.scrollIntoViewIfNeeded();
  await locator.dispatchEvent('click');
}

for (const width of widths) {
  test(`screenshot at ${width}px`, async ({ streamFlixPage }) => {
    await streamFlixPage.setViewportSize({ width, height: 700 });
    await enterPlayerMode(streamFlixPage);
    await selectStudyMode(streamFlixPage, '[data-cell-id="study-mode-dictation"]');
    await streamFlixPage.screenshot({
      path: `tmp/subtitle-practice-v3/screen-${width}.png`,
    });
  });
}
