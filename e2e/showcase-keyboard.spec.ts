import { expect } from '@playwright/test';
import { test } from './showcase.fixture';

test.describe('Design System Showcase — keyboard & focus contracts', () => {
  test('Dialog opens, traps Tab, closes with Escape, restores focus', async ({ showcasePage }) => {
    await showcasePage.goto('?showcase=Dialog');

    const openButton = showcasePage.getByRole('button', { name: 'Open Dialog' });
    await openButton.focus();
    await expect(openButton).toBeFocused();

    await showcasePage.keyboard.press('Enter');
    const dialog = showcasePage.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // useFocusTrap moves focus to first focusable element (close button).
    const closeButton = showcasePage.getByRole('button', { name: 'Close' });
    await expect(closeButton).toBeFocused();

    // Tab cycles forward.
    await showcasePage.keyboard.press('Tab');
    await expect(showcasePage.getByRole('button', { name: 'Cancel' })).toBeFocused();

    await showcasePage.keyboard.press('Tab');
    await expect(showcasePage.getByRole('button', { name: 'Confirm' })).toBeFocused();

    await showcasePage.keyboard.press('Tab');
    await expect(closeButton).toBeFocused();

    // Shift+Tab cycles backward.
    await showcasePage.keyboard.press('Shift+Tab');
    await expect(showcasePage.getByRole('button', { name: 'Confirm' })).toBeFocused();

    // Escape closes and returns focus to trigger.
    await showcasePage.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(openButton).toBeFocused();
  });

  test('Button trigger responds to Enter and Space', async ({ showcasePage }) => {
    await showcasePage.goto('?showcase=Dialog');

    const openButton = showcasePage.getByRole('button', { name: 'Open Dialog' });
    const dialog = showcasePage.getByRole('dialog');

    await openButton.focus();
    await showcasePage.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await showcasePage.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    await openButton.focus();
    await showcasePage.keyboard.press('Space');
    await expect(dialog).toBeVisible();
    await showcasePage.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('Tabs follow roving tabindex and arrow keys', async ({ showcasePage }) => {
    await showcasePage.goto('?showcase=Tabs');

    const preview = showcasePage.getByRole('tab', { name: 'Preview' });
    const code = showcasePage.getByRole('tab', { name: 'Code' });
    const settings = showcasePage.getByRole('tab', { name: 'Settings' });
    const tabpanel = showcasePage.getByRole('tabpanel');

    // Only the active tab is in the natural tab order.
    await expect(preview).toHaveAttribute('tabIndex', '0');
    await expect(code).toHaveAttribute('tabIndex', '-1');
    await expect(settings).toHaveAttribute('tabIndex', '-1');

    // Focus the active tab to start keyboard navigation.
    await preview.focus();
    await expect(preview).toBeFocused();
    await expect(preview).toHaveAttribute('aria-selected', 'true');

    // Arrow right activates and focuses next tab.
    await showcasePage.keyboard.press('ArrowRight');
    await expect(code).toBeFocused();
    await expect(code).toHaveAttribute('aria-selected', 'true');
    await expect(code).toHaveAttribute('tabIndex', '0');
    await expect(preview).toHaveAttribute('tabIndex', '-1');

    await showcasePage.keyboard.press('ArrowRight');
    await expect(settings).toBeFocused();
    await expect(settings).toHaveAttribute('aria-selected', 'true');

    // Arrow left wraps? In this implementation it does not wrap; it goes previous.
    await showcasePage.keyboard.press('ArrowLeft');
    await expect(code).toBeFocused();
    await expect(code).toHaveAttribute('aria-selected', 'true');

    await showcasePage.keyboard.press('Home');
    await expect(preview).toBeFocused();
    await expect(preview).toHaveAttribute('aria-selected', 'true');

    await showcasePage.keyboard.press('End');
    await expect(settings).toBeFocused();
    await expect(settings).toHaveAttribute('aria-selected', 'true');

    // Tab moves from tablist to the active tab panel.
    await showcasePage.keyboard.press('Tab');
    await expect(tabpanel).toBeFocused();
  });

  test('Select opens and navigates with keyboard', async ({ showcasePage }) => {
    await showcasePage.goto('?showcase=Select');

    // Use the first single-select trigger inside main content (ignore header).
    const main = showcasePage.locator('main');
    const trigger = main.locator('button[aria-haspopup="listbox"]').first();
    await trigger.focus();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await showcasePage.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const listbox = main.getByRole('listbox');
    await expect(listbox).toBeVisible();

    // Initial highlight is the selected option (English).
    await expect(listbox).toHaveAttribute('aria-activedescendant', 'select-option-en');

    // ArrowDown moves to Tiếng Việt.
    await showcasePage.keyboard.press('ArrowDown');
    await expect(listbox).toHaveAttribute('aria-activedescendant', 'select-option-vi');

    // ArrowDown skips the disabled 中文 and highlights 日本語.
    await showcasePage.keyboard.press('ArrowDown');
    await expect(listbox).toHaveAttribute('aria-activedescendant', 'select-option-ja');

    // Enter selects and closes the menu.
    await showcasePage.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveText('日本語');
  });

  test('Drawer opens, traps Tab, and closes with Escape', async ({ showcasePage }) => {
    await showcasePage.goto('?showcase=Drawer');

    const openButton = showcasePage.getByRole('button', { name: 'Left Drawer' });
    await openButton.focus();
    await showcasePage.keyboard.press('Enter');

    const drawer = showcasePage.getByRole('dialog');
    await expect(drawer).toBeVisible();

    // useFocusTrap moves focus to the first focusable element (header Close button).
    const closeButton = showcasePage.getByRole('button', { name: 'Close' }).first();
    await expect(closeButton).toBeFocused();

    await showcasePage.keyboard.press('Tab');
    await expect(showcasePage.getByRole('button', { name: 'Close' }).last()).toBeFocused();

    await showcasePage.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
    await expect(openButton).toBeFocused();
  });

  test('Input accepts focus and typed text', async ({ showcasePage }) => {
    await showcasePage.goto('?showcase=Input');

    // Use placeholder to avoid ambiguity in label association in this test.
    const input = showcasePage.getByPlaceholder('Nhập nội dung...').first();
    await input.focus();
    await input.fill('hello keyboard');
    await expect(input).toHaveValue('hello keyboard');
  });
});
