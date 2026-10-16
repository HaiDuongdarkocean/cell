import { expect, type BrowserContext, type Page } from '@playwright/test';
import { test } from '../fixtures/TihokaEnvironment.fixture';

const WIKI_URL = 'https://en.wikipedia.org/wiki/Hello_(Adele_song)';

/** Enable web tokenize for the wikipedia origin + page, with IPA readings on
 *  (the reported bug env). Fresh profile = no dictionary loaded — exactly the
 *  condition under which the fused-term bug was reported. */
async function enableWebTokenize(context: BrowserContext, url: string): Promise<void> {
  // A page must exist for the MV3 service worker to spin up reliably.
  if (!context.pages()[0]) await context.newPage();
  await expect
    .poll(() => context.serviceWorkers().length, { timeout: 30_000 })
    .toBeGreaterThan(0);
  const worker = context.serviceWorkers()[0]!;
  await worker.evaluate((pageUrl) => {
    const u = new URL(pageUrl);
    const pageKey = `${u.origin}${u.pathname}`;
    return new Promise<void>((resolve, reject) => {
      chrome.storage.local.set({
        settings: {
          schemaVersion: 43,
          subtitleOverlayTargetLanguage: 'en',
          readingDisplay: 'always',
        },
        tokenizeSettings: {
          schemaVersion: 1,
          origins: { [u.origin]: true },
          urls: { [pageKey]: true },
          subtitleOrigins: {},
          subtitleUrls: {},
        },
      }, () => {
        if (chrome.runtime.lastError) reject(new Error(String(chrome.runtime.lastError.message)));
        else resolve();
      });
    });
  }, url);
}

/** The "song" token whose next word token is "recorded" — the reported pair.
 *  Returns word-lane rects of both tokens. */
async function songRecordedRects(
  page: Page,
): Promise<{ song: DOMRect; recorded: DOMRect } | null> {
  return page.evaluate(() => {
    for (const span of Array.from(
      document.querySelectorAll<HTMLElement>('.js-Tihoka-token--word[data-tihoka-term="song"]'),
    )) {
      let sib = span.nextElementSibling;
      while (sib?.classList.contains('js-Tihoka-token--separator')) sib = sib.nextElementSibling;
      if ((sib as HTMLElement | null)?.getAttribute('data-tihoka-term') !== 'recorded') continue;
      const lane = (el: Element) =>
        (el.querySelector<HTMLElement>('.js-Tihoka-token-word') ?? el).getBoundingClientRect();
      return { song: lane(span).toJSON(), recorded: lane(sib!).toJSON() };
    }
    return null;
  });
}

/** Text of the popup's header term — pierces the popup shadow root. */
async function popupTerm(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    for (const host of Array.from(document.querySelectorAll<HTMLElement>('.js-Tihoka-popup-host'))) {
      const el = host.shadowRoot?.querySelector<HTMLElement>('[data-tihoka-id="dictionary-term"]');
      if (el) return el.textContent;
    }
    return null;
  });
}

async function waitPopupSettled(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          for (const host of Array.from(
            document.querySelectorAll<HTMLElement>('.js-Tihoka-popup-host'),
          )) {
            if (
              host.shadowRoot?.querySelector(
                '[data-tihoka-id="dictionary-definitions-empty"], [data-tihoka-id="dictionary-definitions"]',
              )
            ) {
              return true;
            }
          }
          return false;
        }),
      { timeout: 30_000 },
    )
    .toBe(true);
}

async function openArticle(context: BrowserContext): Promise<Page | null> {
  const page = await context.newPage();
  try {
    await page.goto(WIKI_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  } catch {
    await page.close();
    return null;
  }
  // Blocks bind lazily via IntersectionObserver — wait for the article body,
  // not just any token (nav jump-links bind first).
  const bound = await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.querySelectorAll('.js-Tihoka-token--word[data-tihoka-term="recorded"]')
              .length,
        ),
      { timeout: 60_000, intervals: [500, 1000, 2000] },
    )
    .toBeGreaterThan(0)
    .then(() => true)
    .catch(() => false);
  if (!bound) {
    await page.close();
    return null;
  }
  return page;
}

test.describe('Stage 2: Web Tokenize on Wikipedia', () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ TihokaContext }) => {
    await enableWebTokenize(TihokaContext, WIKI_URL);
  });

  test('clicking "song" shows term "song" in the popup — not fused with the next word', async ({
    TihokaContext,
  }) => {
    const page = await openArticle(TihokaContext);
    test.skip(!page, 'wikipedia unreachable or article never tokenized');
    try {
      const rects = await songRecordedRects(page!);
      test.skip(!rects, 'no "song recorded" token pair found');

      await page!.mouse.click(
        rects!.song.left + rects!.song.width / 2,
        rects!.song.top + rects!.song.height / 2,
      );
      await waitPopupSettled(page!);
      expect(await popupTerm(page!)).toBe('song');
    } finally {
      await page!.close();
    }
  });

  test('selection over "song recorded" keeps the whitespace between tokens', async ({
    TihokaContext,
  }) => {
    const page = await openArticle(TihokaContext);
    test.skip(!page, 'wikipedia unreachable or article never tokenized');
    try {
      const rects = await songRecordedRects(page!);
      test.skip(!rects, 'no "song recorded" token pair found');

      // Selection.toString across inline-flex token columns serializes each
      // column as its own line — the separator text must still appear.
      const selected = await page!.evaluate(() => {
        const songs = Array.from(
          document.querySelectorAll<HTMLElement>(
            '.js-Tihoka-token--word[data-tihoka-term="song"]',
          ),
        );
        for (const song of songs) {
          let sib = song.nextElementSibling;
          while (sib?.classList.contains('js-Tihoka-token--separator')) {
            sib = sib.nextElementSibling;
          }
          if ((sib as HTMLElement | null)?.getAttribute('data-tihoka-term') !== 'recorded') {
            continue;
          }
          const range = document.createRange();
          range.setStartBefore(song);
          range.setEndAfter(sib!);
          const sel = window.getSelection()!;
          sel.removeAllRanges();
          sel.addRange(range);
          const text = sel.toString();
          sel.removeAllRanges();
          return text;
        }
        return null;
      });

      expect(selected).not.toBeNull();
      expect(selected!.replace(/\s+/g, ' ').trim()).toBe('song recorded');
    } finally {
      await page!.close();
    }
  });
});
