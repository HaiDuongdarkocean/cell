import { expect, type BrowserContext, type Page } from '@playwright/test';
import { test } from '../fixtures/actors/universalPanel.fixture';

/**
 * Contract (plan tasks/plan/vocabulary-migaku-redesign.md):
 *   1. Hero shows the known count plus the learning/tracked/ignored breakdown;
 *      filter menu lists All/Tracking/Learning/Known/Ignored with live counts;
 *      legacy `unknown` rows are swept and never render.
 *   2. Search lives behind the top-bar toggle and filters the live view.
 *   3. Row checkbox selection drives the bulk bar; confirmed Delete
 *      soft-deletes the selection into Trash (24h TTL) and Undo restores it.
 *   4. Trash opens from the more menu: no hero, no sort, no selection;
 *      Restore returns the previous status, Delete forever purges.
 *   5. Cycle tracking→known→ignore→tracking (3 persisted states only);
 *      `unknown` is only set externally and removes the row.
 *   6. Everything persists in real IndexedDB across page reloads.
 */

interface LiveSeed {
  readonly term: string;
  readonly status: string;
}

interface TrashSeed {
  readonly term: string;
  readonly previousStatus: string;
  readonly trashedAt: number;
}

async function seedVocabulary(
  context: BrowserContext,
  live: readonly LiveSeed[],
  trash: readonly TrashSeed[],
): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(
    async (args: { live: readonly LiveSeed[]; trash: readonly TrashSeed[] }) => {
      const storage = await chrome.storage.local.get('orca');
      const hash = (storage?.orca as Record<string, unknown> | undefined)?.dbHash;
      const dbName = `orca-dict-${typeof hash === 'string' && hash.length === 8 ? hash : 'devmode0'}-en`;

      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(dbName);
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
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('IndexedDB open blocked'));
      });

      const tx = db.transaction(['langWordStatus', 'langWordTrash'], 'readwrite');
      const statusStore = tx.objectStore('langWordStatus');
      const trashStore = tx.objectStore('langWordTrash');
      const now = Date.now();
      for (const e of args.live) {
        statusStore.put({ term: e.term, status: e.status, updatedAt: now });
      }
      for (const e of args.trash) {
        trashStore.put({ term: e.term, previousStatus: e.previousStatus, trashedAt: e.trashedAt });
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
    },
    { live, trash },
  );
}

async function shadowClick(page: Page, selector: string, timeout = 10_000): Promise<void> {
  const ok = await page.evaluate(
    ({ sel, maxWait }) =>
      new Promise<boolean>((resolve) => {
        const startTime = Date.now();
        const tick = (): void => {
          const el = document
            .getElementById('cell-universal-panel-host')
            ?.shadowRoot?.querySelector(sel) as HTMLElement | null;
          if (el) {
            el.click();
            resolve(true);
            return;
          }
          if (Date.now() - startTime > maxWait) {
            resolve(false);
            return;
          }
          setTimeout(tick, 100);
        };
        tick();
      }),
    { sel: selector, maxWait: timeout },
  );
  if (!ok) throw new Error(`shadow click target never appeared: ${selector}`);
}

async function shadowCount(page: Page, selector: string): Promise<number> {
  return page.evaluate(
    (sel) =>
      document
        .getElementById('cell-universal-panel-host')
        ?.shadowRoot?.querySelectorAll(sel).length ?? 0,
    selector,
  );
}

async function shadowText(page: Page, selector: string): Promise<string | null> {
  return page.evaluate(
    (sel) =>
      (document
        .getElementById('cell-universal-panel-host')
        ?.shadowRoot?.querySelector(sel)?.textContent ?? null),
    selector,
  );
}

async function shadowType(page: Page, selector: string, value: string): Promise<void> {
  const ok = await page.evaluate(
    ({ sel, text }) => {
      const input = document
        .getElementById('cell-universal-panel-host')
        ?.shadowRoot?.querySelector(sel) as HTMLInputElement | null;
      if (!input) return false;
      input.focus();
      input.value = text;
      input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
      return true;
    },
    { sel: selector, text: value },
  );
  if (!ok) throw new Error(`shadow input target not found: ${selector}`);
}

const row = (term: string): string => `[data-cell-id="vocabulary-row-${term}"]`;
const trashRow = (term: string): string => `[data-cell-id="vocabulary-trash-row-${term}"]`;
const segCount = (s: string): string => `[data-cell-id="vocabulary-segment-count-${s}"]`;
const openFilter = (page: Page): Promise<void> =>
  shadowClick(page, '[data-cell-id="vocabulary-filter"]');
const openMore = (page: Page): Promise<void> =>
  shadowClick(page, '[data-cell-id="vocabulary-more"]');
const openTrash = async (page: Page): Promise<void> => {
  await openMore(page);
  await shadowClick(page, '[data-cell-id="vocabulary-more-trash"]');
};
const backToLive = (page: Page): Promise<void> =>
  shadowClick(page, '[data-cell-id="vocabulary-trash-back"]');

test('vocabulary tab: hero, segments, bulk delete, trash restore/purge, persistence', async ({
  cellContext,
  streamFlixPage,
  universalPanel,
}) => {
  const page = streamFlixPage;

  // Mount vocabulary once so the extension creates the dict DB, then seed.
  await universalPanel.open();
  await universalPanel.openTab('vocabulary');
  await expect
    .poll(() => shadowCount(page, '[data-cell-id="vocabulary-tab"]'), { timeout: 15_000 })
    .toBe(1);

  await seedVocabulary(
    cellContext,
    [
      { term: 'alpha', status: 'tracking' },
      { term: 'beta', status: 'known' },
      { term: 'gamma', status: 'ignore' },
      { term: 'delta', status: 'tracking' },
      { term: 'zeta', status: 'unknown' },
    ],
    [{ term: 'epsilon', previousStatus: 'known', trashedAt: Date.now() - 2 * 60 * 60 * 1000 }],
  );

  // Remount the tab so the source reloads from IndexedDB.
  await universalPanel.openTab('dictionary');
  await universalPanel.openTab('vocabulary');
  await expect
    .poll(() => shadowCount(page, row('alpha')), { timeout: 15_000 })
    .toBe(1);

  // Hero reports the known count; legacy 'unknown' zeta row is swept.
  expect(await shadowText(page, '[data-cell-id="vocabulary-hero"]')).toContain('1 Known words');
  expect(await shadowCount(page, row('zeta'))).toBe(0);

  // Filter menu counts.
  await openFilter(page);
  await expect.poll(() => shadowText(page, segCount('all'))).toBe('4');
  await expect.poll(() => shadowText(page, segCount('tracking'))).toBe('2');
  await expect.poll(() => shadowText(page, segCount('known'))).toBe('1');
  await expect.poll(() => shadowText(page, segCount('ignore'))).toBe('1');
  await expect.poll(() => shadowText(page, segCount('learning'))).toBe('0');

  // Segment filter (menu already open).
  await shadowClick(page, '[data-cell-id="vocabulary-segment-tracking"]');
  await expect.poll(() => shadowCount(page, '[data-cell-id^="vocabulary-row-"]')).toBe(2);
  expect(await shadowCount(page, row('alpha'))).toBe(1);
  expect(await shadowCount(page, row('delta'))).toBe(1);
  await openFilter(page);
  await shadowClick(page, '[data-cell-id="vocabulary-segment-all"]');

  // Search lives behind the top-bar toggle and filters the live view.
  await shadowClick(page, '[data-cell-id="vocabulary-search-toggle"]');
  await shadowType(page, 'input[data-cell-id="vocabulary-search"]', 'alph');
  await expect.poll(() => shadowCount(page, '[data-cell-id^="vocabulary-row-"]')).toBe(1);
  expect(await shadowCount(page, row('alpha'))).toBe(1);
  await shadowType(page, 'input[data-cell-id="vocabulary-search"]', '');
  await shadowClick(page, '[data-cell-id="vocabulary-search-toggle"]');

  // Selection drives the bulk bar; confirmed Delete soft-deletes into Trash.
  expect(await shadowText(page, '[data-cell-id="vocabulary-meta"]')).toBe('4 words');
  await shadowClick(page, '[data-cell-id="vocabulary-select-alpha"]');
  await expect.poll(() => shadowText(page, '[data-cell-id="vocabulary-meta"]')).toBe('1 selected');
  await shadowClick(page, '[data-cell-id="vocabulary-bulk-delete"]');
  await expect
    .poll(() => shadowCount(page, '[data-cell-id="vocabulary-bulk-delete-dialog"]'), { timeout: 10_000 })
    .toBe(1);
  await shadowClick(page, '[data-cell-id="vocabulary-bulk-delete-confirm"]');
  await expect.poll(() => shadowCount(page, row('alpha')), { timeout: 10_000 }).toBe(0);

  // Trash opens from the more menu: no hero, no sort, no selection.
  await openMore(page);
  await expect
    .poll(() => shadowText(page, '[data-cell-id="vocabulary-trash-count"]'), { timeout: 10_000 })
    .toBe('2');
  await shadowClick(page, '[data-cell-id="vocabulary-more-trash"]');
  await expect.poll(() => shadowCount(page, trashRow('alpha')), { timeout: 10_000 }).toBe(1);
  expect(await shadowCount(page, trashRow('epsilon'))).toBe(1);
  expect(await shadowCount(page, '[data-cell-id="vocabulary-sort"]')).toBe(0);
  expect(await shadowCount(page, '[data-cell-id="vocabulary-hero"]')).toBe(0);
  expect(await shadowCount(page, '[data-cell-id="vocabulary-select-alpha"]')).toBe(0);

  // Restore alpha → returns to live list with previous status.
  await shadowClick(page, '[data-cell-id="vocabulary-restore-alpha"]');
  await expect.poll(() => shadowCount(page, trashRow('alpha')), { timeout: 10_000 }).toBe(0);
  await backToLive(page);
  await expect.poll(() => shadowCount(page, row('alpha')), { timeout: 10_000 }).toBe(1);

  // Delete forever purges epsilon from trash.
  await openTrash(page);
  await shadowClick(page, '[data-cell-id="vocabulary-trash-delete-epsilon"]');
  await expect
    .poll(() => shadowCount(page, '[data-cell-id="vocabulary-trash-delete-dialog"]'), { timeout: 10_000 })
    .toBe(1);
  await shadowClick(page, '[data-cell-id="vocabulary-trash-delete-confirm"]');
  await expect
    .poll(() => shadowCount(page, '[data-cell-id="vocabulary-trash-empty"]'), { timeout: 10_000 })
    .toBe(1);
  await backToLive(page);

  // Cycle beta known→ignore→tracking (3-status loop; row stays in live list).
  await shadowClick(page, '[data-cell-id="vocabulary-cycle-beta"]');
  await openFilter(page);
  await expect.poll(() => shadowText(page, segCount('ignore')), { timeout: 10_000 }).toBe('2');
  await shadowClick(page, '[data-cell-id="vocabulary-segment-all"]');
  await shadowClick(page, '[data-cell-id="vocabulary-cycle-beta"]');
  await openFilter(page);
  await expect.poll(() => shadowText(page, segCount('tracking')), { timeout: 10_000 }).toBe('3');
  await expect.poll(() => shadowText(page, segCount('all'))).toBe('4');
  await shadowClick(page, '[data-cell-id="vocabulary-segment-all"]');
  await expect.poll(() => shadowCount(page, row('beta'))).toBe(1);

  // Persistence: reload the page, reopen panel — state survives.
  await page.reload({ waitUntil: 'networkidle' });
  await universalPanel.open();
  await universalPanel.openTab('vocabulary');
  await openFilter(page);
  await expect.poll(() => shadowText(page, segCount('all')), { timeout: 15_000 }).toBe('4');
  await shadowClick(page, '[data-cell-id="vocabulary-segment-all"]');
  await openMore(page);
  await expect
    .poll(() => shadowText(page, '[data-cell-id="vocabulary-trash-count"]'), { timeout: 10_000 })
    .toBe('0');
  await page.keyboard.press('Escape');
  expect(await shadowCount(page, row('zeta'))).toBe(0);
});
