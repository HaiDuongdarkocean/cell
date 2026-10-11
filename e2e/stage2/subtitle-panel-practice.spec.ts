import { expect, type Page } from '@playwright/test';
import { test } from '../fixtures/cellEnvironment.fixture';

const PRACTICE = '[data-cell-id="subtitle-practice"]';
const ACTIVE_CUE = '[data-cell-id="practice-active-cue"]';
const FOOTER = '[data-cell-id="practice-footer"]';
const INPUT = '[data-cell-id="practice-input"]';
const CLOZE_BLANK = '[data-cell-id="cloze-blank"]';
const FEEDBACK = '[data-cell-id="practice-feedback"]';
const MORE_BTN = '[data-cell-id="subtitle-panel-more-btn"]';
const STUDY_MENU = '[data-cell-id="study-mode-action-bar"]';
const MODE_OFF = '[data-cell-id="study-mode-normal"]';
const MODE_DICTATION = '[data-cell-id="study-mode-dictation"]';
const MODE_CLOZE = '[data-cell-id="study-mode-cloze"]';
const SPEED_VALUE = '[data-cell-id="speed-value"]';
const SPEED_INC = '[data-cell-id="speed-inc"]';
const SPEED_DEC = '[data-cell-id="speed-dec"]';
const SPEED_RESET = '[data-cell-id="speed-reset"]';

const CUE2_START_S = 20.2;
const CUE2_NEXT_START_S = 29.266;

test.afterEach(async ({ cellContext }) => {
  const worker =
    cellContext.serviceWorkers().find((sw) => sw.url().startsWith('chrome-extension://')) ??
    (await cellContext.waitForEvent('serviceworker', { timeout: 5000 }).catch(() => null));
  if (!worker) return;
  await worker.evaluate(() =>
    chrome.storage.local.set({
      studyModes: {
        version: 1,
        activeModeId: 'normal',
        customModes: [],
        advanced: { skipNoDialogue: 'OFF', removeBracketed: false },
      },
    }),
  );
});

async function seek(page: Page, seconds: number): Promise<void> {
  await page.evaluate((t) => {
    const v = document.querySelector('video');
    if (v) {
      v.currentTime = t;
      v.pause();
    }
  }, seconds);
}

async function videoTime(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelector('video')?.currentTime ?? -1);
}

async function enterPlayerMode(page: Page): Promise<void> {
  await page.keyboard.press('g');
  await expect(page.locator('[data-cell-id="cue-item"]').first()).toBeVisible({
    timeout: 15_000,
  });
}

async function openStudyMenu(page: Page): Promise<void> {
  const menu = page.locator(STUDY_MENU);
  if ((await menu.count()) > 0) return;
  await page.locator(MORE_BTN).click();
  await expect(menu).toBeVisible();
}

async function closeStudyMenu(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.locator(STUDY_MENU)).toHaveCount(0);
}

async function selectSpeed(page: Page, label: string): Promise<void> {
  await openStudyMenu(page);
  const value = page.locator(`${STUDY_MENU} ${SPEED_VALUE}`);
  const target = parseFloat(label);
  for (let i = 0; i < 30; i++) {
    const current = parseFloat((await value.textContent()) ?? '');
    if (current === target) break;
    await page.locator(`${STUDY_MENU} ${current < target ? SPEED_INC : SPEED_DEC}`).click();
    if (i === 29) throw new Error(`could not reach speed ${label}`);
  }
  await expect(page.locator(STUDY_MENU)).toBeVisible();
  await closeStudyMenu(page);
}

async function selectStudyMode(page: Page, selector: string): Promise<void> {
  await openStudyMenu(page);
  await page.locator(selector).dispatchEvent('click');
  await expect(page.locator(STUDY_MENU)).toBeVisible();
  await closeStudyMenu(page);
}

interface GeometryReport {
  violations: string[];
}

async function setTouchTarget(page: Page, size: number): Promise<void> {
  await page.evaluate((value) => {
    document.getElementById('cell-subtitle-root')?.style.setProperty('--touch-target', `${value}px`);
  }, size);
}

async function checkPanelGeometry(page: Page, minControlHeight: number, label = ''): Promise<void> {
  const report = await page.evaluate((minHeight): GeometryReport => {
    const violations: string[] = [];
    const findDeep = (root: Document | ShadowRoot | Element, selector: string): Element | null => {
      const match = root.querySelector(selector);
      if (match) return match;
      for (const element of root.querySelectorAll('*')) {
        if (!element.shadowRoot) continue;
        const nested = findDeep(element.shadowRoot, selector);
        if (nested) return nested;
      }
      return null;
    };
    const collectDeep = (root: Element | ShadowRoot, output: Element[]): void => {
      for (const element of root.querySelectorAll('*')) {
        output.push(element);
        if (element.shadowRoot) collectDeep(element.shadowRoot, output);
      }
    };
    const panel = findDeep(document, '[data-cell-id="subtitle-panel"]');
    if (!panel) return { violations: ['panel not found'] };
    const panelRect = panel.getBoundingClientRect();
    const isRendered = (element: Element): boolean => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const elementName = (element: Element): string =>
      element.getAttribute('data-cell-id') ?? `${element.tagName.toLowerCase()}.${element.getAttribute('class') ?? ''}`;
    const inside = (inner: DOMRect, outer: DOMRect): boolean =>
      inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
    const clippingAncestors = (element: Element): Element[] => {
      const result: Element[] = [];
      let node: Node | null = element.parentNode;
      while (node && node !== panel.parentNode) {
        if (node instanceof ShadowRoot) {
          node = node.host;
          continue;
        }
        if (node instanceof Element) {
          const style = getComputedStyle(node);
          if (style.overflowX !== 'visible' || style.overflowY !== 'visible') result.push(node);
          node = node.parentNode;
          continue;
        }
        break;
      }
      return result;
    };
    const assertFullyVisible = (element: Element): void => {
      if (!isRendered(element)) return;
      const rect = element.getBoundingClientRect();
      if (!inside(rect, panelRect)) violations.push(`out-of-panel: ${elementName(element)}`);
      for (const ancestor of clippingAncestors(element)) {
        if (!inside(rect, ancestor.getBoundingClientRect())) {
          violations.push(`clipped: ${elementName(element)} by ${elementName(ancestor)}`);
          break;
        }
      }
    };
    if (panel.scrollWidth > panel.clientWidth + 1) violations.push('panel has horizontal overflow');
    const descendants: Element[] = [];
    collectDeep(panel, descendants);
    for (const element of descendants) {
      if (!isRendered(element)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.right > panelRect.right + 1 || rect.left < panelRect.left - 1) {
        violations.push(`horizontal escape: ${elementName(element)}`);
      }
      if (element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1) {
        const overflow = getComputedStyle(element).overflowX;
        if (overflow !== 'hidden' && overflow !== 'clip') violations.push(`horizontal overflow: ${elementName(element)}`);
      }
    }
    const criticalSelectors = [
      '[data-cell-id="subtitle-panel-more-btn"]',
      '[data-cell-id="cue-list-scroll"]',
      '[data-cell-id="practice-active-cue"]',
      '[data-cell-id="practice-footer"]',
      '[data-cell-id="practice-input"]',
      '[data-cell-id="practice-previous"]',
      '[data-cell-id="practice-replay"]',
      '[data-cell-id="practice-next"]',
    ];
    for (const selector of criticalSelectors) {
      const element = findDeep(panel, selector);
      if (element) assertFullyVisible(element);
    }
    const rectOf = (selector: string): DOMRect | null => {
      const element = findDeep(panel, selector);
      return element && isRendered(element) ? element.getBoundingClientRect() : null;
    };
    const list = rectOf('[data-cell-id="cue-list-scroll"]');
    const footer = rectOf('[data-cell-id="practice-footer"]');
    if (list && footer && list.bottom > footer.top + 1) violations.push('list overlaps footer');
    const controls = [
      'subtitle-panel-more-btn',
      'practice-previous',
      'practice-replay',
      'practice-next',
    ];
    for (const id of controls) {
      const element = findDeep(panel, `[data-cell-id="${id}"]`);
      if (!element || !isRendered(element)) continue;
      const height = element.getBoundingClientRect().height;
      if (height < minHeight - 1) violations.push(`control too small: ${id} h=${height}`);
    }
    return { violations: [...new Set(violations)] };
  }, minControlHeight);
  expect(report.violations.map((violation) => `${label} ${violation}`)).toEqual([]);
}

async function checkFooterArrangement(page: Page, stacked: boolean): Promise<void> {
  const input = await page.locator(INPUT).boundingBox();
  const previous = await page.locator('[data-cell-id="practice-previous"]').boundingBox();
  const replay = await page.locator('[data-cell-id="practice-replay"]').boundingBox();
  const next = await page.locator('[data-cell-id="practice-next"]').boundingBox();
  expect(input).not.toBeNull();
  expect(previous).not.toBeNull();
  expect(replay).not.toBeNull();
  expect(next).not.toBeNull();
  if (stacked) {
    expect(input!.y + input!.height).toBeLessThanOrEqual(previous!.y + 1);
    expect(Math.abs(previous!.y - replay!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(previous!.y - next!.y)).toBeLessThanOrEqual(1);
    return;
  }
  expect(Math.abs(input!.y - previous!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(input!.y - replay!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(input!.y - next!.y)).toBeLessThanOrEqual(1);
}

test.describe('Stage 2: Subtitle panel practice', () => {
  test('study menu stays open across mode flips and repeated speed steps', async ({
    streamFlixPage,
  }) => {
    await enterPlayerMode(streamFlixPage);
    await openStudyMenu(streamFlixPage);

    const menu = streamFlixPage.locator(STUDY_MENU);
    await streamFlixPage.locator(MODE_CLOZE).dispatchEvent('click');
    await expect(menu).toBeVisible();
    await expect(streamFlixPage.locator(MODE_CLOZE)).toHaveAttribute('aria-checked', 'true');

    await streamFlixPage.locator(MODE_OFF).dispatchEvent('click');
    await expect(menu).toBeVisible();
    await expect(streamFlixPage.locator(MODE_OFF)).toHaveAttribute('aria-checked', 'true');

    const speedValue = streamFlixPage.locator(`${STUDY_MENU} ${SPEED_VALUE}`);
    await expect(speedValue).toHaveText('1×');
    await streamFlixPage.locator(`${STUDY_MENU} ${SPEED_INC}`).click();
    await streamFlixPage.locator(`${STUDY_MENU} ${SPEED_INC}`).click();
    await expect(speedValue).toHaveText('1.5×');
    await expect(menu).toBeVisible();

    await streamFlixPage.locator(`${STUDY_MENU} ${SPEED_RESET}`).click();
    await expect(speedValue).toHaveText('1×');
    await expect(streamFlixPage.locator(`${STUDY_MENU} ${SPEED_RESET}`)).toBeDisabled();
    await expect(menu).toBeVisible();

    await streamFlixPage.screenshot({ path: 'tmp/study-menu-stays-open.png' });
    await closeStudyMenu(streamFlixPage);
  });

  test('dictation: normalized answer scores 100 live and Enter advances the cue', async ({
    streamFlixPage,
  }) => {
    const pageErrors: string[] = [];
    streamFlixPage.on('pageerror', (e) => pageErrors.push(e.message));

    await enterPlayerMode(streamFlixPage);
    await seek(streamFlixPage, CUE2_START_S + 0.3);

    await selectStudyMode(streamFlixPage, MODE_DICTATION);
    await expect(
      streamFlixPage.locator(`${PRACTICE}[data-practice-mode="dictation"]`),
    ).toBeVisible();
    await openStudyMenu(streamFlixPage);
    await expect(streamFlixPage.locator(MODE_DICTATION)).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await streamFlixPage.keyboard.press('Escape');
    const input = streamFlixPage.locator(INPUT);
    await expect(input).toBeVisible();
    await expect(streamFlixPage.locator(`${FOOTER} ${INPUT}`)).toBeVisible();
    await expect(streamFlixPage.locator(`${ACTIVE_CUE} input`)).toHaveCount(0);

    await streamFlixPage.locator('[data-cell-id="practice-replay"]').click();
    await expect
      .poll(() => videoTime(streamFlixPage))
      .toBeGreaterThanOrEqual(CUE2_START_S - 0.5);
    await streamFlixPage.evaluate(() => document.querySelector('video')?.pause());

    await input.fill('Lyin’ isn’t better… than silence!');

    const feedback = streamFlixPage.locator(`${ACTIVE_CUE} ${FEEDBACK}`);
    await expect(feedback).toBeAttached();
    await expect(feedback).toContainText('100 percent');

    await input.press('Enter');
    await expect
      .poll(() => videoTime(streamFlixPage))
      .toBeGreaterThanOrEqual(CUE2_NEXT_START_S - 0.5);
    await expect(feedback).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('dictation: cue end keeps practice focus on the finished cue, replay included', async ({
    streamFlixPage,
  }) => {
    const pageErrors: string[] = [];
    streamFlixPage.on('pageerror', (e) => pageErrors.push(e.message));

    await enterPlayerMode(streamFlixPage);
    await seek(streamFlixPage, CUE2_START_S + 0.3);
    await selectStudyMode(streamFlixPage, MODE_DICTATION);

    const input = streamFlixPage.locator(INPUT);
    await expect(input).toBeVisible();
    const currentCue = streamFlixPage.locator(
      `${PRACTICE} [data-cell-id="cue-item"][data-current="true"]`,
    );
    await expect(currentCue).toHaveCount(1);
    const cueIndex = await currentCue.getAttribute('data-cue-index');
    expect(cueIndex).not.toBeNull();

    await seek(streamFlixPage, 25.2);
    await streamFlixPage.evaluate(() => void document.querySelector('video')?.play());
    await expect
      .poll(() => streamFlixPage.evaluate(() => document.querySelector('video')?.paused ?? false))
      .toBe(true);
    await expect(currentCue).toHaveAttribute('data-cue-index', cueIndex!);
    await expect(input).toBeEnabled();

    await input.press('Control+r');
    await expect
      .poll(() => videoTime(streamFlixPage))
      .toBeLessThan(CUE2_START_S + 1);
    await expect
      .poll(() => streamFlixPage.evaluate(() => document.querySelector('video')?.paused ?? false), {
        timeout: 20_000,
      })
      .toBe(true);
    await expect(currentCue).toHaveAttribute('data-cue-index', cueIndex!);
    await expect(input).toBeEnabled();
    expect(pageErrors).toEqual([]);
  });

  test('cloze: combined input fills source-position blanks live and Enter advances', async ({
    streamFlixPage,
  }) => {
    const pageErrors: string[] = [];
    streamFlixPage.on('pageerror', (e) => pageErrors.push(e.message));

    await enterPlayerMode(streamFlixPage);
    await seek(streamFlixPage, CUE2_START_S + 0.3);

    await selectStudyMode(streamFlixPage, MODE_CLOZE);
    await expect(
      streamFlixPage.locator(`${PRACTICE}[data-practice-mode="cloze"]`),
    ).toBeVisible();

    const blanks = streamFlixPage.locator(`${ACTIVE_CUE} ${CLOZE_BLANK}`);
    await expect(blanks).toHaveCount(2);

    const input = streamFlixPage.locator(INPUT);
    await expect(input).toHaveAttribute('aria-label', 'Type 2 missing words');
    await expect(streamFlixPage.locator(`${ACTIVE_CUE} input`)).toHaveCount(0);

    await input.fill('lyin than');
    await expect(blanks.nth(0)).toHaveAttribute('data-state', 'correct');
    await expect(blanks.nth(1)).toHaveAttribute('data-state', 'correct');

    await input.press('Enter');
    await expect
      .poll(() => videoTime(streamFlixPage))
      .toBeGreaterThanOrEqual(CUE2_NEXT_START_S - 0.5);
    expect(pageErrors).toEqual([]);
  });

  test('stress: 320px, segmented cycling and repeated wrong answers stay usable', async ({
    streamFlixPage,
  }) => {
    const pageErrors: string[] = [];
    streamFlixPage.on('pageerror', (e) => pageErrors.push(e.message));

    await streamFlixPage.setViewportSize({ width: 320, height: 700 });
    await enterPlayerMode(streamFlixPage);
    await setTouchTarget(streamFlixPage, 44);
    await seek(streamFlixPage, 29.5);

    for (let i = 0; i < 10; i++) {
      await selectStudyMode(streamFlixPage, MODE_DICTATION);
      await expect(
        streamFlixPage.locator(`${PRACTICE}[data-practice-mode="dictation"]`),
      ).toBeVisible();
      await selectStudyMode(streamFlixPage, MODE_CLOZE);
      await expect(
        streamFlixPage.locator(`${PRACTICE}[data-practice-mode="cloze"]`),
      ).toBeVisible();
      await openStudyMenu(streamFlixPage);
      await expect(streamFlixPage.locator(MODE_DICTATION)).toHaveAttribute(
        'aria-checked',
        'false',
      );
      await streamFlixPage.keyboard.press('Escape');
      await selectStudyMode(streamFlixPage, MODE_OFF);
      await expect(streamFlixPage.locator(PRACTICE)).toHaveCount(0);
    }

    await selectStudyMode(streamFlixPage, MODE_DICTATION);
    const input = streamFlixPage.locator(INPUT);
    for (let i = 0; i < 10; i++) {
      await input.fill(`completely wrong answer ${i}`);
      await expect(streamFlixPage.locator(`${ACTIVE_CUE} ${FEEDBACK}`)).not.toContainText('100 percent');
    }

    await streamFlixPage.locator('[data-cell-id="practice-replay"]').click();

    await expect(streamFlixPage.locator(PRACTICE)).toHaveCount(1);
    await expect(streamFlixPage.locator(INPUT)).toHaveCount(1);
    await expect(streamFlixPage.locator(`${ACTIVE_CUE} input`)).toHaveCount(0);
    for (const id of ['practice-previous', 'practice-replay', 'practice-next']) {
      await expect(streamFlixPage.locator(`[data-cell-id="${id}"]`)).toBeVisible();
    }
    await checkPanelGeometry(streamFlixPage, 40);
    const panelOverflow = await streamFlixPage.evaluate(() => {
      const findDeep = (root: Document | ShadowRoot | Element, sel: string): Element | null => {
        const hit = root.querySelector(sel);
        if (hit) return hit;
        for (const el of root.querySelectorAll('*')) {
          if (el.shadowRoot) {
            const inner = findDeep(el.shadowRoot, sel);
            if (inner) return inner;
          }
        }
        return null;
      };
      const panel = findDeep(document, '[data-cell-id="subtitle-panel"]');
      return panel ? panel.scrollWidth - panel.clientWidth : -1;
    });
    expect(panelOverflow).toBeLessThanOrEqual(1);
    expect(pageErrors).toEqual([]);
  });

  test('edge: mode persists, cue change resets, and speed apply', async ({
    streamFlixPage,
  }) => {
    const pageErrors: string[] = [];
    streamFlixPage.on('pageerror', (e) => pageErrors.push(e.message));

    await enterPlayerMode(streamFlixPage);
    await seek(streamFlixPage, CUE2_START_S + 0.3);
    await selectStudyMode(streamFlixPage, MODE_DICTATION);
    const input = streamFlixPage.locator(INPUT);
    await expect(input).toBeVisible();

    await input.fill('partial draft');
    await expect(streamFlixPage.locator(`${ACTIVE_CUE} ${FEEDBACK}`)).toBeAttached();

    await seek(streamFlixPage, 38.5);
    await expect(streamFlixPage.locator(`${ACTIVE_CUE} ${FEEDBACK}`)).toHaveCount(0);
    await expect(input).toHaveValue('');

    await input.fill('still no matter where i go');
    await expect(streamFlixPage.locator(`${ACTIVE_CUE} ${FEEDBACK}`)).toContainText('100 percent');

    await selectSpeed(streamFlixPage, '1.5x');
    await expect
      .poll(() =>
        streamFlixPage.evaluate(() => document.querySelector('video')?.playbackRate ?? -1),
      )
      .toBe(1.5);

    await streamFlixPage.reload({ waitUntil: 'networkidle' });
    await expect(streamFlixPage.locator('#player-wrapper video').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(streamFlixPage.locator('#cell-subtitle-root')).toBeAttached({ timeout: 30_000 });
    await expect(streamFlixPage.locator('[data-cell-id="orbital-badge"]')).toBeVisible({
      timeout: 15_000,
    });

    await enterPlayerMode(streamFlixPage);
    await openStudyMenu(streamFlixPage);
    await expect(streamFlixPage.locator(MODE_DICTATION)).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await streamFlixPage.keyboard.press('Escape');
    await seek(streamFlixPage, CUE2_START_S + 0.3);
    await expect(
      streamFlixPage.locator(`${PRACTICE}[data-practice-mode="dictation"]`),
    ).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('history row shows typed feedback and translation after leaving a cue', async ({
    streamFlixPage,
  }) => {
    const pageErrors: string[] = [];
    streamFlixPage.on('pageerror', (e) => pageErrors.push(e.message));

    await enterPlayerMode(streamFlixPage);
    await seek(streamFlixPage, CUE2_START_S + 0.3);
    await selectStudyMode(streamFlixPage, MODE_DICTATION);

    const input = streamFlixPage.locator(INPUT);
    await input.fill('Lyin isn better than silence');
    await input.press('Enter');
    await expect
      .poll(() => videoTime(streamFlixPage))
      .toBeGreaterThanOrEqual(CUE2_NEXT_START_S - 0.5);

    await seek(streamFlixPage, CUE2_NEXT_START_S + 0.3);
    const historyCue = streamFlixPage.locator('[data-cell-id="practice-history-cue"]').first();
    await expect(historyCue).toBeVisible();
    await expect(historyCue.locator('[data-state]')).not.toHaveCount(0);
    await expect(historyCue.locator('[data-cell-id="cue-native-text"]')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('geometry: panel containment across width and height matrix for both modes', async ({
    streamFlixPage,
  }) => {
    const pageErrors: string[] = [];
    streamFlixPage.on('pageerror', (e) => pageErrors.push(e.message));

    const widths = [280, 320, 360, 390, 480, 768, 1024];
    for (const width of widths) {
      await streamFlixPage.setViewportSize({ width, height: 700 });
      const minControlHeight = width < 480 ? 44 : 40;
      await setTouchTarget(streamFlixPage, minControlHeight);
      if (width === widths[0]) {
        await enterPlayerMode(streamFlixPage);
        await seek(streamFlixPage, CUE2_START_S + 0.3);
      }
      await selectStudyMode(streamFlixPage, MODE_DICTATION);
      await expect(
        streamFlixPage.locator(`${PRACTICE}[data-practice-mode="dictation"]`),
      ).toBeVisible();
      if (width === 320) {
        await expect(streamFlixPage.locator('[data-cell-id="speed-value"]')).toBeVisible();
        await expect(streamFlixPage.locator('[data-cell-id="speed-decrease"]')).toBeHidden();
      }
      await streamFlixPage.locator(INPUT).fill('x'.repeat(1500));
      await checkPanelGeometry(streamFlixPage, minControlHeight, `w${width} dictation`);
      if (width === 320) await checkFooterArrangement(streamFlixPage, true);

      await selectStudyMode(streamFlixPage, MODE_CLOZE);
      await expect(
        streamFlixPage.locator(`${PRACTICE}[data-practice-mode="cloze"]`),
      ).toBeVisible();
      await streamFlixPage.locator(INPUT).fill('lyin than');
      await checkPanelGeometry(streamFlixPage, minControlHeight, `w${width} cloze`);

      await selectStudyMode(streamFlixPage, MODE_OFF);
      await expect(streamFlixPage.locator(PRACTICE)).toHaveCount(0);
    }

    for (const [width, height] of [[280, 360], [320, 480], [480, 568]] as const) {
      await streamFlixPage.setViewportSize({ width, height });
      const minControlHeight = width < 480 ? 44 : 40;
      await setTouchTarget(streamFlixPage, minControlHeight);
      await selectStudyMode(streamFlixPage, MODE_DICTATION);
      await expect(streamFlixPage.locator(INPUT)).toBeVisible();
      await streamFlixPage.locator(INPUT).focus();
      await checkPanelGeometry(streamFlixPage, minControlHeight, `${width}x${height} dictation`);
      if (width === 320) await checkFooterArrangement(streamFlixPage, false);
      await selectStudyMode(streamFlixPage, MODE_CLOZE);
      await expect(streamFlixPage.locator(INPUT)).toBeVisible();
      await checkPanelGeometry(streamFlixPage, minControlHeight, `${width}x${height} cloze`);
      await selectStudyMode(streamFlixPage, MODE_OFF);
    }
    expect(pageErrors).toEqual([]);
  });

  test('geometry: long unbroken, CJK, emoji and scaled text stay inside the panel', async ({
    streamFlixPage,
  }) => {
    const pageErrors: string[] = [];
    streamFlixPage.on('pageerror', (e) => pageErrors.push(e.message));

    await streamFlixPage.setViewportSize({ width: 320, height: 700 });
    await enterPlayerMode(streamFlixPage);
    await setTouchTarget(streamFlixPage, 44);
    await seek(streamFlixPage, CUE2_START_S + 0.3);
    await selectStudyMode(streamFlixPage, MODE_DICTATION);
    const input = streamFlixPage.locator(INPUT);
    await expect(input).toBeVisible();

    const stressValues = [
      'supercalifragilisticexpialidocious'.repeat(30),
      'これはとても長い日本語の文章です'.repeat(20),
      '😀🎬📺🍿🎞️'.repeat(40),
      'x'.repeat(2000),
    ];
    for (const value of stressValues) {
      await input.fill(value);
      await checkPanelGeometry(streamFlixPage, 44);
    }

    for (const scale of [80, 125, 150, 200]) {
      await streamFlixPage.evaluate((s) => {
        const host = document.getElementById('cell-subtitle-root');
        const root = host?.shadowRoot?.firstElementChild as HTMLElement | null;
        if (root) root.style.fontSize = `${s}%`;
      }, scale);
      await checkPanelGeometry(streamFlixPage, 44);
    }
    await streamFlixPage.evaluate(() => {
      const host = document.getElementById('cell-subtitle-root');
      const root = host?.shadowRoot?.firstElementChild as HTMLElement | null;
      if (root) root.style.fontSize = '';
    });
    expect(pageErrors).toEqual([]);
  });

  test('dictation and cloze input: typing keys do not leak to host or Cell shortcuts', async ({
    streamFlixPage,
  }) => {
    const pageErrors: string[] = [];
    streamFlixPage.on('pageerror', (e) => pageErrors.push(e.message));

    await enterPlayerMode(streamFlixPage);
    await seek(streamFlixPage, CUE2_START_S + 0.3);
    await selectStudyMode(streamFlixPage, MODE_DICTATION);

    const input = streamFlixPage.locator(INPUT);
    await expect(input).toBeVisible();

    await streamFlixPage.evaluate(() => {
      (window as unknown as { __leakedKeys: Array<{ source: string; key: string; code: string }> }).__leakedKeys = [];
      const push = (e: KeyboardEvent, source: string) => {
        (window as unknown as { __leakedKeys: Array<{ source: string; key: string; code: string }> }).__leakedKeys.push({
          source,
          key: e.key,
          code: e.code,
        });
      };
      document.addEventListener('keydown', (e) => push(e, 'document'));
      window.addEventListener('keydown', (e) => push(e, 'window'));
    });

    await input.fill('ftad');
    await expect(input).toHaveValue('ftad');

    const leaked = await streamFlixPage.evaluate(
      () => (window as unknown as { __leakedKeys: Array<{ source: string; key: string; code: string }> }).__leakedKeys,
    );
    const typingLeaks = leaked.filter((e) => ['KeyF', 'KeyT', 'KeyA', 'KeyD'].includes(e.code));
    expect(typingLeaks).toEqual([]);

    await input.press('Enter');
    await expect
      .poll(() => videoTime(streamFlixPage))
      .toBeGreaterThanOrEqual(CUE2_NEXT_START_S - 0.5);

    const leakedAfterEnter = await streamFlixPage.evaluate(
      () => (window as unknown as { __leakedKeys: Array<{ source: string; key: string; code: string }> }).__leakedKeys,
    );
    const enterLeaks = leakedAfterEnter.filter((e) => e.code === 'Enter');
    expect(enterLeaks).toEqual([]);

    await selectStudyMode(streamFlixPage, MODE_CLOZE);
    await expect(streamFlixPage.locator(INPUT)).toBeVisible();
    await streamFlixPage.evaluate(
      () => ((window as unknown as { __leakedKeys: Array<{ source: string; key: string; code: string }> }).__leakedKeys = []),
    );
    await input.fill('ftad');
    await expect(input).toHaveValue('ftad');

    const leakedCloze = await streamFlixPage.evaluate(
      () => (window as unknown as { __leakedKeys: Array<{ source: string; key: string; code: string }> }).__leakedKeys,
    );
    const typingLeaksCloze = leakedCloze.filter((e) => ['KeyF', 'KeyT', 'KeyA', 'KeyD'].includes(e.code));
    expect(typingLeaksCloze).toEqual([]);

    expect(pageErrors).toEqual([]);
  });
});
