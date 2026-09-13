import { expect, type BrowserContext, type Page } from '@playwright/test';
import { test } from '../fixtures/actors/universalPanel.fixture';

const OVERLAY_TARGET_SELECTOR = '[data-cell-id="subtitle-block"] [data-role="target"] span';
const VIDEO_SELECTOR = '#player-wrapper video';

const CUE2_START_S = 20.2;
const CUE2_END_S = 25.533;
const CUE3_START_S = 29.266;
const GAP_TIME_S = 27.0;
const FAR_GAP_S = 50.0;

type StudyModeAdvanced = { skipNoDialogue: string; removeBracketed: boolean };
const ADVANCED_OFF: StudyModeAdvanced = { skipNoDialogue: 'OFF', removeBracketed: false };

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

async function writeStudyModes(
  context: BrowserContext,
  activeModeId: string,
  advanced: StudyModeAdvanced = ADVANCED_OFF,
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

async function seekPaused(page: Page, timeS: number): Promise<void> {
  const video = page.locator(VIDEO_SELECTOR).first();
  await video.evaluate((v: HTMLVideoElement, t: number) => {
    v.muted = true;
    v.pause();
    v.currentTime = t;
  }, timeS);
}

async function play(page: Page): Promise<void> {
  await page.locator(VIDEO_SELECTOR).first().evaluate((v: HTMLVideoElement) => void v.play());
}

async function isTargetHidden(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.getElementById('cell-subtitle-root')?.shadowRoot;
    const layer = root?.querySelector('[data-role="target"]');
    if (!layer) return true;
    const text = (layer.textContent ?? '').trim();
    if (text === '') return true;
    const el = layer as HTMLElement;
    const style = getComputedStyle(el);
    return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
  });
}

function targetLine(page: Page) {
  return page.locator(OVERLAY_TARGET_SELECTOR).first();
}

async function waitForCue2(page: Page): Promise<void> {
  await expect(targetLine(page)).toContainText(/silence/i, { timeout: 30_000 });
}

test.describe('Stage 2: Study Modes on StreamFlix', () => {
  test('listen hides subtitles and normal restores them via storage sync', async ({
    cellContext,
    streamFlixPage,
  }) => {
    await seedOverlaySettings(cellContext);
    await writeStudyModes(cellContext, 'normal');
    await seekPaused(streamFlixPage, CUE2_START_S + 0.4);
    await waitForCue2(streamFlixPage);

    await writeStudyModes(cellContext, 'listen');
    await expect.poll(() => isTargetHidden(streamFlixPage), { timeout: 10_000 }).toBe(true);

    await writeStudyModes(cellContext, 'normal');
    await expect(targetLine(streamFlixPage)).toContainText(/silence/i, { timeout: 10_000 });
  });

  test('dictation slows to 0.75x, repeats the cue, and normal restores baseline rate', async ({
    cellContext,
    streamFlixPage,
  }) => {
    await seedOverlaySettings(cellContext);
    await writeStudyModes(cellContext, 'normal');

    const video = streamFlixPage.locator(VIDEO_SELECTOR).first();
    await video.evaluate((v: HTMLVideoElement, t: number) => {
      v.muted = true;
      v.pause();
      v.playbackRate = 1.25;
      v.currentTime = t;
    }, CUE2_START_S + 0.4);
    await waitForCue2(streamFlixPage);

    await writeStudyModes(cellContext, 'dictation');
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.playbackRate), { timeout: 10_000 })
      .toBe(0.75);

    await play(streamFlixPage);
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 20_000 })
      .toBeLessThan(CUE2_START_S + 2);

    await writeStudyModes(cellContext, 'normal');
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.playbackRate), { timeout: 10_000 })
      .toBe(1.25);
    await expect(targetLine(streamFlixPage)).toContainText(/lyin/i, { timeout: 10_000 });
  });

  test('read pauses at cue start, resumes on user play, pauses at cue end', async ({
    cellContext,
    streamFlixPage,
  }) => {
    await seedOverlaySettings(cellContext);
    await writeStudyModes(cellContext, 'normal');
    await seekPaused(streamFlixPage, CUE2_START_S + 0.4);
    await waitForCue2(streamFlixPage);
    await play(streamFlixPage);

    const video = streamFlixPage.locator(VIDEO_SELECTOR).first();
    await writeStudyModes(cellContext, 'read');
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused), { timeout: 10_000 })
      .toBe(true);

    await play(streamFlixPage);
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused), { timeout: 10_000 })
      .toBe(false);

    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused), { timeout: 15_000 })
      .toBe(true);

    await writeStudyModes(cellContext, 'normal');
  });

  test('panel preset click applies to the player in-process', async ({
    cellContext,
    streamFlixPage,
    universalPanel,
  }) => {
    await seedOverlaySettings(cellContext);
    await writeStudyModes(cellContext, 'normal');
    await seekPaused(streamFlixPage, CUE2_START_S + 0.4);
    await waitForCue2(streamFlixPage);

    await universalPanel.open();
    await universalPanel.openTab('studyModes');

    const clickModeCard = (id: string) =>
      streamFlixPage.evaluate((cellId) => {
        const root = document.getElementById('cell-universal-panel-host')?.shadowRoot;
        const card = root?.querySelector(`[data-cell-id="${cellId}"]`) as HTMLElement | null;
        card?.click();
        return !!card;
      }, `mode-card-${id}`);

    await expect.poll(() => clickModeCard('listen'), { timeout: 15_000 }).toBe(true);
    await expect.poll(() => isTargetHidden(streamFlixPage), { timeout: 10_000 }).toBe(true);

    await expect.poll(() => clickModeCard('normal'), { timeout: 10_000 }).toBe(true);
    await expect(targetLine(streamFlixPage)).toContainText(/silence/i, { timeout: 10_000 });
  });

  test('JUMP silence skip seeks to the next cue instead of replaying the gap', async ({
    cellContext,
    streamFlixPage,
  }) => {
    await seedOverlaySettings(cellContext);
    await writeStudyModes(cellContext, 'normal');
    await seekPaused(streamFlixPage, CUE2_START_S + 0.4);
    await waitForCue2(streamFlixPage);

    await writeStudyModes(cellContext, 'listen', {
      skipNoDialogue: 'JUMP',
      removeBracketed: false,
    });
    await expect.poll(() => isTargetHidden(streamFlixPage), { timeout: 10_000 }).toBe(true);

    await seekPaused(streamFlixPage, GAP_TIME_S);
    await play(streamFlixPage);

    const video = streamFlixPage.locator(VIDEO_SELECTOR).first();
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(CUE3_START_S);

    await writeStudyModes(cellContext, 'normal');
  });

  test('external seek aborts the in-flight cue chain instead of snapping back', async ({
    cellContext,
    streamFlixPage,
  }) => {
    await seedOverlaySettings(cellContext);
    await writeStudyModes(cellContext, 'normal');
    await seekPaused(streamFlixPage, CUE2_START_S + 0.4);
    await waitForCue2(streamFlixPage);

    const video = streamFlixPage.locator(VIDEO_SELECTOR).first();
    await writeStudyModes(cellContext, 'dictation');
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.playbackRate), { timeout: 10_000 })
      .toBe(0.75);

    await video.evaluate((v: HTMLVideoElement, t: number) => {
      v.currentTime = t;
    }, FAR_GAP_S);
    await play(streamFlixPage);

    await streamFlixPage.waitForTimeout(1500);
    const stayed = await video.evaluate(
      (v: HTMLVideoElement, far: number) => v.currentTime > far - 2,
      FAR_GAP_S,
    );
    expect(stayed).toBe(true);

    await writeStudyModes(cellContext, 'normal');
  });
});
