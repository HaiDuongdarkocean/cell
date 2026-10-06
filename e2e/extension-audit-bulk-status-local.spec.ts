import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type BrowserContext, type Page } from '@playwright/test';
import { test } from './fixtures/cellEnvironment.fixture';

const portOffset = parseInt(process.env.PW_PORT_OFFSET || '0', 10);
const STREAM_ORIGIN = `http://127.0.0.1:${4321 + portOffset}`;
const LOCAL_PLAYER_PATH = 'src/entrypoints/local-player/index.html';
const EXTENSION_ID = 'ifceodogdeeaacmdigljgmafnhkbfnia';

// A real-size video (188s) so the split-view shell measures ~300px after the
// layout settles — the 1s noop fixture leaves it stuck at the <video> default
// box (150px) and clips cue-list tokens.
const VIDEO_PATH = resolve('build/mock-pages/assets/apologize-Brjj1x7A.mp4');
const SRT_PATH = resolve('tests/data-test/auto-match-test/test-video.en.srt');

const PANEL_SEL = '[data-cell-split-view="panel"]';
const OVERLAY_TOKEN_SEL =
  '[data-cell-id="subtitle-block"] [data-role="target"] .js-cell-token';
const CUE_TOKEN_SEL = '[data-cell-id="cue-target-text"] .js-cell-token';
const SELECTED_CLASS = 'js-cell-token--selected';
const ANNOUNCER = '#cell-token-selection-announcer';
const SHOTS = 'tmp/audit-bulk-status';

// Cue 1 spans 0-30s so playback can run long enough for player controls to
// auto-hide without crossing a cue boundary (which clears the selection).
const LONG_CUE_SRT = `1
00:00:00,000 --> 00:00:30,000
Hello world, this is a test.

2
00:00:30,000 --> 00:01:00,000
This is the second line.

3
00:01:00,000 --> 00:01:30,000
And the third line here.
`;

// Cue boundary inside the video's first second so real playback crosses it.
const SHORT_CUES_SRT = `1
00:00:00,000 --> 00:00:00,450
alpha bravo charlie delta

2
00:00:00,450 --> 00:00:01,000
echo foxtrot golf hotel
`;

async function deepExists(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const deepFind = (root: Document | ShadowRoot, s: string): Element | null => {
      const el = root.querySelector(s);
      if (el) return el;
      for (const child of Array.from(root.querySelectorAll('*'))) {
        if (child.shadowRoot) {
          const found = deepFind(child.shadowRoot, s);
          if (found) return found;
        }
      }
      return null;
    };
    return deepFind(document, sel) !== null;
  }, selector);
}

async function waitDeep(page: Page, selector: string, timeout = 15_000): Promise<void> {
  await expect.poll(() => deepExists(page, selector), { timeout }).toBe(true);
}

async function pauseVideo(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('video').forEach((v) => v.pause());
  });
}

async function seedCellSettings(context: BrowserContext): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(async (origin: string) => {
    const storage = await chrome.storage.local.get(['settings', 'tokenizeSettings']);
    const settings = (storage.settings ?? {}) as Record<string, unknown>;
    settings.schemaVersion = 34;
    settings.subtitleOverlayTargetLanguage = 'en';
    await chrome.storage.local.set({ settings });
    await chrome.storage.local.set({
      tokenizeSettings: {
        schemaVersion: 1,
        origins: {},
        urls: {},
        subtitleOrigins: { [origin]: true },
        subtitleUrls: {},
      },
    });
  }, STREAM_ORIGIN);
}

async function selectedTerms(page: Page): Promise<string[]> {
  return page.evaluate((cls) => {
    const out: string[] = [];
    const walk = (root: Document | ShadowRoot): void => {
      for (const el of Array.from(root.querySelectorAll(`.${cls}`))) {
        const term = el.getAttribute('data-cell-term');
        if (term) out.push(term);
      }
      for (const child of Array.from(root.querySelectorAll('*'))) {
        if (child.shadowRoot) walk(child.shadowRoot);
      }
    };
    walk(document);
    return out;
  }, SELECTED_CLASS);
}

async function selectedTermCount(page: Page): Promise<number> {
  return (await selectedTerms(page)).length;
}

async function uniqueSelectedTerms(page: Page): Promise<number> {
  return new Set(await selectedTerms(page)).size;
}

interface TermBox {
  term: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Word-token boxes inside the shadow-DOM cue list, restricted to tokens whose
 *  box sits fully inside the painted panel rect — only those are real-click
 *  targets. */
async function panelTokenBoxes(page: Page): Promise<TermBox[]> {
  return page.evaluate((panelSel) => {
    const host = document.querySelector(panelSel);
    const scope = host?.shadowRoot;
    if (!scope) return [];
    const pr = host!.getBoundingClientRect();
    return Array.from(scope.querySelectorAll('.js-cell-token[data-cell-term]'))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          term: el.getAttribute('data-cell-term') ?? '',
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
        };
      })
      .filter(
        (b) =>
          b.width > 0 &&
          b.x >= pr.left &&
          b.x + b.width <= pr.right + 1 &&
          b.y >= pr.top &&
          b.y + b.height <= pr.bottom + 1 &&
          b.y >= 0 &&
          b.y + b.height <= window.innerHeight &&
          b.x >= 0 &&
          b.x + b.width <= window.innerWidth,
      );
  }, PANEL_SEL);
}

async function panelTokenBoxesInCue(page: Page, cueDomIndex: number): Promise<TermBox[]> {
  return page.evaluate(
    ({ panelSel, idx }) => {
      const host = document.querySelector(panelSel);
      const scope = host?.shadowRoot;
      if (!scope) return [];
      const items = Array.from(scope.querySelectorAll('[data-cell-id="cue-item"]'));
      const item = items[idx];
      if (!item) return [];
      const pr = host!.getBoundingClientRect();
      return Array.from(item.querySelectorAll('.js-cell-token[data-cell-term]'))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            term: el.getAttribute('data-cell-term') ?? '',
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
          };
        })
        .filter(
          (b) =>
            b.width > 0 &&
            b.x >= pr.left &&
            b.x + b.width <= pr.right + 1 &&
            b.y >= pr.top &&
            b.y + b.height <= pr.bottom + 1,
        );
    },
    { panelSel: PANEL_SEL, idx: cueDomIndex },
  );
}

async function panelTermClasses(page: Page, term: string): Promise<string[]> {
  return page.evaluate(
    ({ panelSel, t }) => {
      const host = document.querySelector(panelSel);
      const scope = host?.shadowRoot;
      if (!scope) return [];
      return Array.from(scope.querySelectorAll('.js-cell-token[data-cell-term]'))
        .filter((el) => el.getAttribute('data-cell-term') === t)
        .map((el) => el.className);
    },
    { panelSel: PANEL_SEL, t: term },
  );
}

/** Class snapshot of every panel token — detects any status repaint. */
async function panelTokenSnapshot(page: Page): Promise<string> {
  return page.evaluate((panelSel) => {
    const host = document.querySelector(panelSel);
    const scope = host?.shadowRoot;
    if (!scope) return '';
    return Array.from(scope.querySelectorAll('.js-cell-token[data-cell-term]'))
      .map((el) => `${el.getAttribute('data-cell-term')}=${el.className}`)
      .join(';');
  }, PANEL_SEL);
}

async function overlayTokenBoxes(page: Page): Promise<TermBox[]> {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        '[data-cell-id="subtitle-block"] [data-role="target"] .js-cell-token[data-cell-term]',
      ),
    ).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        term: el.getAttribute('data-cell-term') ?? '',
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
      };
    }),
  );
}

async function overlayTermClasses(page: Page, term: string): Promise<string[]> {
  return page.evaluate(
    (t) =>
      Array.from(
        document.querySelectorAll(
          '[data-cell-id="subtitle-block"] [data-role="target"] .js-cell-token[data-cell-term]',
        ),
      )
        .filter((el) => el.getAttribute('data-cell-term') === t)
        .map((el) => el.className),
    term,
  );
}

async function panelShadowSelection(page: Page): Promise<{ text: string; collapsed: boolean }> {
  return page.evaluate((panelSel) => {
    const host = document.querySelector(panelSel);
    const sel = host?.shadowRoot?.getSelection?.() ?? null;
    return { text: sel?.toString() ?? '', collapsed: sel ? sel.isCollapsed : true };
  }, PANEL_SEL);
}

async function documentSelection(page: Page): Promise<{ text: string; collapsed: boolean }> {
  return page.evaluate(() => {
    const s = window.getSelection();
    return { text: s?.toString() ?? '', collapsed: s?.isCollapsed ?? true };
  });
}

/** What a real click at (x,y) would hit — elementsFromPoint stack summary. */
async function hitStack(page: Page, x: number, y: number): Promise<string[]> {
  return page.evaluate(
    ({ px, py }) =>
      document
        .elementsFromPoint(px, py)
        .slice(0, 6)
        .map(
          (el) =>
            `${el.tagName}#${el.id}.${String(el.className).slice(0, 40)} sv=${el.getAttribute('data-cell-split-view')} term=${el.getAttribute('data-cell-term')}`,
        ),
    { px: x, py: y },
  );
}

async function panelClip(
  page: Page,
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return page.evaluate((panelSel) => {
    const host = document.querySelector(panelSel);
    if (!host) return null;
    const r = host.getBoundingClientRect();
    return {
      x: Math.max(0, r.x),
      y: Math.max(0, r.y),
      width: Math.min(r.width, window.innerWidth - r.x),
      height: Math.min(Math.max(r.height, 300), window.innerHeight - r.y),
    };
  }, PANEL_SEL);
}

async function realClick(
  page: Page,
  box: TermBox,
  modifiers: ('Control' | 'Meta' | 'Shift')[] = [],
): Promise<void> {
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  for (const m of modifiers) await page.keyboard.up(m);
}

/** A real user re-clicks when nothing happens: retry the ctrl+click, re-reading
 *  the target's box each attempt (the cue list auto-scrolls on cue change). */
async function ctrlClickUntil(
  page: Page,
  pick: () => Promise<TermBox | undefined>,
  expected: number,
  tries = 6,
): Promise<void> {
  let lastStack: string[] = [];
  for (let i = 0; i < tries; i++) {
    const box = await pick();
    if (!box) break;
    lastStack = await hitStack(page, box.x + box.width / 2, box.y + box.height / 2);
    await realClick(page, box, ['Control']);
    const ok = await expect
      .poll(() => uniqueSelectedTerms(page), { timeout: 1_500 })
      .toBe(expected)
      .then(() => true)
      .catch(() => false);
    if (ok) return;
    await page.waitForTimeout(250);
  }
  process.stderr.write(
    `[audit] ctrl+click did not select after ${tries} tries; last hit stack: ${JSON.stringify(lastStack)}\n`,
  );
  await expect.poll(() => uniqueSelectedTerms(page), { timeout: 5_000 }).toBe(expected);
}

async function realDragSelect(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 24 });
  await page.mouse.up();
}

async function moveMouseNeutral(page: Page): Promise<void> {
  await page.mouse.move(20, 20, { steps: 4 });
}

async function announcerInfo(
  page: Page,
): Promise<{ exists: boolean; live: string | null; role: string | null; text: string | null }> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { exists: false, live: null, role: null, text: null };
    return {
      exists: true,
      live: el.getAttribute('aria-live'),
      role: el.getAttribute('role'),
      text: el.textContent,
    };
  }, ANNOUNCER);
}

function distinctTerms(boxes: TermBox[]): TermBox[] {
  const seen = new Set<string>();
  const out: TermBox[] = [];
  for (const b of boxes) {
    if (!seen.has(b.term)) {
      seen.add(b.term);
      out.push(b);
    }
  }
  return out;
}

interface SetupOptions {
  srtText?: string;
  seekTo?: number;
}

/** Open the local player, drop a real video + SRT (DataTransfer — the only
 *  synthetic input in this suite; no file-picker path exists for e2e), seek,
 *  pause, ensure the cue-list panel is open, nudge the viewport once so the
 *  split-view wrapper re-measures after video metadata, then wait until at
 *  least one cue-list token is painted inside the panel. */
async function setupLocalPlayer(page: Page, opts: SetupOptions = {}): Promise<void> {
  const srtText = opts.srtText ?? readFileSync(SRT_PATH, 'utf8');
  const seekTo = opts.seekTo ?? 0.5;

  await page.goto(`chrome-extension://${EXTENSION_ID}/${LOCAL_PLAYER_PATH}`);

  const videoBytes = readFileSync(VIDEO_PATH).toString('base64');
  await page.evaluate(
    async ({ videoB64, srt }) => {
      const toBlob = (b64: string): Blob => {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: 'video/mp4' });
      };
      const dt = new DataTransfer();
      dt.items.add(new File([toBlob(videoB64)], 'test-video.mp4', { type: 'video/mp4' }));
      dt.items.add(new File([srt], 'test-video.en.srt', { type: 'text/plain' }));
      const zone = document.querySelector('[data-dropzone]') ?? document.body;
      zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    },
    { videoB64: videoBytes, srt: srtText },
  );

  await waitDeep(page, OVERLAY_TOKEN_SEL, 45_000);
  await pauseVideo(page);
  await page.evaluate((t) => {
    const video = document.querySelector('video');
    if (video) video.currentTime = t;
  }, seekTo);

  if (!(await deepExists(page, PANEL_SEL))) {
    await page.keyboard.press('t');
  }
  await waitDeep(page, PANEL_SEL, 10_000);
  await waitDeep(page, CUE_TOKEN_SEL, 45_000);

  // Nudge the viewport so subtitleSplitView's keyChanged branch re-measures
  // the shell content height now that video metadata has loaded.
  await page.setViewportSize({ width: 1279, height: 719 });
  await page.setViewportSize({ width: 1280, height: 720 });

  await expect
    .poll(async () => (await panelTokenBoxes(page)).length, { timeout: 15_000 })
    .toBeGreaterThan(0);
  await moveMouseNeutral(page);
}

/** Real-user play: click the play button in the controls bar. The video
 *  element's lower half sits under .controlsOverlay whenever controls are
 *  visible (paused), so a center-surface click never reaches it — a real
 *  user clicks the play button or hits Space. */
async function playViaVideoClick(page: Page): Promise<void> {
  const btn = page.locator('[data-cell-id="controls-overlay"] button[aria-label="Play"]');
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
  } else {
    await page.keyboard.press(' ');
  }
  await expect
    .poll(async () => page.evaluate(() => document.querySelector('video')?.paused ?? true))
    .toBe(false);
}

test.describe('audit: subtitle bulk status — local player (real-user)', () => {
  test.beforeEach(async ({ cellContext }) => {
    await seedCellSettings(cellContext);
  });

  test('AC-1: real mouse drag-select in shadow-DOM cue list + key 3 applies known', async ({
    cellContext,
  }) => {
    test.setTimeout(120_000);
    const page = await cellContext.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') process.stderr.write(`[ac1:err] ${msg.text()}\n`);
    });
    await setupLocalPlayer(page);

    let dragTokens: TermBox[] = [];
    for (let i = 0; i < 4; i++) {
      const row = await panelTokenBoxesInCue(page, i);
      if (row.length >= 2) {
        dragTokens = row.slice(0, Math.min(3, row.length));
        break;
      }
    }
    expect(dragTokens.length).toBeGreaterThanOrEqual(2);
    const dragTerms = [...new Set(dragTokens.map((t) => t.term))];

    await realDragSelect(
      page,
      { x: dragTokens[0]!.x + 1, y: dragTokens[0]!.y + dragTokens[0]!.height / 2 },
      {
        x: dragTokens[dragTokens.length - 1]!.x + dragTokens[dragTokens.length - 1]!.width - 1,
        y: dragTokens[dragTokens.length - 1]!.y + dragTokens[dragTokens.length - 1]!.height / 2,
      },
    );

    const shadowSel = await panelShadowSelection(page);
    process.stderr.write(
      `[ac1] shadow selection: "${shadowSel.text}" collapsed=${shadowSel.collapsed} dragTerms=${JSON.stringify(dragTerms)}\n`,
    );
    expect(shadowSel.collapsed).toBe(false);
    expect(shadowSel.text.length).toBeGreaterThan(0);

    const clip = await panelClip(page);
    await page.screenshot({ path: `${SHOTS}/local-dragselect.png`, clip: clip ?? undefined });
    await page.screenshot({ path: `${SHOTS}/local-dragselect-full.png` });

    await page.keyboard.press('3');

    for (const term of dragTerms) {
      await expect
        .poll(async () => (await panelTermClasses(page, term)).join('|'), { timeout: 10_000 })
        .toContain('js-cell-token--status-known');
    }
    await page.screenshot({ path: `${SHOTS}/local-cuelist-applied.png`, clip: clip ?? undefined });
  });

  test('AC-3 + AC-4 + AC-8: real ctrl+click multi-select, visible wash, announcer, apply + deselect', async ({
    cellContext,
  }) => {
    test.setTimeout(120_000);
    const page = await cellContext.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') process.stderr.write(`[ac3:err] ${msg.text()}\n`);
    });
    await setupLocalPlayer(page);

    const all = distinctTerms(await panelTokenBoxes(page));
    expect(all.length).toBeGreaterThanOrEqual(2);
    const [a, b] = all;

    await realClick(page, a!, ['Control']);
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(1);
    await realClick(page, b!, ['Control']);
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(2);

    const clip = await panelClip(page);
    await page.screenshot({ path: `${SHOTS}/local-cuelist-selected.png`, clip: clip ?? undefined });

    const zoom = await page.evaluate((panelSel) => {
      const host = document.querySelector(panelSel);
      const sel = host?.shadowRoot?.querySelector('.js-cell-token--selected');
      if (!sel) return null;
      sel.scrollIntoView({ block: 'nearest' });
      const r = sel.getBoundingClientRect();
      return {
        x: Math.max(0, r.left - 30),
        y: Math.max(0, r.top - 16),
        width: Math.min(r.width + 220, window.innerWidth - Math.max(0, r.left - 30)),
        height: r.height + 32,
      };
    }, PANEL_SEL);
    if (zoom) {
      await page.screenshot({ path: `${SHOTS}/local-cuelist-selected-zoom.png`, clip: zoom });
    }

    // AC-4: selected wash is a background-image gradient layered over the
    // status underline (box-shadow) — a distinct mark, not a recolor.
    const styleCheck = await page.evaluate((panelSel) => {
      const host = document.querySelector(panelSel);
      const scope = host?.shadowRoot;
      const selected = scope?.querySelector('.js-cell-token--selected');
      const plain = scope?.querySelector('.js-cell-token--word:not(.js-cell-token--selected)');
      if (!selected || !plain) return null;
      return {
        selectedBg: getComputedStyle(selected).backgroundImage,
        plainBg: getComputedStyle(plain).backgroundImage,
        selectedShadow: getComputedStyle(selected).boxShadow,
      };
    }, PANEL_SEL);
    expect(styleCheck).not.toBeNull();
    expect(styleCheck!.selectedBg).toContain('gradient');
    expect(styleCheck!.selectedBg).not.toBe(styleCheck!.plainBg);

    // AC-8: announcer region exists, polite, reflects count.
    const announced = await announcerInfo(page);
    expect(announced.exists).toBe(true);
    expect(announced.live).toBe('polite');
    expect(announced.text).toMatch(/2/);

    // Apply '2' → tracking on all selected; store empties; announcer cleared.
    await page.keyboard.press('2');
    await expect.poll(() => selectedTermCount(page)).toBe(0);
    for (const tb of [a!, b!]) {
      await expect
        .poll(async () => (await panelTermClasses(page, tb.term)).join('|'), { timeout: 10_000 })
        .toContain('js-cell-token--status-tracking');
    }
    const cleared = await announcerInfo(page);
    expect(cleared.text).toMatch(/cleared|bỏ/i);
    await page.screenshot({ path: `${SHOTS}/local-cuelist-tracking.png`, clip: clip ?? undefined });

    // Toggle same term twice → ends deselected.
    await realClick(page, a!, ['Control']);
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(1);
    await realClick(page, a!, ['Control']);
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(0);
  });

  test('AC-2: overlay tokenization + real-gesture reachability', async ({ cellContext }) => {
    test.setTimeout(150_000);
    const page = await cellContext.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') process.stderr.write(`[ac2:err] ${msg.text()}\n`);
    });
    await setupLocalPlayer(page, { srtText: LONG_CUE_SRT });

    // Tokenization exists in the DOM — the spans are rendered.
    const tokens = await overlayTokenBoxes(page);
    expect(tokens.length).toBeGreaterThanOrEqual(3);
    await page.screenshot({ path: `${SHOTS}/local-overlay-tokens.png` });

    // Hit-test: what does a real pointer actually hit at a token's center?
    // The subtitle overlay must out-stack the video + controls surfaces.
    const t0 = tokens[0]!;
    const cx = t0.x + t0.width / 2;
    const cy = t0.y + t0.height / 2;
    const stackPanelOpen = await hitStack(page, cx, cy);
    process.stderr.write(`[ac2] hit stack (panel open): ${JSON.stringify(stackPanelOpen)}\n`);
    expect
      .soft((stackPanelOpen[0] ?? '').includes('js-cell-token'), 'panel-open: token is the hit target')
      .toBe(true);

    // Close the cue panel → stage returns to full height; the token must stay
    // the hit target there as well.
    await page.keyboard.press('t');
    await expect.poll(() => deepExists(page, PANEL_SEL), { timeout: 10_000 }).toBe(false);
    await page.waitForTimeout(600);

    const tokensClosed = await overlayTokenBoxes(page);
    expect(tokensClosed.length).toBeGreaterThanOrEqual(3);
    const c0 = tokensClosed[0]!;
    const stackClosed = await hitStack(
      page,
      c0.x + c0.width / 2,
      c0.y + c0.height / 2,
    );
    process.stderr.write(`[ac2] hit stack (panel closed): ${JSON.stringify(stackClosed)}\n`);
    expect
      .soft((stackClosed[0] ?? '').includes('js-cell-token'), 'panel-closed: token is the hit target')
      .toBe(true);

    // Real ctrl+click attempt — record where the click actually lands.
    const pausedBefore = await page.evaluate(() => document.querySelector('video')?.paused ?? null);
    await realClick(page, c0, ['Control']);
    await page.waitForTimeout(500);
    const pausedAfter = await page.evaluate(() => document.querySelector('video')?.paused ?? null);
    const selAfterClick = await uniqueSelectedTerms(page);
    process.stderr.write(
      `[ac2] ctrl+click on "${c0.term}": video.paused ${pausedBefore}→${pausedAfter} (click toggled video=${pausedBefore !== pausedAfter}), selectedTerms=${selAfterClick}\n`,
    );
    await page.screenshot({ path: `${SHOTS}/local-overlay-click-target.png` });
    if (pausedBefore !== null && pausedAfter === false) await pauseVideo(page);
    expect.soft(selAfterClick, 'ctrl+click selected the overlay token').toBe(1);
    // Selected terms take priority over a native DOM selection — clear the
    // ctrl+click pick so the drag-select below is the one being audited.
    await page.keyboard.press('Escape');
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(0);

    // Real drag-select attempt across the token row (panel closed).
    await pauseVideo(page);
    const dragToks = tokensClosed.slice(0, Math.min(3, tokensClosed.length));
    const dragTerms = [...new Set(dragToks.map((t) => t.term))];
    await realDragSelect(
      page,
      { x: dragToks[0]!.x + 1, y: dragToks[0]!.y + dragToks[0]!.height / 2 },
      {
        x: dragToks[dragToks.length - 1]!.x + dragToks[dragToks.length - 1]!.width - 1,
        y: dragToks[dragToks.length - 1]!.y + dragToks[dragToks.length - 1]!.height / 2,
      },
    );
    const docSel = await documentSelection(page);
    process.stderr.write(
      `[ac2] overlay drag selection: "${docSel.text}" collapsed=${docSel.collapsed} dragTerms=${JSON.stringify(dragTerms)}\n`,
    );
    await page.screenshot({ path: `${SHOTS}/local-overlay-dragselect.png` });
    await moveMouseNeutral(page);
    await page.keyboard.press('1');
    await page.waitForTimeout(600);
    const appliedCount = (
      await Promise.all(dragTerms.map((t) => overlayTermClasses(page, t)))
    ).filter((cls) => cls.some((c) => c.includes('js-cell-token--status-unknown'))).length;
    process.stderr.write(`[ac2] drag-select→1 applied ${appliedCount}/${dragTerms.length}\n`);
    expect.soft(appliedCount, 'overlay drag-select + key 1 applies unknown').toBe(dragTerms.length);

    // OverlayPreview check needs the subtitle manager — its open trigger lives
    // in the same overlay row the tokens do, so it must stay reachable too.
    const mgrBtn = page.locator('[aria-label="Open subtitle manager"]').first();
    const mgrBox = await mgrBtn.boundingBox();
    if (mgrBox) {
      const mstack = await hitStack(page, mgrBox.x + mgrBox.width / 2, mgrBox.y + mgrBox.height / 2);
      process.stderr.write(`[ac2] manager button hit stack: ${JSON.stringify(mstack)}\n`);
      expect
        .soft(mstack[0] ?? '', 'manager button is the real click target')
        .toContain('button');
    }
    await page.screenshot({ path: `${SHOTS}/local-overlay-manager-reachable.png` });
  });

  test('AC-5: dictionary popup term wins over an active selection', async ({ cellContext }) => {
    test.setTimeout(120_000);
    const page = await cellContext.newPage();
    page.on('console', (msg) => {
      const t = msg.text();
      if (t.includes('lookup') || msg.type() === 'error' || msg.type() === 'warning') {
        process.stderr.write(`[ac5:${msg.type()}] ${t}\n`);
      }
    });
    page.on('pageerror', (err) => process.stderr.write(`[ac5:pageerror] ${err.message}\n`));
    await setupLocalPlayer(page);

    const all = distinctTerms(await panelTokenBoxes(page));
    expect(all.length).toBeGreaterThanOrEqual(3);
    const [s1, s2, popupTarget] = all;

    await realClick(page, s1!, ['Control']);
    await realClick(page, s2!, ['Control']);
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(2);

    // Plain click on a DIFFERENT token → dictionary popup.
    await realClick(page, popupTarget!);
    await expect.poll(() => deepExists(page, '.js-cell-popup-host'), { timeout: 10_000 }).toBe(true);
    const popupOpenedOnTerm = await expect
      .poll(
        async () =>
          (await panelTermClasses(page, popupTarget!.term)).some((c) =>
            c.includes('js-cell-token--popup-open'),
          ),
        { timeout: 10_000 },
      )
      .toBe(true)
      .then(() => true)
      .catch(() => false);
    process.stderr.write(`[ac5] popup-open class on clicked token: ${popupOpenedOnTerm}\n`);
    expect(popupOpenedOnTerm).toBe(true);

    // Wait for the lookup result to render — popup-target priority only
    // exists once `level.term` is set (spec: resolution order). Pressing a
    // status key during the loading window falls through to the selection by
    // design, so the priority assertion must come after resolution.
    const resolved = await expect
      .poll(() => deepExists(page, '[data-cell-id="dictionary-candidate-0"]'), { timeout: 15_000 })
      .toBe(true)
      .then(() => true)
      .catch(() => false);
    process.stderr.write(`[ac5] lookup result rendered (candidate-0): ${resolved}\n`);
    await page.screenshot({ path: `${SHOTS}/local-popup-priority.png` });
    expect(resolved).toBe(true);

    // Park the mouse away from the token so the hovered-term fallback cannot
    // mask whether the popup target itself received the keypress.
    await moveMouseNeutral(page);
    await page.keyboard.press('4');
    await expect
      .poll(async () => (await panelTermClasses(page, popupTarget!.term)).join('|'), {
        timeout: 10_000,
      })
      .toContain('js-cell-token--status-ignore');

    // The active selection survives a popup-targeted apply.
    process.stderr.write(
      `[ac5] selected after popup apply: ${JSON.stringify(await selectedTerms(page))}\n`,
    );
    expect(await uniqueSelectedTerms(page)).toBe(2);
    for (const tb of [s1!, s2!]) {
      const cls = await panelTermClasses(page, tb.term);
      expect(cls.some((c) => c.includes('js-cell-token--status-ignore'))).toBe(false);
    }
    await page.screenshot({ path: `${SHOTS}/local-popup-priority-applied.png` });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  });

  test('AC-6: lifecycle — Escape clears, cue boundary clears, reload drops store', async ({
    cellContext,
  }) => {
    test.setTimeout(180_000);
    const page = await cellContext.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') process.stderr.write(`[ac6:err] ${msg.text()}\n`);
    });
    await setupLocalPlayer(page, { srtText: SHORT_CUES_SRT, seekTo: 0.2 });

    let tokens: TermBox[] = [];
    for (let i = 0; i < 4; i++) {
      const row = await panelTokenBoxesInCue(page, i);
      if (row.length >= 2) {
        tokens = row;
        break;
      }
    }
    expect(tokens.length).toBeGreaterThanOrEqual(2);
    const pickTerm =
      (term: string) =>
      async (): Promise<TermBox | undefined> =>
        (await panelTokenBoxes(page)).find((b) => b.term === term);

    // Escape clears a live selection + updates the announcer.
    await ctrlClickUntil(page, pickTerm(tokens[0]!.term), 1);
    await page.keyboard.press('Escape');
    await expect.poll(() => selectedTermCount(page)).toBe(0);
    const clearedMsg = await announcerInfo(page);
    expect(clearedMsg.text).toMatch(/cleared|bỏ/i);

    // Real playback past the cue boundary clears the selection.
    await ctrlClickUntil(page, pickTerm(tokens[0]!.term), 1);
    await ctrlClickUntil(page, pickTerm(tokens[1]!.term), 2);
    await playViaVideoClick(page);
    await expect
      .poll(
        async () => page.evaluate(() => document.querySelector('video')?.currentTime ?? 0),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0.45);
    await expect.poll(() => selectedTermCount(page), { timeout: 10_000 }).toBe(0);
    await pauseVideo(page);
    await page.screenshot({ path: `${SHOTS}/local-cue-boundary-cleared.png` });

    // Reload drops the in-memory store. Pick a token near the panel's
    // vertical center — edge rows can be scroll-clipped while still inside
    // the host rect.
    expect((await panelTokenBoxes(page)).length).toBeGreaterThanOrEqual(1);
    await ctrlClickUntil(
      page,
      async () => {
        const boxes = (await panelTokenBoxes(page)).sort((a, b) => a.y - b.y);
        return boxes[Math.floor(boxes.length / 2)];
      },
      1,
    );
    await page.reload();
    await setupLocalPlayer(page, { srtText: SHORT_CUES_SRT, seekTo: 0.2 });
    await page.waitForTimeout(500);
    expect(await selectedTermCount(page)).toBe(0);
  });

  test('stress + editable inertness: 7-term select, empty keypress, 4x toggle, mixed surfaces', async ({
    cellContext,
  }) => {
    test.setTimeout(180_000);
    const page = await cellContext.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') process.stderr.write(`[stress:err] ${msg.text()}\n`);
    });
    await setupLocalPlayer(page, { srtText: LONG_CUE_SRT });

    // Editable-inertness check: the only editable fields in the local player
    // live inside the subtitle manager (offset input etc.), whose open button
    // sits in the overlay row — probe hit-testing before driving it.
    const mgrBtn = page.locator('[aria-label="Open subtitle manager"]').first();
    const mgrBox = await mgrBtn.boundingBox();
    let managerReachable = false;
    if (mgrBox) {
      const mstack = await hitStack(page, mgrBox.x + mgrBox.width / 2, mgrBox.y + mgrBox.height / 2);
      process.stderr.write(`[stress] manager button hit: ${JSON.stringify(mstack)}\n`);
      managerReachable = (mstack[0] ?? '').toLowerCase().includes('button');
    }
    if (managerReachable) {
      await mgrBtn.click({ timeout: 10_000 });
      await waitDeep(page, '[data-cell-id="subtitle-manager-panel"]', 10_000);
      const offsetInput = page.locator('[data-cell-id="manager-offset-input-target"]');
      await offsetInput.click();
      const statusBefore = await panelTokenSnapshot(page);
      await page.keyboard.press('1');
      await expect.soft(offsetInput).toHaveValue('1');
      await page.waitForTimeout(400);
      expect(await panelTokenSnapshot(page)).toBe(statusBefore);
      process.stderr.write(
        '[stress] editable inertness: key 1 inside offset input → no status change\n',
      );
      await offsetInput.fill('0');
      await page.locator('[data-cell-id="subtitle-manager-close"]').click();
      await expect
        .poll(() => deepExists(page, '[data-cell-id="subtitle-manager-panel"]'), { timeout: 10_000 })
        .toBe(false);
    } else {
      process.stderr.write(
        '[stress] LIMITATION: subtitle manager unreachable via real input — editable-inertness not verifiable on this surface\n',
      );
    }

    // Stress: ctrl+click up to 7 distinct visible terms → key 3 → all known.
    let visible = distinctTerms(await panelTokenBoxes(page));
    if (visible.length < 7) {
      const first = visible[0];
      if (first) {
        for (let i = 0; i < 3 && visible.length < 7; i++) {
          await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
          await page.mouse.wheel(0, 200);
          await page.waitForTimeout(250);
          visible = distinctTerms(await panelTokenBoxes(page));
        }
      }
    }
    const batch = visible.slice(0, Math.min(7, visible.length));
    process.stderr.write(`[stress] batch terms: ${JSON.stringify(batch.map((b) => b.term))}\n`);
    expect(batch.length).toBeGreaterThanOrEqual(4);
    for (const tb of batch) {
      await realClick(page, tb, ['Control']);
    }
    await expect.poll(() => uniqueSelectedTerms(page), { timeout: 10_000 }).toBe(batch.length);
    await page.keyboard.press('3');
    await expect.poll(() => selectedTermCount(page)).toBe(0);
    for (const tb of batch) {
      await expect
        .poll(async () => (await panelTermClasses(page, tb.term)).join('|'), { timeout: 10_000 })
        .toContain('js-cell-token--status-known');
    }
    await page.screenshot({
      path: `${SHOTS}/local-stress-7term.png`,
      clip: (await panelClip(page)) ?? undefined,
    });

    // Toggle same term 4x → ends deselected.
    const togglee = batch[0]!;
    for (let i = 0; i < 4; i++) {
      await realClick(page, togglee, ['Control']);
    }
    expect(await selectedTermCount(page)).toBe(0);

    // Press 1 with empty selection + mouse neutral → harmless (no status flips).
    await moveMouseNeutral(page);
    const snapBefore = await panelTokenSnapshot(page);
    await page.keyboard.press('1');
    await page.waitForTimeout(400);
    const snapAfter = await panelTokenSnapshot(page);
    expect(snapAfter).toBe(snapBefore);
    process.stderr.write('[stress] empty keypress: snapshot unchanged\n');

    // Mixed surfaces: panel token + overlay token share one store → one
    // keypress applies to both. Probe overlay hit-testing first.
    const overlayToks = await overlayTokenBoxes(page);
    const visibleNow = distinctTerms(await panelTokenBoxes(page));
    const panelPick = visibleNow.find((d) => !overlayToks.some((o) => o.term === d.term));
    const overlayHit = overlayToks.length
      ? await hitStack(
          page,
          overlayToks[0]!.x + overlayToks[0]!.width / 2,
          overlayToks[0]!.y + overlayToks[0]!.height / 2,
        )
      : [];
    const overlayReachable = (overlayHit[0] ?? '').includes('js-cell-token');
    process.stderr.write(
      `[stress] mixed-surface overlay hit: ${JSON.stringify(overlayHit)} reachable=${overlayReachable}\n`,
    );
    if (overlayToks.length >= 1 && panelPick && overlayReachable) {
      await realClick(page, panelPick, ['Control']);
      await realClick(page, overlayToks[0]!, ['Control']);
      await expect.poll(() => uniqueSelectedTerms(page)).toBe(2);
      await page.keyboard.press('2');
      await expect.poll(() => selectedTermCount(page)).toBe(0);
      await expect
        .poll(async () => (await panelTermClasses(page, panelPick.term)).join('|'), {
          timeout: 10_000,
        })
        .toContain('js-cell-token--status-tracking');
      await expect
        .poll(async () => (await overlayTermClasses(page, overlayToks[0]!.term)).join('|'), {
          timeout: 10_000,
        })
        .toContain('js-cell-token--status-tracking');
      await page.screenshot({ path: `${SHOTS}/local-mixed-surfaces.png` });
    } else {
      process.stderr.write(
        `[stress] mixed-surface check skipped: ${overlayToks.length === 0 ? 'no overlay tokens' : !panelPick ? 'no disjoint panel term' : 'overlay unreachable'}\n`,
      );
    }
  });
});
