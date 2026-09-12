import { expect } from '@playwright/test';
import { test } from './showcase.fixture';

const CONTENT = '[data-cell-id="card-creator-content"]';
const QUEUE_PANEL = '[data-cell-id="cc-queue-panel"]';
const QUEUE_TOGGLE = '[data-cell-id="cc-queue-toggle"]';
const QUEUE_BACK = '[data-cell-id="cc-queue-back"]';
const QUEUE_UNDO = '[data-cell-id="cc-queue-undo"]';
const TARGET_WORD = '[data-cell-id="cc-target-word-input"] textarea';

test.describe('Showcase — Card Creator queue slide-over', () => {
  test.beforeEach(async ({ showcasePage }) => {
    await showcasePage.goto('?showcase=Card Creator');
    await expect(showcasePage.locator(CONTENT)).toBeVisible();
  });

  test('auto-opens as a dialog layer that covers the card creator content', async ({
    showcasePage,
  }) => {
    const panel = showcasePage.locator(QUEUE_PANEL);
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('role', 'dialog');
    await expect(panel).toHaveAttribute('aria-modal', 'true');
    await expect(panel.locator('h2')).toHaveText('Queue (1/3)');

    // Full cover: overlay box matches the card creator frame, not an inline column.
    const panelBox = await panel.boundingBox();
    const contentBox = await showcasePage.locator(CONTENT).boundingBox();
    expect(panelBox).not.toBeNull();
    expect(contentBox).not.toBeNull();
    expect(Math.abs(panelBox!.width - contentBox!.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(panelBox!.height - contentBox!.height)).toBeLessThanOrEqual(2);

    for (const term of ['serendipity', 'ephemeral', 'luminous']) {
      await expect(
        panel.getByRole('button', { name: `Select ${term}` }),
      ).toBeVisible();
    }
  });

  test('closes via back button and reopens via the header toggle', async ({
    showcasePage,
  }) => {
    const panel = showcasePage.locator(QUEUE_PANEL);
    await expect(panel).toBeVisible();

    await showcasePage.locator(QUEUE_BACK).click();
    await expect(panel).toBeHidden();

    await showcasePage.locator(QUEUE_TOGGLE).click();
    await expect(panel).toBeVisible();
  });

  test('closes via Escape', async ({ showcasePage }) => {
    const panel = showcasePage.locator(QUEUE_PANEL);
    await expect(panel).toBeVisible();

    await showcasePage.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });

  test('selecting an item switches the prefill and closes the panel', async ({
    showcasePage,
  }) => {
    const panel = showcasePage.locator(QUEUE_PANEL);
    await expect(panel).toBeVisible();

    await panel.getByRole('button', { name: 'Select ephemeral' }).click();
    await expect(panel).toBeHidden();
    await expect(showcasePage.locator(TARGET_WORD)).toHaveValue('ephemeral');
  });

  test('deleting an item keeps the panel open and offers undo', async ({
    showcasePage,
  }) => {
    const panel = showcasePage.locator(QUEUE_PANEL);
    await expect(panel).toBeVisible();

    const item = panel.locator('[data-cell-id="cc-queue-item-1"]');
    await item.hover();
    await panel.locator('[data-cell-id="cc-queue-delete-1"]').click();

    // Still open — pruning several items must not bounce the user out.
    await expect(panel).toBeVisible();
    await expect(panel.locator('h2')).toHaveText('Queue (1/2)');
    await expect(showcasePage.locator(QUEUE_UNDO)).toBeVisible();

    await showcasePage.locator(QUEUE_UNDO).click();
    // Undo restores the item AND makes it active (store sets activeIndex = restored index).
    await expect(panel.locator('h2')).toHaveText('Queue (2/3)');
    await expect(panel.getByRole('button', { name: 'Select ephemeral' })).toBeVisible();
  });

  test('overflow queue stays scrollable inside the overlay', async ({ showcasePage }) => {
    await showcasePage.goto('?showcase=Card Creator&data=overflow');
    const panel = showcasePage.locator(QUEUE_PANEL);
    await expect(panel).toBeVisible();
    await expect(panel.locator('h2')).toHaveText('Queue (1/50)');

    const list = panel.locator('[data-cell-id="cc-queue-sidebar"]');
    const metrics = await list.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

    // Last item is reachable by scrolling the list container.
    await panel.locator('[data-cell-id="cc-queue-item-49"]').scrollIntoViewIfNeeded();
    await expect(panel.locator('[data-cell-id="cc-queue-item-49"]')).toBeInViewport();
  });
});
