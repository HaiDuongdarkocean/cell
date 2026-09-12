import { test, expect, type Page } from '@playwright/test';

/**
 * LanguageProfilePanel — selectable-cards direction.
 *
 * Runs against the mockup page, which hosts the REAL panel component wired to
 * live settings state (default tab: "Real panel"). Covers the full CRUD +
 * activation flow in both locales via the `?lang=` override.
 */

const PANEL = {
  bannerChange: 'Change',
  newProfile: 'New profile',
  targetTrigger: '[data-cell-id="profile-target-language"]',
  nativeTrigger: '[data-cell-id="profile-native-language"]',
  universalTrigger: '[data-cell-id="universal-native-language"]',
  save: '[data-cell-id="save-language-profile"]',
};

const PROFILE_CARD = (id: string) => `language-profile-card-${id}`;

async function pickOption(page: Page, trigger: string, optionCellId: string): Promise<void> {
  await page.locator(trigger).click();
  await page.locator(`[data-cell-id="${optionCellId}"]`).click();
}

function profileMenuButton(page: Page, id: string) {
  // The ⋮ menu button lives in the same `item` wrapper as the radio card.
  return page.getByTestId(PROFILE_CARD(id)).locator('..').getByRole('button', { name: /Actions for|Thao tác cho/ });
}

test.describe('LanguageProfilePanel — cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders banner, persistent toolbar, and 3 selectable cards', async ({ page }) => {
    await expect(page.getByText('Universal native language')).toBeVisible();
    await expect(page.getByText(/Profiles · 3/)).toBeVisible();
    await expect(page.getByRole('button', { name: PANEL.newProfile })).toBeVisible();

    await expect(page.getByRole('radio')).toHaveCount(3);
    await expect(page.getByTestId(PROFILE_CARD('p-en'))).toHaveAttribute('aria-checked', 'true');
  });

  test('clicking a card activates it', async ({ page }) => {
    const korean = page.getByTestId(PROFILE_CARD('p-ko'));
    await korean.click();
    await expect(korean).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId(PROFILE_CARD('p-en'))).toHaveAttribute('aria-checked', 'false');
  });

  test('New profile opens the form at the top; adding a profile grows the list', async ({ page }) => {
    await page.getByRole('button', { name: PANEL.newProfile }).click();
    const form = page.getByRole('group', { name: 'Add language profile' });
    await expect(form).toBeVisible();
    // Toolbar stays visible while the form is open.
    await expect(page.getByText(/Profiles · 3/)).toBeVisible();
    // Submit disabled until a target is picked.
    await expect(page.locator(PANEL.save)).toBeDisabled();

    await pickOption(page, PANEL.targetTrigger, 'profile-target-language-option-fr');
    await page.locator(PANEL.save).click();

    await expect(page.getByText(/Profiles · 4/)).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(4);
    await expect(
      page.getByRole('radio').filter({ hasText: /Français.*(Native|Gốc):/ }),
    ).toBeVisible();
  });

  test('kebab → Edit morphs the card into an in-place identity form', async ({ page }) => {
    await profileMenuButton(page, 'p-en').click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    const form = page.getByRole('group', { name: 'Edit language profile' });
    await expect(form).toBeVisible();
    // Identity only — no Advanced section in edit mode.
    await expect(form.getByText('Advanced')).not.toBeVisible();

    // Change native override to English and save.
    await pickOption(page, PANEL.nativeTrigger, 'profile-native-language-option-en');
    await form.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByTestId(PROFILE_CARD('p-en'))).toContainText('Native: English · custom');
  });

  test('kebab → Delete removes the card and reassigns active', async ({ page }) => {
    await profileMenuButton(page, 'p-en').click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByText(/Profiles · 2/)).toBeVisible();
    // Active fell back to the first remaining profile.
    await expect(page.getByTestId(PROFILE_CARD('p-ja'))).toHaveAttribute('aria-checked', 'true');
  });

  test('Universal native banner: Change → draft → Save updates inherited meta', async ({ page }) => {
    await page.getByRole('button', { name: PANEL.bannerChange }).click();
    await pickOption(page, PANEL.universalTrigger, 'universal-native-language-option-de');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByTestId('universal-native-banner-value')).toContainText('Deutsch');
    await expect(page.getByTestId(PROFILE_CARD('p-ja'))).toContainText('Native: Deutsch');
  });

  test('duplicate target+native is rejected inline', async ({ page }) => {
    await page.getByRole('button', { name: PANEL.newProfile }).click();
    await pickOption(page, PANEL.targetTrigger, 'profile-target-language-option-en');
    await page.locator(PANEL.save).click();
    await expect(page.locator('[data-cell-id="language-profile-validation"]')).toContainText(
      'already exists',
    );
  });
});

test.describe('LanguageProfilePanel — vi locale', () => {
  test('renders Vietnamese copy when ?lang=vi', async ({ page }) => {
    await page.goto('/?lang=vi');
    await expect(page.getByText('Ngôn ngữ gốc dùng chung')).toBeVisible();
    await expect(page.getByText(/Hồ sơ · 3/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thêm hồ sơ' })).toBeVisible();
    await expect(page.getByTestId(PROFILE_CARD('p-en'))).toContainText('Gốc: Tiếng Việt');
  });
});
