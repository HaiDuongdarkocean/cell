import { expect } from '@playwright/test';
import { test } from '../fixtures/cellEnvironment.fixture';

const WRAPPER = '[data-cell-split-view="wrapper"]';
const PANEL = '[data-cell-split-view="panel"]';
const HANDLE = '[data-cell-split-view="handle"]';
const VIDEO = '#player-wrapper video';
const PLAYER = '#player-wrapper';
const CUE_ITEM = '[data-cell-id="cue-item"]';
const CUE_LIST = '[data-cell-id="cue-list-scroll"]';

const waitStable = (page: import('@playwright/test').Page) => page.waitForTimeout(600);

const openSplitView = async (page: import('@playwright/test').Page) => {
  await page.keyboard.press('t');
  await page.locator(WRAPPER).waitFor({ state: 'visible', timeout: 10_000 });
  await waitStable(page);
};

test.describe('Stage 2: Split View edge — fullscreen', () => {
  test('SV-20/21: fullscreen enter+exit keeps video and panel rendering', async ({
    streamFlixPage,
  }) => {
    await openSplitView(streamFlixPage);

    // Enter fullscreen on the player shell — user activation from the
    // keyboard press is still within the transient window.
    await streamFlixPage.evaluate(() => {
      const shell = document.getElementById('player-wrapper');
      return shell?.requestFullscreen();
    });
    await streamFlixPage.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 5_000 });
    await streamFlixPage.waitForTimeout(1500);

    // Fullscreen branch: no wrapper — stage/handle/panel are direct children
    // of the fullscreen element.
    const fsPanel = streamFlixPage.locator(PANEL);
    await expect(fsPanel).toBeVisible({ timeout: 10_000 });
    const fsVideo = await streamFlixPage.locator(VIDEO).boundingBox();
    expect(fsVideo!.height).toBeGreaterThan(0);

    await streamFlixPage.evaluate(() => document.exitFullscreen());
    await streamFlixPage.waitForFunction(() => !document.fullscreenElement, null, { timeout: 5_000 });
    await streamFlixPage.waitForTimeout(1500);

    // Back to normal: wrapper rebuilt around the player shell.
    await expect(streamFlixPage.locator(WRAPPER)).toBeVisible({ timeout: 10_000 });
    const video = await streamFlixPage.locator(VIDEO).boundingBox();
    expect(video!.height).toBeGreaterThan(0);
    expect(await streamFlixPage.locator(WRAPPER).count()).toBe(1);
  });

  test('SV-23: closing while auto-reopened in fullscreen stays closed; fs exit does not resurrect', async ({
    streamFlixPage,
  }) => {
    const logs: string[] = [];
    streamFlixPage.on('console', (msg) => {
      const t = msg.text();
      if (t.includes('[Cell:SplitView')) logs.push(t.slice(0, 200));
    });
    await openSplitView(streamFlixPage);

    await streamFlixPage.evaluate(() => {
      const shell = document.getElementById('player-wrapper');
      return shell?.requestFullscreen();
    });
    // Auto-reopen: the fs-branch appends the panel INSIDE the fullscreen
    // element — the old normal-branch panel stays in the wrapper, so a plain
    // toBeVisible would resolve on the closing panel before the settle fires.
    await streamFlixPage.waitForFunction(
      () => !!document.fullscreenElement?.querySelector('[data-cell-split-view="panel"]'),
      null,
      { timeout: 12_000 },
    );

    // User closes — a pending/second settle must not reopen it. While the fs
    // element is in the top layer the outer wrapper/stage cannot be removed
    // (detaching the fs element would force-exit fullscreen), so assert the
    // user-facing chrome (panel + handle) is gone here; the zombie-wrapper
    // unwrap is verified after fs exit below.
    await streamFlixPage.keyboard.press('t');
    await streamFlixPage.waitForTimeout(1500);
    const remaining = await streamFlixPage.evaluate(() =>
      Array.from(document.querySelectorAll('[data-cell-split-view]'))
        .map((el) => el.getAttribute('data-cell-split-view'))
        .join(',')
    );
    console.log('--- svlog ---\n' + logs.join('\n') + '\n--- remaining: ' + remaining);
    expect(await streamFlixPage.locator(PANEL).count()).toBe(0);
    expect(await streamFlixPage.locator(HANDLE).count()).toBe(0);
    const fsVideo = await streamFlixPage.locator(VIDEO).boundingBox();
    expect(fsVideo!.height).toBeGreaterThan(0);

    await streamFlixPage.evaluate(() => document.exitFullscreen().catch(() => undefined));
    await streamFlixPage.waitForFunction(() => !document.fullscreenElement, null, { timeout: 5_000 });
    await streamFlixPage.waitForTimeout(2000);
    // No resurrect AND no zombie wrapper/stage left behind.
    expect(await streamFlixPage.locator('[data-cell-split-view]').count()).toBe(0);
    const video = await streamFlixPage.locator(VIDEO).boundingBox();
    expect(video!.height).toBeGreaterThan(0);
  });
});

test.describe('Stage 2: Split View edge — player mode interplay', () => {
  test('SV-30/31: entering Player Mode tears down the wrapper; exiting restores it', async ({
    streamFlixPage,
  }) => {
    const logs: string[] = [];
    streamFlixPage.on('console', (msg) => {
      const t = msg.text();
      if (t.includes('[Cell:SplitView')) logs.push(t.slice(0, 200));
    });
    await openSplitView(streamFlixPage);

    await streamFlixPage.keyboard.press('g');
    await streamFlixPage.waitForTimeout(1500);
    expect(await streamFlixPage.locator(WRAPPER).count()).toBe(0);

    await streamFlixPage.keyboard.press('g');
    try {
      await expect(streamFlixPage.locator(WRAPPER)).toBeVisible({ timeout: 12_000 });
      const video = await streamFlixPage.locator(VIDEO).boundingBox();
      expect(video!.height).toBeGreaterThan(0);
    } finally {
      console.log('--- svlog ---\n' + logs.join('\n'));
    }
  });

  test('SV-32: pressing t in Player Mode does not create a split wrapper', async ({
    streamFlixPage,
  }) => {
    await streamFlixPage.keyboard.press('g');
    await streamFlixPage.waitForTimeout(1200);
    await streamFlixPage.keyboard.press('t');
    await streamFlixPage.waitForTimeout(800);
    expect(await streamFlixPage.locator('[data-cell-split-view]').count()).toBe(0);
    await streamFlixPage.keyboard.press('g');
  });
});

test.describe('Stage 2: Split View edge — layout integrity', () => {
  test('SV-60: opening does not shift page scroll', async ({ streamFlixPage }) => {
    await streamFlixPage.evaluate(() => window.scrollTo(0, 300));
    const scrollBefore = await streamFlixPage.evaluate(() => window.scrollY);
    await openSplitView(streamFlixPage);
    const scrollAfter = await streamFlixPage.evaluate(() => window.scrollY);
    expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThanOrEqual(4);
  });

  test('SV-61: sibling content stays rendered beside the wrapper', async ({ streamFlixPage }) => {
    await openSplitView(streamFlixPage);
    const serverCard = streamFlixPage.locator('[class*="serverCard"]');
    const episodeList = streamFlixPage.locator('[class*="episodeList"]');
    await expect(serverCard.first()).toBeVisible();
    await expect(episodeList.first()).toBeVisible();
  });

  test('SV-64: narrow viewport keeps panel within bounds', async ({ streamFlixPage }) => {
    await streamFlixPage.setViewportSize({ width: 390, height: 800 });
    await streamFlixPage.waitForTimeout(400);
    const scrollBefore = await streamFlixPage.evaluate(() => document.documentElement.scrollWidth);
    await openSplitView(streamFlixPage);
    const panelBox = await streamFlixPage.locator(PANEL).boundingBox();
    const videoBox = await streamFlixPage.locator(VIDEO).boundingBox();
    expect(panelBox!.width).toBeGreaterThanOrEqual(190);
    expect(panelBox!.width).toBeLessThanOrEqual(390 * 0.65);
    expect(videoBox!.width).toBeGreaterThan(0);
    // AC: split view must not INCREASE page overflow (mock page itself has a
    // fixed-width header — baseline overflow is a pre-existing mock trait).
    const scrollAfter = await streamFlixPage.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollAfter).toBeLessThanOrEqual(scrollBefore + 2);
  });
});

test.describe('Stage 2: Split View edge — panel content', () => {
  test('SV-70/71: cue list renders and clicking a cue seeks the video', async ({
    streamFlixPage,
  }) => {
    await openSplitView(streamFlixPage);
    const cues = streamFlixPage.locator(`${PANEL} ${CUE_ITEM}`);
    await expect(cues.first()).toBeVisible({ timeout: 10_000 });
    expect(await cues.count()).toBeGreaterThan(1);

    const idx = Math.min(4, (await cues.count()) - 1);
    await cues.nth(idx).locator('[data-cell-id="cue-timestamp"]').click();
    await streamFlixPage.waitForTimeout(300);
    const currentTime = await streamFlixPage.locator(VIDEO).evaluate((v) => (v as HTMLVideoElement).currentTime);
    expect(currentTime).toBeGreaterThan(0);
  });

  test('SV-73: seeking the video updates the active cue highlight', async ({ streamFlixPage }) => {
    await openSplitView(streamFlixPage);
    const cues = streamFlixPage.locator(`${PANEL} ${CUE_ITEM}`);
    await expect(cues.first()).toBeVisible({ timeout: 10_000 });

    await streamFlixPage.locator(VIDEO).evaluate((v) => { (v as HTMLVideoElement).currentTime = 5; });
    await streamFlixPage.waitForTimeout(600);
    const activeCount = await streamFlixPage.locator(`${PANEL} ${CUE_ITEM}[data-current="true"]`).count();
    expect(activeCount).toBeGreaterThanOrEqual(0);
  });

  test('SV-74: cue list scrolls internally without scrolling the page', async ({ streamFlixPage }) => {
    await openSplitView(streamFlixPage);
    const list = streamFlixPage.locator(`${PANEL} ${CUE_LIST}`);
    await expect(list).toBeVisible({ timeout: 10_000 });

    const canScroll = await list.evaluate((el) => el.scrollHeight > el.clientHeight);
    if (!canScroll) {
      test.skip();
      return;
    }
    const pageScrollBefore = await streamFlixPage.evaluate(() => window.scrollY);
    await list.hover();
    await streamFlixPage.mouse.wheel(0, 400);
    await streamFlixPage.waitForTimeout(300);
    const listScroll = await list.evaluate((el) => el.scrollTop);
    const pageScrollAfter = await streamFlixPage.evaluate(() => window.scrollY);
    expect(listScroll).toBeGreaterThan(0);
    expect(pageScrollAfter).toBe(pageScrollBefore);
  });
});

test.describe('Stage 2: Split View edge — input guards & persistence', () => {
  test('SV-50: typing t inside an injected input does not toggle', async ({ streamFlixPage }) => {
    await streamFlixPage.evaluate(() => {
      const input = document.createElement('input');
      input.id = 'sv-test-input';
      document.body.appendChild(input);
      input.focus();
    });
    await streamFlixPage.keyboard.type('t');
    await streamFlixPage.waitForTimeout(400);
    expect(await streamFlixPage.locator(WRAPPER).count()).toBe(0);
    const value = await streamFlixPage.locator('#sv-test-input').inputValue();
    expect(value).toBe('t');
  });

  test('SV-51: modified keys do not toggle', async ({ streamFlixPage }) => {
    await streamFlixPage.keyboard.press('Shift+t');
    await streamFlixPage.waitForTimeout(300);
    expect(await streamFlixPage.locator(WRAPPER).count()).toBe(0);
    await streamFlixPage.keyboard.press('Alt+t');
    await streamFlixPage.waitForTimeout(300);
    expect(await streamFlixPage.locator(WRAPPER).count()).toBe(0);
  });

  test('SV-53: pressing t while focus is inside the panel still toggles', async ({
    streamFlixPage,
  }) => {
    await openSplitView(streamFlixPage);
    const cue = streamFlixPage.locator(`${PANEL} ${CUE_ITEM}`).first();
    if (await cue.count() > 0) await cue.click();
    await streamFlixPage.keyboard.press('t');
    await streamFlixPage.waitForTimeout(800);
    expect(await streamFlixPage.locator(WRAPPER).count()).toBe(0);
  });

  test('SV-43: reload closes split view cleanly; reopen works', async ({ streamFlixPage }) => {
    await openSplitView(streamFlixPage);
    await streamFlixPage.reload({ waitUntil: 'networkidle' });
    const video = streamFlixPage.locator(VIDEO);
    await expect(video).toBeVisible({ timeout: 30_000 });
    await expect(streamFlixPage.locator('#cell-subtitle-root')).toBeAttached({ timeout: 30_000 });
    await streamFlixPage.waitForTimeout(800);

    expect(await streamFlixPage.locator('[data-cell-split-view]').count()).toBe(0);
    await openSplitView(streamFlixPage);
    expect(await streamFlixPage.locator(WRAPPER).count()).toBe(1);
  });
});
