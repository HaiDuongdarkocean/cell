import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { test as base } from '../cellEnvironment.fixture';

/**
 * Stable data-cell-id selectors for the Universal Panel and its sub-features.
 */
export const SELECTORS = {
  orbitalBadge: '[data-cell-id="orbital-badge"]',
  host: '#cell-universal-panel-host',
  tabDictionary: '[data-cell-id="universal-panel-tab-dictionary"]',
  tabStudyModes: '[data-cell-id="universal-panel-tab-study-modes"]',
  tabSettings: '[data-cell-id="universal-panel-tab-settings"]',
  dictionarySearchInput: 'input[data-cell-id="dictionary-search-input"]',
  cardCreatorMobileSheet: '[data-cell-id="card-creator-mobile-sheet"]',
} as const;

export type UniversalPanelTab = 'dictionary' | 'studyModes' | 'settings';

const TAB_SELECTORS: Record<UniversalPanelTab, string> = {
  dictionary: SELECTORS.tabDictionary,
  studyModes: SELECTORS.tabStudyModes,
  settings: SELECTORS.tabSettings,
};

/**
 * Fixture-wrapped actor for the Universal Panel.
 *
 * Provides typed, reusable actions that know how to pierce the panel's
 * shadow root and dispatch composed events when Playwright locators alone
 * cannot drive the React-controlled inputs.
 */
export class UniversalPanelActor {
  constructor(public readonly page: Page) {}

  /**
   * Click the orbital badge and wait for the panel shadow host to render.
   */
  async open(): Promise<void> {
    const badge = this.page.locator(SELECTORS.orbitalBadge);
    await expect(badge).toBeVisible({ timeout: 15_000 });
    await badge.click();

    const host = this.page.locator(SELECTORS.host);
    await expect(host).toBeAttached({ timeout: 15_000 });
    await expect(host).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Click a tab inside the Universal Panel shadow root.
   */
  async openTab(tab: UniversalPanelTab, timeout = 10_000): Promise<void> {
    const selector = TAB_SELECTORS[tab];
    const ok = await this.page.evaluate(
      ({ sel, maxWait }) =>
        new Promise<boolean>((resolve) => {
          const startTime = Date.now();
          const tick = (): void => {
            const host = document.getElementById('cell-universal-panel-host');
            const root = host?.shadowRoot;
            const tabEl = root?.querySelector(sel) as HTMLElement | null;
            if (tabEl) {
              tabEl.click();
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

    if (!ok) {
      throw new Error(`Universal Panel tab "${tab}" did not mount in time`);
    }
  }

  /**
   * Search the dictionary from inside the panel shadow root.
   */
  async search(term: string, timeout = 10_000): Promise<void> {
    const ok = await this.page.evaluate(
      ({ searchTerm, maxWait }) =>
        new Promise<boolean>((resolve) => {
          const startTime = Date.now();
          const tick = (): void => {
            const host = document.getElementById('cell-universal-panel-host');
            const root = host?.shadowRoot;
            const input = root?.querySelector(
              'input[data-cell-id="dictionary-search-input"]',
            ) as HTMLInputElement | null;
            if (input) {
              input.focus();
              input.value = searchTerm;
              input.dispatchEvent(
                new InputEvent('input', { bubbles: true, composed: true }),
              );
              input.dispatchEvent(
                new KeyboardEvent('keydown', {
                  key: 'Enter',
                  bubbles: true,
                  composed: true,
                }),
              );
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
      { searchTerm: term, maxWait: timeout },
    );

    if (!ok) {
      throw new Error('Dictionary search input did not mount in time');
    }
  }

  /**
   * Get the bounding rectangle of the mobile Card Creator sheet inside the
   * panel shadow root. Returns null if the sheet is not present.
   */
  async getCardCreatorSheetBounds(): Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;
  } | null> {
    return this.page.evaluate(() => {
      const host = document.getElementById('cell-universal-panel-host');
      const root = host?.shadowRoot;
      const sheet = root?.querySelector(
        '[data-cell-id="card-creator-mobile-sheet"]',
      ) as HTMLElement | null;
      return sheet?.getBoundingClientRect() ?? null;
    });
  }
}

type UniversalPanelFixtures = {
  universalPanel: UniversalPanelActor;
};

export const test = base.extend<UniversalPanelFixtures>({
  universalPanel: async ({ streamFlixPage }, use) => {
    const actor = new UniversalPanelActor(streamFlixPage);
    await use(actor);
  },
});

export { expect };
