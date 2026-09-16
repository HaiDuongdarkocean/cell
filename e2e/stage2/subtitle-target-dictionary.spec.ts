import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '../fixtures/cellEnvironment.fixture';

const WORD_RE = /[A-Za-zÀ-ɏ']+/;

async function wordPoint(locator: Locator): Promise<{ x: number; y: number } | null> {
  return locator.evaluate((el, wordReSource) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const re = new RegExp(wordReSource);
    let node: Text | null = null;
    while ((node = walker.nextNode() as Text | null)) {
      const match = re.exec(node.textContent ?? '');
      if (!match) continue;
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return null;
  }, WORD_RE.source);
}

async function clickFirstWordAcross(page: Page, locators: Locator): Promise<void> {
  const count = await locators.count();
  for (let i = 0; i < count; i++) {
    const point = await wordPoint(locators.nth(i));
    if (!point) continue;
    await page.mouse.click(point.x, point.y);
    return;
  }
  throw new Error('No cue text with a clickable word found');
}

test.describe('Stage 2: Dictionary lookup on subtitle target text', () => {
  test('click a target word in the Player Mode cue list opens the dictionary popup', async ({ streamFlixPage }) => {
    await streamFlixPage.keyboard.press('g');

    const cueTexts = streamFlixPage.locator('[data-cell-id="cue-target-text"]');
    await expect(cueTexts.first()).toBeVisible({ timeout: 15_000 });

    await clickFirstWordAcross(streamFlixPage, cueTexts);

    const popup = streamFlixPage.locator('.js-cell-popup-host');
    await expect(popup).toBeAttached({ timeout: 10_000 });
  });

  test('click a target word on the video overlay line opens the dictionary popup', async ({ streamFlixPage }) => {
    const video = streamFlixPage.locator('#player-wrapper video').first();
    // Play from inside cue 2 ("LYIN' ISN'T BETTER THAN SILENCE") — paused
    // playback keeps the mock player's center controls over the subtitle text.
    await video.evaluate((v: HTMLVideoElement) => {
      v.currentTime = 21;
      void v.play();
    });

    const targetLayer = streamFlixPage.locator('[data-cell-id="subtitle-block"] [data-role="target"]').first();
    await expect(targetLayer).toBeVisible({ timeout: 15_000 });
    const targetLine = targetLayer.locator('span').first();
    await expect(targetLine).toContainText(/[A-Za-z]/, { timeout: 15_000 });

    // Mock controls auto-hide ~3s into playback; wait them out before clicking.
    await streamFlixPage.waitForTimeout(3400);

    const point = await wordPoint(targetLine);
    expect(point).not.toBeNull();
    await streamFlixPage.mouse.click(point!.x, point!.y);

    const popup = streamFlixPage.locator('.js-cell-popup-host');
    await expect(popup).toBeAttached({ timeout: 10_000 });
    expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  });
});
