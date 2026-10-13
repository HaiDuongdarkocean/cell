import { expect, type Page } from '@playwright/test';
import { test } from '../fixtures/TihokaEnvironment.fixture';

const CUE2_START_S = 20.2;

async function videoState(page: Page): Promise<{ paused: boolean; currentTime: number }> {
  return page.evaluate(() => {
    const v = document.querySelector('video');
    return { paused: v?.paused ?? true, currentTime: v?.currentTime ?? -1 };
  });
}

test("'s' replay-cue resumes playback when the video is paused", async ({
  streamFlixPage,
}) => {
  const page = streamFlixPage;

  // Cue items in Player Mode prove bilingual cues finished loading.
  await page.keyboard.press('g');
  await expect(page.locator('[data-tihoka-id="cue-item"]').first()).toBeVisible({
    timeout: 15_000,
  });
  await page.keyboard.press('g');

  await page.evaluate(() => {
    const v = document.querySelector('video');
    if (v) {
      v.currentTime = 25;
      v.pause();
    }
  });
  expect((await videoState(page)).paused).toBe(true);

  await page.keyboard.press('s');

  await expect
    .poll(async () => (await videoState(page)).paused, { timeout: 10_000 })
    .toBe(false);

  const { currentTime } = await videoState(page);
  expect(currentTime).toBeGreaterThanOrEqual(CUE2_START_S);
  expect(currentTime).toBeLessThan(25);
});
