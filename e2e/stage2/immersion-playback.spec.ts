import { expect, type BrowserContext, type Page } from '@playwright/test';
import { test } from '../fixtures/actors/universalPanel.fixture';

const VIDEO_SELECTOR = '#player-wrapper video';
const OVERLAY_TARGET_SELECTOR = '[data-cell-id="subtitle-block"] [data-role="target"] span';
const POPUP_HOST_SELECTOR = '.js-cell-popup-host';
const STREAMFLIX_SUBTITLE_KEYS = [
  'http://127.0.0.1:4321/',
  'http://127.0.0.1:4321/index.html',
] as const;

const DB_SCHEMA_VERSION = 11;
const CUE2_START_S = 20.2;
const CUE2_END_S = 25.533;
const CUE3_START_S = 29.266;

// Cue 2 = "♪ LYIN' ISN'T BETTER THAN SILENCE ♪" (20.2–25.533). With a seeded
// FREQUENCY resource, ONLY 'silence' carries an entry (rank varies per test) —
// every other word is unlisted and therefore never pausable once a frequency
// resource is enabled.
const SILENCE_DEF = 'DEF_SILENCE_MARKER the complete absence of sound';

const IMMERSION_ADVANCED = {
  skipNoDialogue: 'OFF',
  removeBracketed: false,
  pauseOnUnknown: 'END',
  unknownLevel: 'advanced',
  popupOnAutoPause: true,
  popupCloseOnResume: true,
};

type Advanced = typeof IMMERSION_ADVANCED;

async function seedSettings(context: BrowserContext): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      chrome.storage.local.set(
        { settings: { schemaVersion: 29, subtitleOverlayTargetLanguage: 'en' } },
        () => {
          if (chrome.runtime.lastError) {
            reject(new Error(String(chrome.runtime.lastError.message)));
          } else {
            resolve();
          }
        },
      );
    });
  });
}

async function writeTokenize(context: BrowserContext, enabled: boolean): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(
    (args: { enabled: boolean; keys: readonly string[] }) => {
      const subtitleUrls: Record<string, boolean> = {};
      for (const key of args.keys) subtitleUrls[key] = args.enabled;
      const tokenizeSettings = { schemaVersion: 1, origins: {}, urls: {}, subtitleUrls };
      return new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ tokenizeSettings }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(String(chrome.runtime.lastError.message)));
          } else {
            resolve();
          }
        });
      });
    },
    { enabled, keys: STREAMFLIX_SUBTITLE_KEYS },
  );
}

/** Seed one DICTIONARY resource (popup resolves real definitions) + one
 *  FREQUENCY resource into the extension's IndexedDB. Every test seeds its
 *  own entries because the profile's IndexedDB persists across tests in the
 *  suite — a FREQUENCY resource left over from an earlier test disables the
 *  unfiltered fallback and would gate cues the test didn't intend.
 *  Mirrors dictionary-nested-popup.spec. */
async function seedDictionaryAndFrequency(
  context: BrowserContext,
  freqEntries: ReadonlyArray<{ term: string; rank: number }>,
): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(
    async (args: {
      lang: string;
      version: number;
      freq: ReadonlyArray<{ term: string; rank: number }>;
      def: string;
    }) => {
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

      const tx = db.transaction(
        ['langResourceInfo', 'langDictionaryEntry', 'langFrequencyEntry'],
        'readwrite',
      );
      const resourceStore = tx.objectStore('langResourceInfo');
      const dictStore = tx.objectStore('langDictionaryEntry');
      const freqStore = tx.objectStore('langFrequencyEntry');

      const dictId = await new Promise<number>((resolve, reject) => {
        const req = resourceStore.add({
          name: 'e2e-dict',
          langCode: args.lang,
          type: 'DICTIONARY',
          format: 'json-array',
          signature: `e2e-dict-${Date.now()}`,
          wordCount: 1,
          installationFinished: true,
          importedAt: Date.now(),
        });
        req.onsuccess = () => resolve(req.result as number);
        req.onerror = () => reject(req.error);
      });
      dictStore.add({
        resourceId: dictId,
        term: 'silence',
        reading: '',
        altterm: '',
        pronunciation: '',
        definition: args.def,
        pos: 'noun',
        examples: '',
        audio: '',
        backwardTerm: reverse('silence'),
      });

      const freqId = await new Promise<number>((resolve, reject) => {
        const req = resourceStore.add({
          name: 'e2e-freq',
          langCode: args.lang,
          type: 'FREQUENCY',
          format: 'json-array',
          signature: `e2e-freq-${Date.now()}`,
          wordCount: args.freq.length,
          installationFinished: true,
          enabled: true,
          importedAt: Date.now(),
        });
        req.onsuccess = () => resolve(req.result as number);
        req.onerror = () => reject(req.error);
      });
      for (const e of args.freq) {
        freqStore.add({
          resourceId: freqId,
          term: e.term,
          reading: '',
          frequency: e.rank,
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
    { lang: 'en', version: DB_SCHEMA_VERSION, freq: freqEntries, def: SILENCE_DEF },
  );
}

async function writeStudyModes(
  context: BrowserContext,
  activeModeId: string,
  advanced: Advanced,
): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(
    ({ id, adv }) => {
      const studyModes = { version: 1, activeModeId: id, customModes: [], advanced: adv };
      return new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ studyModes }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(String(chrome.runtime.lastError.message)));
          } else {
            resolve();
          }
        });
      });
    },
    { id: activeModeId, adv: advanced },
  );
}

async function play(page: Page): Promise<void> {
  await page.locator(VIDEO_SELECTOR).first().evaluate((v: HTMLVideoElement) => void v.play());
}

function targetLine(page: Page) {
  return page.locator(OVERLAY_TARGET_SELECTOR).first();
}

function popupHosts(page: Page) {
  return page.locator(POPUP_HOST_SELECTOR);
}

async function seekPaused(page: Page, timeS: number): Promise<void> {
  await page.locator(VIDEO_SELECTOR).first().evaluate((v: HTMLVideoElement, t: number) => {
    v.muted = true;
    v.pause();
    v.currentTime = t;
  }, timeS);
}

async function expectPausedAtCueEnd(page: Page): Promise<void> {
  const video = page.locator(VIDEO_SELECTOR).first();
  await expect
    .poll(
      async () =>
        video.evaluate(
          (v: HTMLVideoElement, cueEnd: number) => v.paused && v.currentTime >= cueEnd - 1,
          CUE2_END_S,
        ),
      { timeout: 25_000 },
    )
    .toBe(true);
}

test.describe('Stage 2: Immersion Playback on StreamFlix', () => {
  test('auto-pause at cue end opens the dictionary popup on the pausable token (tokenize on)', async ({
    cellContext,
    streamFlixPage,
  }) => {
    await seedSettings(cellContext);
    await seedDictionaryAndFrequency(cellContext, [{ term: 'silence', rank: 15000 }]);
    await writeTokenize(cellContext, true);
    await writeStudyModes(cellContext, 'normal', IMMERSION_ADVANCED);

    await seekPaused(streamFlixPage, CUE2_START_S + 0.4);
    await expect(targetLine(streamFlixPage)).toContainText(/silence/i, { timeout: 30_000 });

    await play(streamFlixPage);
    await expectPausedAtCueEnd(streamFlixPage);

    // Popup opens and resolves the seeded definition for 'silence' — proving
    // the lookup targeted the pausable token, not the cue's first word.
    await expect(popupHosts(streamFlixPage).first()).toBeAttached({ timeout: 15_000 });
    await expect(popupHosts(streamFlixPage).first()).toContainText(/DEF_SILENCE_MARKER/i, {
      timeout: 20_000,
    });

    // Business rule: moving to another cue (a/d/s/x/z or natural progression)
    // dismisses the popup.
    await streamFlixPage.keyboard.press('d');
    await expect(popupHosts(streamFlixPage)).toHaveCount(0, { timeout: 10_000 });
  });

  test('auto-pause still pauses but opens no popup when tokenize is off', async ({
    cellContext,
    streamFlixPage,
  }) => {
    await seedSettings(cellContext);
    await seedDictionaryAndFrequency(cellContext, [{ term: 'silence', rank: 15000 }]);
    await writeTokenize(cellContext, false);
    await writeStudyModes(cellContext, 'normal', IMMERSION_ADVANCED);

    await seekPaused(streamFlixPage, CUE2_START_S + 0.4);
    await expect(targetLine(streamFlixPage)).toContainText(/silence/i, { timeout: 30_000 });

    await play(streamFlixPage);
    await expectPausedAtCueEnd(streamFlixPage);

    // Give the (buggy) path a chance to open a popup — it must stay at zero.
    await streamFlixPage.waitForTimeout(3_000);
    await expect(popupHosts(streamFlixPage)).toHaveCount(0);
  });

  test('selected frequency level gates which cues pause', async ({
    cellContext,
    streamFlixPage,
  }) => {
    // 'silence' sits at rank 15000: inside 'advanced' (≤20k) but outside
    // 'common' (≤5k). Every other cue-2 word is unlisted → never pausable.
    await seedSettings(cellContext);
    await seedDictionaryAndFrequency(cellContext, [{ term: 'silence', rank: 15000 }]);
    await writeTokenize(cellContext, false);
    await writeStudyModes(cellContext, 'normal', {
      ...IMMERSION_ADVANCED,
      unknownLevel: 'common',
      popupOnAutoPause: false,
    });

    await seekPaused(streamFlixPage, CUE2_START_S + 0.4);
    await expect(targetLine(streamFlixPage)).toContainText(/silence/i, { timeout: 30_000 });

    // 'common' (≤5k): silence rank 15000 is out of level → plays past cue end.
    const video = streamFlixPage.locator(VIDEO_SELECTOR).first();
    await play(streamFlixPage);
    await expect
      .poll(
        async () =>
          video.evaluate(
            (v: HTMLVideoElement, cueEnd: number) => v.currentTime > cueEnd + 0.5,
            CUE2_END_S,
          ),
        { timeout: 20_000 },
      )
      .toBe(true);
    expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);

    // Switching to 'advanced' (≤20k) brings silence into level → pauses.
    await writeStudyModes(cellContext, 'normal', {
      ...IMMERSION_ADVANCED,
      unknownLevel: 'advanced',
      popupOnAutoPause: false,
    });
    await seekPaused(streamFlixPage, CUE2_START_S + 0.4);
    await play(streamFlixPage);
    await expectPausedAtCueEnd(streamFlixPage);
  });

  test('x/z shortcuts navigate between pausable cues', async ({
    cellContext,
    streamFlixPage,
  }) => {
    // Seed pausable words in BOTH cue 2 ('silence') and cue 3 ('feel') so the
    // test doesn't depend on suite-order IndexedDB leakage: any FREQUENCY
    // resource disables the unfiltered fallback, and without a cue-3 entry
    // 'x' would have no pausable target.
    await seedSettings(cellContext);
    await seedDictionaryAndFrequency(cellContext, [
      { term: 'silence', rank: 100 },
      { term: 'feel', rank: 100 },
    ]);
    await writeStudyModes(cellContext, 'normal', {
      ...IMMERSION_ADVANCED,
      pauseOnUnknown: 'OFF',
      popupOnAutoPause: false,
    });

    const video = streamFlixPage.locator(VIDEO_SELECTOR).first();
    await video.evaluate((v: HTMLVideoElement, t: number) => {
      v.muted = true;
      v.pause();
      v.currentTime = t;
    }, CUE2_START_S + 0.4);
    await expect(targetLine(streamFlixPage)).toContainText(/silence/i, { timeout: 30_000 });

    await streamFlixPage.keyboard.press('x');
    await expect
      .poll(
        async () =>
          video.evaluate(
            (v: HTMLVideoElement, cue3Start: number) =>
              Math.abs(v.currentTime - cue3Start) < 1.5,
            CUE3_START_S,
          ),
        { timeout: 15_000 },
      )
      .toBe(true);

    // Wait for the overlay/engine to settle on cue 3 so findPrev sees the
    // new active index instead of racing the seek.
    await expect(targetLine(streamFlixPage)).toContainText(/floatin/i, { timeout: 15_000 });

    await streamFlixPage.keyboard.press('z');
    await expect
      .poll(
        async () =>
          video.evaluate(
            (v: HTMLVideoElement, cue2Start: number) =>
              Math.abs(v.currentTime - cue2Start) < 1.5,
            CUE2_START_S,
          ),
        { timeout: 15_000 },
      )
      .toBe(true);
  });
});
