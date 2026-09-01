import { expect, type Page } from '@playwright/test';
import { test } from './extension.fixture';

const SRS_STUDY_PATH = 'src/entrypoints/srs-study/index.html';

async function seedSrsProfile(page: Page, extensionId: string): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/src/entrypoints/popup/index.html`);
  await page.locator('body').waitFor({ state: 'visible' });
  const result = await page.evaluate(async () =>
    new Promise<{ success: boolean; error?: string }>((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        resolve({ success: false, error: 'chrome.runtime not available' });
        return;
      }
      const profile = {
        id: 'lp-en',
        target: 'en',
        native: 'vi',
        name: 'English',
        order: 1,
        resourceIds: [] as number[],
      };
      chrome.runtime.sendMessage(
        {
          type: 'UPDATE_SETTINGS',
          payload: {
            settings: {
              activeProfileId: 'lp-en',
              languageProfiles: [profile],
            },
          },
        },
        (response: unknown) => {
          const r = response as { success: boolean; error?: string } | undefined;
          resolve(r ?? { success: false, error: 'no response' });
        },
      );
    }),
  );
  expect(result.success).toBe(true);
}

test.describe('Ocean SRS smoke', () => {
  test('srs-study page loads and shows dashboard', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await seedSrsProfile(page, extensionId);
    await page.goto(`chrome-extension://${extensionId}/${SRS_STUDY_PATH}`);

    await expect(page.getByRole('heading', { name: 'Ocean SRS' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Study' })).toBeVisible();
    await expect(page.getByText('Data is stored locally in this browser')).toBeVisible();

    await page.close();
  });

  test('clicking Study with no due cards shows empty state', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await seedSrsProfile(page, extensionId);
    await page.goto(`chrome-extension://${extensionId}/${SRS_STUDY_PATH}`);

    const studyButton = page.getByRole('button', { name: 'Study' });
    await expect(studyButton).toBeVisible({ timeout: 10_000 });
    await studyButton.click();

    await expect(page.getByText('All caught up for now.')).toBeVisible({ timeout: 10_000 });

    await page.close();
  });

  test('adds a note via background message and starts a review', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await seedSrsProfile(page, extensionId);
    await page.goto(`chrome-extension://${extensionId}/${SRS_STUDY_PATH}`);
    await page.getByRole('heading', { name: 'Ocean SRS' }).waitFor({ state: 'visible', timeout: 10_000 });

    // Seed a note through the background message bus.
    const result = await page.evaluate(async () => {
      const payload = {
        targetLanguage: 'en',
        targetWord: 'smoke',
        fields: {
          target: { kind: 'text', value: 'smoke' },
          ipa: { kind: 'text', value: '/smoʊk/' },
          sentence: { kind: 'text', value: 'The smoke rose from the chimney.' },
          def: { kind: 'text', value: 'a visible suspension of carbon or other particles in air' },
          examples: { kind: 'list', value: ['smoke filled the room'] },
          notes: { kind: 'text', value: '' },
          translation: { kind: 'translation', value: 'khói' },
          context: { kind: 'context', value: 'The smoke rose from the chimney.' },
        },
      };
      return new Promise<{ success: boolean; data?: { noteId: string; cardId: string }; error?: string }>((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
          resolve({ success: false, error: 'chrome.runtime not available' });
          return;
        }
        chrome.runtime.sendMessage({ type: 'SRS_ADD_NOTE', payload }, (response: unknown) => {
          resolve(response as { success: boolean; data?: { noteId: string; cardId: string }; error?: string });
        });
      });
    });

    expect(result.success).toBe(true);
    expect(result.data?.noteId).toBeTruthy();
    expect(result.data?.cardId).toBeTruthy();

    // Start studying; the new card should be due now.
    await page.getByRole('button', { name: 'Study' }).click();
    await expect(page.getByText('SOUND')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Forget' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remember' })).toBeVisible();

    await page.close();
  });
});
