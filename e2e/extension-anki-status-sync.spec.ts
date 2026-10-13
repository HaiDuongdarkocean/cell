import { expect, type Page } from '@playwright/test';
import { test } from './extension.fixture';

const SRS_STUDY_PATH = 'src/entrypoints/srs-study/index.html';
const POPUP_PATH = 'src/entrypoints/popup/index.html';

const portOffset = parseInt(process.env.PW_PORT_OFFSET || '0', 10);
const MOCK_URL = `http://127.0.0.1:${4322 + portOffset}/index.html`;

type MsgResponse<T> = { success: boolean; data?: T; error?: string };

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

async function seedSrsProfile(page: Page, extensionId: string, profileId: string): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/${POPUP_PATH}`);
  await page.locator('body').waitFor({ state: 'visible' });
  const profile = { id: profileId, target: 'en', native: 'vi', name: 'English', order: 1 };
  const result = await sendMsg(page, 'UPDATE_SETTINGS', {
    settings: {
      activeProfileId: profileId,
      languageProfiles: [profile],
      srs: { activeLanguageProfileId: profileId },
    },
  });
  expect(result.success).toBe(true);
}

async function deepQuery(page: Page, selector: string): Promise<boolean> {
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
  const ok = await page.evaluate((sel) => {
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
    const el = deepFind(document, sel);
    if (!el) return false;
    el.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }),
    );
    return true;
  }, selector);
  if (!ok) throw new Error(`deepClick: ${selector} not found`);
}

async function waitDeep(page: Page, selector: string, timeout = 15_000): Promise<void> {
  await expect.poll(() => deepQuery(page, selector), { timeout }).toBe(true);
}

test.describe('Anki status sync', () => {
  test('manual run reaches AnkiConnect or records graceful failure', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await seedSrsProfile(page, extensionId, 'lp-anki-offline');

    const state = await sendMsg<{
      consecutiveFailures: number;
      errors: number;
      lastTrigger: string | null;
      lastSyncAt: number | null;
      cardsSeen: number;
      changed: number;
    }>(page, 'ANKI_STATUS_SYNC_RUN', { tabId: -1 });

    expect(state.success, `ANKI_STATUS_SYNC_RUN failed: ${state.error}`).toBe(true);
    expect(state.data).toBeTruthy();
    expect(state.data!.lastTrigger).toBe('manual');
    expect(state.data!.lastSyncAt).toBeGreaterThan(0);

    if (state.data!.consecutiveFailures > 0) {
      expect(state.data!.errors).toBeGreaterThanOrEqual(1);
    } else {
      const list = await sendMsg<{
        entries: Array<{ term: string; status: string; source?: string }>;
      }>(page, 'WORD_STATUS_LIST', { tabId: -1, langCode: 'en' });
      expect(list.success).toBe(true);
      if (state.data!.changed > 0) {
        const ankiEntries = (list.data?.entries ?? []).filter(
          (e) => e.source === 'anki' && (e.status === 'learning' || e.status === 'known'),
        );
        expect(ankiEntries.length).toBeGreaterThan(0);
      }
    }
    await page.close();
  });

  test('srs review writes learning status for the target word', async ({
    context,
    extensionId,
  }) => {
    test.setTimeout(120_000);
    const page = await context.newPage();
    await seedSrsProfile(page, extensionId, 'lp-anki-sync');
    await page.goto(`chrome-extension://${extensionId}/${SRS_STUDY_PATH}`);
    await page.getByRole('heading', { name: 'Memory' }).waitFor({ state: 'visible', timeout: 10_000 });

    const add = await sendMsg<{ noteId: string; cardId: string }>(page, 'SRS_ADD_NOTE', {
      targetLanguage: 'en',
      targetWord: 'immerse',
      fields: {
        target: { kind: 'text', value: 'immerse' },
        sentence: { kind: 'text', value: 'Learners immerse themselves in the language.' },
        def: { kind: 'text', value: 'to involve oneself deeply' },
      },
    });
    expect(add.success, `SRS_ADD_NOTE failed: ${add.error}`).toBe(true);

    await page.getByRole('button', { name: 'Continue studying' }).click();
    await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible({ timeout: 10_000 });

    for (let step = 0; step < 3; step += 1) {
      const input = page.getByLabel('Type the word');
      if (await input.isVisible().catch(() => false)) {
        await input.fill('immerse');
        await input.press('Enter');
      } else {
        await page.getByRole('button', { name: 'Show answer' }).click();
      }
      await page.getByRole('button', { name: 'Remember' }).click();
    }

    await expect
      .poll(async () => {
        const list = await sendMsg<{ entries: Array<{ term: string; status: string }> }>(
          page,
          'WORD_STATUS_LIST',
          { tabId: -1, langCode: 'en' },
        );
        return list.data?.entries.find((e) => e.term === 'immerse')?.status;
      }, { timeout: 15_000 })
      .toBe('learning');
    await page.close();
  });

  test('settings tab shows the Anki status sync section', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(MOCK_URL);
    await page.locator('body').waitFor({ state: 'visible' });
    await page.waitForTimeout(2_000);

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
      const host = deepFind(document, '[data-tihoka-id="orbital-badge"]');
      if (!host) throw new Error('orbital-badge not found');
      const opts = { bubbles: true, cancelable: true, composed: true, pointerId: 1 };
      host.dispatchEvent(new PointerEvent('pointerdown', opts));
      host.dispatchEvent(new PointerEvent('pointerup', opts));
    });
    await waitDeep(page, '[data-tihoka-id="universal-panel"]', 15_000);

    for (const sel of [
      '[data-tihoka-id="universal-panel-tab-settings"]',
      '[data-tihoka-id="universal-panel-mobile-tab-settings"]',
    ]) {
      if (await deepQuery(page, sel)) {
        await deepClick(page, sel);
        break;
      }
    }
    await waitDeep(page, '[data-tihoka-id="anki-status-sync"]', 15_000);
    const section = page.locator('[data-section="sync"]');
    await section.scrollIntoViewIfNeeded();
    await section.screenshot({ path: 'e2e-results/default/anki-status-sync-settings.png' });
    await page.close();
  });
});
