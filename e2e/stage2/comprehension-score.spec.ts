import { expect, type BrowserContext, type Page } from '@playwright/test';
import { test } from '../fixtures/cellEnvironment.fixture';

const PILL_HOST_SELECTOR = '.js-cell-comprehension-pill-host';

type PillSnapshot = {
  badgeText: string | null;
  band: string | null;
  hasToggle: boolean;
  rect: { width: number; height: number };
} | null;

async function seedOverlaySettings(context: BrowserContext): Promise<void> {
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

async function readPill(page: Page): Promise<PillSnapshot> {
  return page.evaluate((hostSelector: string) => {
    const host = document.querySelector<HTMLElement>(hostSelector);
    const root = host?.shadowRoot;
    if (!root) return null;
    const badge = root.querySelector('[data-cell-id="comprehension-badge"]');
    if (!badge) return null;
    const rect = (root.querySelector('[data-cell-id="comprehension-pill"]') ?? badge).getBoundingClientRect();
    return {
      badgeText: badge.textContent,
      band: badge.getAttribute('data-band'),
      hasToggle: Boolean(root.querySelector('[role="radiogroup"]')),
      rect: { width: rect.width, height: rect.height },
    };
  }, PILL_HOST_SELECTOR);
}

test.describe('Stage 2: Comprehension score > floating pill on StreamFlix', () => {
  test('media score pill appears with coverage and band once cues load', async ({
    cellContext,
    streamFlixPage,
  }) => {
    await seedOverlaySettings(cellContext);

    const video = streamFlixPage.locator('#player-wrapper video').first();
    await video.evaluate((v: HTMLVideoElement) => {
      v.muted = true;
      v.playbackRate = 0.5;
      v.currentTime = 20.6;
      void v.play();
    });

    let pill: PillSnapshot = null;
    await expect
      .poll(async () => {
        pill = await readPill(streamFlixPage);
        return pill;
      }, { timeout: 20_000 })
      .not.toBeNull();

    expect(pill?.badgeText).toMatch(/^\d+%$/);
    expect(pill?.band).toMatch(/^(comfortable|stretch|hard)$/);
    expect(pill?.rect.width).toBeGreaterThan(0);
    expect(pill?.rect.height).toBeGreaterThan(0);
    expect(pill?.hasToggle).toBe(false);

    await video.evaluate((v: HTMLVideoElement) => {
      v.currentTime = 45;
    });
    await expect
      .poll(async () => (await readPill(streamFlixPage))?.badgeText, { timeout: 15_000 })
      .toMatch(/^\d+%$/);

    await video.evaluate((v: HTMLVideoElement) => {
      v.pause();
      v.currentTime = 120;
    });
    await expect
      .poll(async () => (await readPill(streamFlixPage))?.band, { timeout: 15_000 })
      .toMatch(/^(comfortable|stretch|hard)$/);
  });
});
