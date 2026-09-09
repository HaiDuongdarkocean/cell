import { expect, type BrowserContext } from '@playwright/test';
import { test, type UniversalPanelActor } from '../fixtures/actors/universalPanel.fixture';

const SETTINGS_KEY = 'settings';
const ANKI_SCHEMA_CACHE_KEY = 'ankiSchemaCache';

/** Minimal schema-v29 settings payload. `loadSettings` will merge nested defaults. */
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
      audioFallback: 'community-then-tts',
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
  cellContext: BrowserContext,
  payload: { ankiSchemaCache?: Record<string, unknown>; settings?: Record<string, unknown> },
): Promise<void> {
  const worker = cellContext.serviceWorkers()[0] ?? (await cellContext.waitForEvent('serviceworker'));
  await worker.evaluate(
    async (args: {
      settingsKey: string;
      ankiSchemaCacheKey: string;
      settings?: Record<string, unknown>;
      ankiSchemaCache?: Record<string, unknown>;
    }) => {
      await new Promise<void>((resolve) => chrome.storage.local.clear(() => resolve()));
      const storage: Record<string, unknown> = {};
      if (args.ankiSchemaCache) {
        storage[args.ankiSchemaCacheKey] = args.ankiSchemaCache;
      }
      if (args.settings) {
        storage[args.settingsKey] = args.settings;
      }
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set(storage, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(String(chrome.runtime.lastError.message)));
          } else {
            resolve();
          }
        });
      });
    },
    {
      settingsKey: SETTINGS_KEY,
      ankiSchemaCacheKey: ANKI_SCHEMA_CACHE_KEY,
      ...payload,
    },
  );
}

async function readSettings(cellContext: BrowserContext): Promise<Record<string, unknown>> {
  const worker = cellContext.serviceWorkers()[0] ?? (await cellContext.waitForEvent('serviceworker'));
  return worker.evaluate(
    (key: string) =>
      new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.get(key, (result) => resolve((result[key] as Record<string, unknown>) ?? {}));
      }),
    SETTINGS_KEY,
  );
}

async function openCardCreatorSettings(universalPanel: UniversalPanelActor): Promise<void> {
  await universalPanel.open();
  await universalPanel.openTab('settings');

  const ok = await universalPanel.page.evaluate(
    (maxWait) =>
      new Promise<boolean>((resolve) => {
        const start = Date.now();
        const tick = (): void => {
          const host = document.getElementById('cell-universal-panel-host');
          const root = host?.shadowRoot;
          const card = root?.querySelector('[data-section="cardCreator"]') as HTMLElement | null;
          if (card) {
            card.scrollIntoView({ block: 'center' });
            resolve(true);
            return;
          }
          if (Date.now() - start > maxWait) {
            resolve(false);
            return;
          }
          setTimeout(tick, 200);
        };
        tick();
      }),
    15_000,
  );

  expect(ok, 'Card Creator settings card did not mount').toBe(true);
}

/**
 * Wait until a Select inside the Card Creator panel shows the expected trigger label.
 */
async function waitForSelectValue(
  universalPanel: UniversalPanelActor,
  selectDataId: string,
  expected: string,
  timeout = 10_000,
): Promise<void> {
  await universalPanel.page.waitForFunction(
    ({ selectDataId, expected }) => {
      const host = document.getElementById('cell-universal-panel-host');
      const root = host?.shadowRoot;
      const section = root?.querySelector('[data-section="cardCreator"]') as HTMLElement | null;
      const selectRoot = section?.querySelector(`[data-cell-id="${selectDataId}"]`) as HTMLElement | null;
      const value = selectRoot?.querySelector('button[aria-haspopup="listbox"]');
      return value?.textContent?.trim() === expected;
    },
    { selectDataId, expected },
    { timeout },
  );
}

/**
 * Open a Select inside the Card Creator settings panel and choose an option by label.
 */
async function selectInCardCreatorSettings(
  universalPanel: UniversalPanelActor,
  selectDataId: string,
  optionLabel: string,
): Promise<void> {
  const ok = await universalPanel.page.evaluate(
    ({ selectDataId, optionLabel, maxWait }) =>
      new Promise<boolean>((resolve, reject) => {
        const host = document.getElementById('cell-universal-panel-host');
        const root = host?.shadowRoot;
        const section = root?.querySelector('[data-section="cardCreator"]') as HTMLElement | null;
        if (!section) return reject(new Error('Card Creator section not found'));

        const selectRoot = section.querySelector(`[data-cell-id="${selectDataId}"]`) as HTMLElement | null;
        if (!selectRoot) return reject(new Error(`Select ${selectDataId} not found`));

        const trigger = selectRoot.querySelector('button[aria-haspopup="listbox"]') as HTMLElement | null;
        if (!trigger) return reject(new Error(`Trigger for ${selectDataId} not found`));

        trigger.click();

        const start = Date.now();
        const tick = (): void => {
          // Options are portaled to the nearest shadow-root child, so search the whole shadow root.
          const options = root.querySelectorAll('[role="option"]');
          if (options.length > 0) {
            const target = Array.from(options).find((o) => o.textContent?.trim() === optionLabel);
            if (target) {
              (target as HTMLElement).click();
              resolve(true);
              return;
            }
          }
          if (Date.now() - start > maxWait) {
            const visibleOptions = Array.from(options).map((o) => o.textContent);
            reject(new Error(`Option "${optionLabel}" not found in ${selectDataId}. Visible: ${visibleOptions.join(', ')}`));
            return;
          }
          setTimeout(tick, 100);
        };
        tick();
      }),
    { selectDataId, optionLabel, maxWait: 10_000 },
  );

  expect(ok, `Could not select "${optionLabel}" in ${selectDataId}`).toBe(true);
}

test.describe('Stage 2: Card Creator > Anki config in settings', () => {
  test('renders from the persisted schema cache while AnkiConnect is offline', async ({ cellContext, universalPanel }) => {
    const ankiSchemaCache = {
      url: 'http://offline.invalid',
      fetchedAt: Date.now(),
      decks: ['CachedDeck'],
      models: ['Basic'],
      fieldsByModel: { Basic: ['Front', 'Back', 'Definitions'] },
    };

    const settings = makeSettings({
      cardCreator: {
        ankiConnectUrl: 'http://offline.invalid',
        defaultNoteType: 'Basic',
        defaultDeck: 'CachedDeck',
        defaultTags: '',
        mediaUpdateMode: 'overwrite',
        audioFallback: 'community-then-tts',
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
    });

    await seedStorage(cellContext, { ankiSchemaCache, settings });
    await openCardCreatorSettings(universalPanel);

    await waitForSelectValue(universalPanel, 'cc-note-type-select', 'Basic');
    await waitForSelectValue(universalPanel, 'cc-deck-select', 'CachedDeck');

    // Mapping should be auto-populated from the cached fields without network.
    await waitForSelectValue(universalPanel, 'cc-mapping-select-targetWord', 'Front');
  });

  test('settings destination picker switches Anki / Ocean SRS and persists', async ({ cellContext, universalPanel }) => {
    const settings = makeSettings({
      dictionaryPopup: { srsDestination: 'anki' },
    });

    await seedStorage(cellContext, { settings });
    await openCardCreatorSettings(universalPanel);

    // Switch to Ocean SRS
    await waitForSelectValue(universalPanel, 'cc-srs-destination', 'Anki');
    await selectInCardCreatorSettings(universalPanel, 'cc-srs-destination', 'Ocean SRS');

    const after = await readSettings(cellContext);
    expect((after.dictionaryPopup as Record<string, unknown>).srsDestination).toBe('ocean-srs');

    // The Anki-specific inputs should be hidden
    await universalPanel.page.waitForFunction(() => {
      const host = document.getElementById('cell-universal-panel-host');
      const root = host?.shadowRoot;
      const section = root?.querySelector('[data-section="cardCreator"]') as HTMLElement | null;
      return !section?.querySelector('[data-cell-id="cc-anki-url-input"]');
    }, { timeout: 5_000 });

    // Switch back to Anki
    await selectInCardCreatorSettings(universalPanel, 'cc-srs-destination', 'Anki');
    const afterBack = await readSettings(cellContext);
    expect((afterBack.dictionaryPopup as Record<string, unknown>).srsDestination).toBe('anki');
  });

  test('settings field mapping editor writes per-note-type mappings', async ({ cellContext, universalPanel }) => {
    const ankiSchemaCache = {
      url: 'http://localhost:8765',
      fetchedAt: Date.now(),
      decks: ['Default'],
      models: ['Basic'],
      fieldsByModel: { Basic: ['Front', 'Back', 'Definitions'] },
    };

    const settings = makeSettings({
      cardCreator: {
        ankiConnectUrl: 'http://localhost:8765',
        defaultNoteType: 'Basic',
        defaultDeck: 'Default',
        defaultTags: '',
        mediaUpdateMode: 'overwrite',
        audioFallback: 'community-then-tts',
        autoCompleteToggles: {
          definitions: true,
          wordAudios: true,
          sentenceAudios: true,
          images: true,
          sentenceTranslation: true,
          sentence: true,
        },
        fieldMappings: {
          Basic: { targetWord: 'Front' },
        },
      },
    });

    await seedStorage(cellContext, { ankiSchemaCache, settings });
    await openCardCreatorSettings(universalPanel);

    await waitForSelectValue(universalPanel, 'cc-mapping-select-targetWord', 'Front');

    await selectInCardCreatorSettings(universalPanel, 'cc-mapping-select-targetWord', 'Back');

    const after = await readSettings(cellContext);
    expect((after.cardCreator as Record<string, unknown>).fieldMappings).toEqual(
      expect.objectContaining({
        Basic: expect.objectContaining({ targetWord: 'Back' }),
      }),
    );
  });
});
