import { expect, type Page } from '@playwright/test';
import { test } from '../fixtures/TihokaEnvironment.fixture';

const HOST_ID = 'Tihoka-subtitle-root';
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
    const anchorRow = streamFlixPage.locator('[data-tihoka-id="pm-anchor-row"]');
    await expect(anchorRow).toBeAttached({ timeout: 15_000 });
    await expect(
      streamFlixPage.locator('[data-tihoka-id="pm-anchor-band"]'),
    ).toBeAttached({ timeout: 15_000 });

    const manager = await shadowRect(streamFlixPage, '[data-tihoka-id="manager-toggle-btn"]');
    const exit = await shadowRect(streamFlixPage, '[data-tihoka-id="player-mode-exit-btn"]');
    const generate = await shadowRect(streamFlixPage, '[data-tihoka-id="generate-native-btn"]');
    const more = await shadowRect(streamFlixPage, '[data-tihoka-id="pm-more-btn"]');
    const rail = await shadowRect(streamFlixPage, '[data-tihoka-id="player-mode-actions"]');

    for (const [name, rect] of Object.entries({ manager, exit, generate, more, rail })) {
      expect(rect, `${name} must render`).not.toBeNull();
      expect(rect!.w, `${name} width`).toBe(40);
      expect(rect!.h, `${name} height`).toBe(40);
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

    const play = await shadowRect(streamFlixPage, '[data-tihoka-id="nav-play"]');
    expect(play!.w, 'play matches the sibling buttons').toBe(40);
    expect(play!.h, 'play matches the sibling buttons').toBe(40);

    const transportCenters = await streamFlixPage.evaluate(
      ({ host }: { host: string }) => {
        const root = document.getElementById(host)?.shadowRoot;
        return Array.from(
          root?.querySelectorAll<HTMLElement>('[data-tihoka-id="nav-cluster"] [data-tihoka-id]') ?? [],
        ).map((el) => {
          const r = el.getBoundingClientRect();
          return { id: el.dataset.tihokaId, cy: Math.round(r.y + r.height / 2) };
        });
      },
      { host: HOST_ID },
    );
    expect(transportCenters.length, 'transport renders buttons').toBeGreaterThan(0);
    expect(new Set(transportCenters.map((t) => t.cy)).size, 'transport shares one axis').toBe(1);

    await streamFlixPage.screenshot({
      path: 'docs/mockups/player-mode-mobile-layout-impl-v5-alignment.png',
    });
  });

  test('AC-20/21: no anchor caption and no decorative card footer icons', async ({
    streamFlixPage,
  }) => {
    await streamFlixPage.setViewportSize(MOBILE_VIEWPORT);
    await streamFlixPage.keyboard.press('g');
    await expect(streamFlixPage.locator('[data-tihoka-id="pm-anchor-band"]')).toBeAttached({
      timeout: 15_000,
    });

    await expect(streamFlixPage.locator('[data-tihoka-id="pm-caption"]')).toHaveCount(0);
    await expect(
      streamFlixPage.locator('[data-tihoka-id="cue-item"]').first(),
    ).toBeAttached({ timeout: 15_000 });

    const cardIcons = await streamFlixPage.evaluate(
      ({ host }: { host: string }) => {
        const root = document.getElementById(host)?.shadowRoot;
        const cards = Array.from(root?.querySelectorAll('[data-tihoka-id="cue-item"]') ?? []);
        return cards.map((card) => ({
          hasActions: card.querySelector('[data-tihoka-id="pm-card-actions"]') !== null,
          svgs: card.querySelectorAll('svg').length,
        }));
      },
      { host: HOST_ID },
    );
    expect(cardIcons.length, 'cue cards render').toBeGreaterThan(0);
    for (const card of cardIcons) {
      if (!card.hasActions) {
        expect(card.svgs, 'context cards carry no decorative icons').toBe(0);
      }
    }
  });

  test('AC-22/23: ⋯ opens a sheet with the speed stepper and no practice group', async ({
    streamFlixPage,
  }) => {
    await streamFlixPage.setViewportSize(MOBILE_VIEWPORT);
    await streamFlixPage.keyboard.press('g');
    await expect(streamFlixPage.locator('[data-tihoka-id="pm-anchor-band"]')).toBeAttached({
      timeout: 15_000,
    });

    await expect(streamFlixPage.locator('[data-tihoka-id="pm-speed-btn"]')).toHaveCount(0);

    await streamFlixPage.locator('[data-tihoka-id="pm-more-btn"]').click();
    const sheet = streamFlixPage.locator('[data-tihoka-id="pm-more-menu"]');
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await expect(streamFlixPage.locator('[data-tihoka-id="pm-practice-off"]')).toHaveCount(0);
    await expect(streamFlixPage.locator('[data-tihoka-id="pm-practice-dictation"]')).toHaveCount(0);
    await expect(streamFlixPage.locator('[data-tihoka-id="pm-speed-stepper"]')).toBeVisible();
    const speedValue = streamFlixPage.locator('[data-tihoka-id="pm-speed-value"]');
    await expect(speedValue).toBeVisible();
    const initialSpeed = (await speedValue.textContent())?.trim();

    await expect
      .poll(
        async () => {
          const box = await sheet.boundingBox();
          return box ? Math.round(box.y + box.height) : -1;
        },
        { timeout: 5_000, intervals: [100, 150, 200] },
      )
      .toBeLessThanOrEqual(MOBILE_VIEWPORT.height);

    const sheetBox = await sheet.boundingBox();
    const stepperBox = await streamFlixPage.locator('[data-tihoka-id="pm-speed-stepper"]').boundingBox();
    expect(sheetBox).not.toBeNull();
    expect(stepperBox).not.toBeNull();
    expect(
      Math.round(sheetBox!.y + sheetBox!.height - (stepperBox!.y + stepperBox!.height)),
      'stepper pinned to the sheet bottom',
    ).toBeLessThanOrEqual(40);

    await streamFlixPage.locator('[data-tihoka-id="pm-speed-inc"]').click();
    await expect(streamFlixPage.locator('[data-tihoka-id="pm-speed-value"]')).not.toHaveText(
      initialSpeed ?? '1×',
    );

    await streamFlixPage.screenshot({
      path: 'docs/mockups/player-mode-mobile-layout-impl-v5-sheet.png',
    });
  });

  test('AC-17: manager-toggle opens subtitle manager while Player Mode is active', async ({
    streamFlixPage,
  }) => {
    await streamFlixPage.setViewportSize(MOBILE_VIEWPORT);

    await streamFlixPage.keyboard.press('g');
    await expect(
      streamFlixPage.locator('[data-tihoka-id="pm-anchor-row"]'),
    ).toBeAttached({ timeout: 15_000 });

    await expect
      .poll(() => shadowClick(streamFlixPage, '[data-tihoka-id="manager-toggle-btn"]'), { timeout: 15_000 })
      .toBe(true);

    const managerLayer = streamFlixPage.locator('[data-tihoka-id="subtitle-manager-layer"]');
    await expect(managerLayer).toBeVisible({ timeout: 15_000 });
    await expect(
      streamFlixPage.locator('[data-tihoka-id="pm-anchor-band"]'),
    ).toBeAttached();

    await streamFlixPage.waitForTimeout(400);
    await streamFlixPage.screenshot({
      path: 'docs/mockups/player-mode-mobile-layout-impl-v4-manager.png',
    });

    await streamFlixPage.locator('[data-tihoka-id="subtitle-manager-close"]').click();
    await expect(managerLayer).not.toBeVisible({ timeout: 15_000 });
    await expect(
      streamFlixPage.locator('[data-tihoka-id="pm-anchor-band"]'),
    ).toBeAttached();
  });
});
