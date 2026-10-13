import { expect, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { test } from './fixtures/TihokaEnvironment.fixture';
import { UniversalPanelActor } from './fixtures/actors/universalPanel.fixture';

type MsgResponse<T> = { success: boolean; data?: T; error?: string };

const MEDIA_DB = 'orca-local-player';
const POPUP_PATH = 'src/entrypoints/popup/index.html';

function sendMsg<T>(page: Page, type: string, payload: unknown): Promise<MsgResponse<T>> {
  return page.evaluate(
    ({ t, p }) =>
      new Promise<MsgResponse<T>>((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
          resolve({ success: false, error: 'chrome.runtime not available' });
          return;
        }
        chrome.runtime.sendMessage({ type: t, payload: p }, (response: unknown) => {
          resolve((response as MsgResponse<T>) ?? { success: false, error: 'no response' });
        });
      }),
    { t: type, p: payload },
  );
}

function panelRoot(page: Page) {
  return page.locator('#Tihoka-universal-panel-host');
}

async function extensionWorker(context: BrowserContext): Promise<Worker> {
  const [existing] = context.serviceWorkers();
  if (existing) return existing;
  return context.waitForEvent('serviceworker', { timeout: 30_000 });
}

/** Messaging only works from an extension page — chrome.runtime is not
 *  exposed to regular web pages. The popup entrypoint is the lightest
 *  extension surface already used by other specs. */
async function openExtensionPage(context: BrowserContext): Promise<Page> {
  const sw = await extensionWorker(context);
  const extensionId = new URL(sw.url()).hostname;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${POPUP_PATH}`);
  await page.locator('body').waitFor({ state: 'visible' });
  return page;
}

/** Forces the extension to open the media DB through its own repository so
 *  the real versioned migration creates every store. Opening the DB from the
 *  test with a fixed version would create an empty DB (or a drifted schema)
 *  on a fresh profile. */
async function ensureMediaDb(page: Page): Promise<void> {
  const res = await sendMsg(page, 'GET_SESSION_RECAP', {});
  if (!res.success) throw new Error(`GET_SESSION_RECAP failed: ${res.error}`);
}

async function seedLocalSession(
  context: BrowserContext,
  msgPage: Page,
): Promise<void> {
  await clearSessionData(context, msgPage);
  const sw = await extensionWorker(context);
  const ok = await sw.evaluate(
    (dbName) =>
      new Promise<boolean>((resolve) => {
        const now = Date.now();
        const req = indexedDB.open(dbName);
        req.onblocked = () => resolve(false);
        req.onerror = () => resolve(false);
        req.onsuccess = () => {
          const db = req.result;
          const needed = ['videos', 'history', 'sessionEvents'];
          if (!needed.every((n) => db.objectStoreNames.contains(n))) {
            db.close();
            resolve(false);
            return;
          }
          const tx = db.transaction(needed, 'readwrite');
          tx.objectStore('videos').put({
            id: 'v-seed-1',
            filename: 'episode-01.mp4',
            title: 'Episode 01 — Seeded',
            durationMs: 1_440_000,
            addedAt: new Date(now - 86_400_000).toISOString(),
            lastWatchedAt: null,
            resumePositionMs: 0,
            comprehension: {
              coverage: 0.72,
              band: 'comfortable',
              newTerms: 5,
              subtitleFilename: 'episode-01.srt',
              computedAt: new Date(now).toISOString(),
            },
          });
          const hist = tx.objectStore('history');
          hist.put({
            id: `watch-v-seed-1-${now - 600_000}`,
            videoId: 'v-seed-1',
            watchedAt: new Date(now - 600_000).toISOString(),
            watchDurationMs: 300_000,
            positionMs: 300_000,
          });
          hist.put({
            id: `watch-v-seed-1-${now - 250_000}`,
            videoId: 'v-seed-1',
            watchedAt: new Date(now - 250_000).toISOString(),
            watchDurationMs: 240_000,
            positionMs: 540_000,
          });
          const events = tx.objectStore('sessionEvents');
          const lookups: [number, string][] = [
            [now - 550_000, '猫'],
            [now - 500_000, '犬'],
            [now - 480_000, '猫'],
          ];
          for (const [at, term] of lookups) {
            events.put({
              id: `ev-lookup-${at}`,
              at,
              tabId: -1,
              surface: 'local-player',
              kind: 'lookup',
              term,
              langCode: 'ja',
            });
          }
          const marks: [number, string, string][] = [
            [now - 450_000, '猫', 'known'],
            [now - 400_000, '山', 'learning'],
            [now - 350_000, '水', 'tracking'],
          ];
          for (const [at, term, status] of marks) {
            events.put({
              id: `ev-status-${at}`,
              at,
              tabId: -1,
              surface: 'local-player',
              kind: 'status',
              term,
              status,
              langCode: 'ja',
            });
          }
          tx.oncomplete = () => {
            db.close();
            resolve(true);
          };
          tx.onerror = () => {
            db.close();
            resolve(false);
          };
          tx.onabort = () => {
            db.close();
            resolve(false);
          };
        };
      }),
    MEDIA_DB,
  );
  if (!ok) throw new Error('seed write failed');
}

async function clearSessionData(
  context: BrowserContext,
  msgPage: Page,
): Promise<void> {
  await ensureMediaDb(msgPage);
  const sw = await extensionWorker(context);
  await sw.evaluate(
    (dbName) =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open(dbName);
        req.onblocked = () => resolve();
        req.onerror = () => resolve();
        req.onsuccess = () => {
          const db = req.result;
          const names = ['videos', 'history', 'sessionEvents'].filter((n) =>
            db.objectStoreNames.contains(n),
          );
          if (names.length === 0) {
            db.close();
            resolve();
            return;
          }
          const tx = db.transaction(names, 'readwrite');
          for (const n of names) tx.objectStore(n).clear();
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => {
            db.close();
            resolve();
          };
        };
      }),
    MEDIA_DB,
  );
}

test.describe('Session Recap tab', () => {
  test('Recap tab shows empty state when no history exists', async ({
    TihokaContext,
    streamFlixPage,
  }) => {
    const extPage = await openExtensionPage(TihokaContext);
    await clearSessionData(TihokaContext, extPage);
    await extPage.close();

    const page = streamFlixPage;
    const panel = new UniversalPanelActor(page);
    await panel.open();
    await panel.openTab('recap');
    await expect(
      panelRoot(page).locator('text=No sessions yet'),
    ).toBeVisible({ timeout: 15_000 });
    await panelRoot(page).screenshot({
      path: 'e2e-results/default/session-recap-empty.png',
    });
  });

  test('GET_SESSION_RECAP composes a session from seeded records + events', async ({
    TihokaContext,
  }) => {
    const extPage = await openExtensionPage(TihokaContext);
    await seedLocalSession(TihokaContext, extPage);
    const res = await sendMsg<{ sessions: unknown[] }>(extPage, 'GET_SESSION_RECAP', {});
    await extPage.close();

    expect(res.success).toBe(true);
    const sessions = res.data?.sessions as {
      sourceLabel: string;
      lookups?: { count: number; terms: string[] };
      statusChanges?: { count: number; derived: boolean };
      coverage?: { value: number };
      durationMs: number;
    }[];
    expect(sessions.length).toBeGreaterThan(0);
    const latest = sessions[0]!;
    expect(latest.sourceLabel).toBe('Episode 01 — Seeded');
    expect(latest.durationMs).toBe(540_000);
    expect(latest.lookups?.count).toBe(3);
    expect(latest.lookups?.terms).toEqual(['猫', '犬']);
    expect(latest.statusChanges?.count).toBe(3);
    expect(latest.statusChanges?.derived).toBe(false);
    expect(latest.coverage?.value).toBeCloseTo(0.72);
  });

  test('Recap tab renders hero + chips; term chip navigates to Dictionary', async ({
    TihokaContext,
    streamFlixPage,
  }) => {
    const extPage = await openExtensionPage(TihokaContext);
    await seedLocalSession(TihokaContext, extPage);
    await extPage.close();

    const page = streamFlixPage;
    const panel = new UniversalPanelActor(page);
    await panel.open();
    await panel.openTab('recap');

    const hero = panelRoot(page).locator('[data-tihoka-id="recap-hero"]');
    await expect(hero).toBeVisible({ timeout: 15_000 });
    await expect(hero).toContainText('Episode 01 — Seeded');
    await expect(hero).toContainText('72%');
    const nekoChip = hero.getByRole('button', { name: '猫' }).first();
    await expect(nekoChip).toBeVisible();
    await hero.screenshot({ path: 'e2e-results/default/session-recap-hero.png' });

    await nekoChip.click();
    const dictInput = panelRoot(page).locator('input[data-tihoka-id="dictionary-search-input"]');
    await expect(dictInput).toBeVisible({ timeout: 15_000 });
    await panelRoot(page).screenshot({
      path: 'e2e-results/default/session-recap-dict.png',
    });
  });
});
