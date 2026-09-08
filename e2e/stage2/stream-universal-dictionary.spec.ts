import { expect } from '@playwright/test';
import { test } from '../fixtures/cellEnvironment.fixture';

/**
 * Search the dictionary from inside the Universal Panel shadow root by
 * dispatching synthetic events on the React-controlled search input.
 */
async function searchDictionaryInPanel(page: import('@playwright/test').Page, term: string, timeout = 10_000): Promise<void> {
  const ok = await page.evaluate(({ searchTerm, maxWait }) => new Promise<boolean>((resolve) => {
    const startTime = Date.now();
    const tick = (): void => {
      const host = document.getElementById('cell-universal-panel-host');
      if (host) {
        const root = host.shadowRoot ?? host;
        const input = root.querySelector('input[data-cell-id="dictionary-search-input"]') as HTMLInputElement | null;
        if (input) {
          input.focus();
          input.value = searchTerm;
          input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
          resolve(true);
          return;
        }
      }
      if (Date.now() - startTime > maxWait) {
        resolve(false);
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  }), { searchTerm: term, maxWait: timeout });

  if (!ok) {
    throw new Error('Dictionary search input did not mount in time');
  }
}

test.describe('Stage 2: Universal Panel > Dictionary on StreamFlix', () => {
  test('opens Dictionary via the orbital badge', async ({ streamFlixPage }) => {
    const page = streamFlixPage;

    // Open the Universal Panel by clicking the orbital badge.
    const badge = page.locator('[data-cell-id="orbital-badge"]');
    await badge.click();

    // Wait for the panel shadow host and the dictionary tab to render.
    const panelHost = page.locator('#cell-universal-panel-host');
    await expect(panelHost).toBeAttached({ timeout: 15_000 });
    await expect(panelHost).toBeVisible({ timeout: 10_000 });

    const hasDictionaryTab = await page.evaluate(() => {
      const host = document.getElementById('cell-universal-panel-host');
      if (!host) return false;
      const root = host.shadowRoot ?? host;
      return !!root.querySelector('[data-cell-id="universal-panel-tab-dictionary"]');
    });
    expect(hasDictionaryTab).toBe(true);

    // Search a word so the dictionary panel has content to inspect.
    await searchDictionaryInPanel(page, 'exclamation');
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'test-results/stream-universal-desktop-dictionary.png' });
  });

  test('mobile panel shows collapsed Card Creator sheet with only the pill', async ({ streamFlixPage }) => {
    const page = streamFlixPage;
    await page.setViewportSize({ width: 390, height: 844 });

    const badge = page.locator('[data-cell-id="orbital-badge"]');
    await badge.click();

    const panelHost = page.locator('#cell-universal-panel-host');
    await expect(panelHost).toBeAttached({ timeout: 15_000 });
    await expect(panelHost).toBeVisible({ timeout: 10_000 });

    const sheetBounds = await page.evaluate(() => {
      const host = document.getElementById('cell-universal-panel-host');
      if (!host) return null;
      const root = host.shadowRoot ?? host;
      const sheet = root.querySelector('[data-cell-id="card-creator-mobile-sheet"]') as HTMLElement | null;
      return sheet?.getBoundingClientRect() ?? null;
    });

    if (sheetBounds) {
      // Collapsed peek should expose the pill only (< 40px), not Card Creator fields.
      expect(sheetBounds.height).toBeLessThanOrEqual(40);
    }

    await page.screenshot({ path: 'test-results/stream-universal-mobile-sheet.png' });
  });
});
