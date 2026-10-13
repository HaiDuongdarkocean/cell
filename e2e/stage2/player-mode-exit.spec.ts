import { expect } from '@playwright/test';
import { test } from '../fixtures/TihokaEnvironment.fixture';

test('player mode enter/exit restores subtitle host without page errors', async ({ streamFlixPage }) => {
  const pageErrors: string[] = [];
  streamFlixPage.on('pageerror', (e) => pageErrors.push(e.message));

  const originalParentInfo = await streamFlixPage.evaluate(() => {
    const host = document.getElementById('Tihoka-subtitle-root');
    return host?.parentElement ? { tag: host.parentElement.tagName, cls: host.parentElement.className } : null;
  });
  expect(originalParentInfo).not.toBeNull();

  await streamFlixPage.keyboard.press('g');
  const cueTexts = streamFlixPage.locator('[data-tihoka-id="cue-target-text"]');
  await expect(cueTexts.first()).toBeVisible({ timeout: 15_000 });

  await streamFlixPage.keyboard.press('g');
  await streamFlixPage.waitForTimeout(1500);

  const restored = await streamFlixPage.evaluate(() => {
    const host = document.getElementById('Tihoka-subtitle-root');
    return host?.parentElement ? { tag: host.parentElement.tagName, cls: host.parentElement.className } : null;
  });
  expect(restored).toEqual(originalParentInfo);
  expect(pageErrors).toEqual([]);
});
