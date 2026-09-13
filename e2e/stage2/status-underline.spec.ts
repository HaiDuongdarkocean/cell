import { expect, type BrowserContext, type Page } from '@playwright/test';
import { test } from '../fixtures/cellEnvironment.fixture';

const STREAMFLIX_KEYS = [
  'http://127.0.0.1:4321/',
  'http://127.0.0.1:4321/index.html',
] as const;

type TokenScope = 'web' | 'overlay' | 'cue';
type TokenState = {
  className: string;
  boxShadow: string;
  rect: { width: number; height: number };
} | null;

async function writeTokenizeSettings(context: BrowserContext): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate((keys: readonly string[]) => {
    const urls: Record<string, boolean> = {};
    const subtitleUrls: Record<string, boolean> = {};
    for (const key of keys) {
      urls[key] = true;
      subtitleUrls[key] = true;
    }
    return new Promise<void>((resolve, reject) => {
      chrome.storage.local.set({
        settings: { schemaVersion: 29, subtitleOverlayTargetLanguage: 'en' },
        tokenizeSettings: { schemaVersion: 1, origins: {}, urls, subtitleUrls },
      }, () => {
        if (chrome.runtime.lastError) reject(new Error(String(chrome.runtime.lastError.message)));
        else resolve();
      });
    });
  }, STREAMFLIX_KEYS);
}

async function tokenState(page: Page, scope: TokenScope, term: string): Promise<TokenState> {
  return page.evaluate(({ scope, term }) => {
    const subtitleRoot = document.getElementById('cell-subtitle-root')?.shadowRoot;
    let element: Element | null | undefined;
    if (scope === 'web') {
      element = Array.from(document.querySelectorAll('.js-cell-token[data-cell-term]'))
        .find((candidate) => candidate.getAttribute('data-cell-term') === term && !candidate.closest('#cell-subtitle-root'));
    } else if (scope === 'overlay') {
      element = subtitleRoot?.querySelector(`[data-role="target"] .js-cell-token[data-cell-term="${term}"]`);
    } else {
      element = subtitleRoot?.querySelector(`[data-cell-id="cue-item"][data-current="true"] .js-cell-token[data-cell-term="${term}"]`);
    }
    if (!element) return null;
    const style = getComputedStyle(element as HTMLElement);
    const rect = element.getBoundingClientRect();
    return {
      className: (element as HTMLElement).className,
      boxShadow: style.boxShadow,
      rect: { width: rect.width, height: rect.height },
    };
  }, { scope, term });
}

function expectStatusUnderline(state: TokenState, status: string): void {
  expect(state).not.toBeNull();
  expect(state?.className).toContain(`js-cell-token--status-${status}`);
  expect(state?.rect.width).toBeGreaterThan(0);
  expect(state?.rect.height).toBeGreaterThan(0);
  expect(state?.boxShadow).toContain('inset');
  expect(state?.boxShadow).toContain('-2px');
}

async function setOverlayTermStatus(page: Page, term: string, key: string, status: string): Promise<void> {
  await expect.poll(async () => tokenState(page, 'overlay', term), { timeout: 30_000 }).not.toBeNull();
  await page.evaluate((term) => {
    const token = document.getElementById('cell-subtitle-root')
      ?.shadowRoot
      ?.querySelector(`[data-role="target"] .js-cell-token[data-cell-term="${term}"]`);
    token?.dispatchEvent(new MouseEvent('mouseenter'));
  }, term);
  await page.keyboard.press(key);
  await expect.poll(
    async () => (await tokenState(page, 'overlay', term))?.className ?? '',
    { timeout: 30_000 },
  ).toContain(`js-cell-token--status-${status}`);
}

test.describe('status underline', () => {
  test('keeps known and ignored word underlines on web, overlay, and cue list', async ({ cellContext, streamFlixPage }) => {
    await writeTokenizeSettings(cellContext);
    await streamFlixPage.reload({ waitUntil: 'networkidle' });
    await expect(streamFlixPage.locator('#player-wrapper video').first()).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => streamFlixPage.locator('.js-cell-token[data-cell-term="the"]').count()).toBeGreaterThan(0);
    await expect.poll(async () => streamFlixPage.locator('.js-cell-token[data-cell-term="at"]').count()).toBeGreaterThan(0);

    const video = streamFlixPage.locator('#player-wrapper video').first();
    await video.evaluate((v: HTMLVideoElement) => {
      v.muted = true;
      v.playbackRate = 0.5;
      v.currentTime = 20.6;
      void v.play();
    });
    const targetLine = streamFlixPage.locator('[data-cell-id="subtitle-block"] [data-role="target"] span').first();
    await expect(targetLine).toContainText(/silence/i, { timeout: 30_000 });
    await video.evaluate((v: HTMLVideoElement) => {
      v.currentTime = 43;
    });
    await expect(targetLine).toContainText(/end/i, { timeout: 30_000 });

    await expect.poll(async () => streamFlixPage.evaluate(() => {
      const button = document.getElementById('cell-subtitle-root')?.shadowRoot?.querySelector<HTMLElement>('[data-cell-id="player-mode-btn"]');
      if (!button) return false;
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
      return true;
    })).toBe(true);
    await expect.poll(async () => tokenState(streamFlixPage, 'cue', 'the')).not.toBeNull();
    await expect.poll(async () => tokenState(streamFlixPage, 'cue', 'at')).not.toBeNull();

    await setOverlayTermStatus(streamFlixPage, 'the', '3', 'known');
    await setOverlayTermStatus(streamFlixPage, 'at', '4', 'ignore');

    for (const [term, status] of [['the', 'known'], ['at', 'ignore']] as const) {
      for (const scope of ['web', 'overlay', 'cue'] as const) {
        await expect.poll(async () => (await tokenState(streamFlixPage, scope, term))?.className ?? '').toContain(`js-cell-token--status-${status}`);
        expectStatusUnderline(await tokenState(streamFlixPage, scope, term), status);
      }
    }
    await video.evaluate((v: HTMLVideoElement) => v.pause());
  });
});
