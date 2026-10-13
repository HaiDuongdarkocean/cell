import { expect, type Page } from '@playwright/test';
import { test } from './extension.fixture';

const SRS_STUDY_PATH = 'src/entrypoints/srs-study/index.html';

async function seedSrsProfile(page: Page, extensionId: string, profileId = 'lp-en'): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/src/entrypoints/popup/index.html`);
  await page.locator('body').waitFor({ state: 'visible' });
  const result = await page.evaluate(async (profileId: string) =>
    new Promise<{ success: boolean; error?: string }>((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        resolve({ success: false, error: 'chrome.runtime not available' });
        return;
      }
      const profile = {
        id: profileId,
        target: 'en',
        native: 'vi',
        name: 'English',
        order: 1,
      };
      chrome.runtime.sendMessage(
        {
          type: 'UPDATE_SETTINGS',
          payload: {
            settings: {
              activeProfileId: profileId,
              languageProfiles: [profile],
              srs: { activeLanguageProfileId: profileId },
            },
          },
        },
        (response: unknown) => {
          const r = response as { success: boolean; error?: string } | undefined;
          resolve(r ?? { success: false, error: 'no response' });
        },
      );
    }),
    profileId,
  );
  expect(result.success).toBe(true);
}

test.describe('Ocean SRS smoke', () => {
  test('srs-study page loads and shows dashboard', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await seedSrsProfile(page, extensionId);
    await page.goto(`chrome-extension://${extensionId}/${SRS_STUDY_PATH}`);

    await expect(page.getByRole('heading', { name: 'Memory' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Continue studying' })).toBeVisible();
    await expect(page.getByText('Study Streak')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'All Decks' })).toBeVisible();
    await expect(page.getByText('uninstalling the extension deletes them')).toBeVisible();

    await page.close();
  });

  test('clicking Study with no due cards shows empty state', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await seedSrsProfile(page, extensionId);
    await page.goto(`chrome-extension://${extensionId}/${SRS_STUDY_PATH}`);

    const studyButton = page.getByRole('button', { name: 'Continue studying' });
    await expect(studyButton).toBeVisible({ timeout: 10_000 });
    await studyButton.click();

    await expect(page.getByText('All caught up for now.')).toBeVisible({ timeout: 10_000 });

    await page.close();
  });

  test('adds a note via background message and starts a review', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await seedSrsProfile(page, extensionId);
    await page.goto(`chrome-extension://${extensionId}/${SRS_STUDY_PATH}`);
    await page.getByRole('heading', { name: 'Memory' }).waitFor({ state: 'visible', timeout: 10_000 });

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

    expect(result.success, `SRS_ADD_NOTE failed: ${result.error}`).toBe(true);
    expect(result.data?.noteId).toBeTruthy();
    expect(result.data?.cardId).toBeTruthy();

    // Start studying; the new card should be due now.
    await page.getByRole('button', { name: 'Continue studying' }).click();
    await expect(page.locator('[aria-label="Sound"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible();

    // Flip to the back to verify the answer card renders.
    await page.getByRole('button', { name: 'Show answer' }).click();
    await expect(page.getByRole('heading', { name: 'smoke' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Remember' })).toBeVisible();

    await page.close();
  });

  test('reviews a card through sound, meaning, and spelling', async ({ context, extensionId }) => {
    const page = await context.newPage();
    // Use a fresh language profile so this test owns the SRS collection.
    const profileId = 'lp-review';
    await seedSrsProfile(page, extensionId, profileId);
    await page.goto(`chrome-extension://${extensionId}/${SRS_STUDY_PATH}`);
    await page.getByRole('heading', { name: 'Memory' }).waitFor({ state: 'visible', timeout: 10_000 });

    // Seed a note through the background message bus.
    const result = await page.evaluate(async () => {
      const payload = {
        targetLanguage: 'en',
        targetWord: 'ignite',
        fields: {
          target: { kind: 'text', value: 'ignite' },
          ipa: { kind: 'text', value: '/ɪɡˈnaɪt/' },
          sentence: { kind: 'text', value: 'The sparks ignite the dry leaves.' },
          def: { kind: 'text', value: 'to start to burn; to make something start to burn' },
          examples: { kind: 'list', value: ['the fuel ignited instantly'] },
          notes: { kind: 'text', value: '' },
          translation: { kind: 'translation', value: 'đốt cháy' },
          context: { kind: 'context', value: 'The sparks ignite the dry leaves.' },
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

    expect(result.success, `SRS_ADD_NOTE failed: ${result.error}`).toBe(true);

    // Start studying; the new card should be due now.
    await page.getByRole('button', { name: 'Continue studying' }).click();
    await expect(page.locator('[aria-label="Sound"][aria-current="step"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible();

    // Explore SOUND: reveal the answer, then rate Remember.
    await page.getByRole('button', { name: 'Show answer' }).click();
    await expect(page.getByRole('heading', { name: 'ignite' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Remember' }).click();
    await expect(page.locator('[aria-label="Meaning"][aria-current="step"]')).toBeVisible({ timeout: 10_000 });

    // Explore MEANING: reveal, rate Remember, then SPELLING appears.
    await page.getByRole('button', { name: 'Show answer' }).click();
    await expect(page.getByRole('heading', { name: 'ignite' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Remember' }).click();
    await expect(page.locator('[aria-label="Spelling"][aria-current="step"]')).toBeVisible({ timeout: 10_000 });

    // Explore SPELLING: reveal, rate Remember.
    await page.getByLabel('Type the word').fill('ignite');
    await page.getByLabel('Type the word').press('Enter');
    await expect(page.getByRole('heading', { name: 'ignite' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Remember' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Remember' }).click();

    // We have now proven the SRS review flow: a card advances through the
    // explore stage for sound → meaning → spelling when Remember is clicked.
    await page.close();
  });

  test('edit card shows stored media and tags, and persists tag edits', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await seedSrsProfile(page, extensionId, 'lp-edit');
    await page.goto(`chrome-extension://${extensionId}/${SRS_STUDY_PATH}`);
    await page.getByRole('heading', { name: 'Memory' }).waitFor({ state: 'visible', timeout: 10_000 });

    const result = await page.evaluate(async () => {
      const payload = {
        targetLanguage: 'en',
        targetWord: 'resonate',
        tags: ['smoke-tag', 'e2e'],
        fields: {
          target: { kind: 'text', value: 'resonate' },
          sentence: { kind: 'text', value: 'Her words resonate with the crowd.' },
          def: { kind: 'text', value: 'to evoke a feeling of shared emotion' },
          wordAudio: {
            kind: 'audio',
            value: 'data:audio/mpeg;base64,//uQZAAAAANIAAAAAExBTUUzLjk4LjIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            source: 'local',
          },
          sentAudio: {
            kind: 'audio',
            value: 'data:audio/mpeg;base64,//uQZAAAAANIAAAAAExBTUUzLjk4LjIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            source: 'local',
          },
          image: {
            kind: 'image',
            value: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          },
        },
      };
      return new Promise<{ success: boolean; error?: string }>((resolve) => {
        chrome.runtime.sendMessage({ type: 'SRS_ADD_NOTE', payload }, (response: unknown) => {
          resolve(response as { success: boolean; error?: string });
        });
      });
    });
    expect(result.success, `SRS_ADD_NOTE failed: ${result.error}`).toBe(true);

    await page.getByRole('button', { name: 'Continue studying' }).click();
    await page.getByRole('button', { name: 'Edit card' }).click();

    await expect(page.getByRole('heading', { name: 'Edit card' })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-tihoka-id="srs-edit-wordAudio-view-0"]')).toBeVisible();
    await expect(page.locator('[data-tihoka-id="srs-edit-sentAudio-view-0"]')).toBeVisible();
    await expect(page.locator('[data-tihoka-id="srs-edit-image-thumb-0"]')).toBeVisible();
    await expect(page.locator('[data-tihoka-id="srs-edit-tags-row"]').getByText('smoke-tag')).toBeVisible();
    await expect(page.locator('[data-tihoka-id="srs-edit-tags-row"]').getByText('e2e')).toBeVisible();

    await expect(page.locator('[data-tihoka-id="srs-edit-image-add"]')).toHaveText('Add');
    await expect(page.getByRole('button', { name: 'Delete card' })).toBeVisible();
    await page.screenshot({ path: 'tmp/srs-edit/top.png' });

    await page.locator('[data-tihoka-id="srs-edit-tags-row"] input').fill('persisted-tag');
    await page.locator('[data-tihoka-id="srs-edit-tags-row"] input').press('Enter');
    await expect(page.locator('[data-tihoka-id="srs-edit-tags-row"]').getByText('persisted-tag')).toBeVisible();

    await page.screenshot({ path: 'tmp/srs-edit/evidence.png', fullPage: true });

    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Edit card' })).toBeHidden({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Edit card' }).click();
    await expect(page.locator('[data-tihoka-id="srs-edit-tags-row"]').getByText('persisted-tag')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-tihoka-id="srs-edit-wordAudio-view-0"]')).toBeVisible();
    await expect(page.locator('[data-tihoka-id="srs-edit-image-thumb-0"]')).toBeVisible();

    await page.close();
  });
});
