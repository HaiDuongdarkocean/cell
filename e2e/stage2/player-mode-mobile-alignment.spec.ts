import { expect, type Page } from '@playwright/test';
import { test } from '../fixtures/cellEnvironment.fixture';

const HOST_ID = 'cell-subtitle-root';
const MOBILE_VIEWPORT = { width: 390, height: 780 };
const AXIS_TOLERANCE_PX = 1.5;

type Rect = { x: number; y: number; w: number; h: number; cx: number; cy: number };

async function shadowRect(page: Page, selector: string): Promise<Rect | null> {
  return page.evaluate(
    ({ host, sel }: { host: string; sel: string }) => {
      const el = document.getElementById(host)?.shadowRoot?.querySelector<HTMLElement>(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
    },
    { host: HOST_ID, sel: selector },
  );
}

async function shadowClick(page: Page, selector: string): Promise<boolean> {
  return page.evaluate(
    ({ host, sel }: { host: string; sel: string }) => {
      const el = document.getElementById(host)?.shadowRoot?.querySelector<HTMLElement>(sel);
      if (!el) return false;
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
      return true;
    },
    { host: HOST_ID, sel: selector },
  );
}

test.describe('Stage 2: Player Mode mobile <600px > anchor alignment', () => {
  test('AC-18: floating buttons share vertical axes with bottom-bar buttons', async ({
    streamFlixPage,
  }) => {
    await streamFlixPage.setViewportSize(MOBILE_VIEWPORT);

    await streamFlixPage.keyboard.press('g');
    const anchorRow = streamFlixPage.locator('[data-cell-id="pm-anchor-row"]');
    await expect(anchorRow).toBeAttached({ timeout: 15_000 });
    await expect(
      streamFlixPage.locator('[data-cell-id="pm-anchor-band"]'),
    ).toBeAttached({ timeout: 15_000 });

    const manager = await shadowRect(streamFlixPage, '[data-cell-id="manager-toggle-btn"]');
    const exit = await shadowRect(streamFlixPage, '[data-cell-id="player-mode-exit-btn"]');
    const generate = await shadowRect(streamFlixPage, '[data-cell-id="generate-native-btn"]');
    const more = await shadowRect(streamFlixPage, '[data-cell-id="pm-more-btn"]');
    const rail = await shadowRect(streamFlixPage, '[data-cell-id="player-mode-actions"]');

    for (const [name, rect] of Object.entries({ manager, exit, generate, more, rail })) {
      expect(rect, `${name} must render`).not.toBeNull();
      expect(rect!.w, `${name} width`).toBe(48);
      expect(rect!.h, `${name} height`).toBe(48);
    }

    expect(Math.abs(manager!.cx - exit!.cx), 'manager-toggle shares X axis with exit').toBeLessThanOrEqual(
      AXIS_TOLERANCE_PX,
    );
    expect(Math.abs(generate!.cx - more!.cx), 'generate shares X axis with more').toBeLessThanOrEqual(
      AXIS_TOLERANCE_PX,
    );
    expect(Math.abs(manager!.cy - generate!.cy), 'manager/generate share Y axis').toBeLessThanOrEqual(
      AXIS_TOLERANCE_PX,
    );

    await streamFlixPage.screenshot({
      path: 'docs/mockups/player-mode-mobile-layout-impl-v4-alignment.png',
    });
  });

  test('AC-17: manager-toggle opens subtitle manager while Player Mode is active', async ({
    streamFlixPage,
  }) => {
    await streamFlixPage.setViewportSize(MOBILE_VIEWPORT);

    await streamFlixPage.keyboard.press('g');
    await expect(
      streamFlixPage.locator('[data-cell-id="pm-anchor-row"]'),
    ).toBeAttached({ timeout: 15_000 });

    await expect
      .poll(() => shadowClick(streamFlixPage, '[data-cell-id="manager-toggle-btn"]'), { timeout: 15_000 })
      .toBe(true);

    const managerLayer = streamFlixPage.locator('[data-cell-id="subtitle-manager-layer"]');
    await expect(managerLayer).toBeVisible({ timeout: 15_000 });
    await expect(
      streamFlixPage.locator('[data-cell-id="pm-anchor-band"]'),
    ).toBeAttached();

    await streamFlixPage.waitForTimeout(400);
    await streamFlixPage.screenshot({
      path: 'docs/mockups/player-mode-mobile-layout-impl-v4-manager.png',
    });

    await streamFlixPage.locator('[data-cell-id="subtitle-manager-close"]').click();
    await expect(managerLayer).not.toBeVisible({ timeout: 15_000 });
    await expect(
      streamFlixPage.locator('[data-cell-id="pm-anchor-band"]'),
    ).toBeAttached();
  });
});
