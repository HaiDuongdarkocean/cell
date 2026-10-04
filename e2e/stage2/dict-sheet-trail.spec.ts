import { expect, type Locator, type Page } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';
import { test } from '../fixtures/cellEnvironment.fixture';

const DB_SCHEMA_VERSION = 13;
const WORD_RE = /[A-Za-zÀ-ɏ']+/;
const MOBILE_VIEWPORT = { width: 390, height: 844 };

/**
 * Contract (spec docs/specs/dict-sheet-breadcrumb.md):
 *   Given: a level-1 dictionary sheet opened at mobile width (<599px)
 *   Then:  a lookup inside its definitions pushes a NEW sheet level while
 *          level 1 stays mounted; the top sheet shows a breadcrumb strip
 *          "lv1 > lv2 > ... > lvN" (hidden at depth 1); tapping a crumb closes
 *          the deeper levels via closeFromLevel; a page lookup resets the
 *          chain; only the top sheet keeps aria-modal (covered levels inert).
 */

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
    async ([i, w]) => {
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
      // The sheet slides in with a transform transition — measuring rects
      // mid-flight yields stale click coordinates. document.getAnimations()
      // can't see shadow DOM, so walk composed ancestors instead.
      {
        const anims: Animation[] = [];
        let el: Element | null = region;
        while (el) {
          anims.push(
            ...el.getAnimations().filter((a) => a.effect?.getTiming?.().iterations !== Infinity),
          );
          const root = el.getRootNode();
          el = el.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
        }
        if (anims.length) {
          await Promise.race([
            Promise.allSettled(anims.map((a) => a.finished)),
            new Promise((r) => setTimeout(r, 2000)),
          ]);
        }
      }
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
          if (region.contains(deepHit(x, y))) return { x, y };
        }
      }
      return null;
    },
    [hostIndex, word],
  );
}

async function wordPoint(locator: Locator, word?: string): Promise<{ x: number; y: number } | null> {
  return locator.evaluate(async (el, args) => {
    // Popup sheet hosts cover page text — elementFromPoint returns their host
    // element even when the sheet's inner content is inert, so the word under
    // them can never be probed. Disable pointer-events while probing, like
    // the extension's own caret resolver (withUiHostsPointerEventsDisabled).
    const uiHosts: HTMLElement[] = [
      ...Array.from(document.querySelectorAll<HTMLElement>('.js-cell-popup-host')),
      ...Array.from(
        document
          .getElementById('cell-subtitle-root')
          ?.shadowRoot?.querySelectorAll<HTMLElement>('.js-cell-popup-host') ?? [],
      ),
    ];
    const savedPe = uiHosts.map((h) => h.style.pointerEvents);
    try {
      uiHosts.forEach((h) => {
        h.style.pointerEvents = 'none';
      });
      // Overlay/sheet surfaces animate on mount — measuring rects mid-flight
      // yields stale click coordinates. Walk composed ancestors (document-level
      // getAnimations can't see shadow DOM) and wait for finite animations.
      {
        const anims: Animation[] = [];
        let node: Element | null = el;
        while (node) {
          anims.push(
            ...node.getAnimations().filter((a) => a.effect?.getTiming?.().iterations !== Infinity),
          );
          const root = node.getRootNode();
          node = node.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
        }
        if (anims.length) {
          await Promise.race([
            Promise.allSettled(anims.map((a) => a.finished)),
            new Promise((r) => setTimeout(r, 2000)),
          ]);
        }
      }
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
          if (el.contains(deepHit(x, y))) return { x, y };
        }
      }
      return null;
    } finally {
      uiHosts.forEach((h, i) => {
        h.style.pointerEvents = savedPe[i] ?? '';
      });
    }
  }, { wordReSource: WORD_RE.source, word });
}

const popupHosts = (page: Page) => page.locator('.js-cell-popup-host');
const sheetOf = (page: Page, index: number) =>
  popupHosts(page).nth(index).locator('[data-cell-id="popup-dictionary"]');
const trailOf = (page: Page, index: number) =>
  popupHosts(page).nth(index).locator('[data-cell-id="lookup-trail"]');

test.describe('Stage 2: Sheet-mode lookup trail', () => {
  test.beforeEach(async ({ cellContext, streamFlixPage }) => {
    await seedDictionary(cellContext, 'en', [
      { term: 'silence', pos: 'noun', definition: 'the complete absence of sound or noise' },
      { term: 'absence', pos: 'noun', definition: 'the state of being away from a place' },
      { term: 'state', pos: 'noun', definition: 'the condition of a thing at a time' },
      { term: 'condition', pos: 'noun', definition: 'the mode of being of a thing' },
      { term: 'mode', pos: 'noun', definition: 'a way of doing silence' },
      { term: 'sound', pos: 'noun', definition: 'vibrations that travel through the air' },
      { term: 'better', pos: 'adj', definition: 'of higher quality than another' },
    ]);
    await streamFlixPage.setViewportSize(MOBILE_VIEWPORT);
  });

  test('nested lookups stack sheets with a navigable breadcrumb trail', async ({ streamFlixPage }) => {
    await streamFlixPage.keyboard.press('g');

    const cueTexts = streamFlixPage.locator('[data-cell-id="cue-target-text"]');
    await expect(cueTexts.first()).toBeVisible({ timeout: 15_000 });

    // Level 1 — sheet opens without a trail (depth < 2).
    const silenceCue = cueTexts.filter({ hasText: /silence/i }).first();
    const silencePoint = await wordPoint(silenceCue, 'silence');
    expect(silencePoint).not.toBeNull();
    await streamFlixPage.mouse.click(silencePoint!.x, silencePoint!.y);
    await expect(popupHosts(streamFlixPage)).toHaveCount(1, { timeout: 10_000 });
    await expect(sheetOf(streamFlixPage, 0)).toHaveAttribute('aria-modal', 'true');
    await expect(trailOf(streamFlixPage, 0)).toHaveCount(0);

    // Level 2 — push, not replace: level 1 stays mounted and goes inert while
    // the top sheet shows "silence > absence".
    const lv1Defs = popupHosts(streamFlixPage).nth(0).locator('[data-allow-lookup]');
    await expect(lv1Defs).toContainText(/absence/i, { timeout: 15_000 });
    const lv2Point = await nestedWordPoint(streamFlixPage, 0, 'absence');
    expect(lv2Point).not.toBeNull();
    await streamFlixPage.mouse.click(lv2Point!.x, lv2Point!.y);
    await expect(popupHosts(streamFlixPage)).toHaveCount(2, { timeout: 10_000 });

    const trail2 = trailOf(streamFlixPage, 1);
    await expect(trail2.locator('li')).toHaveCount(2);
    await expect(trail2).toContainText(/silence/i);
    await expect(trail2).toContainText(/absence/i);
    await expect(sheetOf(streamFlixPage, 0)).toHaveAttribute('inert', '');
    expect(await sheetOf(streamFlixPage, 0).getAttribute('aria-modal')).toBeNull();
    // Covered sheets render a hit catcher so taps on their exposed area route
    // back into the stack instead of falling through to the page.
    await expect(popupHosts(streamFlixPage).nth(0).locator('[data-cell-id="sheet-inert-cover"]')).toHaveCount(1);
    await expect(popupHosts(streamFlixPage).nth(1).locator('[data-cell-id="sheet-inert-cover"]')).toHaveCount(0);

    // Deeper levels keep stacking; the trail mirrors the whole chain
    // (seeded chain: silence→absence→state→condition→mode).
    const lv2Defs = popupHosts(streamFlixPage).nth(1).locator('[data-allow-lookup]').first();
    await expect(lv2Defs).toContainText(/state/i, { timeout: 15_000 });
    const lv3Point = await nestedWordPoint(streamFlixPage, 1, 'state');
    expect(lv3Point).not.toBeNull();
    await streamFlixPage.mouse.click(lv3Point!.x, lv3Point!.y);
    await expect(popupHosts(streamFlixPage)).toHaveCount(3, { timeout: 10_000 });

    const lv3Defs = popupHosts(streamFlixPage).nth(2).locator('[data-allow-lookup]').first();
    await expect(lv3Defs).toContainText(/condition/i, { timeout: 15_000 });
    const lv4Point = await nestedWordPoint(streamFlixPage, 2, 'condition');
    expect(lv4Point).not.toBeNull();
    await streamFlixPage.mouse.click(lv4Point!.x, lv4Point!.y);
    await expect(popupHosts(streamFlixPage)).toHaveCount(4, { timeout: 10_000 });

    const lv4Defs = popupHosts(streamFlixPage).nth(3).locator('[data-allow-lookup]').first();
    await expect(lv4Defs).toContainText(/mode/i, { timeout: 15_000 });
    const lv5Point = await nestedWordPoint(streamFlixPage, 3, 'mode');
    expect(lv5Point).not.toBeNull();
    await streamFlixPage.mouse.click(lv5Point!.x, lv5Point!.y);
    await expect(popupHosts(streamFlixPage)).toHaveCount(5, { timeout: 10_000 });

    const trail5 = trailOf(streamFlixPage, 4);
    await expect(trail5.locator('li')).toHaveCount(5);
    await streamFlixPage.screenshot({ path: 'tmp/dict-sheet-breadcrumb/e2e-deep-chain.png' });

    // A freshly mounted overflowing strip lands scrolled to the newest crumb.
    const scrollState = await trail5.evaluate((el) => ({
      left: el.scrollLeft,
      right: el.scrollLeft + el.clientWidth,
      width: el.scrollWidth,
    }));
    expect(scrollState.width).toBeGreaterThan(scrollState.right - scrollState.left);
    expect(scrollState.left).toBeGreaterThan(0);
    expect(scrollState.right).toBeGreaterThanOrEqual(scrollState.width - 1);

    // Wheel deltaY maps to horizontal scroll (already at the end → wheel back).
    const wheelDelta = await trail5.evaluate((el) => {
      const before = el.scrollLeft;
      el.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true }));
      return { before, after: el.scrollLeft };
    });
    expect(wheelDelta.after).toBeLessThan(wheelDelta.before);

    // Tap crumb index 1 ("absence") → deeper levels close, depth = 2.
    const crumbs = trail5.locator('button');
    await expect(crumbs).toHaveCount(4);
    await crumbs.nth(1).click();
    await expect(popupHosts(streamFlixPage)).toHaveCount(2, { timeout: 10_000 });
    await expect(trailOf(streamFlixPage, 1).locator('li')).toHaveCount(2);
    await expect(sheetOf(streamFlixPage, 1)).toHaveAttribute('aria-modal', 'true');
    // The surviving sheet gets focus back once its inert attr is lifted.
    const focused = await streamFlixPage.evaluate(() => {
      const hosts = document
        .getElementById('cell-subtitle-root')
        ?.shadowRoot?.querySelectorAll('.js-cell-popup-host') ?? [];
      const host = hosts[hosts.length - 1] as HTMLElement | undefined;
      return host?.shadowRoot?.activeElement?.getAttribute('data-cell-id') ?? null;
    });
    expect(focused).toBe('popup-dictionary');
    await streamFlixPage.screenshot({ path: 'tmp/dict-sheet-breadcrumb/e2e-after-crumb-nav.png' });

    // Player Mode runs in native fullscreen (#cell-subtitle-root) — in a real
    // browser the first Escape exits fullscreen natively before page code sees
    // the key (Player Mode then unmounts on fullscreenchange). CDP delivers
    // Escape to page JS instead, so emulate the browser step with
    // exitFullscreen(); the next Escape reaches the sheet stack and pops top.
    await streamFlixPage.evaluate(() => document.exitFullscreen());
    await expect(streamFlixPage.locator('#cell-subtitle-root')).not.toHaveAttribute(
      'data-cell-player-mode',
      'true',
      { timeout: 10_000 },
    );
    await streamFlixPage.keyboard.press('Escape');
    await expect(popupHosts(streamFlixPage)).toHaveCount(1, { timeout: 10_000 });
    await expect(sheetOf(streamFlixPage, 0)).not.toHaveAttribute('inert', '');

    // Re-enter Player Mode for the remaining page-lookup step, then rebuild
    // depth 2 and check a page lookup resets the whole chain.
    await streamFlixPage.keyboard.press('g');
    await expect(cueTexts.first()).toBeVisible({ timeout: 15_000 });
    const lv2Point2 = await nestedWordPoint(streamFlixPage, 0, 'absence');
    expect(lv2Point2).not.toBeNull();
    await streamFlixPage.mouse.click(lv2Point2!.x, lv2Point2!.y);
    await expect(popupHosts(streamFlixPage)).toHaveCount(2, { timeout: 10_000 });

    // The sheets default to ~75vh and cover the whole cue area — shrink them
    // via the drag handle's keyboard resize (-32px/press). Covered sheets are
    // inert (unfocusable), so dispatch ArrowDown on each handle directly —
    // it still runs the real onKeyDownHandle resize path. Level 1 shrinks less
    // so a band of it stays exposed above level 2 for the cover-tap check.
    await streamFlixPage.evaluate(() => {
      const hosts = document
        .getElementById('cell-subtitle-root')
        ?.shadowRoot?.querySelectorAll('.js-cell-popup-host') ?? [];
      hosts.forEach((h, i) => {
        const handle = (h as HTMLElement).shadowRoot?.querySelector('[role="separator"]');
        for (let p = 0; p < (i === 0 ? 4 : 10); p++) {
          handle?.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
          );
        }
      });
      const scroller = document
        .getElementById('cell-subtitle-root')
        ?.shadowRoot?.querySelector<HTMLElement>('[data-cell-id="cue-list-scroll"]');
      if (scroller) scroller.scrollTop = 0;
    });

    // A tap on the exposed band of the covered level-1 sheet hits its inert
    // cover instead of falling through to the page — the stack routes it as
    // "return to level 1" and closes level 2.
    const lv1Top = await streamFlixPage.evaluate(() => {
      const host = document
        .getElementById('cell-subtitle-root')
        ?.shadowRoot?.querySelectorAll('.js-cell-popup-host')[0] as HTMLElement | undefined;
      const sheet = host?.shadowRoot?.querySelector('[data-cell-id="popup-dictionary"]');
      return sheet?.getBoundingClientRect().top ?? null;
    });
    expect(lv1Top).not.toBeNull();
    await streamFlixPage.mouse.click(195, lv1Top! + 12);
    await expect(popupHosts(streamFlixPage)).toHaveCount(1, { timeout: 10_000 });
    // lv1 kept its own content — the tap did not fall through to a page lookup.
    await expect(popupHosts(streamFlixPage).nth(0)).toContainText(/absence/i);

    let resetPoint = await wordPoint(silenceCue, 'better');
    if (!resetPoint) {
      for (const cue of await cueTexts.all()) {
        resetPoint = await wordPoint(cue);
        if (resetPoint) break;
      }
    }
    expect(resetPoint).not.toBeNull();
    await streamFlixPage.mouse.click(resetPoint!.x, resetPoint!.y);
    await expect(popupHosts(streamFlixPage)).toHaveCount(1, { timeout: 10_000 });
    await expect(trailOf(streamFlixPage, 0)).toHaveCount(0);
  });
});
