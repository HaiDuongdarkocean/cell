import { expect, type Locator, type Page } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';
import { test } from '../fixtures/cellEnvironment.fixture';

const DB_SCHEMA_VERSION = 13;
const WORD_RE = /[A-Za-zÀ-ɏ']+/;

/**
 * Contract (spec docs/specs/dictionary-popup-nested-stack.md):
 *   Given: a level-1 dictionary popup opened from a subtitle target word
 *   Then:  clicking a word inside its definitions opens a level-2 popup while
 *          level 1 stays mounted; deeper nesting keeps stacking; clicking a
 *          word in an ancestor prunes deeper levels; clicking another source
 *          word reuses level 1; clicking blank space dismisses everything.
 */

/** Seed one DICTIONARY resource + entries into the extension's IndexedDB so a
 *  live lookup resolves real definitions. Mirrors card-creator-generate-all. */
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

      let version = args.version;
      const existing = (await indexedDB.databases?.() ?? []).find((d) => d.name === dbName);
      if (existing?.version && existing.version > version) version = existing.version;

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
    { lang: langCode, version: DB_SCHEMA_VERSION, entries },
  );
}

/** Screen point of the first text-node occurrence of `word` inside the
 *  `[data-allow-lookup]` region of popup host index `hostIndex`. */
async function nestedWordPoint(
  page: Page,
  hostIndex: number,
  word?: string,
): Promise<{ x: number; y: number } | null> {
  return page.evaluate(
    ([i, w]) => {
      const hosts = [
        ...Array.from(document.querySelectorAll('.js-cell-popup-host')),
        ...Array.from(
          document.getElementById('cell-subtitle-root')?.shadowRoot
            ?.querySelectorAll('.js-cell-popup-host') ?? [],
        ),
      ];
      const shadow = (hosts[i as number] as HTMLElement | undefined)?.shadowRoot;
      const region = shadow?.querySelector('[data-allow-lookup]');
      if (!region) return null;
      const deepHit = (x: number, y: number): Element | null => {
        let hit = document.elementFromPoint(x, y);
        while (hit?.shadowRoot) {
          const inner = hit.shadowRoot.elementFromPoint(x, y);
          if (!inner || inner === hit) break;
          hit = inner;
        }
        return hit;
      };
      const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const text = node.textContent ?? '';
        const wordRe = w ? null : /[a-zA-Z']+/g;
        let idx = -1;
        let m: RegExpExecArray | null;
        const nextSpan = (): [number, number] | null => {
          if (w) {
            idx = text.toLowerCase().indexOf(w as string, idx + 1);
            return idx === -1 ? null : [idx, idx + (w as string).length];
          }
          m = wordRe!.exec(text);
          return m ? [m.index, m.index + m[0].length] : null;
        };
        let span: [number, number] | null;
        while ((span = nextSpan())) {
          const range = document.createRange();
          range.setStart(node, span[0]);
          range.setEnd(node, span[1]);
          const rect = range.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          // Skip occurrences covered by a deeper popup — a real user can
          // only click text that is actually topmost at that point.
          if (region.contains(deepHit(x, y))) return { x, y };
        }
      }
      return null;
    },
    [hostIndex, word],
  );
}

async function wordPoint(locator: Locator, word?: string): Promise<{ x: number; y: number } | null> {
  return locator.evaluate((el, args) => {
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
        if (args.word && m[0].toLowerCase() !== args.word) continue;
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        // Only return points the user can actually click — the hit-test must
        // land inside this element (not covered by a popup overlaying it).
        if (el.contains(deepHit(x, y))) return { x, y };
      }
    }
    return null;
  }, { wordReSource: WORD_RE.source, word });
}

const popupHosts = (page: Page) => page.locator('.js-cell-popup-host');

test.describe('Stage 2: Nested dictionary popup stack', () => {
  test.beforeEach(async ({ cellContext }) => {
    await seedDictionary(cellContext, 'en', [
      { term: 'silence', pos: 'noun', definition: 'the complete absence of sound or noise' },
      { term: 'absence', pos: 'noun', definition: 'the state of being away from a place' },
      { term: 'state', pos: 'noun', definition: 'the condition of a thing at a time' },
      { term: 'condition', pos: 'noun', definition: 'the mode of being of a thing' },
      { term: 'sound', pos: 'noun', definition: 'vibrations that travel through the air' },
      { term: 'better', pos: 'adj', definition: 'of higher quality than another' },
    ]);
  });

  test('lookup inside definitions opens a nested popup while ancestors stay visible', async ({ streamFlixPage }) => {
    await streamFlixPage.keyboard.press('g');

    const cueTexts = streamFlixPage.locator('[data-cell-id="cue-target-text"]');
    await expect(cueTexts.first()).toBeVisible({ timeout: 15_000 });

    // Level 1: click "SILENCE" in the cue list.
    const silenceCue = cueTexts.filter({ hasText: /silence/i }).first();
    const silencePoint = await wordPoint(silenceCue, 'silence');
    expect(silencePoint).not.toBeNull();
    await streamFlixPage.mouse.click(silencePoint!.x, silencePoint!.y);
    await expect(popupHosts(streamFlixPage)).toHaveCount(1, { timeout: 10_000 });

    // Wait for the level-1 definitions region to render the seeded result.
    const lv1Defs = popupHosts(streamFlixPage).nth(0).locator('[data-allow-lookup]');
    await expect(lv1Defs).toContainText(/absence/i, { timeout: 15_000 });

    // Level 2: click "absence" inside level 1 — level 1 must stay.
    const lv2Point = await nestedWordPoint(streamFlixPage, 0, 'absence');
    expect(lv2Point).not.toBeNull();
    await streamFlixPage.mouse.click(lv2Point!.x, lv2Point!.y);
    await expect(popupHosts(streamFlixPage)).toHaveCount(2, { timeout: 10_000 });

    // Level 3: click "state" inside level 2 — levels 1 and 2 stay.
    const lv2Defs = popupHosts(streamFlixPage).nth(1).locator('[data-allow-lookup]');
    await expect(lv2Defs).toContainText(/state/i, { timeout: 15_000 });
    const lv3Point = await nestedWordPoint(streamFlixPage, 1, 'state');
    expect(lv3Point).not.toBeNull();
    await streamFlixPage.mouse.click(lv3Point!.x, lv3Point!.y);
    await expect(popupHosts(streamFlixPage)).toHaveCount(3, { timeout: 10_000 });

    // Click back into level 1 — prefer "sound", fall back to any visible word
    // (deeper popups may cover the preferred word; a user can only click
    // text that is actually topmost). Level 3 pruned, level 2 reused.
    const lv1Again =
      (await nestedWordPoint(streamFlixPage, 0, 'sound')) ??
      (await nestedWordPoint(streamFlixPage, 0));
    expect(lv1Again).not.toBeNull();
    await streamFlixPage.mouse.click(lv1Again!.x, lv1Again!.y);
    await expect(popupHosts(streamFlixPage)).toHaveCount(2, { timeout: 10_000 });

    // Click a different source word ("better" in the same cue) → the whole
    // stack collapses back to a single, repositioned level 1. If popups cover
    // "better", fall back to the first visible word in any cue.
    let betterPoint = await wordPoint(silenceCue, 'better');
    if (!betterPoint) {
      for (const cue of await cueTexts.all()) {
        betterPoint = await wordPoint(cue);
        if (betterPoint) break;
      }
    }
    expect(betterPoint).not.toBeNull();
    await streamFlixPage.mouse.click(betterPoint!.x, betterPoint!.y);
    await expect(popupHosts(streamFlixPage)).toHaveCount(1, { timeout: 10_000 });

    // Click blank space → the stack dismisses entirely. Probe for a point that
    // resolves to the bare page (no overlay, no link) so the click cannot
    // navigate or toggle controls.
    const blankPoint = await streamFlixPage.evaluate(() => {
      for (const x of [10, 30, 60]) {
        for (const y of [window.innerHeight - 10, 10]) {
          const el = document.elementFromPoint(x, y);
          if (el && (el === document.body || el === document.documentElement)) return { x, y };
        }
      }
      return null;
    });
    if (blankPoint) {
      await streamFlixPage.mouse.click(blankPoint.x, blankPoint.y);
    } else {
      const videoBox = await streamFlixPage.locator('#player-wrapper video').first().boundingBox();
      expect(videoBox).not.toBeNull();
      await streamFlixPage.mouse.click(videoBox!.x + videoBox!.width / 2, videoBox!.y + 24);
    }
    await expect(popupHosts(streamFlixPage)).toHaveCount(0, { timeout: 10_000 });
  });

  test('Escape closes the top level and focuses the exposed parent', async ({ streamFlixPage }) => {
    await streamFlixPage.keyboard.press('g');

    const cueTexts = streamFlixPage.locator('[data-cell-id="cue-target-text"]');
    await expect(cueTexts.first()).toBeVisible({ timeout: 15_000 });

    const silenceCue = cueTexts.filter({ hasText: /silence/i }).first();
    const silencePoint = await wordPoint(silenceCue, 'silence');
    expect(silencePoint).not.toBeNull();
    await streamFlixPage.mouse.click(silencePoint!.x, silencePoint!.y);
    await expect(popupHosts(streamFlixPage)).toHaveCount(1, { timeout: 10_000 });

    const lv1Defs = popupHosts(streamFlixPage).nth(0).locator('[data-allow-lookup]');
    await expect(lv1Defs).toContainText(/absence/i, { timeout: 15_000 });

    const lv2Point = await nestedWordPoint(streamFlixPage, 0, 'absence');
    expect(lv2Point).not.toBeNull();
    await streamFlixPage.mouse.click(lv2Point!.x, lv2Point!.y);
    await expect(popupHosts(streamFlixPage)).toHaveCount(2, { timeout: 10_000 });

    const lv2Defs = popupHosts(streamFlixPage).nth(1).locator('[data-allow-lookup]');
    await expect(lv2Defs).toContainText(/state/i, { timeout: 15_000 });
    const lv3Point = await nestedWordPoint(streamFlixPage, 1, 'state');
    expect(lv3Point).not.toBeNull();
    await streamFlixPage.mouse.click(lv3Point!.x, lv3Point!.y);
    await expect(popupHosts(streamFlixPage)).toHaveCount(3, { timeout: 10_000 });

    const focusedHostIndex = () =>
      streamFlixPage.evaluate(() => {
        let active: Element | null = document.activeElement;
        while (active instanceof HTMLElement && active.shadowRoot?.activeElement) {
          active = active.shadowRoot.activeElement;
        }
        const root = active?.getRootNode();
        const focusedHost = root instanceof ShadowRoot ? root.host : active;
        const hosts = [
          ...Array.from(document.querySelectorAll('.js-cell-popup-host')),
          ...Array.from(
            document.getElementById('cell-subtitle-root')?.shadowRoot
              ?.querySelectorAll('.js-cell-popup-host') ?? [],
          ),
        ];
        return hosts.indexOf(focusedHost as HTMLElement);
      });

    await streamFlixPage.keyboard.press('Escape');
    await expect(popupHosts(streamFlixPage)).toHaveCount(2, { timeout: 10_000 });
    expect(await focusedHostIndex()).toBe(1);

    await streamFlixPage.keyboard.press('Escape');
    await expect(popupHosts(streamFlixPage)).toHaveCount(1, { timeout: 10_000 });
    expect(await focusedHostIndex()).toBe(0);

    await streamFlixPage.keyboard.press('Escape');
    await expect(popupHosts(streamFlixPage)).toHaveCount(0, { timeout: 10_000 });
  });
});
