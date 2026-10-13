import { expect } from '@playwright/test';
import { test } from '../extension.fixture';

const portOffset = parseInt(process.env.PW_PORT_OFFSET || '0', 10);
const STREAM_URL = `http://127.0.0.1:${4321 + portOffset}/index.html`;
const PARENT_ORIGIN = `http://127.0.0.1:${4321 + portOffset}`;
const CHILD_ORIGIN = 'http://127.0.0.1:4324';

test.describe('debug-seam-hardening — cross-origin iframe flows', () => {
  test.skip(portOffset !== 0, 'iframe child origin is hardcoded to :4324');

  test('iframe child injects, debug relay reaches top at explicit origin, PM enter/exit, forged posts dropped', async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(`${STREAM_URL}?player=iframe`, { waitUntil: 'domcontentloaded' });

    // The host page renders the cross-origin player iframe (4321 → 4324).
    const frameLocator = page.frameLocator('iframe');
    await expect(frameLocator.locator('video')).toBeVisible({ timeout: 30_000 });
    const child = page.frames().find((f) => f.url().startsWith(CHILD_ORIGIN));
    if (!child) throw new Error('cross-origin player frame not found');

    // Child-frame content script mounts its overlay (all_frames injection).
    await expect(frameLocator.locator('#Tihoka-subtitle-root')).toBeAttached({ timeout: 20_000 });

    // E2E debug marker on the top document — proves debug gating still emits
    // in Tihoka_E2E builds.
    await page.waitForFunction(
      () => document.documentElement.hasAttribute('data-tihoka-runscan'),
      null,
      { timeout: 20_000 },
    );

    // Cross-frame debug relay: the child's __Tihoka_DEBUG_PAGE_SCAN post is
    // delivered to the top at the resolved parent origin (ancestorOrigins /
    // referrer) and mirrored to data-tihoka-iframe-scan.
    await page.waitForFunction(
      () => document.documentElement.hasAttribute('data-tihoka-iframe-scan'),
      null,
      { timeout: 20_000 },
    );

    // Forged ENTER from the top window itself — event.source is not an iframe
    // contentWindow → dropped before any state change.
    await page.evaluate(() => {
      window.postMessage(
        {
          type: '__Tihoka_PLAYER_MODE_ENTER',
          frameSrc: `${location.origin}/index.html`,
        },
        '*',
      );
    });
    await page.waitForTimeout(500);
    expect(await page.locator('[data-tihoka-player-mode-host]').count()).toBe(0);

    // Forged ENTER from the real iframe but with a lying frameSrc — origin
    // corroboration fails → dropped.
    await child.evaluate((parent) => {
      window.parent.postMessage(
        { type: '__Tihoka_PLAYER_MODE_ENTER', frameSrc: 'https://evil.example/embed' },
        parent,
      );
    }, PARENT_ORIGIN);
    await page.waitForTimeout(500);
    expect(await page.locator('[data-tihoka-player-mode-host]').count()).toBe(0);

    // Legitimate ENTER from the real iframe contentWindow with matching
    // frameSrc → top enters Player Mode (fullscreen or fixed fallback) and
    // the child observes ENTERED at its own origin.
    const entered = await child.evaluate((parent) => {
      return new Promise<boolean>((resolve) => {
        const onMsg = (e: MessageEvent): void => {
          if (e.data?.type === '__Tihoka_PLAYER_MODE_ENTERED') {
            window.removeEventListener('message', onMsg);
            resolve(true);
          }
        };
        window.addEventListener('message', onMsg);
        window.parent.postMessage(
          {
            type: '__Tihoka_PLAYER_MODE_ENTER',
            frameSrc: location.origin + location.pathname,
          },
          parent,
        );
        setTimeout(() => resolve(false), 8_000);
      });
    }, PARENT_ORIGIN);
    await page.waitForFunction(
      () =>
        document.querySelector('[data-tihoka-player-mode-host]') !== null ||
        document.fullscreenElement !== null,
      null,
      { timeout: 10_000 },
    );
    expect(entered).toBe(true);

    // Legitimate EXIT from the same iframe → top tears down.
    await child.evaluate((parent) => {
      window.parent.postMessage(
        {
          type: '__Tihoka_PLAYER_MODE_EXIT',
          frameSrc: location.origin + location.pathname,
        },
        parent,
      );
    }, PARENT_ORIGIN);
    await page.waitForFunction(
      () =>
        document.querySelector('[data-tihoka-player-mode-host]') === null &&
        document.fullscreenElement === null,
      null,
      { timeout: 10_000 },
    );

    // Subtitle discovery relay — <track> mode mounts a blob: track; the
    // MAIN-world discovery script fetches it and posts a network-response
    // signal to the parent at the resolved origin. The top bridge validates
    // the schema and records it under data-tihoka-iframe-discovery-log.
    await page.getByRole('tab', { name: '<track>' }).click();
    await page.waitForFunction(
      () => {
        const raw = document.documentElement.getAttribute('data-tihoka-iframe-discovery-log');
        if (!raw) return false;
        try {
          return (JSON.parse(raw) as { kind?: string; origin?: string }[]).some(
            (e) => e.kind === 'network-response',
          );
        } catch {
          return false;
        }
      },
      null,
      { timeout: 25_000 },
    );

    // Forged malformed discovery signal — schema-invalid → silently dropped;
    // the discovery log must not grow.
    const before = await page.evaluate(() => {
      const raw = document.documentElement.getAttribute('data-tihoka-iframe-discovery-log') ?? '[]';
      const len = (JSON.parse(raw) as unknown[]).length;
      window.postMessage(
        { type: '__Tihoka_SUBTITLE_DISCOVERY', signal: { kind: 'bogus', data: 'x' } },
        '*',
      );
      window.postMessage(
        { type: '__Tihoka_SUBTITLE_DISCOVERY', signal: null },
        '*',
      );
      return len;
    });
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => {
      const raw = document.documentElement.getAttribute('data-tihoka-iframe-discovery-log') ?? '[]';
      return (JSON.parse(raw) as unknown[]).length;
    });
    expect(after).toBe(before);

    await page.close();
  });
});
