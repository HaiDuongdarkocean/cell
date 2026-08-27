import { expect, type Locator, type Page } from '@playwright/test';
import { test } from './showcase.fixture';
import { VISUAL_MATRIX, type VisualCase, type VisualTheme } from './visual-matrix';

function sanitizeFileName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function applyTheme(page: Page, theme: VisualTheme): Promise<void> {
  if (theme === 'dark') {
    const getTheme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await expect.poll(getTheme).toBe('light');
    await page.getByRole('button', { name: /Switch to/i }).click();
    await expect.poll(getTheme).toBe('dark');
  }
}

async function getActionArg(arg: VisualCase['actionArg'], page: Page): Promise<Locator> {
  if (typeof arg === 'function') return arg(page);
  throw new Error('open/click action requires a TargetFn actionArg');
}

async function prepareState(target: Locator, visualCase: VisualCase): Promise<void> {
  const page = target.page();

  switch (visualCase.action) {
    case 'none':
      await target.scrollIntoViewIfNeeded();
      break;
    case 'hover':
      await target.scrollIntoViewIfNeeded();
      await target.hover();
      break;
    case 'focus':
      await target.scrollIntoViewIfNeeded();
      await target.focus();
      break;
    case 'click': {
      await target.scrollIntoViewIfNeeded();
      const arg = await getActionArg(visualCase.actionArg, page);
      await arg.click();
      break;
    }
    case 'open': {
      const trigger = await getActionArg(visualCase.actionArg, page);
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();
      await expect(target).toBeVisible();
      await target.scrollIntoViewIfNeeded();
      break;
    }
    case 'type': {
      await target.scrollIntoViewIfNeeded();
      const text = typeof visualCase.actionArg === 'string' ? visualCase.actionArg : 'visual-test';
      await target.fill(text);
      break;
    }
    default:
      break;
  }

  // Give CSS transitions a frame to settle; tests run with reduced motion.
  await page.waitForTimeout(100);
}

test.describe('Design System Showcase — visual baselines', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ showcasePage }) => {
    // Disable animations to avoid flaky snapshots.
    await showcasePage.emulateMedia({ reducedMotion: 'reduce' });
  });

  for (const visualCase of VISUAL_MATRIX) {
    const testName = `${visualCase.component} — ${visualCase.state} — ${visualCase.theme}`;
    const snapshotName = `${sanitizeFileName(visualCase.component)}-${sanitizeFileName(
      visualCase.state,
    )}-${visualCase.theme}.png`;

    test(testName, async ({ showcasePage }) => {
      await showcasePage.goto(`?showcase=${visualCase.component}`);

      await applyTheme(showcasePage, visualCase.theme);

      const target = visualCase.target(showcasePage);
      if (visualCase.action !== 'open') {
        await expect(target).toBeVisible();
      }

      await prepareState(target, visualCase);

      await expect(target).toHaveScreenshot(snapshotName, {
        maxDiffPixelRatio: 0.02,
        threshold: 0.2,
      });
    });
  }
});
