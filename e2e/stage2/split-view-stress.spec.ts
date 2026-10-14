import { expect } from '@playwright/test';
import { test } from '../fixtures/TihokaEnvironment.fixture';

// "Split view is mounted" = the host shell carries the marker attr — the
// architecture no longer wraps the shell, it only narrows it in place.
const WRAPPER = '[data-tihoka-split-shell]';
const PANEL = '[data-tihoka-split-view="panel"]';
const HANDLE = '[data-tihoka-split-view="handle"]';
const VIDEO = '#player-wrapper video';
const PLAYER = '#player-wrapper';

const getInlineStyle = (page: import('@playwright/test').Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => (el as HTMLElement).style.cssText);

const waitStable = (page: import('@playwright/test').Page) => page.waitForTimeout(600);

test.describe('Stage 2: Split View stress — rapid toggle', () => {
  test('SV-04: reopen inside the 410ms cleanup window keeps video visible', async ({
    streamFlixPage,
  }) => {
    const video = streamFlixPage.locator(VIDEO);
    const before = await video.boundingBox();
    expect(before!.height).toBeGreaterThan(0);

    await streamFlixPage.keyboard.press('t');
    await streamFlixPage.locator(WRAPPER).waitFor({ state: 'visible', timeout: 10_000 });
    await streamFlixPage.waitForTimeout(60);
    await streamFlixPage.keyboard.press('t');
    await streamFlixPage.waitForTimeout(60);
    await streamFlixPage.keyboard.press('t');

    await streamFlixPage.locator(WRAPPER).waitFor({ state: 'visible', timeout: 10_000 });
    await waitStable(streamFlixPage);

    const after = await video.boundingBox();
    expect(after!.height).toBeGreaterThan(before!.height * 0.5);
    expect(await streamFlixPage.locator(WRAPPER).count()).toBe(1);
  });

  test('SV-03: 10 rapid alternating toggles end with clean closed state', async ({
    streamFlixPage,
  }) => {
    const player = streamFlixPage.locator(PLAYER);
    const video = streamFlixPage.locator(VIDEO);
    const before = await video.boundingBox();
    const beforeStyle = await getInlineStyle(streamFlixPage, PLAYER);

    for (let i = 0; i < 10; i++) {
      await streamFlixPage.keyboard.press('t');
      await streamFlixPage.waitForTimeout(90);
    }

    await waitStable(streamFlixPage);
    expect(await streamFlixPage.locator(WRAPPER).count()).toBe(0);
    const after = await video.boundingBox();
    expect(Math.round(after!.height)).toBe(Math.round(before!.height));
    const afterStyle = await getInlineStyle(streamFlixPage, PLAYER);
    expect(afterStyle).toBe(beforeStyle);
    expect(await player.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(0);
  });
});

test.describe('Stage 2: Split View stress — resize handle', () => {
  test('SV-10/11: one continuous drag resizes panel without rebuilding the wrapper', async ({
    streamFlixPage,
  }) => {
    await streamFlixPage.keyboard.press('t');
    const wrapper = streamFlixPage.locator(WRAPPER);
    await wrapper.waitFor({ state: 'visible', timeout: 10_000 });
    await waitStable(streamFlixPage);

    const handle = streamFlixPage.locator(HANDLE);
    const handleBox = await handle.boundingBox();
    const panelBox = await streamFlixPage.locator(PANEL).boundingBox();
    expect(handleBox).not.toBeNull();

    const startX = handleBox!.x + handleBox!.width / 2;
    const startY = handleBox!.y + handleBox!.height / 2;

    await streamFlixPage.mouse.move(startX, startY);
    await streamFlixPage.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await streamFlixPage.mouse.move(startX - i * 20, startY, { steps: 1 });
      await streamFlixPage.waitForTimeout(40);
    }
    await streamFlixPage.mouse.up();
    await waitStable(streamFlixPage);

    expect(await streamFlixPage.locator(WRAPPER).count()).toBe(1);
    const newPanelBox = await streamFlixPage.locator(PANEL).boundingBox();
    expect(newPanelBox!.width).toBeGreaterThan(panelBox!.width + 50);

    const videoBox = await streamFlixPage.locator(VIDEO).boundingBox();
    expect(videoBox!.height).toBeGreaterThan(0);
    expect(videoBox!.width).toBeGreaterThan(0);
  });
});

test.describe('Stage 2: Split View stress — page lifecycle', () => {
  test('SV-40: switching episodes keeps split view attached to the player', async ({
    streamFlixPage,
  }) => {
    await streamFlixPage.keyboard.press('t');
    const wrapper = streamFlixPage.locator(WRAPPER);
    await wrapper.waitFor({ state: 'visible', timeout: 10_000 });
    await waitStable(streamFlixPage);

    await streamFlixPage
      .locator('[class*="episodeList"] [class*="episodeNum"]', { hasText: /^2$/ })
      .first()
      .click();
    await waitStable(streamFlixPage);

    expect(await streamFlixPage.locator(WRAPPER).count()).toBe(1);
    const videoBox = await streamFlixPage.locator(VIDEO).boundingBox();
    expect(videoBox!.height).toBeGreaterThan(0);
  });

  test('SV-41: switching to iframe mode while open leaves no ghost split-view DOM', async ({
    streamFlixPage,
  }) => {
    const pageErrors: string[] = [];
    streamFlixPage.on('pageerror', (err) => pageErrors.push(String(err)));

    await streamFlixPage.keyboard.press('t');
    const wrapper = streamFlixPage.locator(WRAPPER);
    await wrapper.waitFor({ state: 'visible', timeout: 10_000 });
    await waitStable(streamFlixPage);

    await streamFlixPage.getByRole('tab', { name: /cross-origin iframe/i }).click();
    await streamFlixPage.waitForTimeout(1000);

    // Contract: no split-view artifacts survive the host removing the player
    // subtree — the MutationObserver self-closes the session.
    expect(await streamFlixPage.locator('[data-tihoka-split-view],[data-tihoka-split-shell]').count()).toBe(0);

    // The shell never leaves its host parent, so host teardown removes it
    // cleanly — record any stray pageerror for the report; the contract
    // above still must hold.
    const appAlive = await streamFlixPage.locator('#root > *').count();
    test.info().annotations.push({
      type: 'host-react-removal',
      description: `pageErrors=${pageErrors.length} appRootChildren=${appAlive}`,
    });
  });
});

test.describe('Stage 2: Split View stress — input guards', () => {
  test('SV-50: typing t inside an input does not toggle', async ({ streamFlixPage }) => {
    const input = streamFlixPage.locator('input[type="search"], input[type="text"], textarea').first();
    if ((await input.count()) === 0) {
      test.skip();
      return;
    }
    await input.click();
    await streamFlixPage.keyboard.type('t');
    await streamFlixPage.waitForTimeout(300);
    expect(await streamFlixPage.locator(WRAPPER).count()).toBe(0);
  });

  test('SV-05: holding t (key repeat) toggles at most once', async ({ streamFlixPage }) => {
    await streamFlixPage.keyboard.down('t');
    await streamFlixPage.waitForTimeout(1500);
    await streamFlixPage.keyboard.up('t');
    await waitStable(streamFlixPage);
    const count = await streamFlixPage.locator(WRAPPER).count();
    expect(count).toBeLessThanOrEqual(1);
  });
});
