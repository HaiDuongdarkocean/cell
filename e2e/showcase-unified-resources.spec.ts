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

  test('import flow updates live in-place — upload row → importing card → done card + alert', async ({ showcasePage }) => {
    const frame = await openResourcesSection(showcasePage);

    const filePath = resolve(EVIDENCE_DIR, 'live-flow.txt');
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    writeFileSync(filePath, 'x\n'.repeat(5_000_000));

    const panel = frame.locator('[data-cell-id="resources-panel"]');
    const list = panel.locator('[role="list"]').first();
    await list.locator('[data-cell-id="resource-card-4"]').scrollIntoViewIfNeeded();

    await frame.locator('[data-cell-id="dropzone-input"]').setInputFiles(filePath);

    const jobRow = frame.locator('[data-cell-id^="import-job-"]').first();
    await expect(jobRow).toBeAttached({ timeout: IMPORT_DONE_MS });
    await showcasePage.screenshot({ path: `${EVIDENCE_DIR}/10-uploading-row.png`, fullPage: false });

    const importingFill = frame.locator('[data-cell-id^="importing-"]').first();
    await expect(importingFill).toBeAttached({ timeout: IMPORT_DONE_MS });
    await showcasePage.screenshot({ path: `${EVIDENCE_DIR}/11-importing-card.png`, fullPage: false });

    const newCard = list.locator('[data-cell-id="resource-card-10000"]');
    await expect(importingFill).toHaveCount(0, { timeout: IMPORT_DONE_MS });
    await expect(newCard).toBeAttached({ timeout: IMPORT_DONE_MS });
    await expect(list.locator('[data-cell-id="component-frequency-10000"]')).toBeVisible({ timeout: IMPORT_DONE_MS });
    await expect(panel.locator('[data-cell-id="panel-alert"]')).toBeVisible({ timeout: IMPORT_DONE_MS });
    await newCard.scrollIntoViewIfNeeded();
    await showcasePage.screenshot({ path: `${EVIDENCE_DIR}/12-done-card.png`, fullPage: false });
  });

  test('component narrowing on a live job row lands only the selected subset', async ({ showcasePage }) => {
    const frame = await openResourcesSection(showcasePage);

    const bigPathA = resolve(EVIDENCE_DIR, 'slow-upload-a.txt');
    const bigPathB = resolve(EVIDENCE_DIR, 'slow-upload-b.txt');
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    writeFileSync(bigPathA, 'y\n'.repeat(30_000_000));
    writeFileSync(bigPathB, 'z\n'.repeat(30_000_000));

    const mixedPath = resolve(EVIDENCE_DIR, 'mixed-narrow.zip');
    writeFileSync(
      mixedPath,
      zipSync({
        'index.json': strToU8('{"title":"narrow","format":3}'),
        'term_bank_1.json': strToU8('[["alpha","alpha",[],1,[],[]]]'),
        'term_meta_bank_1.json': strToU8('[["alpha","freq",50]]'),
      }),
    );

    // Both upload slots stay busy with the big files long enough for the mixed
    // zip to sit 'queued' — its chips stay pickable and the click reaches the
    // upload chunks via getComponents.
    await frame.locator('[data-cell-id="dropzone-input"]').setInputFiles([bigPathA, bigPathB, mixedPath]);

    const freqChip = frame.locator('[data-cell-id^="job-component-frequency-"]');
    await expect(freqChip).toBeAttached({ timeout: IMPORT_DONE_MS });
    await freqChip.click();
    await expect(freqChip).toHaveAttribute('aria-pressed', 'false');
    await showcasePage.screenshot({ path: `${EVIDENCE_DIR}/13-live-chips.png`, fullPage: false });

    const panel = frame.locator('[data-cell-id="resources-panel"]');
    const list = panel.locator('[role="list"]').first();
    const narrowCard = list.locator('[data-cell-id="resource-card-10002"]');
    await expect(narrowCard).toBeAttached({ timeout: IMPORT_DONE_MS * 2 });
    await expect(list.locator('[data-cell-id="component-definitions-10002"]')).toBeVisible({ timeout: IMPORT_DONE_MS });
    await expect(list.locator('[data-cell-id="component-frequency-10002"]')).toHaveCount(0);
    await narrowCard.scrollIntoViewIfNeeded();
    await showcasePage.screenshot({ path: `${EVIDENCE_DIR}/14-narrowed-card.png`, fullPage: false });
  });

  test('delete drains the card in place; a re-dropped file waits for removal then imports', async ({ showcasePage }) => {
    const frame = await openResourcesSection(showcasePage);

    const filePath = resolve(EVIDENCE_DIR, 'delete-cycle.txt');
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    writeFileSync(filePath, 'del\n'.repeat(4_000_000));

    const panel = frame.locator('[data-cell-id="resources-panel"]');
    const list = panel.locator('[role="list"]').first();

    await frame.locator('[data-cell-id="dropzone-input"]').setInputFiles(filePath);
    const card = list.locator('[data-cell-id="resource-card-10000"]');
    await expect(card).toBeAttached({ timeout: IMPORT_DONE_MS });

    await frame.locator('[data-cell-id="edit-resources"]').click();
    await frame.locator('[data-cell-id="delete-button-10000"]').click();
    await frame.locator('[data-cell-id="confirm-delete"]').click();

    const drain = frame.locator('[data-cell-id="deleting-10000"]');
    await expect(drain).toBeAttached({ timeout: IMPORT_DONE_MS });
    await expect(frame.locator('[data-cell-id="delete-meta-10000"]')).toContainText('Removing…');
    await card.scrollIntoViewIfNeeded();
    await showcasePage.screenshot({ path: `${EVIDENCE_DIR}/16-deleting-card.png`, fullPage: false });

    // Re-dropping the same file must queue behind the removal, not race it.
    await frame.locator('[data-cell-id="dropzone-input"]').setInputFiles(filePath);
    const heldRow = frame.locator('text=Waiting for removal…');
    await expect(heldRow).toBeAttached({ timeout: 5_000 });
    await heldRow.scrollIntoViewIfNeeded();
    await showcasePage.screenshot({ path: `${EVIDENCE_DIR}/17-held-import.png`, fullPage: false });

    const landed = list.locator('[data-cell-id="resource-card-10001"]');
    await expect(landed).toBeAttached({ timeout: IMPORT_DONE_MS * 2 });
    await expect(card).toHaveCount(0);
    await landed.scrollIntoViewIfNeeded();
    await showcasePage.screenshot({ path: `${EVIDENCE_DIR}/18-reimported.png`, fullPage: false });
  });

  test('failed import keeps a visible error row with retry/dismiss', async ({ showcasePage }) => {
    const frame = await openResourcesSection(showcasePage);

    const filePath = resolve(EVIDENCE_DIR, 'fail-wordlist.txt');
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    writeFileSync(filePath, 'boom\n');

    await frame.locator('[data-cell-id="dropzone-input"]').setInputFiles(filePath);

    const retry = frame.locator('[data-cell-id^="job-retry-"]');
    await expect(retry).toBeVisible({ timeout: IMPORT_DONE_MS });
    const dismiss = frame.locator('[data-cell-id^="job-dismiss-"]');
    await expect(dismiss).toBeVisible();
    await retry.scrollIntoViewIfNeeded();
    await showcasePage.screenshot({ path: `${EVIDENCE_DIR}/15-error-row.png`, fullPage: false });
  });

  test('component chip toggles via aria-pressed on a mixed card and persists', async ({ showcasePage }) => {
    const frame = await openResourcesSection(showcasePage);
    const chip = frame.locator('[data-cell-id="component-frequency-4"]');
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');

    // Remount the section — the panel re-fetches RESOURCE_LIST and the mock
    // must still report the component disabled, like real IDB persistence.
    await frame.locator('[data-section-id="general"]').first().click();
    const navBack = frame.locator('[data-section-id="resources"]').first();
    await navBack.click();
    const chipAfter = frame.locator('[data-cell-id="component-frequency-4"]');
    await expect(chipAfter).toBeVisible();
    await expect(chipAfter).toHaveAttribute('aria-pressed', 'false');
  });
});
