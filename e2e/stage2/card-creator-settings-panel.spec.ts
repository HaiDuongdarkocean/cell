import { expect, type BrowserContext, type Page } from '@playwright/test';
import { test, type UniversalPanelActor } from '../fixtures/actors/universalPanel.fixture';

const SETTINGS_KEY = 'settings';

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

/**
 * Click an element inside the Universal Panel shadow root.
 */
function clickInPanel(page: Page, selector: string, timeout = 10_000): Promise<boolean> {
  return page.evaluate(
    ({ sel, maxWait }) =>
      new Promise<boolean>((resolve) => {
        const start = Date.now();
        const tick = (): void => {
          const host = document.getElementById('cell-universal-panel-host');
          const root = host?.shadowRoot;
          const el = root?.querySelector(sel) as HTMLElement | null;
          if (el) {
            el.click();
            resolve(true);
            return;
          }
          if (Date.now() - start > maxWait) {
            resolve(false);
            return;
          }
          setTimeout(tick, 100);
        };
        tick();
      }),
    { sel: selector, maxWait: timeout },
  );
}

interface PanelElementInfo {
  section?: string;
  text?: string;
}

/**
 * Query a single element inside the Universal Panel shadow root.
 * Returns a lightweight, serializable snapshot of the element.
 */
function queryInPanel(page: Page, selector: string, timeout = 10_000): Promise<PanelElementInfo | null> {
  return page.evaluate(
    ({ sel, maxWait }) =>
      new Promise<PanelElementInfo | null>((resolve) => {
        const start = Date.now();
        const tick = (): void => {
          const host = document.getElementById('cell-universal-panel-host');
          const root = host?.shadowRoot;
          const el = root?.querySelector(sel) as HTMLElement | null;
          if (el) {
            resolve({
              section: el.dataset.section,
              text: el.textContent ?? undefined,
            });
            return;
          }
          if (Date.now() - start > maxWait) {
            resolve(null);
            return;
          }
          setTimeout(tick, 100);
        };
        tick();
      }),
    { sel: selector, maxWait: timeout },
  );
}

/**
 * Wait for a selector to be present or absent inside the panel shadow root.
 */
function waitForPanelSelector(
  page: Page,
  selector: string,
  present: boolean,
  timeout = 10_000,
): Promise<boolean> {
  return page.evaluate(
    ({ sel, shouldExist, maxWait }) =>
      new Promise<boolean>((resolve) => {
        const start = Date.now();
        const tick = (): void => {
          const host = document.getElementById('cell-universal-panel-host');
          const root = host?.shadowRoot;
          const exists = !!root?.querySelector(sel);
          if (exists === shouldExist) {
            resolve(true);
            return;
          }
          if (Date.now() - start > maxWait) {
            resolve(false);
            return;
          }
          setTimeout(tick, 100);
        };
        tick();
      }),
    { sel: selector, shouldExist: present, maxWait: timeout },
  );
}

async function openCardCreatorInDictionary(universalPanel: UniversalPanelActor): Promise<void> {
  await universalPanel.open();
  await universalPanel.openTab('dictionary');
  await universalPanel.search('exclamation');

  const clicked = await clickInPanel(
    universalPanel.page,
    '[data-cell-id="dictionary-send-to-card"]',
  );
  expect(clicked, 'Send to Card button did not appear').toBe(true);

  const content = await queryInPanel(
    universalPanel.page,
    '[data-cell-id="card-creator-content"]',
  );
  expect(content, 'Card Creator content did not mount').toBeTruthy();
}

test.describe('Stage 2: Card Creator > Settings side panel in Dictionary', () => {
  test('opens and closes the Card Creator settings panel inside the integrated view', async ({
    cellContext,
    universalPanel,
  }) => {
    const settings = makeSettings();
    await seedStorage(cellContext, { settings });
    await openCardCreatorInDictionary(universalPanel);

    const settingsButtonVisible = await queryInPanel(universalPanel.page, '[data-cell-id="cc-settings"]');
    expect(settingsButtonVisible, 'Card Creator settings button did not render').toBeTruthy();
    await clickInPanel(universalPanel.page, '[data-cell-id="cc-settings"]');

    const layer = await queryInPanel(
      universalPanel.page,
      '[data-cell-id="card-creator-settings-layer"]',
    );
    expect(layer, 'Settings layer did not open').toBeTruthy();
    expect(layer?.section, 'Settings layer section').toBe('cardCreator');

    const backButton = await queryInPanel(
      universalPanel.page,
      '[data-cell-id="cc-settings-back"]',
    );
    expect(backButton, 'Settings back button did not render').toBeTruthy();

    const title = await queryInPanel(
      universalPanel.page,
      '[data-cell-id="card-creator-settings-layer"] h2',
    );
    expect(title?.text, 'Settings title did not render').toBeTruthy();

    await clickInPanel(universalPanel.page, '[data-cell-id="cc-settings-back"]');

    const closed = await waitForPanelSelector(
      universalPanel.page,
      '[data-cell-id="card-creator-settings-layer"]',
      false,
      5_000,
    );
    expect(closed, 'Settings layer did not unmount after close').toBe(true);
  });

  test('reopens the Card Creator settings panel after closing it', async ({
    cellContext,
    universalPanel,
  }) => {
    const settings = makeSettings();
    await seedStorage(cellContext, { settings });
    await openCardCreatorInDictionary(universalPanel);

    const settingsButtonVisible = await queryInPanel(universalPanel.page, '[data-cell-id="cc-settings"]');
    expect(settingsButtonVisible, 'Card Creator settings button did not render').toBeTruthy();
    await clickInPanel(universalPanel.page, '[data-cell-id="cc-settings"]');

    const backButton = await queryInPanel(
      universalPanel.page,
      '[data-cell-id="cc-settings-back"]',
    );
    expect(backButton, 'Back button did not render on first open').toBeTruthy();
    await clickInPanel(universalPanel.page, '[data-cell-id="cc-settings-back"]');

    await waitForPanelSelector(
      universalPanel.page,
      '[data-cell-id="card-creator-settings-layer"]',
      false,
      5_000,
    );

    await clickInPanel(universalPanel.page, '[data-cell-id="cc-settings"]');

    const layer = await queryInPanel(
      universalPanel.page,
      '[data-cell-id="card-creator-settings-layer"]',
    );
    expect(layer, 'Settings layer did not reopen').toBeTruthy();
  });
});
