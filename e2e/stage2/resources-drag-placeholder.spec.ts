import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BrowserContext } from '@playwright/test';
import { test, expect } from '../fixtures/actors/universalPanel.fixture';

const EVIDENCE_DIR = resolve('tmp/resources-drag');

// Fresh profiles have no dictionary DB hash → getDbName('en') resolves to the
// DEFAULT_DB_HASH fallback. Seeding two rows gives the list real cards to drag
// without running the import pipeline.
async function seedResources(context: BrowserContext): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(async () => {
    const DB = 'orca-dict-devmode0-en';
    const existing = (await indexedDB.databases?.() ?? []).find((d) => d.name === DB);
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const req = indexedDB.open(DB, Math.max(15, existing?.version ?? 0));
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('langResourceInfo')) {
          req.result.createObjectStore('langResourceInfo', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const tx = db.transaction('langResourceInfo', 'readwrite');
    const store = tx.objectStore('langResourceInfo');
    for (const [i, name] of ['alpha-dict.tihoka', 'beta-freq.freq', 'gamma-dict.tihoka'].entries()) {
      store.add({
        name,
        langCode: 'en',
        type: i === 1 ? 'FREQUENCY' : 'DICTIONARY',
        format: 'term-bank',
        signature: `seed-${name}`,
        wordCount: 1000 + i,
        installationFinished: true,
        importedAt: Date.now(),
        priority: i,
      });
    }
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  });
}

test.describe('Stage 2: Resources > drag placeholder on StreamFlix (dark)', () => {
  test('drag lifts a ghost and shows a dashed placeholder matching the dropzone chrome', async ({
    universalPanel,
    streamFlixPage,
    TihokaContext,
  }) => {
    await seedResources(TihokaContext);
    await streamFlixPage.emulateMedia({ colorScheme: 'dark' });

    await universalPanel.open();
    await universalPanel.openTab('settings');
    const nav = streamFlixPage.locator('[data-section-id="resources"]').first();
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.click();

    const panel = streamFlixPage.locator('[data-Tihoka-id="resources-panel"]');
    await expect(panel).toBeVisible({ timeout: 15_000 });
    const grip = panel.locator('[data-Tihoka-id^="drag-"]').first();
    await grip.scrollIntoViewIfNeeded();
    await expect(grip).toBeVisible();

    const dropzoneColor = await panel.locator('[class*="dropzone"]').first()
      .evaluate((el) => getComputedStyle(el).borderColor);

    const box = await grip.boundingBox();
    await streamFlixPage.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await streamFlixPage.mouse.down();
    await streamFlixPage.mouse.move(box!.x + 8, box!.y + box!.height / 2 + 80, { steps: 12 });
    await streamFlixPage.waitForTimeout(300);

    const placeholder = panel.locator('[data-Tihoka-id="drag-placeholder"]');
    await expect(placeholder).toBeVisible();
    const style = await placeholder.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { borderStyle: cs.borderStyle, borderColor: cs.borderColor };
    });
    expect(style.borderStyle).toBe('dashed');
    expect(style.borderColor).toBe(dropzoneColor);

    mkdirSync(EVIDENCE_DIR, { recursive: true });
    await streamFlixPage.screenshot({ path: `${EVIDENCE_DIR}/drag-placeholder.png`, fullPage: false });
    await streamFlixPage.mouse.up();
  });
});
