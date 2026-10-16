import { expect, type BrowserContext, type Page } from '@playwright/test';
import { test } from './fixtures/TihokaEnvironment.fixture';

/**
 * Contract: with subtitle tokenize enabled for the origin and readings/glosses
 * set to 'always', activating a cue must produce token spans, data-reading,
 * and data-gloss attributes inside the annotation budget (300ms target,
 * measured from cue activation).
 *
 * Run 2 reloads the page: the SW gloss cache (chrome.storage.session) must
 * make glosses resolve without a provider round-trip.
 */

const portOffset = parseInt(process.env.PW_PORT_OFFSET || '0', 10);
const STREAM_ORIGIN = `http://127.0.0.1:${4321 + portOffset}`;
const STREAM_URL = `${STREAM_ORIGIN}/index.html`;

interface LatencyMarks {
  t0: number;
  tokens: number;
  reading: number;
  gloss: number;
}

async function seedSettings(context: BrowserContext): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(async (origin: string) => {
    const storage = await chrome.storage.local.get(['settings', 'tokenizeSettings']);
    const settings = (storage.settings ?? {}) as Record<string, unknown>;
    settings.schemaVersion = 34;
    settings.subtitleOverlayTargetLanguage = 'en';
    settings.subtitleOverlayNativeLanguage = 'vi';
    settings.readingDisplay = 'always';
    settings.glossDisplay = 'always';
    await chrome.storage.local.set({ settings });
    await chrome.storage.local.set({
      tokenizeSettings: {
        schemaVersion: 1,
        origins: {},
        urls: {},
        subtitleOrigins: { [origin]: true },
        subtitleUrls: {},
      },
    });
  }, STREAM_ORIGIN);
}

async function installLatencyProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __lat: LatencyMarks; __latTimer?: number };
    w.__lat = { t0: 0, tokens: -1, reading: -1, gloss: -1 };
    const deepScan = (root: Document | ShadowRoot, sel: string): boolean => {
      if (root.querySelector(sel)) return true;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        if (el.shadowRoot && deepScan(el.shadowRoot, sel)) return true;
      }
      return false;
    };
    w.__latTimer = window.setInterval(() => {
      const l = w.__lat;
      if (l.t0 === 0) return;
      const now = performance.now();
      if (l.tokens < 0 && deepScan(document, '.js-Tihoka-token')) l.tokens = now - l.t0;
      if (l.reading < 0 && deepScan(document, '.js-Tihoka-token[data-reading]')) l.reading = now - l.t0;
      if (l.gloss < 0 && deepScan(document, '.js-Tihoka-token[data-gloss]')) l.gloss = now - l.t0;
    }, 5);
  });
}

async function activateAndMeasure(page: Page): Promise<LatencyMarks> {
  await installLatencyProbe(page);
  await page.evaluate(() => {
    (window as unknown as { __lat: LatencyMarks }).__lat.t0 = performance.now();
    const video = document.querySelector('video');
    if (video) {
      video.muted = true;
      video.currentTime = 0.5;
      void video.play().catch(() => {});
    }
  });
  await expect
    .poll(async () => (await page.evaluate(() => (window as unknown as { __lat: LatencyMarks }).__lat)).tokens, {
      timeout: 30_000,
    })
    .toBeGreaterThanOrEqual(0);
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => (window as unknown as { __lat: LatencyMarks }).__lat)).reading,
      { timeout: 30_000 },
    )
    .toBeGreaterThanOrEqual(0);
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => (window as unknown as { __lat: LatencyMarks }).__lat)).gloss,
      { timeout: 30_000 },
    )
    .toBeGreaterThanOrEqual(0);
  return page.evaluate(() => (window as unknown as { __lat: LatencyMarks }).__lat);
}

test.describe('subtitle tokenize latency', () => {
  test.beforeEach(async ({ TihokaContext }) => {
    await seedSettings(TihokaContext);
  });

  test('tokens, readings and glosses land inside the annotation budget', async ({
    streamFlixPage,
  }) => {
    test.setTimeout(120_000);
    const page = streamFlixPage;

    const run1 = await activateAndMeasure(page);
    process.stdout.write(
      `[latency run1] tokens=${run1.tokens.toFixed(0)}ms reading=${run1.reading.toFixed(0)}ms gloss=${run1.gloss.toFixed(0)}ms\n`,
    );

    await page.reload({ waitUntil: 'networkidle' });
    const video = page.locator('#player-wrapper video').first();
    await expect(video).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#Tihoka-subtitle-root')).toBeAttached({ timeout: 30_000 });

    const run2 = await activateAndMeasure(page);
    process.stdout.write(
      `[latency run2] tokens=${run2.tokens.toFixed(0)}ms reading=${run2.reading.toFixed(0)}ms gloss=${run2.gloss.toFixed(0)}ms\n`,
    );

    expect(run1.tokens).toBeLessThan(300);
    expect(run1.reading).toBeLessThan(300);
    expect(run2.tokens).toBeLessThan(300);
    expect(run2.reading).toBeLessThan(300);
    expect(run2.gloss).toBeLessThan(300);
  });
});
