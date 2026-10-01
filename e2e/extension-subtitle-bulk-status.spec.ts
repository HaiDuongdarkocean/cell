import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type BrowserContext, type Page } from '@playwright/test';
import { test } from './fixtures/cellEnvironment.fixture';

const portOffset = parseInt(process.env.PW_PORT_OFFSET || '0', 10);
const STREAM_ORIGIN = `http://127.0.0.1:${4321 + portOffset}`;
const LOCAL_PLAYER_PATH = 'src/entrypoints/local-player/index.html';
const EXTENSION_ID = 'acaplpheplggagjpekjlmcjhgghimcfm';

const VIDEO_PATH = resolve('data/extension/uBOLite/web_accessible_resources/noop-1s.mp4');
const SRT_PATH = resolve('tests/data-test/auto-match-test/test-video.en.srt');

const SELECTED_CLASS = 'js-cell-token--selected';
const ANNOUNCER = '#cell-token-selection-announcer';

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

const PANEL_SEL = '[data-cell-split-view="panel"]';

async function panelTerms(page: Page, limit: number): Promise<string[]> {
  return page.evaluate(
    ({ panelSel, n }) => {
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
      const host = deepFind(document, panelSel);
      const scope: ParentNode = host?.shadowRoot ?? document;
      return Array.from(scope.querySelectorAll('.js-cell-token[data-cell-term]'))
        .slice(0, n)
        .map((el) => el.getAttribute('data-cell-term')!);
    },
    { panelSel: PANEL_SEL, n: limit },
  );
}

async function panelStatusCount(page: Page, status: string): Promise<number> {
  return page.evaluate(
    ({ panelSel, cls }) => {
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
      const host = deepFind(document, panelSel);
      const scope: ParentNode = host?.shadowRoot ?? document;
      return scope.querySelectorAll(`.js-cell-token--status-${cls}`).length;
    },
    { panelSel: PANEL_SEL, cls: status },
  );
}

async function activateFirstCue(page: Page): Promise<void> {
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (!video) return;
    video.muted = true;
    video.currentTime = 0.5;
    void video.play().catch(() => {});
  });
}

/** Pause playback so the active cue (and thus the bulk selection, which
 *  clears on cue change) stays stable while the test interacts. */
async function pauseVideo(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('video').forEach((v) => v.pause());
  });
}

/** Dispatch a click directly on a token — used for surfaces whose real click
 *  point is occluded by host-page layout (mock StreamFlix paints its player
 *  section over the split-view panel area). Still exercises the real
 *  React/native click handler with modifier state. */
async function dispatchTermClick(
  page: Page,
  term: string,
  modifiers: { ctrl?: boolean; meta?: boolean } = {},
  scopeSel?: string,
): Promise<void> {
  const found = await page.evaluate(
    ({ t, scope, mods }) => {
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
      const scopeRoot: ParentNode = scope
        ? (deepFind(document, scope)?.shadowRoot ?? deepFind(document, scope) ?? document)
        : document;
      const tok = Array.from(scopeRoot.querySelectorAll('.js-cell-token')).find(
        (e) => e.getAttribute('data-cell-term') === t,
      );
      if (!tok) return false;
      tok.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          composed: true,
          ctrlKey: Boolean(mods.ctrl),
          metaKey: Boolean(mods.meta),
        }),
      );
      return true;
    },
    { t: term, scope: scopeSel ?? null, mods: modifiers },
  );
  if (!found) throw new Error(`dispatchTermClick: not found: ${term}`);
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

async function seedEnglishDictionary(context: BrowserContext): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(async () => {
    const storage = await chrome.storage.local.get('orca');
    const hash = (storage?.orca as Record<string, unknown> | undefined)?.dbHash;
    const dbName = `orca-dict-${typeof hash === 'string' && hash.length === 8 ? hash : 'devmode0'}-en`;
    const existing = (await indexedDB.databases?.() ?? []).find((d) => d.name === dbName);
    const version = existing?.version ?? 1;
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const req = indexedDB.open(dbName, version);
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const [name, opts] of [
          ['langResourceInfo', { keyPath: 'id', autoIncrement: true }],
          ['langFrequencyEntry', { keyPath: 'id', autoIncrement: true }],
          ['langDictionaryEntry', { keyPath: 'id', autoIncrement: true }],
          ['langPhraseIndex', { keyPath: 'resourceId' }],
          ['langWordStatus', { keyPath: 'term' }],
          ['langWordTrash', { keyPath: 'term' }],
          ['syncOutbox', { keyPath: 'id', autoIncrement: true }],
          ['syncMeta', { keyPath: 'key' }],
        ] as const) {
          if (!d.objectStoreNames.contains(name)) d.createObjectStore(name, opts);
        }
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    db.close();
  });
}

async function selectedTermCount(page: Page): Promise<number> {
  return (await selectedTerms(page)).length;
}

async function uniqueSelectedTerms(page: Page): Promise<number> {
  return new Set(await selectedTerms(page)).size;
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

test.describe('subtitle bulk status', () => {
  test.beforeEach(async ({ cellContext }) => {
    await seedCellSettings(cellContext);
    await seedEnglishDictionary(cellContext);
  });

  test('streaming cue list: ctrl+click multi-select, key 3 applies, Escape clears', async ({
    streamFlixPage,
  }) => {
    test.setTimeout(120_000);
    const page = streamFlixPage;
    page.on('console', (msg) => {
      if (msg.type() === 'error') process.stderr.write(`[page:err] ${msg.text()}\n`);
    });

    await activateFirstCue(page);

    // 't' toggles the split-view cue list (existing hotkey; 'g' is Player Mode).
    await page.keyboard.press('t');
    await waitDeep(page, PANEL_SEL, 20_000);
    const cueTokenSel = '[data-cell-id="cue-target-text"] .js-cell-token';
    await waitDeep(page, cueTokenSel, 60_000);

    // AC-2.4 sanity: cue timestamp click still seeks the video.
    const seekBefore = await page.evaluate(() => document.querySelector('video')?.currentTime ?? -1);
    await page.evaluate((panelSel) => {
      const deepFind = (root: Document | ShadowRoot, s: string): Element | null => {
        const el = root.querySelector(s);
        if (el) return el;
        for (const child of Array.from(root.querySelectorAll('*'))) {
          if (child.shadowRoot) {
            const f = deepFind(child.shadowRoot, s);
            if (f) return f;
          }
        }
        return null;
      };
      const host = deepFind(document, panelSel);
      const buttons = host?.shadowRoot?.querySelectorAll('[data-cell-id="cue-timestamp"]');
      const last = buttons?.[buttons.length - 1];
      last?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    }, PANEL_SEL);
    await expect
      .poll(async () => page.evaluate(() => document.querySelector('video')?.currentTime ?? -1))
      .not.toBe(seekBefore);
    await pauseVideo(page);

    const terms = await panelTerms(page, 3);
    expect(terms.length).toBeGreaterThanOrEqual(2);

    await dispatchTermClick(page, terms[0]!, { ctrl: true }, PANEL_SEL);
    await dispatchTermClick(page, terms[1]!, { ctrl: true }, PANEL_SEL);

    await expect.poll(() => uniqueSelectedTerms(page)).toBe(2);
    await page.screenshot({ path: 'tmp/subtitle-bulk-status/cue-list-selected.png' });

    // Announcer reflects the count.
    const announced = await page.evaluate(
      (sel) => document.querySelector(sel)?.textContent,
      ANNOUNCER,
    );
    expect(announced).toMatch(/2/);

    await page.keyboard.press('3');
    await expect.poll(() => selectedTermCount(page)).toBe(0);
    await expect
      .poll(() => panelStatusCount(page, 'known'), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(2);

    // Plain click still opens the dictionary popup.
    await dispatchTermClick(page, terms[0]!, {}, PANEL_SEL);
    await expect.poll(() => deepExists(page, '.js-cell-popup-host'), { timeout: 10_000 }).toBe(true);
    await page.keyboard.press('Escape');

    // Escape clears a fresh selection.
    await dispatchTermClick(page, terms[0]!, { ctrl: true }, PANEL_SEL);
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(1);
    await page.keyboard.press('Escape');
    await expect.poll(() => selectedTermCount(page)).toBe(0);
  });

  test('streaming overlay block: tokens bind and ctrl+click selects', async ({ streamFlixPage }) => {
    test.setTimeout(120_000);
    const page = streamFlixPage;
    await activateFirstCue(page);
    const overlayTokenSel =
      '[data-cell-id="subtitle-block"] [data-role="target"] .js-cell-token';
    await waitDeep(page, overlayTokenSel, 60_000);
    await pauseVideo(page);

    const firstTerm = await page.evaluate(() => {
      const root = document.getElementById('cell-subtitle-root')?.shadowRoot ?? document;
      const el = root.querySelector(
        '[data-cell-id="subtitle-block"] [data-role="target"] .js-cell-token[data-cell-term]',
      );
      return el?.getAttribute('data-cell-term') ?? null;
    });
    expect(firstTerm).not.toBeNull();

    await dispatchTermClick(page, firstTerm!, { ctrl: true }, '[data-cell-id="subtitle-block"]');
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(1);
  });

  test('player mode: cue list ctrl+click selects, Escape clears', async ({ streamFlixPage }) => {
    test.setTimeout(120_000);
    const page = streamFlixPage;
    await activateFirstCue(page);

    // 'g' toggles Player Mode (existing hotkey); cue list is open by default.
    await page.keyboard.press('g');
    await waitDeep(page, '[data-cell-id="player-mode-overlay"]', 20_000);
    await waitDeep(page, '[data-cell-id="cue-target-text"] .js-cell-token', 60_000);
    await pauseVideo(page);

    const pmTerm = await page.evaluate(() => {
      const root = document.getElementById('cell-subtitle-root')?.shadowRoot;
      const overlay = root?.querySelector('[data-cell-id="player-mode-overlay"]');
      const el = overlay?.querySelector('.js-cell-token[data-cell-term]');
      return el?.getAttribute('data-cell-term') ?? null;
    });
    expect(pmTerm).not.toBeNull();

    await dispatchTermClick(page, pmTerm!, { ctrl: true }, '[data-cell-id="player-mode-overlay"]');
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(1);
    await page.screenshot({ path: 'tmp/subtitle-bulk-status/player-mode-selected.png' });

    // Zoomed clip of the selected token — pixel evidence for the wash.
    const tokClip = await page.evaluate((t) => {
      const root = document.getElementById('cell-subtitle-root')?.shadowRoot;
      const overlay = root?.querySelector('[data-cell-id="player-mode-overlay"]');
      const el = Array.from(
        overlay?.querySelectorAll('.js-cell-token--selected') ?? [],
      ).find((e) => e.getAttribute('data-cell-term') === t);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.max(0, r.left - 20), y: Math.max(0, r.top - 20), width: r.width + 140, height: r.height + 40 };
    }, pmTerm);
    if (tokClip) {
      await page.screenshot({
        path: 'tmp/subtitle-bulk-status/player-mode-selected-zoom.png',
        clip: tokClip,
      });
    }

    // Concept B water wash: selected token keeps underline channel and gains a
    // background-image wash (not a flat background-color swap).
    const styleCheck = await page.evaluate((t) => {
      const root = document.getElementById('cell-subtitle-root')?.shadowRoot;
      const overlay = root?.querySelector('[data-cell-id="player-mode-overlay"]');
      const selected = Array.from(
        overlay?.querySelectorAll('.js-cell-token--selected') ?? [],
      ).find((e) => e.getAttribute('data-cell-term') === t);
      const plain = overlay?.querySelector(
        '.js-cell-token--word:not(.js-cell-token--selected)',
      );
      if (!selected || !plain) return null;
      const selStyle = getComputedStyle(selected);
      const plainStyle = getComputedStyle(plain);
      return {
        selectedBgImage: selStyle.backgroundImage,
        plainBgImage: plainStyle.backgroundImage,
        selectedUnderline: selStyle.textDecorationLine,
      };
    }, pmTerm);
    expect(styleCheck).not.toBeNull();
    expect(styleCheck!.selectedBgImage).toContain('gradient');
    expect(styleCheck!.plainBgImage).not.toBe(styleCheck!.selectedBgImage);

    await page.keyboard.press('Escape');
    await expect.poll(() => selectedTermCount(page)).toBe(0);
  });

  test('local player: overlay tokenized + cue list bulk status', async ({ cellContext }) => {
    test.setTimeout(120_000);
    const page = await cellContext.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') process.stderr.write(`[lp:err] ${msg.text()}\n`);
    });
    await page.goto(`chrome-extension://${EXTENSION_ID}/${LOCAL_PLAYER_PATH}`);

    const videoBytes = readFileSync(VIDEO_PATH).toString('base64');
    const srtText = readFileSync(SRT_PATH, 'utf8');
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

    // Seek into the first cue window so the overlay renders an active cue.
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) video.currentTime = 0.5;
    });

    // Overlay target line tokenizes once cues load.
    const overlayTokenSel =
      '[data-cell-id="subtitle-block"] [data-role="target"] .js-cell-token';
    await waitDeep(page, overlayTokenSel, 30_000);
    await pauseVideo(page);

    // 't' toggles the split-view cue list (PlayerView keydown handler).
    await page.keyboard.press('t');
    await waitDeep(page, PANEL_SEL, 10_000);
    await expect
      .poll(() => panelTerms(page, 2), { timeout: 20_000 })
      .toHaveLength(2);

    const cueTerms = await panelTerms(page, 2);

    await dispatchTermClick(page, cueTerms[0]!, { ctrl: true }, PANEL_SEL);
    await dispatchTermClick(page, cueTerms[1]!, { ctrl: true }, PANEL_SEL);
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(2);
    await page.screenshot({ path: 'tmp/subtitle-bulk-status/local-selected.png' });

    await page.keyboard.press('3');
    await expect.poll(() => selectedTermCount(page)).toBe(0);
    await expect
      .poll(() => panelStatusCount(page, 'known'), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(2);

    // Overlay ctrl+click selects too.
    const overlayTerm = await page.evaluate(() => {
      const sel =
        '[data-cell-id="subtitle-block"] [data-role="target"] .js-cell-token[data-cell-term]';
      const deepFind = (root: Document | ShadowRoot): Element | null => {
        const el = root.querySelector(sel);
        if (el) return el;
        for (const child of Array.from(root.querySelectorAll('*'))) {
          if (child.shadowRoot) {
            const found = deepFind(child.shadowRoot);
            if (found) return found;
          }
        }
        return null;
      };
      return deepFind(document)?.getAttribute('data-cell-term') ?? null;
    });
    expect(overlayTerm).not.toBeNull();
    await dispatchTermClick(page, overlayTerm!, { ctrl: true }, '[data-cell-id="subtitle-block"]');
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(1);
    await page.keyboard.press('Escape');
    await expect.poll(() => selectedTermCount(page)).toBe(0);

    // OverlayPreview (editable) is never tokenized.
    const editableTokenized = await page.evaluate(() => {
      const sel = '[data-cell-id="overlay-preview-target-line"] .js-cell-token';
      const deepFind = (root: Document | ShadowRoot): Element | null => {
        const el = root.querySelector(sel);
        if (el) return el;
        for (const child of Array.from(root.querySelectorAll('*'))) {
          if (child.shadowRoot) {
            const found = deepFind(child.shadowRoot);
            if (found) return found;
          }
        }
        return null;
      };
      return deepFind(document) !== null;
    });
    expect(editableTokenized).toBe(false);
  });
});
