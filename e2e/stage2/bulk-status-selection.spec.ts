import { expect, type BrowserContext, type Page } from '@playwright/test';
import { test } from '../fixtures/cellEnvironment.fixture';

const STREAMFLIX_PORT = 4321 + parseInt(process.env.PW_PORT_OFFSET || '0', 10);
const STREAMFLIX_KEYS = [
  `http://127.0.0.1:${STREAMFLIX_PORT}/`,
  `http://127.0.0.1:${STREAMFLIX_PORT}/index.html`,
] as const;

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

async function overlayTerms(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(
      document.getElementById('cell-subtitle-root')
        ?.shadowRoot
        ?.querySelectorAll('[data-role="target"] .js-cell-token--word[data-cell-term]') ?? [],
    ).map((el) => el.getAttribute('data-cell-term') ?? ''),
  );
}

async function overlayTokenClass(page: Page, term: string): Promise<string | null> {
  return page.evaluate((t) => {
    const el = document.getElementById('cell-subtitle-root')
      ?.shadowRoot
      ?.querySelector(`[data-role="target"] .js-cell-token[data-cell-term="${t}"]`);
    return el ? (el as HTMLElement).className : null;
  }, term);
}

async function selectOverlayText(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const line = document.getElementById('cell-subtitle-root')
      ?.shadowRoot
      ?.querySelector('[data-role="target"] span');
    if (!line || !line.firstChild) return false;
    const range = document.createRange();
    range.selectNodeContents(line);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    return !sel.isCollapsed;
  });
}

async function panelWordTerms(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(
      document.querySelector('[data-cell-split-view="panel"]')
        ?.shadowRoot
        ?.querySelectorAll('[data-cell-id="cue-target-text"] .js-cell-token--word[data-cell-term]') ?? [],
    ).map((el) => el.getAttribute('data-cell-term') ?? ''),
  );
}

async function selectPanelCueWithWords(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const cues = Array.from(
      document.querySelector('[data-cell-split-view="panel"]')
        ?.shadowRoot
        ?.querySelectorAll('[data-cell-id="cue-target-text"]') ?? [],
    );
    const cue = cues.find((el) => el.querySelector('.js-cell-token--word[data-cell-term]'));
    if (!cue || !cue.firstChild) return [];
    const terms = Array.from(cue.querySelectorAll('.js-cell-token--word[data-cell-term]'))
      .map((el) => el.getAttribute('data-cell-term') ?? '');
    const range = document.createRange();
    range.selectNodeContents(cue);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    return sel.isCollapsed ? [] : terms;
  });
}

async function panelWordPoint(page: Page, term: string): Promise<{ x: number; y: number } | null> {
  return page.evaluate((t) => {
    const el = document
      .querySelector('[data-cell-split-view="panel"]')
      ?.shadowRoot?.querySelector(`.js-cell-token--word[data-cell-term="${t}"]`);
    if (!el) return null;
    const rect = (el as HTMLElement).getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, term);
}

async function panelTokenClasses(page: Page, term: string): Promise<string[]> {
  return page.evaluate(
    (t) =>
      Array.from(
        document.querySelector('[data-cell-split-view="panel"]')
          ?.shadowRoot
          ?.querySelectorAll(`.js-cell-token--word[data-cell-term="${t}"]`) ?? [],
      ).map((el) => (el as HTMLElement).className),
    term,
  );
}

async function prepareVideo(page: Page): Promise<void> {
  const video = page.locator('#player-wrapper video').first();
  await expect(video).toBeVisible({ timeout: 30_000 });
  await video.evaluate((v: HTMLVideoElement) => {
    v.muted = true;
    v.currentTime = 20.6;
    void v.play();
  });
  await expect.poll(async () => (await overlayTerms(page)).length, { timeout: 30_000 }).toBeGreaterThan(1);
  await video.evaluate((v: HTMLVideoElement) => v.pause());
}

test.describe('bulk status via selection', () => {
  test('selecting subtitle overlay tokens + status key updates them', async ({ cellContext, streamFlixPage }) => {
    await writeTokenizeSettings(cellContext);
    await streamFlixPage.reload({ waitUntil: 'networkidle' });
    await prepareVideo(streamFlixPage);

    const terms = await overlayTerms(streamFlixPage);
    expect(terms.length).toBeGreaterThan(1);
    expect(await selectOverlayText(streamFlixPage)).toBe(true);

    await streamFlixPage.keyboard.press('2');

    for (const term of terms) {
      await expect.poll(
        async () => (await overlayTokenClass(streamFlixPage, term)) ?? '',
        { timeout: 15_000 },
      ).toContain('js-cell-token--status-tracking');
    }
  });

  test('selecting split-view panel cue tokens + status key updates them', async ({ cellContext, streamFlixPage }) => {
    await writeTokenizeSettings(cellContext);
    await streamFlixPage.reload({ waitUntil: 'networkidle' });
    await prepareVideo(streamFlixPage);

    await streamFlixPage.keyboard.press('t');
    await expect.poll(async () => (await panelWordTerms(streamFlixPage)).length, { timeout: 30_000 }).toBeGreaterThan(0);

    const terms = await selectPanelCueWithWords(streamFlixPage);
    expect(terms.length).toBeGreaterThan(0);

    await streamFlixPage.keyboard.press('3');

    for (const term of terms) {
      await expect.poll(
        async () => {
          const classes = await panelTokenClasses(streamFlixPage, term);
          return classes.length > 0 && classes.every((c) => c.includes('js-cell-token--status-known'));
        },
        { timeout: 15_000 },
      ).toBe(true);
    }

    expect(await streamFlixPage.evaluate(() => window.getSelection()?.isCollapsed ?? true)).toBe(true);
  });

  test('hovering a split-view panel token + status key updates that word', async ({ cellContext, streamFlixPage }) => {
    await writeTokenizeSettings(cellContext);
    await streamFlixPage.reload({ waitUntil: 'networkidle' });
    await prepareVideo(streamFlixPage);

    await streamFlixPage.keyboard.press('t');
    await expect.poll(async () => (await panelWordTerms(streamFlixPage)).length, { timeout: 30_000 }).toBeGreaterThan(0);

    const term = (await panelWordTerms(streamFlixPage)).find((t) => t.length > 0);
    expect(term).toBeTruthy();

    const point = await panelWordPoint(streamFlixPage, term!);
    expect(point).not.toBeNull();
    await streamFlixPage.mouse.move(point!.x, point!.y);

    await streamFlixPage.keyboard.press('3');

    await expect.poll(
      async () => {
        const classes = await panelTokenClasses(streamFlixPage, term!);
        return classes.length > 0 && classes.every((c) => c.includes('js-cell-token--status-known'));
      },
      { timeout: 15_000 },
    ).toBe(true);
  });
});
