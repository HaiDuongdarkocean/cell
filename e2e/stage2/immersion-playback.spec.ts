import { expect, type BrowserContext, type Page } from '@playwright/test';
import { test } from '../fixtures/actors/universalPanel.fixture';

const VIDEO_SELECTOR = '#player-wrapper video';
const OVERLAY_TARGET_SELECTOR = '[data-cell-id="subtitle-block"] [data-role="target"] span';

const CUE2_START_S = 20.2;
const CUE2_END_S = 25.533;
const CUE3_START_S = 29.266;

const IMMERSION_ADVANCED = {
  skipNoDialogue: 'OFF',
  removeBracketed: false,
  pauseOnUnknown: 'END',
  unknownScope: 'ALL',
  popupOnAutoPause: false,
  popupCloseOnResume: true,
};

const ADVANCED_OFF = {
  skipNoDialogue: 'OFF',
  removeBracketed: false,
  pauseOnUnknown: 'OFF',
  unknownScope: 'ALL',
  popupOnAutoPause: false,
  popupCloseOnResume: true,
};

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

async function writeStudyModes(
  context: BrowserContext,
  activeModeId: string,
  advanced: typeof IMMERSION_ADVANCED,
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

test.describe('Stage 2: Immersion Playback on StreamFlix', () => {
  test('normal mode auto-pauses at end of a cue containing an unknown word', async ({
    cellContext,
    streamFlixPage,
  }) => {
    await seedSettings(cellContext);
    await writeStudyModes(cellContext, 'normal', IMMERSION_ADVANCED);

    const video = streamFlixPage.locator(VIDEO_SELECTOR).first();
    await video.evaluate((v: HTMLVideoElement, t: number) => {
      v.muted = true;
      v.pause();
      v.currentTime = t;
    }, CUE2_START_S + 0.4);
    await expect(targetLine(streamFlixPage)).toContainText(/silence/i, { timeout: 30_000 });

    await play(streamFlixPage);
    await expect
      .poll(
        async () =>
          video.evaluate(
            (v: HTMLVideoElement, cueEnd: number) => v.paused && v.currentTime >= cueEnd - 1,
            CUE2_END_S,
          ),
        { timeout: 20_000 },
      )
      .toBe(true);

    await writeStudyModes(cellContext, 'normal', ADVANCED_OFF);
    await play(streamFlixPage);
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused), { timeout: 10_000 })
      .toBe(false);
  });

  test('next-unknown-cue shortcut seeks to the next pausable cue', async ({
    cellContext,
    streamFlixPage,
  }) => {
    await seedSettings(cellContext);
    await writeStudyModes(cellContext, 'normal', {
      ...IMMERSION_ADVANCED,
      pauseOnUnknown: 'OFF',
    });

    const video = streamFlixPage.locator(VIDEO_SELECTOR).first();
    await video.evaluate((v: HTMLVideoElement, t: number) => {
      v.muted = true;
      v.pause();
      v.currentTime = t;
    }, CUE2_START_S + 0.4);
    await expect(targetLine(streamFlixPage)).toContainText(/silence/i, { timeout: 30_000 });

    await streamFlixPage.keyboard.press('n');
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
  });
});
