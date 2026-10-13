import { expect, type BrowserContext, type Page } from '@playwright/test';
import { test } from '../fixtures/TihokaEnvironment.fixture';

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
    const subtitleRoot = document.getElementById('Tihoka-subtitle-root')?.shadowRoot;
    let element: Element | null | undefined;
    if (scope === 'web') {
      element = Array.from(document.querySelectorAll('.js-Tihoka-token[data-tihoka-term]'))
        .find((candidate) => candidate.getAttribute('data-tihoka-term') === term && !candidate.closest('#Tihoka-subtitle-root'));
    } else if (scope === 'overlay') {
      element = subtitleRoot?.querySelector(`[data-role="target"] .js-Tihoka-token[data-tihoka-term="${term}"]`);
    } else {
      element = subtitleRoot?.querySelector(`[data-tihoka-id="cue-item"][data-current="true"] .js-Tihoka-token[data-tihoka-term="${term}"]`);
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
  expect(state?.className).toContain(`js-Tihoka-token--status-${status}`);
  expect(state?.rect.width).toBeGreaterThan(0);
  expect(state?.rect.height).toBeGreaterThan(0);
  expect(state?.boxShadow).toContain('inset');
  expect(state?.boxShadow).toContain('-2px');
}

async function setOverlayTermStatus(page: Page, term: string, key: string, status: string): Promise<void> {
  await expect.poll(async () => tokenState(page, 'overlay', term), { timeout: 30_000 }).not.toBeNull();
  await page.evaluate((term) => {
    const token = document.getElementById('Tihoka-subtitle-root')
      ?.shadowRoot
      ?.querySelector(`[data-role="target"] .js-Tihoka-token[data-tihoka-term="${term}"]`);
    token?.dispatchEvent(new MouseEvent('mouseenter'));
  }, term);
  await page.keyboard.press(key);
  await expect.poll(
    async () => (await tokenState(page, 'overlay', term))?.className ?? '',
    { timeout: 30_000 },
  ).toContain(`js-Tihoka-token--status-${status}`);
}

test.describe('status underline', () => {
  test('keeps known and ignored word underlines on web, overlay, and cue list', async ({ TihokaContext, streamFlixPage }) => {
    await writeTokenizeSettings(TihokaContext);
    await streamFlixPage.reload({ waitUntil: 'networkidle' });
    await expect(streamFlixPage.locator('#player-wrapper video').first()).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => streamFlixPage.locator('.js-Tihoka-token[data-tihoka-term="the"]').count()).toBeGreaterThan(0);
    await expect.poll(async () => streamFlixPage.locator('.js-Tihoka-token[data-tihoka-term="at"]').count()).toBeGreaterThan(0);

    const video = streamFlixPage.locator('#player-wrapper video').first();
    await video.evaluate((v: HTMLVideoElement) => {
      v.muted = true;
      v.playbackRate = 0.5;
      v.currentTime = 20.6;
      void v.play();
    });
    const targetLine = streamFlixPage.locator('[data-tihoka-id="subtitle-block"] [data-role="target"] span').first();
    await expect(targetLine).toContainText(/silence/i, { timeout: 30_000 });
    await video.evaluate((v: HTMLVideoElement) => {
      v.currentTime = 43;
    });
    await expect(targetLine).toContainText(/end/i, { timeout: 30_000 });

    await expect.poll(async () => streamFlixPage.evaluate(() => {
      const button = document.getElementById('Tihoka-subtitle-root')?.shadowRoot?.querySelector<HTMLElement>('[data-tihoka-id="player-mode-btn"]');
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
        await expect.poll(async () => (await tokenState(streamFlixPage, scope, term))?.className ?? '').toContain(`js-Tihoka-token--status-${status}`);
        expectStatusUnderline(await tokenState(streamFlixPage, scope, term), status);
      }
    }
    await video.evaluate((v: HTMLVideoElement) => v.pause());
  });

  test('native text selection outranks the hovered token on web tokens', async ({ TihokaContext, streamFlixPage }) => {
    await writeTokenizeSettings(TihokaContext);
    await streamFlixPage.reload({ waitUntil: 'networkidle' });
    await expect(streamFlixPage.locator('#player-wrapper video').first()).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => streamFlixPage.locator('.js-Tihoka-token[data-tihoka-term="the"]').count()).toBeGreaterThan(0);
    await expect.poll(async () => streamFlixPage.locator('.js-Tihoka-token[data-tihoka-term="first"]').count()).toBeGreaterThan(0);

    const description = streamFlixPage.locator('.js-Tihoka-token[data-tihoka-term="humanity"]').first();
    await description.scrollIntoViewIfNeeded();

    const dragBounds = await streamFlixPage.evaluate(() => {
      const tokens = Array.from(document.querySelectorAll('.js-Tihoka-token[data-tihoka-term]'))
        .filter((el) => !el.closest('#Tihoka-subtitle-root'));
      const first = tokens.find((el) => el.getAttribute('data-tihoka-term') === 'humanity');
      const last = tokens.find((el) => el.getAttribute('data-tihoka-term') === 'first');
      const hovered = tokens.find((el) => el.getAttribute('data-tihoka-term') === 'gates');
      if (!first || !last || !hovered) return null;
      if ((first.compareDocumentPosition(last) & Node.DOCUMENT_POSITION_FOLLOWING) === 0) {
        return null;
      }
      hovered.dispatchEvent(new MouseEvent('mouseenter'));
      const a = first.getBoundingClientRect();
      const b = last.getBoundingClientRect();
      return {
        from: { x: a.left + 1, y: a.top + a.height / 2 },
        to: { x: b.left + b.width * 0.6, y: b.top + b.height / 2 },
      };
    });
    if (!dragBounds) throw new Error('token bounds not found');
    await streamFlixPage.mouse.move(dragBounds.from.x, dragBounds.from.y);
    await streamFlixPage.mouse.down();
    await streamFlixPage.mouse.move(dragBounds.to.x, dragBounds.to.y, { steps: 12 });
    await streamFlixPage.mouse.up();
    await expect.poll(async () => streamFlixPage.evaluate(() => window.getSelection()?.toString() ?? ''), { timeout: 10_000 }).toMatch(/humanity/i);
    await expect.poll(async () => streamFlixPage.evaluate(() => window.getSelection()?.toString() ?? '')).not.toContain('gates');

    await streamFlixPage.keyboard.press('2');

    for (const term of ['humanity', 'first']) {
      await expect.poll(
        async () => (await tokenState(streamFlixPage, 'web', term))?.className ?? '',
        { timeout: 30_000 },
      ).toContain('js-Tihoka-token--status-tracking');
      expectStatusUnderline(await tokenState(streamFlixPage, 'web', term), 'tracking');
    }
    await expect.poll(
      async () => (await tokenState(streamFlixPage, 'web', 'gates'))?.className ?? '',
    ).not.toContain('js-Tihoka-token--status-tracking');
  });
});
