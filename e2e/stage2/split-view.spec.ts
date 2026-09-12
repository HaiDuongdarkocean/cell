import { expect } from '@playwright/test';
import { test } from '../fixtures/cellEnvironment.fixture';

test.describe('Stage 2: Split View on StreamFlix', () => {
  test('pressing t keeps the video visible beside the subtitle panel', async ({ streamFlixPage }) => {
    const video = streamFlixPage.locator('video');
    const before = await video.boundingBox();
    expect(before).not.toBeNull();

    await streamFlixPage.keyboard.press('t');
    const wrapper = streamFlixPage.locator('[data-cell-split-view="wrapper"]');
    const panel = streamFlixPage.locator('[data-cell-split-view="panel"]');
    await expect(wrapper).toBeVisible({ timeout: 10_000 });
    await expect(panel).toBeVisible();

    const after = await video.boundingBox();
    // The video stage must keep ~its original height (bug: height collapsed to 0).
    expect(after!.height).toBeGreaterThan(before!.height * 0.5);
    expect(after!.width).toBeGreaterThan(0);

    await streamFlixPage.keyboard.press('t');
    await expect(wrapper).toHaveCount(0, { timeout: 5_000 });
    const restored = await video.boundingBox();
    expect(Math.round(restored!.height)).toBe(Math.round(before!.height));
  });
});
