import { expect, type Page } from '@playwright/test';
import { test } from '../fixtures/actors/universalPanel.fixture';

async function clickClose(page: Page): Promise<void> {
  const rect = await page.evaluate(() => {
    const host = document.getElementById('cell-universal-panel-host');
    const btn = host?.shadowRoot?.querySelector('[data-cell-id="universal-panel-close"]');
    const r = btn?.getBoundingClientRect();
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
  });
  if (!rect) throw new Error('close button not found');
  await page.mouse.click(rect.x, rect.y);
}

async function expectPanelGone(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .getElementById('cell-universal-panel-host')
            ?.shadowRoot?.querySelector('[data-cell-id="universal-panel"]') != null,
      ),
    )
    .toBe(false);
}

test.describe('universal panel close', () => {
  test('X button unmounts the panel (normal motion)', async ({ universalPanel, streamFlixPage }) => {
    await universalPanel.open();
    await clickClose(streamFlixPage);
    await expectPanelGone(streamFlixPage);
  });

  test('X button unmounts the panel under prefers-reduced-motion', async ({
    universalPanel,
    streamFlixPage,
  }) => {
    // With animations disabled no animationend ever fires — the panel must
    // still unmount via the fallback, not stay rendered with the host's
    // pointer-events disabled (regression: panel looked permanently open).
    await streamFlixPage.emulateMedia({ reducedMotion: 'reduce' });
    await universalPanel.open();
    await clickClose(streamFlixPage);
    await expectPanelGone(streamFlixPage);
  });
});
