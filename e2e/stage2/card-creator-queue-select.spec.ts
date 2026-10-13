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
      const root = document.getElementById('Tihoka-universal-panel-host')?.shadowRoot;
      const area = root?.querySelector(`[data-tihoka-id="${id}-input"] textarea`) as HTMLTextAreaElement | null;
      return area?.value ?? null;
    },
    dataId,
  );
}

/** Count attached media items for a MediaList inside the panel shadow root. */
function mediaCount(page: Page, dataId: string, kind: 'audio' | 'image'): Promise<number> {
  return page.evaluate(
    ({ id, k }) => {
      const root = document.getElementById('Tihoka-universal-panel-host')?.shadowRoot;
      const selector = k === 'audio'
        ? `[data-tihoka-id="${id}"] [data-tihoka-id^="${id}-view-"]`
        : `[data-tihoka-id="${id}"] [data-tihoka-id^="${id}-thumb-"]`;
      return root?.querySelectorAll(selector)?.length ?? 0;
    },
    { id: dataId, k: kind },
  );
}

/** Click an element inside a shadow root via a composed DOM click (the mock
 *  player's overlay mask swallows coordinate clicks). */
function shadowClick(page: Page, hostId: string, selector: string): Promise<boolean> {
  return page.evaluate(
    ({ host, sel }) => {
      const el = document
        .getElementById(host)
        ?.shadowRoot?.querySelector<HTMLElement>(sel);
      if (!el) return false;
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
      return true;
    },
    { host: hostId, sel: selector },
  );
}

/** Read all queue item terms (row order) from the queue panel. */
function queueTerms(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const root = document.getElementById('Tihoka-universal-panel-host')?.shadowRoot;
    const rows = root?.querySelectorAll('[data-tihoka-id^="cc-queue-item-"]') ?? [];
    return Array.from(rows).map((r) => r.textContent?.trim() ?? '');
  });
}

/**
 * Contract (user cycle):
 *   Given: video playing a subtitle cue, user clicks "Edit card" → Card
 *          Creator opens inside the Universal Panel with a queue of the
 *          cue's unknown/tracking words
 *   When:  the user clicks a queue item
 *   Then:  Card Creator switches to that term AND runs the same dictionary
 *          generate flow as "Generate all" — the item's definitions stay,
 *          word audio is fetched for the new term, and shared cue media
 *          (screenshot image) is preserved.
 */
test.describe('Stage 2: Card Creator > queue item select runs dictionary generate', () => {
  test('clicking a queue item looks up its term and fills the card', async ({
    TihokaContext,
    streamFlixPage,
  }, testInfo) => {
    await seedStorage(TihokaContext, { settings: makeSettings() });
    await seedDictionary(TihokaContext, 'en', [
      {
        term: 'better',
        pos: 'adj.',
        definition: 'of a more excellent or effective type or quality',
      },
      {
        term: 'than',
        pos: 'conj.',
        definition: 'used to introduce the second element in a comparison',
      },
      {
        term: 'silence',
        pos: 'n.',
        definition: 'complete absence of sound; stillness',
      },
    ]);

    // Seek to cue 2 ("LYIN' ISN'T BETTER THAN SILENCE", 20.2s–25.5s) so the
    // edit-card action has an active target cue to build the queue from.
    // Keep the video paused — captureSentenceAudio seeks/plays the cue range
    // itself; an active cue only requires currentTime inside the cue window.
    await streamFlixPage.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement | null;
      if (video) video.currentTime = 21;
    });

    // Wait until the cue text actually renders in the subtitle overlay —
    // clicking edit-card while cues are still loading hits the
    // "No active subtitle" early return.
    await expect
      .poll(async () => {
        return streamFlixPage.evaluate(() => {
          const root = document.getElementById('Tihoka-subtitle-root')?.shadowRoot;
          const text = root?.querySelector('[data-tihoka-id="subtitle-block"]')?.textContent ?? '';
          return /better|silence/i.test(text);
        });
      }, { timeout: 30_000 })
      .toBe(true);

    // Click "Edit card" → capture + build queue → sendToCard opens the panel.
    await shadowClick(streamFlixPage, 'Tihoka-subtitle-root', '[data-tihoka-id="edit-card-btn"]');

    // The panel opens (dictionary tab + card creator) and the queue slide-over
    // auto-opens when the cue yields ≥ 2 unknown/tracking words.
    await expect
      .poll(async () => {
        return streamFlixPage.evaluate(() => {
          const root = document.getElementById('Tihoka-universal-panel-host')?.shadowRoot;
          return !!root?.querySelector('[data-tihoka-id="cc-queue-panel"] [data-tihoka-id^="cc-queue-item-"]');
        });
      }, { timeout: 30_000 })
      .toBe(true);

    const terms = await queueTerms(streamFlixPage);
    expect(terms.length).toBeGreaterThanOrEqual(2);
    const silenceIdx = terms.findIndex((t) => t.includes('silence'));
    expect(silenceIdx, `queue rows ${JSON.stringify(terms)} lack "silence"`).toBeGreaterThanOrEqual(0);

    // Word audio starts empty — the queue build only carries definitions.
    expect(await mediaCount(streamFlixPage, 'cc-word-audios-list', 'audio')).toBe(0);

    // Click the "silence" item's select button → panel closes → select+generate runs.
    await shadowClick(
      streamFlixPage,
      'Tihoka-universal-panel-host',
      `[data-tihoka-id="cc-queue-item-${silenceIdx}"] button`,
    );

    await expect
      .poll(() => fieldValue(streamFlixPage, 'cc-target-word'), { timeout: 10_000 })
      .toBe('silence');
    await expect
      .poll(() => fieldValue(streamFlixPage, 'cc-definitions'), { timeout: 20_000 })
      .toContain('stillness');

    // The select+generate flow fetched word audio for the new term.
    await expect
      .poll(() => mediaCount(streamFlixPage, 'cc-word-audios-list', 'audio'), { timeout: 20_000 })
      .toBeGreaterThanOrEqual(1);

    // Switch to "better" → the card must swap to that term (stale-term media
    // was cleared, the new term's own lookup applies).
    await shadowClick(streamFlixPage, 'Tihoka-universal-panel-host', '[data-tihoka-id="cc-queue-toggle"]');
    await expect
      .poll(async () => (await queueTerms(streamFlixPage)).length, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(2);
    const betterIdx = (await queueTerms(streamFlixPage)).findIndex((t) => t.includes('better'));
    expect(betterIdx).toBeGreaterThanOrEqual(0);
    await shadowClick(
      streamFlixPage,
      'Tihoka-universal-panel-host',
      `[data-tihoka-id="cc-queue-item-${betterIdx}"] button`,
    );

    await expect
      .poll(() => fieldValue(streamFlixPage, 'cc-target-word'), { timeout: 10_000 })
      .toBe('better');
    await expect
      .poll(() => fieldValue(streamFlixPage, 'cc-definitions'), { timeout: 20_000 })
      .toContain('excellent');
    await expect
      .poll(() => mediaCount(streamFlixPage, 'cc-word-audios-list', 'audio'), { timeout: 20_000 })
      .toBeGreaterThanOrEqual(1);

    await streamFlixPage.screenshot({
      path: resolve(getE2EAgentPaths().agentRoot, 'card-creator-queue-select.png'),
    });
    await streamFlixPage.screenshot({ path: testInfo.outputPath('card-creator-queue-select.png') });
  });
});
