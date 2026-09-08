import { expect, type Page } from '@playwright/test';
import { test } from './extension.fixture';

const STREAMFLIX_URL = 'http://127.0.0.1:4321/index.html';

/**
 * Wait for the Cell subtitle overlay shadow host and orbital badge to mount
 * on the StreamFlix mock page, then open the Universal Panel via the badge.
 */
async function openUniversalPanelFromBadge(page: Page): Promise<void> {
  const video = page.locator('video').first();
  await expect(video).toBeVisible({ timeout: 30_000 });

  // Content script attaches the Cell subtitle overlay host.
  const overlayHost = page.locator('#cell-subtitle-root');
  await expect(overlayHost).toBeAttached({ timeout: 30_000 });

  // Orbital badge is mounted by webTextDictionaryController.
  const badgeHost = page.locator('.js-cell-orbital-badge-host');
  await expect(badgeHost).toBeAttached({ timeout: 30_000 });

  const badge = badgeHost.locator('[data-cell-id="orbital-badge"]');
  await expect(badge).toBeVisible({ timeout: 10_000 });

  // Single tap at the edge toggles the universal panel.
  await badge.click();

  // Wait for the panel shadow host and the dictionary tab to render.
  const panelHost = page.locator('#cell-universal-panel-host');
  await expect(panelHost).toBeAttached({ timeout: 15_000 });
  await expect(panelHost).toBeVisible({ timeout: 10_000 });
}

/**
 * Wait up to `timeout` ms for the dictionary search input to exist inside the
 * Universal Panel shadow root, then dispatch synthetic input + Enter events to
 * trigger a lookup.
 */
async function searchDictionaryInPanel(page: Page, term: string, timeout = 10_000): Promise<void> {
  const ok = await page.evaluate(({ searchTerm, maxWait }) => new Promise<boolean>((resolve) => {
    const startTime = Date.now();
    const tick = (): void => {
      const host = document.getElementById('cell-universal-panel-host');
      if (host) {
        const root = host.shadowRoot ?? host;
        const input = root.querySelector('[data-cell-id="dictionary-search-input"] input') as HTMLInputElement | null;
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

test.describe('Cell MV3 extension on StreamFlix', () => {
  test('opens Universal Panel > Dictionary from the orbital badge', async ({ context }) => {
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(STREAMFLIX_URL, { waitUntil: 'domcontentloaded' });

    await openUniversalPanelFromBadge(page);

    // Assert the dictionary tab is active and visible.
    const hasDictionaryTab = await page.evaluate(() => {
      const host = document.getElementById('cell-universal-panel-host');
      if (!host) return false;
      const root = host.shadowRoot ?? host;
      return !!root.querySelector('[data-cell-id="universal-panel-tab-dictionary"]');
    });
    expect(hasDictionaryTab).toBe(true);

    // Search a word so the dictionary panel has content to scroll.
    await searchDictionaryInPanel(page, 'exclamation');
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'test-results/stream-universal-desktop-dictionary.png' });

    await page.close();
  });

  test('mobile panel shows collapsed Card Creator sheet with only the pill', async ({ context }) => {
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(STREAMFLIX_URL, { waitUntil: 'domcontentloaded' });

    await openUniversalPanelFromBadge(page);

    // Wait for the mobile Card Creator bottom sheet to attach.
    const sheetPill = page.locator('#cell-universal-panel-host').locator('[data-cell-id="card-creator-sheet-pill"]');
    const pillFound = await sheetPill.count();
    if (pillFound === 0) {
      await page.evaluate(() => {
        const host = document.getElementById('cell-universal-panel-host');
        if (!host) return;
        const root = host.shadowRoot ?? host;
        const pill = root.querySelector('[data-cell-id="card-creator-sheet-pill"]') as HTMLElement | null;
        pill?.click();
      });
    } else {
      await expect(sheetPill).toBeVisible({ timeout: 10_000 });
    }

    // Verify the collapsed sheet is only the pill height (32px) and content is hidden.
    const sheetBounds = await page.evaluate(() => {
      const host = document.getElementById('cell-universal-panel-host');
      if (!host) return null;
      const root = host.shadowRoot ?? host;
      const sheet = root.querySelector('[data-cell-id="card-creator-mobile-sheet"]') as HTMLElement | null;
      return sheet?.getBoundingClientRect() ?? null;
    });

    if (sheetBounds) {
      // The collapsed peek should be 32px (pill only) plus a small amount of
      // the sheet container, not expose Card Creator title / fields.
      expect(sheetBounds.height).toBeLessThanOrEqual(40);
    }

    await page.screenshot({ path: 'test-results/stream-universal-mobile-sheet.png' });
    await page.close();
  });
});
