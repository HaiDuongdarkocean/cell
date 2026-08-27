import type { Locator, Page } from '@playwright/test';

/**
 * Visual state matrix for stable design-system components.
 *
 * Goal: capture the smallest set of rendered states with high blast radius,
 * not every permutation. Each case drives one Playwright `toHaveScreenshot`
 * assertion in `showcase-visual.spec.ts`.
 *
 * Matrix dimensions:
 * - Theme: light / dark
 * - State: default, hover, focus, active, disabled, loading, error, open (when applicable)
 */

export type VisualTheme = 'light' | 'dark';

export type TargetFn = (page: Page) => Locator;

export interface VisualCase {
  /** Component showcase slug. */
  component: string;
  /** Short state name used in snapshot filename. */
  state: string;
  /** Theme for this snapshot. */
  theme: VisualTheme;
  /** Playwright locator for the target element. */
  target: TargetFn;
  /** Action to apply before screenshot. */
  action: 'none' | 'hover' | 'focus' | 'click' | 'type' | 'open';
  /** Extra target/data for the action (e.g. the trigger to open, the tab to click). */
  actionArg?: TargetFn | string;
  /** Human-readable note for the reviewer. */
  note?: string;
}

const main = (page: Page): Locator => page.locator('main').first();

export const VISUAL_MATRIX: VisualCase[] = [
  // Button — primary states
  {
    component: 'Button',
    state: 'primary-default',
    theme: 'light',
    target: (page) => page.getByRole('button', { name: 'Primary' }).first(),
    action: 'none',
    note: 'Canonical primary button at rest.',
  },
  {
    component: 'Button',
    state: 'primary-hover',
    theme: 'light',
    target: (page) => page.getByRole('button', { name: 'Primary' }).first(),
    action: 'hover',
    note: 'Primary button hover material lift.',
  },
  {
    component: 'Button',
    state: 'primary-focus',
    theme: 'light',
    target: (page) => page.getByRole('button', { name: 'Primary' }).first(),
    action: 'focus',
    note: 'Primary button focus-visible ring.',
  },
  {
    component: 'Button',
    state: 'primary-active',
    theme: 'light',
    target: (page) => page.getByRole('button', { name: 'Active' }).first(),
    action: 'none',
    note: 'Pressed/toggle active state (ghost variant).',
  },
  {
    component: 'Button',
    state: 'primary-disabled',
    theme: 'light',
    target: (page) => page.getByRole('button', { name: 'Disabled' }),
    action: 'none',
    note: 'Disabled button with reduced opacity.',
  },
  {
    component: 'Button',
    state: 'primary-loading',
    theme: 'light',
    target: (page) => page.getByRole('button', { name: 'Loading' }),
    action: 'none',
    note: 'Loading state with spinner and aria-busy.',
  },
  {
    component: 'Button',
    state: 'primary-error',
    theme: 'light',
    target: (page) => page.getByRole('button', { name: 'Error' }),
    action: 'none',
    note: 'Error state fill.',
  },
  {
    component: 'Button',
    state: 'primary-default',
    theme: 'dark',
    target: (page) => page.getByRole('button', { name: 'Primary' }).first(),
    action: 'none',
    note: 'Primary button in dark theme.',
  },

  // Input — key surface states
  {
    component: 'Input',
    state: 'default',
    theme: 'light',
    target: (page) => page.locator('input[placeholder="Nhập nội dung..."]').first(),
    action: 'none',
    note: 'Default glass input at rest.',
  },
  {
    component: 'Input',
    state: 'focus',
    theme: 'light',
    target: (page) => page.locator('input[placeholder="Nhập nội dung..."]').first(),
    action: 'focus',
    note: 'Input with focus ring.',
  },
  {
    component: 'Input',
    state: 'error',
    theme: 'light',
    target: (page) => page.getByRole('textbox', { name: 'Email lỗi' }),
    action: 'none',
    note: 'Input in error state.',
  },
  {
    component: 'Input',
    state: 'disabled',
    theme: 'light',
    target: (page) => page.getByRole('textbox', { name: 'Disabled' }),
    action: 'none',
    note: 'Disabled input.',
  },
  {
    component: 'Input',
    state: 'default',
    theme: 'dark',
    target: (page) => page.locator('input[placeholder="Nhập nội dung..."]').first(),
    action: 'none',
    note: 'Default input in dark theme.',
  },

  // Card — default + interactive
  {
    component: 'Card',
    state: 'default',
    theme: 'light',
    target: (page) => page.getByText('Static container.').locator('..'),
    action: 'none',
    note: 'Default card surface.',
  },
  {
    component: 'Card',
    state: 'interactive-hover',
    theme: 'light',
    target: (page) => page.getByText('Hover to see active state.').locator('..'),
    action: 'hover',
    note: 'Interactive card hover lift.',
  },
  {
    component: 'Card',
    state: 'default',
    theme: 'dark',
    target: (page) => page.getByText('Static container.').locator('..'),
    action: 'none',
    note: 'Default card in dark theme.',
  },

  // Dialog — open state
  {
    component: 'Dialog',
    state: 'open',
    theme: 'light',
    target: (page) => page.getByRole('dialog'),
    action: 'open',
    actionArg: (page) => page.getByRole('button', { name: 'Open Dialog' }),
    note: 'Dialog panel with header and footer.',
  },
  {
    component: 'Dialog',
    state: 'open',
    theme: 'dark',
    target: (page) => page.getByRole('dialog'),
    action: 'open',
    actionArg: (page) => page.getByRole('button', { name: 'Open Dialog' }),
    note: 'Dialog panel in dark theme.',
  },

  // Tabs — active tab change
  {
    component: 'Tabs',
    state: 'preview-active',
    theme: 'light',
    target: (page) => page.getByRole('tablist'),
    action: 'none',
    note: 'Tabs with Preview tab active.',
  },
  {
    component: 'Tabs',
    state: 'code-active',
    theme: 'light',
    target: (page) => page.getByRole('tablist'),
    action: 'click',
    actionArg: (page) => page.getByRole('tab', { name: 'Code' }),
    note: 'Tabs with Code tab active.',
  },

  // Select — closed and open
  {
    component: 'Select',
    state: 'closed',
    theme: 'light',
    target: (page) => main(page).locator('button[aria-haspopup="listbox"]').first(),
    action: 'none',
    note: 'Select trigger at rest.',
  },
  {
    component: 'Select',
    state: 'open',
    theme: 'light',
    target: (page) => main(page).getByRole('listbox'),
    action: 'open',
    actionArg: (page) => main(page).locator('button[aria-haspopup="listbox"]').first(),
    note: 'Select listbox opened.',
  },
];
