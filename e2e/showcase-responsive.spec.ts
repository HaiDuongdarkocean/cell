import { expect, type Page } from '@playwright/test';
import { test } from './showcase.fixture';

const VIEWPORTS = [
  { name: 'compact', width: 320, height: 640 },
  { name: 'mobile', width: 600, height: 800 },
  { name: 'tablet', width: 840, height: 600 },
  { name: 'laptop', width: 1200, height: 800 },
  { name: 'desktop', width: 1600, height: 900 },
];

const P0_COMPONENTS = ['Button', 'Input', 'Card', 'Dialog', 'Tabs', 'Select', 'Drawer'];

interface OverflowResult {
  scrollWidth: number;
  clientWidth: number;
}

async function getOverflow(page: Page): Promise<OverflowResult> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

test.describe('Design System Showcase — responsive and zoom matrix', () => {
  test.use({ viewport: { width: 1200, height: 800 } });

  for (const { name, width, height } of VIEWPORTS) {
    for (const component of P0_COMPONENTS) {
      test(`${component} reflows without horizontal overflow at ${name} (${width}x${height})`, async ({ showcasePage }) => {
        await showcasePage.setViewportSize({ width, height });
        await showcasePage.goto(`?showcase=${component}`);

        const { scrollWidth, clientWidth } = await getOverflow(showcasePage);
        expect(scrollWidth, `expected no horizontal overflow at ${name}`).toBeLessThanOrEqual(clientWidth);
      });
    }
  }

  test('Button meets touch-target minimum across viewports', async ({ showcasePage }) => {
    const primary = showcasePage.getByRole('button', { name: 'Primary' }).first();
    const large = showcasePage.getByRole('button', { name: 'Large' }).first();

    for (const { name, width, height } of VIEWPORTS) {
      await showcasePage.setViewportSize({ width, height });
      await showcasePage.goto('?showcase=Button');

      for (const [label, locator] of [
        ['Primary', primary],
        ['Large', large],
      ] as const) {
        const box = await locator.boundingBox();
        expect(box, `${label} button visible at ${name}`).toBeTruthy();
        expect(box!.height, `${label} height >= 40px at ${name}`).toBeGreaterThanOrEqual(40);
        expect(box!.width, `${label} width >= 40px at ${name}`).toBeGreaterThanOrEqual(40);
      }
    }
  });

  test('200% text zoom reflows without horizontal overflow', async ({ showcasePage }) => {
    await showcasePage.setViewportSize({ width: 600, height: 800 });
    await showcasePage.goto('?showcase=Button');

    // Double the root font size to simulate 200% page zoom for rem-based layout.
    await showcasePage.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });

    // Wait for relayout after font-size change.
    await showcasePage.waitForTimeout(200);

    const { scrollWidth, clientWidth } = await getOverflow(showcasePage);
    expect(scrollWidth, 'expected no horizontal overflow at 200% zoom').toBeLessThanOrEqual(clientWidth);
  });
});
