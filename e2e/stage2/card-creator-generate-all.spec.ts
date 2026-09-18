import { resolve } from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from '../fixtures/actors/universalPanel.fixture';
import { getE2EAgentPaths } from '../lib/agent-paths';

const SETTINGS_KEY = 'settings';
const DB_SCHEMA_VERSION = 12;

/** Minimal schema-v29 settings payload. `loadSettings` merges nested defaults. */
function makeSettings(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 29,
    dictionaryPopup: { srsDestination: 'anki' },
    cardCreator: {
      ankiConnectUrl: 'http://localhost:8765',
      defaultNoteType: '',
      defaultDeck: '',
      defaultTags: '',
      mediaUpdateMode: 'overwrite',
      autoCompleteToggles: {
        definitions: true,
        wordAudios: true,
        sentenceAudios: true,
        images: true,
        sentenceTranslation: true,
        sentence: true,
      },
      fieldMappings: {},
    },
    ...overrides,
  };
}

async function seedStorage(
  context: BrowserContext,
  payload: { settings?: Record<string, unknown> },
): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(
    (args: { settingsKey: string; settings?: Record<string, unknown> }) => {
      const storage: Record<string, unknown> = {};
      if (args.settings) {
        storage[args.settingsKey] = args.settings;
      }
      return new Promise<void>((resolve, reject) => {
        chrome.storage.local.set(storage, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(String(chrome.runtime.lastError.message)));
          } else {
            resolve();
          }
        });
      });
    },
    { settingsKey: SETTINGS_KEY, ...payload },
  );
}

/** Seed one DICTIONARY resource + entries into the extension's IndexedDB so a
 *  live lookup resolves real definitions. Mirrors baseRepository
 *  (`orca-dict-{hash}-{lang}`, v12, createAllStores) — the create-all upgrade
 *  handler is replicated in case the worker has not opened the DB yet. */
async function seedDictionary(
  context: BrowserContext,
  langCode: string,
  entries: ReadonlyArray<{ term: string; definition: string; pos?: string; examples?: string }>,
): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(
    async (args: { lang: string; version: number; entries: ReadonlyArray<{ term: string; definition: string; pos?: string; examples?: string }> }) => {
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
          if (!d.objectStoreNames.contains('langWordTrash')) {
            d.createObjectStore('langWordTrash', { keyPath: 'term' });
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
          examples: e.examples ?? '',
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

/** Read a field's textarea value inside the panel shadow root. */
function fieldValue(page: Page, dataId: string): Promise<string | null> {
  return page.evaluate(
    (id) => {
      const root = document.getElementById('cell-universal-panel-host')?.shadowRoot;
      const area = root?.querySelector(`[data-cell-id="${id}-input"] textarea`) as HTMLTextAreaElement | null;
      return area?.value ?? null;
    },
    dataId,
  );
}

/** Count attached media items for a MediaList inside the panel shadow root. */
function mediaCount(page: Page, dataId: string, kind: 'audio' | 'image'): Promise<number> {
  return page.evaluate(
    ({ id, k }) => {
      const root = document.getElementById('cell-universal-panel-host')?.shadowRoot;
      const selector = k === 'audio'
        ? `[data-cell-id="${id}"] [data-cell-id^="${id}-view-"]`
        : `[data-cell-id="${id}"] [data-cell-id^="${id}-thumb-"]`;
      return root?.querySelectorAll(selector)?.length ?? 0;
    },
    { id: dataId, k: kind },
  );
}

/**
 * Contract (user cycle):
 *   Given: Universal Panel > Dictionary tab open, Card Creator pane empty,
 *          user types a word into Target word and clicks "Generate all"
 *   Then:  the system looks the word up in the dictionary and returns the
 *          data into Card Creator — definitions (always) plus whichever
 *          media sources resolve — with a visible feedback toast.
 */
test.describe('Stage 2: Card Creator > Generate all from a typed target word', () => {
  test('looks the word up in the dictionary and fills the card', async ({
    cellContext,
    universalPanel,
    streamFlixPage,
  }, testInfo) => {
    await seedStorage(cellContext, { settings: makeSettings() });
    await seedDictionary(cellContext, 'en', [
      {
        term: 'exclamation',
        pos: 'n.',
        definition: '1. a sudden cry or remark expressing surprise\n2. the act of exclaiming',
        examples: 'an exclamation of delight',
      },
    ]);

    await universalPanel.open();
    await universalPanel.openTab('dictionary');

    // Card Creator pane renders on the right even without a lookup context.
    const contentReady = await streamFlixPage.evaluate(
      (maxWait) =>
        new Promise<boolean>((resolve) => {
          const start = Date.now();
          const tick = (): void => {
            const root = document.getElementById('cell-universal-panel-host')?.shadowRoot;
            if (root?.querySelector('[data-cell-id="card-creator-content"]')) return resolve(true);
            if (Date.now() - start > maxWait) return resolve(false);
            setTimeout(tick, 100);
          };
          tick();
        }),
      15_000,
    );
    expect(contentReady, 'Card Creator pane did not mount').toBe(true);

    // User types the target word manually (no prefill — context is null).
    const targetArea = streamFlixPage.locator('[data-cell-id="cc-target-word-input"] textarea');
    await targetArea.fill('exclamation');
    await expect.poll(() => fieldValue(streamFlixPage, 'cc-target-word')).toBe('exclamation');

    // User clicks Generate all → dictionary lookup → data flows back.
    await streamFlixPage.locator('[data-cell-id="cc-generate-all"]').click();

    // Definitions must be populated from the seeded dictionary entry.
    await expect
      .poll(() => fieldValue(streamFlixPage, 'cc-definitions'), { timeout: 20_000 })
      .not.toBe('');

    const definitions = await fieldValue(streamFlixPage, 'cc-definitions');
    expect(definitions, 'definitions stayed empty after Generate all').toContain('sudden cry');

    // A feedback toast is visible in the card creator body.
    const toast = streamFlixPage.locator('[data-cell-id="cc-toast-stack"] [data-toast-kind]');
    await expect(toast.first()).toBeVisible({ timeout: 5_000 });

    // Media fetched from dictionary sources lands in the card (word audio).
    await expect
      .poll(() => mediaCount(streamFlixPage, 'cc-word-audios-list', 'audio'), { timeout: 20_000 })
      .toBeGreaterThanOrEqual(1);

    await streamFlixPage.screenshot({
      path: resolve(getE2EAgentPaths().agentRoot, 'card-creator-generate-all.png'),
    });
    await streamFlixPage.screenshot({ path: testInfo.outputPath('card-creator-generate-all.png') });
  });
});
