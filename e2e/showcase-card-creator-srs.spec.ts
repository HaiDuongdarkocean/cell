import { expect } from '@playwright/test';
import { test } from './showcase.fixture';

const CONTENT = '[data-tihoka-id="card-creator-content"]';
const UPDATE_MODE = '[data-tihoka-id="cc-update-mode"]';
const UPDATE_BTN = '[data-tihoka-id="cc-update"]';
const ADD_BTN = '[data-tihoka-id="cc-add"]';
const NOTETYPE = '[data-tihoka-id="cc-note-type"]';
const DECK = '[data-tihoka-id="cc-deck"]';
const QUEUE_PANEL = '[data-tihoka-id="cc-queue-panel"]';

async function closeQueue(page: import('./showcase.fixture').Page): Promise<void> {
  const panel = page.locator(QUEUE_PANEL);
  if (await panel.isVisible()) {
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  }
}

test.describe('Showcase — Card Creator SRS destination', () => {
  test('anki mode shows update mode + Update button', async ({ showcasePage }) => {
    await showcasePage.goto('?showcase=Card Creator');
    await expect(showcasePage.locator(CONTENT)).toBeVisible();
    await closeQueue(showcasePage);
    await expect(showcasePage.locator(UPDATE_MODE)).toBeVisible();
    await expect(showcasePage.locator(UPDATE_BTN)).toBeVisible();
    await showcasePage.screenshot({ path: 'tmp/cc-srs/anki-mode.png', fullPage: true });
  });

  test('srs mode hides Anki-only controls and shows SRS deck/notetype', async ({ showcasePage }) => {
    await showcasePage.goto('?showcase=Card Creator&srs=1');
    await expect(showcasePage.locator(CONTENT)).toBeVisible();
    await closeQueue(showcasePage);
    await expect(showcasePage.locator(UPDATE_MODE)).toBeHidden();
    await expect(showcasePage.locator(UPDATE_BTN)).toBeHidden();
    await expect(showcasePage.locator(ADD_BTN)).toBeVisible();
    await expect(showcasePage.locator(NOTETYPE)).toContainText('Ocean Basic');
    await expect(showcasePage.locator(DECK)).toContainText('Ocean Default');
    await showcasePage.screenshot({ path: 'tmp/cc-srs/srs-mode.png', fullPage: true });
  });
});
