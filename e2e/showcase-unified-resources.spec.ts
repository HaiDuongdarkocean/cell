import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { expect, type FrameLocator, type Page } from '@playwright/test';
import { test } from './showcase.fixture';

const EVIDENCE_DIR = resolve('tmp/unified-resource-import');
const IMPORT_DONE_MS = 20_000;

// The settings showcase renders SettingsDialogContent inside a device-bezel
// iframe — inner selectors must go through frameLocator.
async function openResourcesSection(showcasePage: Page): Promise<FrameLocator> {
  await showcasePage.goto('?showcase=Settings+Dialog+Page&view=direct');
  const frame = showcasePage.frameLocator('iframe').first();
  const navItem = frame.locator('[data-section-id="resources"]').first();
  await expect(navItem).toBeVisible({ timeout: 15_000 });
  await navItem.click();
  const panel = frame.locator('[data-cell-id="resources-panel"]');
  await expect(panel).toBeVisible();
  return frame;
}

test.describe('Unified resource import — one section, components from content', () => {
  test('single section + single dropzone + flat mixed list', async ({ showcasePage }) => {
    const frame = await openResourcesSection(showcasePage);
    const panel = frame.locator('[data-cell-id="resources-panel"]');

    await expect(panel.locator('[role="list"]')).toHaveCount(1);
    await expect(frame.locator('[data-cell-id="dropzone-input"]')).toHaveCount(1);

    const list = panel.locator('[role="list"]').first();
    await expect(list.locator('[data-cell-id^="resource-card-"]')).toHaveCount(4);

    await expect(list.locator('[data-cell-id="component-definitions-1"]')).toBeVisible();
    await expect(list.locator('[data-cell-id="component-frequency-3"]')).toBeVisible();
    await expect(list.locator('[data-cell-id="component-definitions-4"]')).toBeVisible();
    await expect(list.locator('[data-cell-id="component-frequency-4"]')).toBeVisible();

    mkdirSync(EVIDENCE_DIR, { recursive: true });
    await showcasePage.screenshot({ path: `${EVIDENCE_DIR}/01-unified-list.png`, fullPage: false });
  });

  test('txt import lands as a frequency resource in the same list', async ({ showcasePage }) => {
    const frame = await openResourcesSection(showcasePage);

    const filePath = resolve(EVIDENCE_DIR, 'wordfreq.txt');
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    writeFileSync(filePath, 'hello\nworld\n');

    await frame.locator('[data-cell-id="dropzone-input"]').setInputFiles(filePath);

    const pending = frame.locator('[data-cell-id^="import-job-"], [data-cell-id^="importing-"]').first();
    await expect(pending).toBeAttached();

    const panel = frame.locator('[data-cell-id="resources-panel"]');
    const list = panel.locator('[role="list"]').first();
    const newCard = list.locator('[data-cell-id="resource-card-10000"]');
    await expect(newCard).toBeAttached({ timeout: IMPORT_DONE_MS });
    await expect(list.locator('[data-cell-id="component-frequency-10000"]')).toBeVisible({ timeout: IMPORT_DONE_MS });

    await showcasePage.screenshot({ path: `${EVIDENCE_DIR}/02-freq-import.png`, fullPage: false });
  });

  test('mixed zip shows detected component chips and lands both', async ({ showcasePage }) => {
    const frame = await openResourcesSection(showcasePage);

    const filePath = resolve(EVIDENCE_DIR, 'mixed-dict.zip');
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    writeFileSync(
      filePath,
      zipSync({
        'index.json': strToU8('{"title":"mixed","format":3}'),
        'term_bank_1.json': strToU8('[["hello","hello",[],1,[],[]]]'),
        'term_meta_bank_1.json': strToU8('[["hello","freq",100]]'),
      }),
    );

    await frame.locator('[data-cell-id="dropzone-input"]').setInputFiles(filePath);

    // During upload the detected chips are pickable on the job row — that row
    // is ephemeral (suppressed once the importing card takes over), so the
    // stable contract is the finished card carrying both components.
    const pending = frame.locator('[data-cell-id^="import-job-"], [data-cell-id^="importing-"]').first();
    await expect(pending).toBeAttached();

    const panel = frame.locator('[data-cell-id="resources-panel"]');
    const list = panel.locator('[role="list"]').first();
    const newCard = list.locator('[data-cell-id="resource-card-10000"]');
    await expect(newCard).toBeAttached({ timeout: IMPORT_DONE_MS });
    await expect(list.locator('[data-cell-id="component-definitions-10000"]')).toBeVisible({ timeout: IMPORT_DONE_MS });
    await expect(list.locator('[data-cell-id="component-frequency-10000"]')).toBeVisible({ timeout: IMPORT_DONE_MS });

    await showcasePage.screenshot({ path: `${EVIDENCE_DIR}/03-mixed-import.png`, fullPage: false });
  });

  test('component chip toggles via aria-pressed on a mixed card', async ({ showcasePage }) => {
    const frame = await openResourcesSection(showcasePage);
    const chip = frame.locator('[data-cell-id="component-frequency-4"]');
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
  });
});
