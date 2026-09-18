import { expect, type Locator, type Page } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';
import { test } from '../fixtures/cellEnvironment.fixture';

const STREAMFLIX_PORT = 4321 + parseInt(process.env.PW_PORT_OFFSET || '0', 10);
const STREAMFLIX_KEYS = [
  `http://127.0.0.1:${STREAMFLIX_PORT}/`,
  `http://127.0.0.1:${STREAMFLIX_PORT}/index.html`,
] as const;
const DB_SCHEMA_VERSION = 11;
const WORD_RE = /[A-Za-zÀ-ɏ']+/;

/**
 * Contract:
 *   1. Split-view cue tokens render their frequency band class + pill
 *      background instead of the hardcoded frequency-off layer.
 *   2. The FAB i+1 mode matches a cue whose single non-known word has
 *      `tracking` status (not only `unknown`).
 *   3. While a dictionary popup shows a result, keys 1-4 set the looked-up
 *      word's status (unknown/tracking/known/ignore) and repaint its tokens.
 */

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

/** Seed one DICTIONARY resource + entries into the extension's IndexedDB so a
 *  live lookup resolves real definitions. Mirrors dictionary-nested-popup. */
async function seedDictionary(
  context: BrowserContext,
  langCode: string,
  entries: ReadonlyArray<{ term: string; definition: string; pos?: string }>,
): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(
    async (args: { lang: string; version: number; entries: ReadonlyArray<{ term: string; definition: string; pos?: string }> }) => {
      const storage = await chrome.storage.local.get('orca');
      const hash = (storage?.orca as Record<string, unknown> | undefined)?.dbHash;
      const dbName = `orca-dict-${typeof hash === 'string' && hash.length === 8 ? hash : 'devmode0'}-${args.lang}`;
      const reverse = (s: string): string => s.split('').reverse().join('');

      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(dbName, args.version);
        req.onupgradeneeded = () => {
          const d = req.result;
          if (!d.objectStoreNames.contains('langResourceInfo')) {
            const s = d.createObjectStore('langResourceInfo', { keyPath: 'id', autoIncrement: true });
            s.createIndex('by_signature', 'signature', { unique: false });
            s.createIndex('by_type', 'type', { unique: false });
            s.createIndex('by_order', 'importedAt', { unique: false });
          }
          if (!d.objectStoreNames.contains('langFrequencyEntry')) {
            const s = d.createObjectStore('langFrequencyEntry', { keyPath: 'id', autoIncrement: true });
            s.createIndex('by_resource', 'resourceId', { unique: false });
            s.createIndex('by_term', 'term', { unique: false });
            s.createIndex('by_backwardTerm', 'backwardTerm', { unique: false });
          }
          if (!d.objectStoreNames.contains('langDictionaryEntry')) {
            const s = d.createObjectStore('langDictionaryEntry', { keyPath: 'id', autoIncrement: true });
            s.createIndex('by_resource', 'resourceId', { unique: false });
            s.createIndex('by_term', 'term', { unique: false });
            s.createIndex('by_backwardTerm', 'backwardTerm', { unique: false });
          }
          if (!d.objectStoreNames.contains('langPhraseIndex')) {
            const s = d.createObjectStore('langPhraseIndex', { keyPath: 'resourceId' });
            s.createIndex('by_resource', 'resourceId', { unique: false });
          }
          if (!d.objectStoreNames.contains('langWordStatus')) {
            const s = d.createObjectStore('langWordStatus', { keyPath: 'term' });
            s.createIndex('by_status', 'status', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('IndexedDB open blocked'));
      });

      const tx = db.transaction(['langResourceInfo', 'langDictionaryEntry'], 'readwrite');
      const resourceStore = tx.objectStore('langResourceInfo');
      const dictStore = tx.objectStore('langDictionaryEntry');
      const resourceId = await new Promise<number>((resolve, reject) => {
        const req = resourceStore.add({
          name: 'e2e-seed',
          langCode: args.lang,
          type: 'DICTIONARY',
          format: 'json-array',
          signature: `e2e-seed-${Date.now()}`,
          wordCount: args.entries.length,
          installationFinished: true,
          importedAt: Date.now(),
        });
        req.onsuccess = () => resolve(req.result as number);
        req.onerror = () => reject(req.error);
      });
      for (const e of args.entries) {
        dictStore.add({
          resourceId,
          term: e.term,
          reading: '',
          altterm: '',
          pronunciation: '',
          definition: e.definition,
          pos: e.pos ?? '',
          examples: '',
          audio: '',
          backwardTerm: reverse(e.term),
        });
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
    },
    { lang: langCode, version: DB_SCHEMA_VERSION, entries },
  );
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

async function panelWordTerms(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(
      document.querySelector('[data-cell-split-view="panel"]')
        ?.shadowRoot
        ?.querySelectorAll('[data-cell-id="cue-target-text"] .js-cell-token--word[data-cell-term]') ?? [],
    ).map((el) => el.getAttribute('data-cell-term') ?? ''),
  );
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
  await expect
    .poll(async () => (await overlayTerms(page)).length, { timeout: 30_000 })
    .toBeGreaterThan(1);
  await video.evaluate((v: HTMLVideoElement) => v.pause());
}

/** Select every word token of the first cue whose target text has ≥2 word
 *  tokens; returns the cue's data-cue-index and its term list. */
async function selectFirstPanelCue(
  page: Page,
): Promise<{ cueIndex: string; terms: string[] } | null> {
  return page.evaluate(() => {
    const cues = Array.from(
      document.querySelector('[data-cell-split-view="panel"]')
        ?.shadowRoot
        ?.querySelectorAll('[data-cell-id="cue-target-text"]') ?? [],
    );
    const cue = cues.find(
      (el) => el.querySelectorAll('.js-cell-token--word[data-cell-term]').length >= 2,
    );
    if (!cue || !cue.firstChild) return null;
    const terms = Array.from(cue.querySelectorAll('.js-cell-token--word[data-cell-term]'))
      .map((el) => el.getAttribute('data-cell-term') ?? '');
    const range = document.createRange();
    range.selectNodeContents(cue);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    if (sel.isCollapsed) return null;
    return {
      cueIndex: cue.closest('[data-cue-index]')?.getAttribute('data-cue-index') ?? '',
      terms,
    };
  });
}

/** Select the first panel token for `term` via selectNodeContents; the
 *  status-key listener reads it as a single-term selection. */
async function selectPanelToken(page: Page, term: string): Promise<string | null> {
  return page.evaluate((t) => {
    const el = document
      .querySelector('[data-cell-split-view="panel"]')
      ?.shadowRoot
      ?.querySelector<HTMLElement>(`.js-cell-token--word[data-cell-term="${t}"]`);
    if (!el) return null;
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.addRange(range);
    return sel.isCollapsed ? null : el.textContent;
  }, term);
}

/** Screen point of `word` inside the overlay target line. Walks shadow roots
 *  on hit-test so the point is only returned when a real user click would
 *  land inside the line. */
async function wordPoint(
  locator: Locator,
  word: string,
): Promise<{ x: number; y: number } | null> {
  return locator.evaluate(
    (el, args) => {
      const deepHit = (x: number, y: number): Element | null => {
        let hit = document.elementFromPoint(x, y);
        while (hit?.shadowRoot) {
          const inner = hit.shadowRoot.elementFromPoint(x, y);
          if (!inner || inner === hit) break;
          hit = inner;
        }
        return hit;
      };
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const re = new RegExp(args.wordReSource, 'g');
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const text = node.textContent ?? '';
        let m: RegExpExecArray | null;
        re.lastIndex = 0;
        while ((m = re.exec(text))) {
          if (m[0].toLowerCase() !== args.word) continue;
          const range = document.createRange();
          range.setStart(node, m.index);
          range.setEnd(node, m.index + m[0].length);
          const rect = range.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          if (el.contains(deepHit(x, y))) return { x, y };
        }
      }
      return null;
    },
    { wordReSource: WORD_RE.source, word },
  );
}

test('popup dictionary keys 1-4 set the looked-up word status', async ({
  cellContext,
  streamFlixPage,
}) => {
  await seedDictionary(cellContext, 'en', [
    { term: 'silence', pos: 'noun', definition: 'the complete absence of sound or noise' },
  ]);
  await writeTokenizeSettings(cellContext);
  await streamFlixPage.reload({ waitUntil: 'networkidle' });

  const video = streamFlixPage.locator('#player-wrapper video').first();
  await expect(video).toBeVisible({ timeout: 30_000 });
  // Start before cue 2 ("LYIN' ISN'T BETTER THAN SILENCE", 20.2-25.5s) so the
  // overlay tokenizes it on the natural cue boundary — a mid-cue seek renders
  // the cue without tokens.
  await video.evaluate((v: HTMLVideoElement) => {
    v.muted = true;
    v.currentTime = 18.5;
    void v.play();
  });
  await expect
    .poll(async () => (await overlayTerms(streamFlixPage)).includes('silence'), {
      timeout: 30_000,
    })
    .toBe(true);

  const targetLine = streamFlixPage
    .locator('[data-cell-id="subtitle-block"] [data-role="target"]')
    .first();
  // Mock controls auto-hide ~3s into playback; the hit-tested wordPoint stays
  // null while they cover the line, so poll until the word is clickable.
  let point: { x: number; y: number } | null = null;
  await expect
    .poll(async () => (point = await wordPoint(targetLine, 'silence')), { timeout: 10_000 })
    .not.toBeNull();
  await streamFlixPage.mouse.click(point!.x, point!.y);

  const popup = streamFlixPage.locator('.js-cell-popup-host');
  await expect(popup).toBeAttached({ timeout: 10_000 });
  const statusBadge = popup.locator('[data-cell-id="dictionary-status-cycle"]');
  await expect(statusBadge).toContainText('unknown', { timeout: 15_000 });

  const presses: ReadonlyArray<readonly [string, string]> = [
    ['2', 'tracking'],
    ['4', 'ignore'],
    ['3', 'known'],
    ['1', 'unknown'],
  ];
  for (const [key, status] of presses) {
    await streamFlixPage.keyboard.press(key);
    await expect(statusBadge).toContainText(status, { timeout: 10_000 });
    await expect
      .poll(async () => overlayTokenClass(streamFlixPage, 'silence'), { timeout: 10_000 })
      .toContain(`js-cell-token--status-${status}`);
  }
});

test('split-view cue tokens render frequency band backgrounds', async ({
  cellContext,
  streamFlixPage,
}) => {
  await writeTokenizeSettings(cellContext);
  await streamFlixPage.reload({ waitUntil: 'networkidle' });
  await prepareVideo(streamFlixPage);

  await streamFlixPage.keyboard.press('t');
  await expect
    .poll(async () => (await panelWordTerms(streamFlixPage)).length, { timeout: 30_000 })
    .toBeGreaterThan(0);
  await expect
    .poll(
      async () =>
        streamFlixPage.evaluate(
          () =>
            document
              .querySelector('[data-cell-split-view="panel"]')
              ?.shadowRoot?.querySelectorAll(
                '.js-cell-token--word[class*="js-cell-token--frequency-"]:not(.js-cell-token--resolving)',
              ).length ?? 0,
        ),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);

  const tokens = await streamFlixPage.evaluate(() => {
    const root = document.querySelector('[data-cell-split-view="panel"]')?.shadowRoot;
    return Array.from(
      root?.querySelectorAll<HTMLElement>('.js-cell-token--word[data-cell-term]') ?? [],
    ).map((el) => ({ cls: el.className, bg: getComputedStyle(el).backgroundColor }));
  });
  expect(tokens.length).toBeGreaterThan(0);
  for (const t of tokens) {
    expect(t.cls).not.toContain('js-cell-token--frequency-off');
    expect(t.cls).toMatch(/js-cell-token--frequency-(core|common|general|advanced|rare)/);
    if (t.cls.includes('status-unknown') || t.cls.includes('status-tracking')) {
      expect(t.bg).not.toBe('rgba(0, 0, 0, 0)');
      expect(t.bg).not.toBe('transparent');
    }
  }
});

test('i+1 filter includes a cue whose only new word is tracking', async ({
  cellContext,
  streamFlixPage,
}) => {
  await writeTokenizeSettings(cellContext);
  await streamFlixPage.reload({ waitUntil: 'networkidle' });
  await prepareVideo(streamFlixPage);

  await streamFlixPage.keyboard.press('t');
  await expect
    .poll(async () => (await panelWordTerms(streamFlixPage)).length, { timeout: 30_000 })
    .toBeGreaterThan(0);

  const cue = await selectFirstPanelCue(streamFlixPage);
  expect(cue).not.toBeNull();
  const terms = cue!.terms.filter((t) => WORD_RE.test(t));
  expect(terms.length).toBeGreaterThan(1);

  await streamFlixPage.keyboard.press('3');
  await expect
    .poll(
      async () => {
        const classes = await panelTokenClasses(streamFlixPage, terms[0]!);
        return (
          classes.length > 0 &&
          classes.every((c) => c.includes('js-cell-token--status-known'))
        );
      },
      { timeout: 15_000 },
    )
    .toBe(true);

  const term = await selectPanelToken(streamFlixPage, terms[0]!);
  expect(term).not.toBeNull();
  await streamFlixPage.keyboard.press('2');
  await expect
    .poll(
      async () => {
        const classes = await panelTokenClasses(streamFlixPage, terms[0]!);
        return classes.every((c) => c.includes('js-cell-token--status-tracking'));
      },
      { timeout: 15_000 },
    )
    .toBe(true);

  const fab = streamFlixPage.locator('[data-cell-id="cue-filter-fab"]');
  await expect(fab).toBeVisible({ timeout: 10_000 });
  await expect(fab).toHaveAttribute('aria-label', /[1-9]\d* i\+1 cues/, { timeout: 15_000 });
  await fab.click();

  const i1Item = streamFlixPage.locator('role=menuitemradio').filter({ hasText: 'i+1' });
  await expect(i1Item).toBeVisible({ timeout: 10_000 });
  await i1Item.click();

  await expect(streamFlixPage.locator('[data-cell-id="cue-filter-strip"]')).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    streamFlixPage.locator(`[data-cell-id="cue-item"][data-cue-index="${cue!.cueIndex}"]`),
  ).toBeVisible({ timeout: 10_000 });
});
