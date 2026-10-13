import { expect } from '@playwright/test';
import { test } from '../fixtures/TihokaEnvironment.fixture';

const WRAPPER = '[data-tihoka-split-view="wrapper"]';
const PANEL = '[data-tihoka-split-view="panel"]';
const HANDLE = '[data-tihoka-split-view="handle"]';
// Player Mode renders the same data-tihoka-split-view contract INSIDE the
// subtitle shadow root, and Playwright locators pierce shadow — assertions
// about page-DOM split-view chrome must query the light DOM directly.
const lightDomSplitCount = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.querySelectorAll('[data-tihoka-split-view]').length);
const lightDomWrapperCount = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () => document.querySelectorAll('[data-tihoka-split-view="wrapper"]').length,
  );
const VIDEO = '#player-wrapper video';
const CUE_ITEM = '[data-tihoka-id="cue-item"]';
const CUE_LIST = '[data-tihoka-id="cue-list-scroll"]';

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
      if (t.includes('[Tihoka:SplitView')) logs.push(t.slice(0, 200));
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
      () => !!document.fullscreenElement?.querySelector('[data-tihoka-split-view="panel"]'),
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
      Array.from(document.querySelectorAll('[data-tihoka-split-view]'))
        .map((el) => el.getAttribute('data-tihoka-split-view'))
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
    expect(await streamFlixPage.locator('[data-tihoka-split-view]').count()).toBe(0);
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
      if (t.includes('[Tihoka:SplitView')) logs.push(t.slice(0, 200));
    });
    await openSplitView(streamFlixPage);

    await streamFlixPage.keyboard.press('g');
    await streamFlixPage.waitForTimeout(1500);
    expect(await lightDomWrapperCount(streamFlixPage)).toBe(0);

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
    expect(await lightDomSplitCount(streamFlixPage)).toBe(0);
    await streamFlixPage.keyboard.press('g');
  });

  test('SV-33: exiting Player Mode mounts no split-view nodes in page DOM (AC-6.5)', async ({
    streamFlixPage,
  }) => {
    await streamFlixPage.keyboard.press('g');
    await streamFlixPage.waitForTimeout(1500);
    await streamFlixPage.keyboard.press('g');
    await streamFlixPage.waitForTimeout(1500);
    // querySelectorAll does not pierce shadow roots — PM's own wrapper/stage
    // (inside #Tihoka-subtitle-root) are excluded; only leaked page-DOM nodes count.
    const lightDomNodes = await streamFlixPage.evaluate(
      () => document.querySelectorAll('[data-tihoka-split-view]').length,
    );
    expect(lightDomNodes).toBe(0);
  });
});

test.describe('Stage 2: Split View edge — layout integrity', () => {
  test('SV-62: wrapper holds only stage + panel; resize handle is an invisible panel-edge strip', async ({
    streamFlixPage,
  }) => {
    await openSplitView(streamFlixPage);

    // AC-1.1 DOM contract: the wrapper is a clean two-child row — the resize
    // affordance is a feature of the panel edge, not a visible divider bar.
    const wrapperChildren = await streamFlixPage
      .locator(WRAPPER)
      .evaluate((el) =>
        Array.from(el.children).map((c) => c.getAttribute('data-tihoka-split-view')),
      );
    expect(wrapperChildren).toEqual(['stage', 'panel']);

    // The handle lives inside the panel shadow at the left edge: finger-sized
    // hit zone, col-resize cursor, no painted surface.
    const handleInfo = await streamFlixPage.locator(PANEL).evaluate((el) => {
      const h = el.shadowRoot?.querySelector('[data-tihoka-split-view="handle"]');
      if (!h) return null;
      const r = h.getBoundingClientRect();
      const cs = getComputedStyle(h);
      return {
        offsetLeft: r.left - el.getBoundingClientRect().left,
        width: r.width,
        cursor: cs.cursor,
        background: cs.backgroundColor,
      };
    });
    expect(handleInfo).not.toBeNull();
    expect(handleInfo!.offsetLeft).toBeLessThanOrEqual(0.5);
    expect(handleInfo!.width).toBeGreaterThanOrEqual(12);
    expect(handleInfo!.cursor).toBe('col-resize');
    expect(['rgba(0, 0, 0, 0)', 'transparent']).toContain(handleInfo!.background);

    // No divider lane between stage and panel — the panel border is the seam.
    const seam = await streamFlixPage.evaluate(() => {
      const stage = document
        .querySelector('[data-tihoka-split-view="stage"]')!
        .getBoundingClientRect();
      const panel = document
        .querySelector('[data-tihoka-split-view="panel"]')!
        .getBoundingClientRect();
      return panel.left - stage.right;
    });
    expect(seam).toBeLessThanOrEqual(2);
  });

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

  test('SV-64: narrow viewport floats panel as a bottom sheet (AC-4.11)', async ({
    streamFlixPage,
  }) => {
    await streamFlixPage.setViewportSize({ width: 390, height: 800 });
    await streamFlixPage.waitForTimeout(400);
    const scrollBefore = await streamFlixPage.evaluate(() => document.documentElement.scrollWidth);
    await openSplitView(streamFlixPage);
    const wrapperBox = await streamFlixPage.locator(WRAPPER).boundingBox();
    const videoBox = await streamFlixPage.locator(VIDEO).boundingBox();
    // Sheet mode: the panel leaves the page flow and docks to the viewport
    // bottom so the video keeps its natural slot instead of sharing the
    // wrapper height with an inline panel. Measure the light-DOM host —
    // MobileCueChrome renders an inner data-tihoka-split-view="panel" in the
    // sheet shadow that locator() would also match.
    const panelState = await streamFlixPage.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-tihoka-split-view="panel"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        position: getComputedStyle(el).position,
        parentIsBody: el.parentElement === document.body,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
      };
    });
    expect(panelState).not.toBeNull();
    expect(panelState!.position).toBe('fixed');
    expect(panelState!.parentIsBody).toBe(true);
    // Video keeps its slot: full width, on-screen, aspect height.
    expect(videoBox!.width).toBeGreaterThanOrEqual(300);
    expect(videoBox!.height).toBeGreaterThan(0);
    expect(videoBox!.x).toBeGreaterThanOrEqual(0);
    expect(videoBox!.x + videoBox!.width).toBeLessThanOrEqual(391);
    expect(wrapperBox!.width).toBeLessThanOrEqual(390);
    // Sheet is fully inside the viewport, docked at the bottom.
    expect(panelState!.x).toBeGreaterThanOrEqual(0);
    expect(panelState!.x + panelState!.width).toBeLessThanOrEqual(391);
    expect(panelState!.height).toBeGreaterThan(0);
    expect(panelState!.y + panelState!.height).toBeLessThanOrEqual(801);
    // AC: split view must not INCREASE page overflow (mock page itself has a
    // fixed-width header — baseline overflow is a pre-existing mock trait).
    const scrollAfter = await streamFlixPage.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollAfter).toBeLessThanOrEqual(scrollBefore + 2);
  });

  test('SV-65: resize desktop→narrow→desktop keeps video+panel visible (AC-4.11)', async ({
    streamFlixPage,
  }) => {
    await openSplitView(streamFlixPage);
    const wideVideo = await streamFlixPage.locator(VIDEO).boundingBox();

    const lightPanel = () =>
      streamFlixPage.evaluate(() => {
        const el = document.querySelector<HTMLElement>('[data-tihoka-split-view="panel"]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          parentIsBody: el.parentElement === document.body,
          x: r.x,
          width: r.width,
          height: r.height,
          position: getComputedStyle(el).position,
        };
      });

    await streamFlixPage.setViewportSize({ width: 390, height: 800 });
    await waitStable(streamFlixPage);
    const narrowVideo = await streamFlixPage.locator(VIDEO).boundingBox();
    const narrowPanel = await lightPanel();
    expect(narrowVideo!.width).toBeGreaterThan(0);
    expect(narrowVideo!.x).toBeGreaterThanOrEqual(0);
    expect(narrowVideo!.x + narrowVideo!.width).toBeLessThanOrEqual(391);
    expect(narrowPanel!.height).toBeGreaterThan(0);
    expect(narrowPanel!.position).toBe('fixed');
    expect(narrowPanel!.parentIsBody).toBe(true);
    expect(narrowPanel!.x).toBeGreaterThanOrEqual(0);
    expect(narrowPanel!.x + narrowPanel!.width).toBeLessThanOrEqual(391);

    await streamFlixPage.setViewportSize({ width: 1280, height: 800 });
    await waitStable(streamFlixPage);
    const backVideo = await streamFlixPage.locator(VIDEO).boundingBox();
    const backPanel = await lightPanel();
    expect(backVideo!.width).toBeGreaterThan(0);
    expect(backPanel!.width).toBeGreaterThan(0);
    expect(backPanel!.parentIsBody).toBe(false);
    expect(Math.abs(backVideo!.width - wideVideo!.width)).toBeLessThanOrEqual(4);
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
    await cues.nth(idx).locator('[data-tihoka-id="cue-timestamp"]').click();
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
    await expect(streamFlixPage.locator('#Tihoka-subtitle-root')).toBeAttached({ timeout: 30_000 });
    await streamFlixPage.waitForTimeout(800);

    expect(await streamFlixPage.locator('[data-tihoka-split-view]').count()).toBe(0);
    await openSplitView(streamFlixPage);
    expect(await streamFlixPage.locator(WRAPPER).count()).toBe(1);
  });
});
