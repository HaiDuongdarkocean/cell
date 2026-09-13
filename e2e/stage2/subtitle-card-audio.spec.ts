import { expect, type BrowserContext, type Locator } from '@playwright/test';
import { test } from '../fixtures/cellEnvironment.fixture';

const SETTINGS_KEY = 'settings';
const DB_SCHEMA_VERSION = 11;

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

async function pointForWord(locator: Locator, wordReSource: string): Promise<{ x: number; y: number } | null> {
  return locator.evaluate((el, source) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const re = new RegExp(source, 'i');
    let node: Text | null = null;
    while ((node = walker.nextNode() as Text | null)) {
      const match = re.exec(node.textContent ?? '');
      if (!match) continue;
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return null;
  }, wordReSource);
}

test.describe('Stage 2: Subtitle lookup > Card Creator media source on StreamFlix', () => {
  test('send to card from a target cue word records the video audio instead of TTS', async ({
    cellContext,
    streamFlixPage,
  }, testInfo) => {
    await seedStorage(cellContext, { settings: makeSettings() });
    await seedDictionary(cellContext, 'en', [
      {
        term: 'silence',
        pos: 'n.',
        definition: '1. complete absence of sound\n2. the state of being silent',
      },
    ]);

    const video = streamFlixPage.locator('#player-wrapper video').first();
    // Play muted at half speed inside cue 2 (20.2s-25.5s "LYIN' ISN'T BETTER
    // THAN SILENCE") so autoplay always succeeds and the cue stays active
    // until the popup opens and pauses playback inside the cue range.
    await video.evaluate((v: HTMLVideoElement) => {
      v.muted = true;
      v.playbackRate = 0.5;
      v.currentTime = 20.6;
      void v.play();
    });

    const targetLayer = streamFlixPage
      .locator('[data-cell-id="subtitle-block"] [data-role="target"]')
      .first();
    await expect(targetLayer).toBeVisible({ timeout: 15_000 });
    await expect(targetLayer).toContainText(/silence/i, { timeout: 15_000 });

    // Re-seek to the cue start — the overlay poll above may have taken seconds
    // — then wait for the mock controls to auto-hide (~3s) before clicking.
    await video.evaluate((v: HTMLVideoElement) => {
      v.currentTime = 20.4;
    });
    await streamFlixPage.waitForTimeout(3400);

    const point = await pointForWord(targetLayer, '\\bsilence\\b');
    expect(point).not.toBeNull();
    await streamFlixPage.mouse.click(point!.x, point!.y);

    const sendButton = streamFlixPage.locator(
      '.js-cell-popup-host [data-cell-id="dictionary-send-to-card"]',
    );
    await expect(sendButton).toBeVisible({ timeout: 15_000 });
    await sendButton.click();

    // The progress chip floats bottom-center over the video while the cue
    // audio is being recorded ("Preparing card…" then "Recording…").
    const chip = streamFlixPage.locator('[data-cell-id="subtitle-toast"]');
    await expect(chip).toContainText(/recording|preparing/i, { timeout: 15_000 });

    // collectCardCreatorMedia seeks the video back to the cue start and
    // records ~5.3s of cue audio before the panel mounts — wait generously.
    const sentenceRows = streamFlixPage.locator(
      '[data-cell-id="cc-sentence-audios-list"] [data-cell-id^="cc-sentence-audios-list-view-"]',
    );
    await expect(sentenceRows.first()).toBeVisible({ timeout: 30_000 });

    // A recorded cue clip is named cell-sentence-<ts>-<rand>.<ext>; fetched
    // TTS/URL audio is named cell-audio-<ts>-<rand>.<ext>.
    const labels = await sentenceRows.evaluateAll((els) =>
      els.map((el) => el.getAttribute('aria-label') ?? ''),
    );
    expect(labels.some((l) => /cell-sentence-\d+-[a-z0-9]+\./i.test(l))).toBe(true);
    expect(labels.every((l) => !/cell-audio-/.test(l))).toBe(true);

    const thumbs = streamFlixPage.locator(
      '[data-cell-id="cc-images-list"] [data-cell-id^="cc-images-list-thumb-"]',
    );
    await expect(thumbs.first()).toBeVisible({ timeout: 5_000 });

    // Panel opened — the chip has been dismissed.
    await expect(chip).toHaveCount(0);

    await streamFlixPage.screenshot({ path: testInfo.outputPath('subtitle-card-audio.png') });
  });
});
