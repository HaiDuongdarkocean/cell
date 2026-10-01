import { expect, type Page } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';
import { test } from './fixtures/cellEnvironment.fixture';

/**
 * Contract (spec docs/specs/lookup-latency-marks.md):
 *   Given: the E2E build (CELL_E2E=1 → isCellDebug gate on)
 *   When:  a lookup completes and the audio tab renders rows
 *   Then:  User Timing measures `cell:lookup:*` and `cell:audio:*` exist with
 *          duration >= 0 — read from the page's performance buffer, with the
 *          helper's console.debug summary as fallback if the isolated world
 *          does not share the page timeline.
 */

const WORD_RE = /[A-Za-zÀ-ɏ']+/;
const PERF_LINE = /\[perf\] (cell:(?:lookup|audio):[^\s]+): ([\d.]+)ms/;

async function seedDictionary(
  context: BrowserContext,
  langCode: string,
  entries: ReadonlyArray<{ term: string; definition: string; pos?: string }>,
): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(
    async (args: { lang: string; entries: ReadonlyArray<{ term: string; definition: string; pos?: string }> }) => {
      const storage = await chrome.storage.local.get('orca');
      const hash = (storage?.orca as Record<string, unknown> | undefined)?.dbHash;
      const dbName = `orca-dict-${typeof hash === 'string' && hash.length === 8 ? hash : 'devmode0'}-${args.lang}`;
      const reverse = (s: string): string => s.split('').reverse().join('');

      const version = await (async () => {
        const existing = (await indexedDB.databases?.() ?? []).find((d) => d.name === dbName);
        return existing?.version ?? 1;
      })();

      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(dbName, version);
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
          if (!d.objectStoreNames.contains('langWordTrash')) {
            d.createObjectStore('langWordTrash', { keyPath: 'term' });
          }
          if (!d.objectStoreNames.contains('syncOutbox')) {
            d.createObjectStore('syncOutbox', { keyPath: 'id', autoIncrement: true });
          }
          if (!d.objectStoreNames.contains('syncMeta')) {
            d.createObjectStore('syncMeta', { keyPath: 'key' });
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
    { lang: langCode, entries },
  );
}

/** Pin the fallback chain to the vendored offline engine so `applied`/`render`
 *  marks always fire — real network audio (Forvo) is not reachable in tests. */
async function seedEspeakAudioSettings(context: BrowserContext): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(async () => {
    const storage = await chrome.storage.local.get('settings');
    const settings = (storage.settings ?? {}) as Record<string, unknown>;
    const pronunciation = (settings.pronunciation ?? {}) as Record<string, unknown>;
    settings.schemaVersion = 34;
    settings.pronunciation = {
      ...pronunciation,
      fallbackEngines: ['espeak'],
      downloadEspeakTtsData: true,
    };
    await chrome.storage.local.set({ settings });
  });
}

async function wordPoint(page: Page, word: string): Promise<{ x: number; y: number } | null> {
  const cue = page.locator('[data-cell-id="cue-target-text"]').filter({ hasText: new RegExp(word, 'i') }).first();
  return cue.evaluate((el, args) => {
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
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
    }
    return null;
  }, { wordReSource: WORD_RE.source, word });
}

/** Click through shadow DOM: find the first element matching `selector` inside
 *  any `.js-cell-popup-host` shadow root and dispatch a real click point. */
async function clickInPopupShadow(page: Page, selector: string): Promise<boolean> {
  const point = await page.evaluate((sel) => {
    const hosts = [
      ...Array.from(document.querySelectorAll('.js-cell-popup-host')),
      ...Array.from(
        document.getElementById('cell-subtitle-root')?.shadowRoot
          ?.querySelectorAll('.js-cell-popup-host') ?? [],
      ),
    ];
    for (const host of hosts) {
      const el = host.shadowRoot?.querySelector(sel);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return null;
  }, selector);
  if (!point) return false;
  await page.mouse.click(point.x, point.y);
  return true;
}

async function cellMeasures(page: Page, prefix: 'lookup' | 'audio'): Promise<Array<{ name: string; duration: number }>> {
  return page.evaluate((p) => {
    return performance
      .getEntriesByType('measure')
      .filter((e) => e.name.startsWith(`cell:${p}:`))
      .map((e) => ({ name: e.name, duration: e.duration }));
  }, prefix);
}

test.describe('lookup + audio latency marks', () => {
  test.beforeEach(async ({ cellContext }) => {
    await seedDictionary(cellContext, 'en', [
      { term: 'silence', pos: 'noun', definition: 'the complete absence of sound or noise' },
    ]);
    await seedEspeakAudioSettings(cellContext);
  });

  test('emits cell:lookup:* and cell:audio:* measures on the real hot path', async ({ streamFlixPage }) => {
    test.setTimeout(180_000);
    const consoleMeasures = new Map<string, number>();
    streamFlixPage.on('console', (msg) => {
      const m = msg.text().match(PERF_LINE);
      if (m) consoleMeasures.set(m[1]!, parseFloat(m[2]!));
    });

    await streamFlixPage.keyboard.press('g');
    const cueTexts = streamFlixPage.locator('[data-cell-id="cue-target-text"]');
    await expect(cueTexts.first()).toBeVisible({ timeout: 15_000 });

    const point = await wordPoint(streamFlixPage, 'silence');
    expect(point).not.toBeNull();
    await streamFlixPage.mouse.click(point!.x, point!.y);
    await expect(streamFlixPage.locator('.js-cell-popup-host')).toHaveCount(1, { timeout: 10_000 });
    await expect(
      streamFlixPage.locator('.js-cell-popup-host').locator('[data-allow-lookup]'),
    ).toContainText(/absence/i, { timeout: 15_000 });

    const lookupDone = async () => {
      const entries = await cellMeasures(streamFlixPage, 'lookup');
      return entries.length > 0 || [...consoleMeasures.keys()].some((k) => k.startsWith('cell:lookup:'));
    };
    await expect.poll(lookupDone, { timeout: 15_000 }).toBe(true);

    const clicked = await clickInPopupShadow(streamFlixPage, '[data-cell-id="dictionary-tab-audio"]');
    expect(clicked).toBe(true);

    const audioDone = async () => {
      const entries = await cellMeasures(streamFlixPage, 'audio');
      return entries.length > 0 || [...consoleMeasures.keys()].some((k) => k.startsWith('cell:audio:'));
    };
    await expect.poll(audioDone, { timeout: 90_000 }).toBe(true);

    const lookupEntries = await cellMeasures(streamFlixPage, 'lookup');
    const audioEntries = await cellMeasures(streamFlixPage, 'audio');
    const all = [
      ...lookupEntries,
      ...audioEntries,
      ...[...consoleMeasures.entries()].map(([name, duration]) => ({ name, duration })),
    ];
    expect(all.some((e) => e.name.startsWith('cell:lookup:') && e.duration >= 0)).toBe(true);
    expect(all.some((e) => e.name.startsWith('cell:audio:') && e.duration >= 0)).toBe(true);
    for (const e of all) {
      console.log(`[latency-marks] ${e.name} = ${e.duration.toFixed(1)}ms`);
    }
  });
});
