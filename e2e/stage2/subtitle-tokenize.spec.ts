import { expect, type BrowserContext, type Page } from '@playwright/test';
import { test } from '../fixtures/cellEnvironment.fixture';

const SUBTITLE_HOST_ID = 'cell-subtitle-root';
const STREAMFLIX_SUBTITLE_KEYS = [
  'http://127.0.0.1:4321/',
  'http://127.0.0.1:4321/index.html',
] as const;
const WORDY_CUE_START_MS = '20200';
const WORDY_CUE_TEXT = "♪ LYIN' ISN'T BETTER THAN SILENCE ♪";
const OVERLAY_TARGET_SELECTOR = '[data-cell-id="subtitle-block"] [data-role="target"] span';
const TOKEN_SELECTOR = '.js-cell-token[data-cell-term]';

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

async function writeTokenizeSettings(context: BrowserContext, enabled: boolean): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(
    (args: { enabled: boolean; keys: readonly string[] }) => {
      const subtitleUrls: Record<string, boolean> = {};
      for (const key of args.keys) {
        subtitleUrls[key] = args.enabled;
      }
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

async function shadowClick(page: Page, hostId: string, selector: string): Promise<boolean> {
  return page.evaluate(
    ({ host, sel }: { host: string; sel: string }) => {
      const el = document.getElementById(host)?.shadowRoot?.querySelector<HTMLElement>(sel);
      if (!el) return false;
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
      return true;
    },
    { host: hostId, sel: selector },
  );
}

async function overlayWordTokenCount(page: Page): Promise<number> {
  return page
    .locator(OVERLAY_TARGET_SELECTOR)
    .first()
    .evaluate((el) =>
      Array.from(el.querySelectorAll('.js-cell-token[data-cell-term]')).filter(
        (t) => (t.getAttribute('data-cell-term') ?? '').length > 0,
      ).length,
    );
}

test.describe('Stage 2: Subtitle tokenize > token spans on StreamFlix', () => {
  test('enabling subtitle tokenize renders token spans in the overlay and the Player Mode cue list', async ({
    cellContext,
    streamFlixPage,
  }) => {
    await seedOverlaySettings(cellContext);
    await writeTokenizeSettings(cellContext, true);

    const video = streamFlixPage.locator('#player-wrapper video').first();
    await video.evaluate((v: HTMLVideoElement) => {
      v.muted = true;
      v.playbackRate = 0.5;
      v.currentTime = 20.6;
      void v.play();
    });

    const targetLine = streamFlixPage.locator(OVERLAY_TARGET_SELECTOR).first();
    await expect(targetLine).toBeVisible({ timeout: 15_000 });
    await expect(targetLine).toContainText(/silence/i, { timeout: 15_000 });

    await expect
      .poll(() => overlayWordTokenCount(streamFlixPage), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);

    await video.evaluate((v: HTMLVideoElement) => {
      v.pause();
      v.currentTime = 20.6;
    });

    await expect
      .poll(
        () => shadowClick(streamFlixPage, SUBTITLE_HOST_ID, '[data-cell-id="player-mode-btn"]'),
        { timeout: 15_000 },
      )
      .toBe(true);

    const cueTargetText = streamFlixPage.locator(
      `[data-cell-id="cue-item"][data-cue-start="${WORDY_CUE_START_MS}"] [data-cell-id="cue-target-text"]`,
    );
    await expect(cueTargetText).toBeAttached({ timeout: 15_000 });
    await expect(cueTargetText).toContainText(/silence/i, { timeout: 15_000 });
    const firstCueToken = cueTargetText.locator(TOKEN_SELECTOR).first();
    await expect(firstCueToken).toBeVisible({ timeout: 15_000 });
    await expect(firstCueToken).toHaveClass(/js-cell-token--word/);
    await expect(firstCueToken).toHaveClass(/js-cell-token--status-[a-z]+/);
    await expect(firstCueToken.locator('.js-cell-token-word')).toHaveCount(1);
    await expect(firstCueToken.locator('.js-cell-token-status')).toHaveCount(1);
  });

  test('disabling subtitle tokenize restores plain subtitle text', async ({
    cellContext,
    streamFlixPage,
  }) => {
    await seedOverlaySettings(cellContext);
    await writeTokenizeSettings(cellContext, true);

    const video = streamFlixPage.locator('#player-wrapper video').first();
    await video.evaluate((v: HTMLVideoElement) => {
      v.muted = true;
      v.playbackRate = 0.5;
      v.currentTime = 20.6;
      void v.play();
    });

    const targetLine = streamFlixPage.locator(OVERLAY_TARGET_SELECTOR).first();
    await expect(targetLine).toBeVisible({ timeout: 15_000 });
    await expect(targetLine).toContainText(/silence/i, { timeout: 15_000 });

    await expect
      .poll(() => overlayWordTokenCount(streamFlixPage), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);

    await video.evaluate((v: HTMLVideoElement) => {
      v.pause();
      v.currentTime = 20.6;
    });

    await writeTokenizeSettings(cellContext, false);

    await expect
      .poll(
        () =>
          targetLine.evaluate((el) => el.querySelectorAll('.js-cell-token').length),
        { timeout: 15_000 },
      )
      .toBe(0);

    const plainText = await targetLine.evaluate((el) =>
      (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(plainText).toBe(WORDY_CUE_TEXT);
  });
});
