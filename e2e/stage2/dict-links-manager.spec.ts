import { expect, type Page } from '@playwright/test';
import { test } from '../fixtures/actors/universalPanel.fixture';

async function shadowClick(page: Page, selector: string, timeout = 10_000): Promise<void> {
  const ok = await page.evaluate(
    ({ sel, maxWait }) =>
      new Promise<boolean>((resolve) => {
        const startTime = Date.now();
        const tick = (): void => {
          const el = document
            .getElementById('cell-universal-panel-host')
            ?.shadowRoot?.querySelector(sel) as HTMLElement | null;
          if (el) {
            el.click();
            resolve(true);
            return;
          }
          if (Date.now() - startTime > maxWait) {
            resolve(false);
            return;
          }
          setTimeout(tick, 100);
        };
        tick();
      }),
    { sel: selector, maxWait: timeout },
  );
  if (!ok) throw new Error(`shadow click target never appeared: ${selector}`);
}

async function shadowCount(page: Page, selector: string): Promise<number> {
  return page.evaluate(
    (sel) =>
      document.getElementById('cell-universal-panel-host')?.shadowRoot?.querySelectorAll(sel)
        .length ?? 0,
    selector,
  );
}

async function shadowTexts(page: Page, selector: string): Promise<string[]> {
  return page.evaluate(
    (sel) =>
      Array.from(
        document
          .getElementById('cell-universal-panel-host')
          ?.shadowRoot?.querySelectorAll(sel) ?? [],
      ).map((el) => el.textContent?.trim() ?? ''),
    selector,
  );
}

async function shadowIdByName(page: Page, name: string): Promise<string | null> {
  return page.evaluate(
    (linkName) => {
      const buttons = document
        .getElementById('cell-universal-panel-host')
        ?.shadowRoot?.querySelectorAll('[data-cell-id^="dict-link-name-"]') ?? [];
      for (const el of buttons) {
        if (el.textContent?.trim() === linkName) {
          return (el.getAttribute('data-cell-id') ?? '').replace('dict-link-name-', '');
        }
      }
      return null;
    },
    name,
  );
}

async function shadowType(page: Page, selector: string, value: string): Promise<void> {
  const ok = await page.evaluate(
    ({ sel, text }) => {
      const input = document
        .getElementById('cell-universal-panel-host')
        ?.shadowRoot?.querySelector(sel) as HTMLInputElement | null;
      if (!input) return false;
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, text);
      input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
      return true;
    },
    { sel: selector, text: value },
  );
  if (!ok) throw new Error(`shadow input target not found: ${selector}`);
}

async function openDictLinksManager(
  page: Page,
  universalPanel: { open(): Promise<void>; openTab(tab: 'settings'): Promise<void> },
): Promise<void> {
  await universalPanel.open();
  await universalPanel.openTab('settings');
  await expect
    .poll(() => shadowCount(page, '[data-cell-id="dict-links-manager"]'), { timeout: 20_000 })
    .toBe(1);
  await shadowClick(page, '[data-section-id="dictionaryPopup"]');
}

const NAMES = '[data-cell-id^="dict-link-name-"]';
const ROWS = '[data-cell-id^="dict-link-slot-"]';

test('dict-links-manager: defaults render, add/validate/delete, persists across reload', async ({
  universalPanel,
  streamFlixPage,
}, testInfo) => {
  const page = streamFlixPage;

  await openDictLinksManager(page, universalPanel);

  // Shipped defaults render in stored order.
  await expect
    .poll(() => shadowTexts(page, NAMES), { timeout: 10_000 })
    .toEqual(['Cambridge Dictionary', 'Wiktionary', 'Google Translate']);

  // Invalid template (no {term}) is rejected and the dialog stays open.
  await shadowClick(page, '[data-cell-id="dict-link-add"]');
  await expect
    .poll(() => shadowCount(page, '[data-cell-id="dict-link-editor"]'), { timeout: 10_000 })
    .toBe(1);
  await shadowType(page, '[data-cell-id="dict-link-editor-name"]', 'Bad Link');
  await shadowType(page, '[data-cell-id="dict-link-editor-url"]', 'https://example.com/no-placeholder');
  await shadowClick(page, '[data-cell-id="dict-link-editor-save"]');
  await expect
    .poll(() => shadowCount(page, '[data-cell-id="dict-link-editor"] [role="alert"]'), {
      timeout: 5_000,
    })
    .toBe(1);
  expect(await shadowCount(page, ROWS)).toBe(3);

  // Close the rejected editor via its footer Cancel button.
  const cancelled = await page.evaluate(() => {
    const dialog = document
      .getElementById('cell-universal-panel-host')
      ?.shadowRoot?.querySelector('[data-cell-id="dict-link-editor"]');
    const cancel = Array.from(dialog?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Cancel',
    ) as HTMLElement | undefined;
    cancel?.click();
    return !!cancel;
  });
  expect(cancelled).toBe(true);
  await expect
    .poll(() => shadowCount(page, '[data-cell-id="dict-link-editor"]'), { timeout: 5_000 })
    .toBe(0);

  // Valid template is accepted.
  await shadowClick(page, '[data-cell-id="dict-link-add"]');
  await shadowType(page, '[data-cell-id="dict-link-editor-name"]', 'E2E Dict');
  await shadowType(
    page,
    '[data-cell-id="dict-link-editor-url"]',
    'https://example.com/{term}?lang={lang}',
  );
  await shadowClick(page, '[data-cell-id="dict-link-editor-save"]');
  await expect
    .poll(() => shadowTexts(page, NAMES), { timeout: 10_000 })
    .toEqual(['Cambridge Dictionary', 'Wiktionary', 'Google Translate', 'E2E Dict']);

  // Persisted: reload the page and re-open the manager.
  await page.reload({ waitUntil: 'networkidle' });
  const badge = page.locator('[data-cell-id="orbital-badge"]');
  await expect(badge).toBeVisible({ timeout: 30_000 });
  await openDictLinksManager(page, universalPanel);
  await expect
    .poll(() => shadowTexts(page, NAMES), { timeout: 10_000 })
    .toEqual(['Cambridge Dictionary', 'Wiktionary', 'Google Translate', 'E2E Dict']);

  // Delete the added link via the confirm dialog.
  const id = await shadowIdByName(page, 'E2E Dict');
  expect(id).toBeTruthy();
  await shadowClick(page, `[data-cell-id="dict-link-delete-${id}"]`);
  await expect
    .poll(() => shadowCount(page, '[data-cell-id="dict-link-delete-dialog"]'), { timeout: 5_000 })
    .toBe(1);
  await shadowClick(page, '[data-cell-id="dict-link-delete-confirm"]');
  await expect
    .poll(() => shadowTexts(page, NAMES), { timeout: 10_000 })
    .toEqual(['Cambridge Dictionary', 'Wiktionary', 'Google Translate']);

  await page.screenshot({ path: testInfo.outputPath('dict-links-manager.png') });
});
