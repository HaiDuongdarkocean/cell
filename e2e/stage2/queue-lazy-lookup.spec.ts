import { expect, type Page } from '@playwright/test';
import { test } from '../fixtures/TihokaEnvironment.fixture';

const STREAMFLIX_URL = 'http://127.0.0.1:4321/index.html';

async function waitForServiceWorker(context) {
  let [sw] = context.serviceWorkers();
  if (!sw) {
    sw = await context.waitForEvent('serviceworker', { timeout: 30_000 });
  }
  return sw;
}

async function setTestStorage(context, url: string): Promise<void> {
  const sw = await waitForServiceWorker(context);
  const pageKey = url;
  await sw.evaluate(async (args) => {
    const { pageKey } = args;
    await chrome.storage.local.set({
      settings: { schemaVersion: 0 },
      tokenizeSettings: {
        schemaVersion: 1,
        origins: {},
        urls: {},
        subtitleUrls: { [pageKey]: true },
      },
    });
    return chrome.storage.local.get(['settings', 'tokenizeSettings']);
  }, { pageKey });
}

async function getInputValueDeep(page: Page, selector: string): Promise<string | null> {
  return page.evaluate((sel) => {
    const search = (root: Document | ShadowRoot | Element): HTMLInputElement | HTMLTextAreaElement | null => {
      const hit = root.querySelector(sel);
      if (hit) return hit as HTMLInputElement | HTMLTextAreaElement;
      for (const el of root.querySelectorAll('*')) {
        const child = (el as HTMLElement).shadowRoot;
        if (child) {
          const nested = search(child);
          if (nested) return nested;
        }
      }
      return null;
    };
    const el = search(document);
    return el?.value?.trim() ?? null;
  }, selector);
}

async function queryDeepText(page: Page, selector: string): Promise<string | null> {
  return page.evaluate((sel) => {
    const search = (root: Document | ShadowRoot | Element): Element | null => {
      const hit = root.querySelector(sel);
      if (hit) return hit;
      for (const el of root.querySelectorAll('*')) {
        const child = (el as HTMLElement).shadowRoot;
        if (child) {
          const nested = search(child);
          if (nested) return nested;
        }
      }
      return null;
    };
    const el = search(document);
    return el?.textContent?.trim() ?? null;
  }, selector);
}

async function clickDeep(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const search = (root: Document | ShadowRoot | Element): Element | null => {
      const hit = root.querySelector(sel);
      if (hit) return hit;
      for (const el of root.querySelectorAll('*')) {
        const child = (el as HTMLElement).shadowRoot;
        if (child) {
          const nested = search(child);
          if (nested) return nested;
        }
      }
      return null;
    };
    const el = search(document) as HTMLElement | null;
    if (!el) return false;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
    return true;
  }, selector);
}

async function isDeepVisible(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const search = (root: Document | ShadowRoot | Element): Element | null => {
      const hit = root.querySelector(sel);
      if (hit) return hit;
      for (const el of root.querySelectorAll('*')) {
        const child = (el as HTMLElement).shadowRoot;
        if (child) {
          const nested = search(child);
          if (nested) return nested;
        }
      }
      return null;
    };
    const el = search(document) as HTMLElement | null;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }, selector);
}

async function waitForDeepVisible(page: Page, selector: string, timeout = 30_000): Promise<void> {
  await expect.poll(() => isDeepVisible(page, selector), { timeout }).toBe(true);
}

async function seekToCue(page: Page, time: number): Promise<{ currentTime: number; duration: number; readyState: number } | null> {
  return page.evaluate(async (t) => {
    const v = document.querySelector('video') as HTMLVideoElement | null;
    if (!v) return null;
    if (v.readyState < 1) {
      await new Promise<void>((resolve) => {
        const onMeta = () => resolve();
        v.addEventListener('loadedmetadata', onMeta, { once: true });
        setTimeout(resolve, 5000);
      });
    }
    v.currentTime = t;
    try {
      await v.play();
    } catch {
      // ignore autoplay errors
    }
    return { currentTime: v.currentTime, duration: v.duration, readyState: v.readyState };
  }, time);
}

test('subtitle overlay Send to Card opens lazy queue', async ({ streamFlixPage, TihokaContext }) => {
  // Seed extension storage before reload so the content script picks it up.
  await setTestStorage(TihokaContext, STREAMFLIX_URL);
  await streamFlixPage.reload({ waitUntil: 'networkidle' });

  // Confirm the Tihoka overlay is mounted.
  await expect(streamFlixPage.locator('[data-tihoka-id="orbital-badge"]')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => streamFlixPage.evaluate(() => !!document.getElementById('Tihoka-subtitle-root')), {
    timeout: 30_000,
  }).toBe(true);

  const page = streamFlixPage;

  // Start playback by clicking the video, seek to the third cue, and wait for it.
  const videoEl = page.locator('video').first();
  await expect(videoEl).toBeVisible({ timeout: 10_000 });
  await videoEl.click({ force: true });
  await page.waitForTimeout(500);
  await seekToCue(page, 31);
  await page.evaluate(() => { const v = document.querySelector('video'); v?.pause(); });
  await page.waitForTimeout(1500);

  // Wait for the subtitle target text to render and become tokenized.
  await expect.poll(async () => {
    const target = await queryDeepText(page, '[data-role="target"] span');
    const tokenByShadow = await page.evaluate(() => {
      const search = (root: Document | ShadowRoot | Element): Element | null => {
        const hit = root.querySelector('[data-tihoka-term^="floatin"]');
        if (hit) return hit;
        for (const el of root.querySelectorAll('*')) {
          const sr = (el as HTMLElement).shadowRoot;
          if (sr) {
            const nested = search(sr);
            if (nested) return nested;
          }
        }
        return null;
      };
      const hit = search(document);
      return hit?.textContent?.trim() ?? null;
    });
    return { target, token: tokenByShadow };
  }, { timeout: 30_000 }).toEqual(expect.objectContaining({ target: expect.stringMatching(/floatin/i), token: expect.stringMatching(/^floatin/i) }));

  // Click the token to open the popup dictionary.
  // The native play button overlay intercepts pointer events, so use JS click.
  await clickDeep(page, '[data-tihoka-term^="floatin"]');
  await waitForDeepVisible(page, '[data-tihoka-id="popup-dictionary"]', 15_000);

  // Click Send to Card in the popup dictionary.
  await clickDeep(page, '[data-tihoka-id="dictionary-send-to-card"]');

  // Wait for the universal panel and the queue sidebar.
  await waitForDeepVisible(page, '#Tihoka-universal-panel-host', 15_000);
  await waitForDeepVisible(page, '[data-tihoka-id="cc-queue-sidebar"]', 15_000);

  // Queue should contain the unknown/tracking words from the cue.
  const queueText = await queryDeepText(page, '[data-tihoka-id="cc-queue-sidebar"]');
  expect(queueText).toMatch(/floatin/);

  // Click a queue item and verify the Dictionary looks it up.
  await clickDeep(page, '[data-tihoka-id="cc-queue-item-0"]');
  await expect.poll(() => queryDeepText(page, '[data-tihoka-id="dictionary-term"]'), {
    timeout: 30_000,
  }).toBeTruthy();

  // Click the integrated Dictionary's Send to Card and verify the Card Creator form.
  await waitForDeepVisible(page, '[data-tihoka-id="dictionary-send-to-card"]', 10_000);
  await clickDeep(page, '[data-tihoka-id="dictionary-send-to-card"]');

  // Verify the Card Creator form is filled with the looked-up term.
  await waitForDeepVisible(page, '[data-tihoka-id="cc-target-word-input"]', 15_000);
  const targetWord = await getInputValueDeep(page, '[data-tihoka-id="cc-target-word-input"] textarea');
  expect(targetWord).toMatch(/floatin/i);
});

test('subtitle overlay Quick Add opens lazy queue', async ({ streamFlixPage, TihokaContext }) => {
  await setTestStorage(TihokaContext, STREAMFLIX_URL);
  await streamFlixPage.reload({ waitUntil: 'networkidle' });

  await expect(streamFlixPage.locator('[data-tihoka-id="orbital-badge"]')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => streamFlixPage.evaluate(() => !!document.getElementById('Tihoka-subtitle-root')), {
    timeout: 30_000,
  }).toBe(true);

  const page = streamFlixPage;
  const videoEl = page.locator('video').first();
  await expect(videoEl).toBeVisible({ timeout: 10_000 });
  await videoEl.click({ force: true });
  await page.waitForTimeout(500);
  await seekToCue(page, 31);
  await page.evaluate(() => { const v = document.querySelector('video'); v?.pause(); });
  await page.waitForTimeout(1500);

  await expect.poll(async () => {
    const target = await queryDeepText(page, '[data-role="target"] span');
    const tokenByShadow = await page.evaluate(() => {
      const search = (root: Document | ShadowRoot | Element): Element | null => {
        const hit = root.querySelector('[data-tihoka-term^="floatin"]');
        if (hit) return hit;
        for (const el of root.querySelectorAll('*')) {
          const sr = (el as HTMLElement).shadowRoot;
          if (sr) {
            const nested = search(sr);
            if (nested) return nested;
          }
        }
        return null;
      };
      const hit = search(document);
      return hit?.textContent?.trim() ?? null;
    });
    return { target, token: tokenByShadow };
  }, { timeout: 30_000 }).toEqual(expect.objectContaining({ target: expect.stringMatching(/floatin/i), token: expect.stringMatching(/^floatin/i) }));

  await clickDeep(page, '[data-tihoka-term^="floatin"]');
  await waitForDeepVisible(page, '[data-tihoka-id="popup-dictionary"]', 15_000);

  await clickDeep(page, '[data-tihoka-id="dictionary-quick-add"]');
  await waitForDeepVisible(page, '#Tihoka-universal-panel-host', 15_000);
  await waitForDeepVisible(page, '[data-tihoka-id="cc-queue-sidebar"]', 15_000);

  const queueText = await queryDeepText(page, '[data-tihoka-id="cc-queue-sidebar"]');
  expect(queueText).toMatch(/floatin/i);
});
