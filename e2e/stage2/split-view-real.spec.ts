import { expect } from '@playwright/test';
import { test } from '../fixtures/cellEnvironment.fixture';

const WRAPPER = '[data-cell-split-view="wrapper"]';

const KISSKH_URL =
  'https://kisskh.co/Drama/Perfect-Crown/Episode-1?id=11923&ep=207851&page=0&pageSize=100';
const YOUTUBE_URL = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
const THEMOVIEBOX_URL =
  'https://themoviebox.xyz/movies/oh-boy-was-i-wrong-about-her-KZp0CGxDxI2?id=2281575019673174328&type=/movie/detail&detailSe=&detailEp=&lang=en';

type Page = import('@playwright/test').Page;

const gotoOrSkip = async (
  page: Page,
  url: string,
  videoSelector = 'video',
): Promise<boolean> => {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  } catch {
    return false;
  }
  try {
    await page.locator(videoSelector).first().waitFor({ state: 'attached', timeout: 30_000 });
  } catch {
    return false;
  }
  return true;
};

const splitViewState = (page: Page) =>
  page.evaluate(() => {
    const wrapper = document.querySelector('[data-cell-split-view="wrapper"]');
    const panel = document.querySelector('[data-cell-split-view="panel"]');
    const video = document.querySelector('video');
    const vr = video?.getBoundingClientRect();
    const pr = panel?.getBoundingClientRect();
    const wr = wrapper?.getBoundingClientRect();
    return {
      wrappers: document.querySelectorAll('[data-cell-split-view="wrapper"]').length,
      panels: document.querySelectorAll('[data-cell-split-view="panel"]').length,
      handles: document.querySelectorAll('[data-cell-split-view="handle"]').length,
      total: document.querySelectorAll('[data-cell-split-view]').length,
      video: vr ? { w: Math.round(vr.width), h: Math.round(vr.height) } : null,
      panel: pr ? { w: Math.round(pr.width), h: Math.round(pr.height) } : null,
      wrapper: wr ? { w: Math.round(wr.width), h: Math.round(wr.height) } : null,
      fullscreen: !!document.fullscreenElement,
    };
  });

test.describe('Stage 2: Split View on real sites', () => {
  test.setTimeout(180_000);

  test('SV-62R: kisskh — split view keeps video + sibling columns rendered', async ({
    cellContext,
  }) => {
    const page = await cellContext.newPage();
    try {
      const loaded = await gotoOrSkip(page, KISSKH_URL);
      test.skip(!loaded, 'kisskh unreachable or anti-bot blocked (no <video> within 30s)');

      await page.waitForSelector('#cell-subtitle-root', { state: 'attached', timeout: 30_000 });
      await page.waitForTimeout(1500);

      // Sibling footprint before split view (kisskh uses a flex row: video col
      // + drama info col — the regression this regression guards).
      const before = await page.evaluate(() => {
        const video = document.querySelector('video');
        const shell = video?.closest('div');
        return { w: shell?.getBoundingClientRect().width ?? 0 };
      });

      await page.keyboard.press('t');
      await page.locator(WRAPPER).waitFor({ state: 'visible', timeout: 15_000 });
      await page.waitForTimeout(1000);

      const state = await splitViewState(page);
      expect(state.wrappers).toBe(1);
      expect(state.video!.h).toBeGreaterThan(0);
      expect(state.panel!.w).toBeGreaterThan(0);
      // Wrapper should not take the whole row when siblings exist — panel
      // + video share the original column footprint.
      expect(state.wrapper!.w).toBeLessThanOrEqual(Math.max(before.w + 20, 320));

      await page.keyboard.press('t');
      await page.waitForTimeout(1500);
      const closed = await splitViewState(page);
      expect(closed.total).toBe(0);
    } finally {
      await page.close();
    }
  });

  test('SV-20R: youtube — split view survives native fullscreen enter+exit', async ({
    cellContext,
  }) => {
    const page = await cellContext.newPage();
    try {
      const loaded = await gotoOrSkip(page, YOUTUBE_URL, 'video.html5-main-video');
      test.skip(!loaded, 'youtube unreachable or consent wall blocked (no video within 30s)');

      // Dismiss consent if present, then wait for the content script.
      const consent = page.locator('button:has-text("Accept all"), button:has-text("I agree")');
      if (await consent.first().isVisible().catch(() => false)) {
        await consent.first().click().catch(() => undefined);
        await page.waitForLoadState('domcontentloaded');
      }
      await page.waitForSelector('#cell-subtitle-root', { state: 'attached', timeout: 30_000 });
      await page.waitForTimeout(2000);

      await page.keyboard.press('t');
      await page.locator(WRAPPER).waitFor({ state: 'visible', timeout: 15_000 });
      await page.waitForTimeout(1000);

      const opened = await splitViewState(page);
      expect(opened.wrappers).toBe(1);
      expect(opened.video!.h).toBeGreaterThan(0);

      // Enter native fullscreen on the movie player.
      await page.evaluate(() => {
        const shell = document.getElementById('movie_player') ?? document.querySelector('video')?.parentElement;
        return (shell as HTMLElement | undefined)?.requestFullscreen();
      });
      await page.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 8_000 });
      // Auto-close + settle + auto-reopen inside the fs element.
      await page.waitForFunction(
        () => !!document.fullscreenElement?.querySelector('[data-cell-split-view="panel"]'),
        null,
        { timeout: 15_000 },
      );
      const inFs = await splitViewState(page);
      expect(inFs.panels).toBe(1);

      await page.evaluate(() => document.exitFullscreen());
      await page.waitForFunction(() => !document.fullscreenElement, null, { timeout: 8_000 });
      await page.waitForTimeout(2500);

      const afterFs = await splitViewState(page);
      expect(afterFs.wrappers).toBe(1);
      expect(afterFs.video!.h).toBeGreaterThan(0);
    } finally {
      await page.close();
    }
  });

  test('SV-61R: themoviebox — broad shell keeps resources panel; close restores', async ({
    cellContext,
  }) => {
    const page = await cellContext.newPage();
    try {
      const loaded = await gotoOrSkip(page, THEMOVIEBOX_URL);
      test.skip(!loaded, 'themoviebox unreachable or blocked (no <video> within 30s)');

      await page.waitForSelector('#cell-subtitle-root', { state: 'attached', timeout: 30_000 });
      await page.waitForTimeout(1500);

      await page.keyboard.press('t');
      await page.locator(WRAPPER).waitFor({ state: 'visible', timeout: 15_000 });
      await page.waitForTimeout(1000);

      const state = await splitViewState(page);
      expect(state.wrappers).toBe(1);
      expect(state.video!.h).toBeGreaterThan(0);
      expect(state.panel!.h).toBeGreaterThan(0);

      await page.keyboard.press('t');
      await page.waitForTimeout(1500);
      const closed = await splitViewState(page);
      expect(closed.total).toBe(0);
      expect(closed.video!.h).toBeGreaterThan(0);
    } finally {
      await page.close();
    }
  });
});
