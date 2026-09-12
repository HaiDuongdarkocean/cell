import { expect } from '@playwright/test';
import { test } from './extension.fixture';

const portOffset = parseInt(process.env.PW_PORT_OFFSET || '0', 10);
const STREAM_MOCK_URL = `http://127.0.0.1:${4321 + portOffset}/index.html`;

test.describe('Cell subtitle manager panel', () => {
  test('manager toggle button opens the subtitle manager panel', async ({
    context,
  }, testInfo) => {
    const page = await context.newPage();
    await page.goto(STREAM_MOCK_URL, { waitUntil: 'domcontentloaded' });

    // Mock StreamFlix page mounts a <video> directly.
    await expect(page.locator('video')).toBeVisible({ timeout: 30_000 });

    // Content script attaches the Cell overlay host to the player container.
    await expect(page.locator('#cell-subtitle-root')).toBeAttached({
      timeout: 15_000,
    });

    // Click the manager toggle button (inside the overlay's shadow DOM).
    // A coordinate-based click is intercepted by the mock player's play mask,
    // so dispatch a bubbling DOM click instead — React's root listener receives
    // it and fires onToggleManager.
    await page.evaluate(() => {
      const host = document.getElementById('cell-subtitle-root');
      const btn = host?.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-cell-id="manager-toggle-btn"]',
      );
      if (!btn) throw new Error('manager-toggle-btn not found');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    });

    // The manager panel is portaled into #cell-manager-portal (its own
    // shadow host); assert the layer renders and is visible.
    const managerLayer = page.locator('[data-cell-id="subtitle-manager-layer"]');
    await expect(managerLayer).toBeVisible({ timeout: 10_000 });

    await page.screenshot({
      path: testInfo.outputPath('subtitle-manager-open.png'),
      fullPage: false,
    });
    await page.close();
  });
});
