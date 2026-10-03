import { expect, type Page } from '@playwright/test';
import { test } from './extension.fixture';

const portOffset = parseInt(process.env.PW_PORT_OFFSET || '0', 10);
const STREAM_MOCK_URL = `http://127.0.0.1:${4321 + portOffset}/index.html`;

async function deepQuery(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const deepFind = (root: Document | ShadowRoot, s: string): Element | null => {
      const el = root.querySelector(s);
      if (el) return el;
      for (const child of Array.from(root.querySelectorAll('*'))) {
        if (child.shadowRoot) {
          const found = deepFind(child.shadowRoot, s);
          if (found) return found;
        }
      }
      return null;
    };
    return deepFind(document, sel) !== null;
  }, selector);
}

async function deepClick(page: Page, selector: string): Promise<void> {
  const ok = await page.evaluate(
    (sel) => {
      const deepFind = (
        root: Document | ShadowRoot,
        s: string,
      ): Element | null => {
        const el = root.querySelector(s);
        if (el) return el;
        for (const child of Array.from(root.querySelectorAll('*'))) {
          if (child.shadowRoot) {
            const found = deepFind(child.shadowRoot, s);
            if (found) return found;
          }
        }
        return null;
      };
      const el = deepFind(document, sel);
      if (!el) return false;
      el.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }),
      );
      return true;
    },
    selector,
  );
  if (!ok) throw new Error(`deepClick: ${selector} not found`);
}

async function waitDeep(page: Page, selector: string, timeout = 15_000): Promise<void> {
  await expect
    .poll(() => deepQuery(page, selector), { timeout })
    .toBe(true);
}

async function condenseEnabled(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const deepFind = (root: Document | ShadowRoot, s: string): Element | null => {
      const el = root.querySelector(s);
      if (el) return el;
      for (const child of Array.from(root.querySelectorAll('*'))) {
        if (child.shadowRoot) {
          const found = deepFind(child.shadowRoot, s);
          if (found) return found;
        }
      }
      return null;
    };
    const btn = deepFind(document, '[data-cell-id="manager-condense-audio"]');
    return btn !== null && !(btn as HTMLButtonElement).disabled;
  });
}

test.describe('Cell condensed audio', () => {
  test('record leg: trigger → pill → playlist ready', async ({ context }) => {
    test.setTimeout(180_000);
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        process.stderr.write(`[page:${msg.type()}] ${msg.text()}\n`);
      }
    });
    const sws = context.serviceWorkers();
    for (const sw of sws) {
      sw.on('console', (msg) =>
        process.stderr.write(`[sw:${msg.type()}] ${msg.text()}\n`),
      );
    }
    await page.goto(STREAM_MOCK_URL, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('video')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#cell-subtitle-root')).toBeAttached({ timeout: 15_000 });

    await page.evaluate(() => {
      const host = document.getElementById('cell-subtitle-root');
      const btn = host?.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-cell-id="manager-toggle-btn"]',
      );
      if (!btn) throw new Error('manager-toggle-btn not found');
      btn.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }),
      );
    });
    await waitDeep(page, '[data-cell-id="subtitle-manager-layer"]', 10_000);

    await expect
      .poll(() => condenseEnabled(page), { timeout: 30_000 })
      .toBe(true);
    await page.screenshot({ path: 'tmp/condensed-audio/manager-condense-trigger.png' });

    await deepClick(page, '[data-cell-id="manager-condense-audio"]');
    try {
      await waitDeep(page, '[data-cell-id="condensed-audio-pill"]', 20_000);
    } catch (err) {
      const sw = context.serviceWorkers()[0];
      if (sw) {
        const records = await sw.evaluate(
          () =>
            new Promise<unknown>((resolve) => {
              const req = indexedDB.open('orca-local-player');
              req.onsuccess = () => {
                const db = req.result;
                try {
                  const tx = db.transaction('condensedAudio', 'readonly');
                  const getAll = tx.objectStore('condensedAudio').getAll();
                  getAll.onsuccess = () => resolve(getAll.result);
                  getAll.onerror = () => resolve(`err:${String(getAll.error)}`);
                } catch (e) {
                  resolve(`throw:${String(e)}`);
                }
              };
              req.onerror = () => resolve(`open-err:${String(req.error)}`);
            }),
        );
        process.stderr.write(`[diag] condensedAudio records: ${JSON.stringify(records)}\n`);
      }
      throw err;
    }
    await page.waitForTimeout(1_500);
    await waitDeep(page, '[data-cell-id="condensed-audio-pause"]', 5_000);
    await waitDeep(page, '[data-cell-id="condensed-audio-stop"]', 5_000);
    await waitDeep(page, '[data-cell-id="condensed-audio-discard"]', 5_000);
    await page.screenshot({ path: 'tmp/condensed-audio/recording-pill.png' });

    const isPlaying = await page.evaluate(() => {
      const v = document.querySelector('video');
      return v !== null && !v.paused && v.currentTime > 0;
    });
    expect(isPlaying).toBe(true);

    await deepClick(page, '[data-cell-id="condensed-audio-pause"]');
    await expect
      .poll(
        () => page.evaluate(() => document.querySelector('video')?.paused ?? false),
        { timeout: 5_000 },
      )
      .toBe(true);
    await page.screenshot({ path: 'tmp/condensed-audio/recording-pill-paused.png' });

    await deepClick(page, '[data-cell-id="condensed-audio-pause"]');
    await expect
      .poll(
        () => page.evaluate(() => !(document.querySelector('video')?.paused ?? true)),
        { timeout: 5_000 },
      )
      .toBe(true);

    await deepClick(page, '[data-cell-id="condensed-audio-discard"]');
    await waitDeep(page, '[data-cell-id="condensed-audio-discard-dialog"] [role="dialog"]', 5_000);
    await page.screenshot({ path: 'tmp/condensed-audio/recording-pill-discard-confirm.png' });
    await deepClick(
      page,
      '[data-cell-id="condensed-audio-discard-dialog"] [role="dialog"] button:first-of-type',
    );
    await page.waitForTimeout(300);
    expect(await deepQuery(page, '[data-cell-id="condensed-audio-pill"]')).toBe(true);

    await page.waitForTimeout(4_000);
    await deepClick(page, '[data-cell-id="condensed-audio-stop"]');

    await expect
      .poll(async () => !(await deepQuery(page, '[data-cell-id="condensed-audio-pill"]')), {
        timeout: 10_000,
      })
      .toBe(true);

    await page.evaluate(() => {
      const deepFind = (root: Document | ShadowRoot, s: string): Element | null => {
        const el = root.querySelector(s);
        if (el) return el;
        for (const child of Array.from(root.querySelectorAll('*'))) {
          if (child.shadowRoot) {
            const found = deepFind(child.shadowRoot, s);
            if (found) return found;
          }
        }
        return null;
      };
      const host = deepFind(document, '[data-cell-id="orbital-badge"]');
      if (!host) throw new Error('orbital-badge not found');
      const opts = { bubbles: true, cancelable: true, composed: true, pointerId: 1 };
      host.dispatchEvent(new PointerEvent('pointerdown', opts));
      host.dispatchEvent(new PointerEvent('pointerup', opts));
    });
    try {
      await waitDeep(page, '[data-cell-id="universal-panel"]', 15_000);
    } catch (err) {
      const hosts = await page.evaluate(() => {
        const ids: string[] = [];
        document.querySelectorAll('*').forEach((el) => {
          if (el.shadowRoot) ids.push(el.id || el.tagName);
        });
        return ids;
      });
      process.stderr.write(`[diag] shadow hosts: ${JSON.stringify(hosts)}\n`);
      throw err;
    }

    const onPlaylist = await page.evaluate(() => {
      const deepFind = (root: Document | ShadowRoot, s: string): Element | null => {
        const el = root.querySelector(s);
        if (el) return el;
        for (const child of Array.from(root.querySelectorAll('*'))) {
          if (child.shadowRoot) {
            const found = deepFind(child.shadowRoot, s);
            if (found) return found;
          }
        }
        return null;
      };
      return deepFind(document, '[data-cell-id="universal-panel-content-playlist"]') !== null;
    });

    if (!onPlaylist) {
      const navTargets = [
        '[data-cell-id="universal-panel-mobile-tab-playlist"]',
        '[data-cell-id="universal-panel-tab-playlist"]',
      ];
      for (const sel of navTargets) {
        if (await deepQuery(page, sel)) {
          await deepClick(page, sel);
          break;
        }
      }
    }
    await waitDeep(page, '[data-cell-id="universal-panel-content-playlist"]', 10_000);
    await page.screenshot({ path: 'tmp/condensed-audio/playlist-tab.png' });

    const dumpRecords = async (): Promise<void> => {
      const sw = context.serviceWorkers()[0];
      if (!sw) return;
      const records = await sw.evaluate(
        () =>
          new Promise<unknown>((resolve) => {
            const req = indexedDB.open('orca-local-player');
            req.onsuccess = () => {
              try {
                const tx = req.result.transaction('condensedAudio', 'readonly');
                const getAll = tx.objectStore('condensedAudio').getAll();
                getAll.onsuccess = () => resolve(getAll.result);
                getAll.onerror = () => resolve(`err:${String(getAll.error)}`);
              } catch (e) {
                resolve(`throw:${String(e)}`);
              }
            };
            req.onerror = () => resolve(`open-err:${String(req.error)}`);
          }),
      );
      process.stderr.write(`[diag] records: ${JSON.stringify(records)}\n`);
    };

    try {
      await expect
        .poll(
          () => deepQuery(page, '[data-cell-id^="playlist-preview-btn-"]'),
          { timeout: 60_000 },
        )
        .toBe(true);
    } catch (err) {
      await dumpRecords();
      throw err;
    }
    await page.screenshot({ path: 'tmp/condensed-audio/playlist-ready.png' });

    await page.close();
  });

  test('record leg: runs start-to-end, skips rendered-empty cues', async ({ context }) => {
    test.setTimeout(420_000);
    const page = await context.newPage();
    await page.goto(STREAM_MOCK_URL, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('video')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#cell-subtitle-root')).toBeAttached({ timeout: 15_000 });

    await page.evaluate(() => {
      const host = document.getElementById('cell-subtitle-root');
      const btn = host?.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-cell-id="manager-toggle-btn"]',
      );
      if (!btn) throw new Error('manager-toggle-btn not found');
      btn.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }),
      );
    });
    await waitDeep(page, '[data-cell-id="subtitle-manager-layer"]', 10_000);
    await expect
      .poll(() => condenseEnabled(page), { timeout: 30_000 })
      .toBe(true);

    await deepClick(page, '[data-cell-id="manager-condense-audio"]');
    await waitDeep(page, '[data-cell-id="condensed-audio-pill"]', 20_000);

    await expect
      .poll(
        () => page.evaluate(() => document.querySelector('video')?.currentTime ?? 0),
        { timeout: 15_000 },
      )
      .toBeGreaterThan(15);

    await expect
      .poll(async () => !(await deepQuery(page, '[data-cell-id="condensed-audio-pill"]')), {
        timeout: 330_000,
        intervals: [5_000],
      })
      .toBe(true);

    const readRecords = async (): Promise<unknown> =>
      context.serviceWorkers()[0]?.evaluate(
        () =>
          new Promise<unknown>((resolve) => {
            const req = indexedDB.open('orca-local-player');
            req.onsuccess = () => {
              try {
                const tx = req.result.transaction('condensedAudio', 'readonly');
                const getAll = tx.objectStore('condensedAudio').getAll();
                getAll.onsuccess = () => resolve(getAll.result);
                getAll.onerror = () => resolve(`err:${String(getAll.error)}`);
              } catch (e) {
                resolve(`throw:${String(e)}`);
              }
            };
            req.onerror = () => resolve(`open-err:${String(req.error)}`);
          }),
      );

    let record: { status: string; durationMs: number } | null = null;
    try {
      await expect
        .poll(
          async () => {
            const rows = await readRecords();
            if (!Array.isArray(rows)) return null;
            const ready = (rows as { status: string; durationMs: number }[])
              .filter((r) => r.status === 'ready')
              .sort((a, b) => b.durationMs - a.durationMs);
            record = ready[0] ?? null;
            return record;
          },
          { timeout: 120_000, intervals: [2_000] },
        )
        .not.toBeNull();
    } catch (err) {
      process.stderr.write(`[diag] records: ${JSON.stringify(await readRecords())}\n`);
      throw err;
    }
    expect(record!.durationMs).toBeGreaterThan(60_000);

    await page.close();
  });
});
