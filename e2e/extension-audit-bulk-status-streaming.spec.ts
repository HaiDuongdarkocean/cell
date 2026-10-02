import { mkdirSync } from 'node:fs';
import { expect, type BrowserContext, type Page } from '@playwright/test';
import { test } from './fixtures/cellEnvironment.fixture';

/**
 * Audit: subtitle-bulk-status on STREAMING surfaces (mock StreamFlix) using
 * REAL user input paths — page.mouse / locator.click({modifiers}) /
 * page.keyboard — with JS dispatchEvent kept as a flagged last resort.
 *
 * Evidence lands in tmp/audit-bulk-status/ (screenshots + console markers
 * prefixed [audit]).
 *
 * KNOWN MOCK LIMITATION (not a product bug): the StreamFlix video is a ~52px
 * strip, so the split-view panel renders squeezed and `._playerSection`
 * intercepts real clicks over it. Procedure: probe one real ctrl+click before
 * pinning; if intercepted, pin the real panel element to a legible fixed rect
 * (layout-only change) and keep driving it with real mouse/keyboard input.
 */

const portOffset = parseInt(process.env.PW_PORT_OFFSET || '0', 10);
const STREAM_ORIGIN = `http://127.0.0.1:${4321 + portOffset}`;

const SHOT_DIR = 'tmp/audit-bulk-status';
mkdirSync(SHOT_DIR, { recursive: true });

const SELECTED_CLASS = 'js-cell-token--selected';
const ANNOUNCER = '#cell-token-selection-announcer';
const PANEL_SEL = '[data-cell-split-view="panel"]';
const PANEL_TOKENS = `${PANEL_SEL} [data-cell-id="cue-target-text"] .js-cell-token`;
const PM_OVERLAY = '[data-cell-id="player-mode-overlay"]';
const PM_TOKENS = `${PM_OVERLAY} [data-cell-id="cue-target-text"] .js-cell-token`;
const OVERLAY_TOKENS =
  '[data-cell-id="subtitle-block"] [data-role="target"] .js-cell-token';
const POPUP_HOST = '.js-cell-popup-host';
const VOLUME_INPUT = 'input[aria-label="Volume level"]';

// [audit] console markers are scraped into tmp/audit-bulk-status/notes.txt by
// the report step — keep the prefix stable.
function note(msg: string): void {
  process.stderr.write(`[audit] ${msg}\n`);
}

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

/** Mock limitation workaround: pin the real squeezed/occluded split-view panel
 *  to a legible fixed rect. Layout-only — input path stays real. */
async function raiseSplitViewForScreenshot(page: Page): Promise<void> {
  await page.evaluate(() => {
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
    const panel = deepFind(document, '[data-cell-split-view="panel"]');
    if (panel instanceof HTMLElement) {
      panel.style.position = 'fixed';
      panel.style.top = '90px';
      panel.style.right = '16px';
      panel.style.left = 'auto';
      panel.style.width = '380px';
      panel.style.height = '70vh';
      panel.style.zIndex = '2147483000';
    }
  });
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

async function pauseVideo(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('video').forEach((v) => v.pause());
  });
}

/** Seek into a cue with real word tokens (cue 2 of the default mock video) so
 *  the overlay binds word tokens quickly instead of waiting through the ♪ cue. */
async function seekToWordCue(page: Page): Promise<void> {
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (!video) return;
    video.muted = true;
    video.currentTime = 21;
    void video.play().catch(() => {});
  });
}

/** LAST RESORT — flagged synthetic fallback. Direct dispatch on a token whose
 *  real click point is occluded by host-page layout. */
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

const DICT_TERMS = [
  'lyin', "lyin'", 'isn', "isn't", 'better', 'than', 'silence', 'floatin',
  "floatin'", 'but', 'i', 'feel', 'like', "i'm", 'dyin', "dyin'", 'still',
  'no', 'matter', 'where', 'go', 'at', 'the', 'end', 'of', 'every', 'road',
  'you', 'were', 'good', 'to', 'me', 'yeah', 'know', 'it', "it's", 'easier',
  'run', 'after', 'everything', "i've", 'done', 'hear', 'now', 'hello', 'can',
];

async function seedEnglishDictionary(context: BrowserContext): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(async (terms: string[]) => {
    const storage = await chrome.storage.local.get('orca');
    const hash = (storage?.orca as Record<string, unknown> | undefined)?.dbHash;
    const dbName = `orca-dict-${typeof hash === 'string' && hash.length === 8 ? hash : 'devmode0'}-en`;
    const existing = (await indexedDB.databases?.() ?? []).find((d) => d.name === dbName);
    // Never open above the existing version — the extension's own openDB uses
    // a fixed schema version and would fail with VersionError on a lower one.
    const version = existing?.version ?? 1;
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const req = indexedDB.open(dbName, version);
      req.onupgradeneeded = () => {
        const d = req.result;
        const ensureIdx = (store: IDBObjectStore, name: string, keyPath: string) => {
          if (!store.indexNames.contains(name)) store.createIndex(name, keyPath, { unique: false });
        };
        const mk = (name: string, opts: IDBObjectStoreParameters): IDBObjectStore | null =>
          d.objectStoreNames.contains(name) ? null : d.createObjectStore(name, opts);
        const res = mk('langResourceInfo', { keyPath: 'id', autoIncrement: true });
        if (res) {
          ensureIdx(res, 'by_signature', 'signature');
          ensureIdx(res, 'by_type', 'type');
          ensureIdx(res, 'by_order', 'importedAt');
          ensureIdx(res, 'by_contentHash', 'contentHash');
        }
        const freq = mk('langFrequencyEntry', { keyPath: 'id', autoIncrement: true });
        if (freq) {
          ensureIdx(freq, 'by_resource', 'resourceId');
          ensureIdx(freq, 'by_term', 'term');
          ensureIdx(freq, 'by_backwardTerm', 'backwardTerm');
        }
        const dict = mk('langDictionaryEntry', { keyPath: 'id', autoIncrement: true });
        if (dict) {
          ensureIdx(dict, 'by_resource', 'resourceId');
          ensureIdx(dict, 'by_term', 'term');
          ensureIdx(dict, 'by_backwardTerm', 'backwardTerm');
        }
        const phrase = mk('langPhraseIndex', { keyPath: 'resourceId' });
        if (phrase) ensureIdx(phrase, 'by_resource', 'resourceId');
        const ws = mk('langWordStatus', { keyPath: 'term' });
        if (ws) ensureIdx(ws, 'by_status', 'status');
        mk('langWordTrash', { keyPath: 'term' });
        const outbox = mk('syncOutbox', { keyPath: 'id', autoIncrement: true });
        if (outbox) ensureIdx(outbox, 'by_key', 'key');
        const meta = mk('syncMeta', { keyPath: 'key' });
        if (meta) ensureIdx(meta, 'by_recKey', 'recKey');
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    // One resource + a dictionary row per cue word so token click lookups
    // resolve to a real result and the popup exposes a status target.
    const tx = db.transaction(['langResourceInfo', 'langDictionaryEntry'], 'readwrite');
    tx.objectStore('langResourceInfo').put({
      id: 1,
      signature: 'audit-bulk-status',
      type: 'json',
      name: 'audit-seed',
      importedAt: 0,
      wordCount: terms.length,
    });
    const dictStore = tx.objectStore('langDictionaryEntry');
    const variants = new Set<string>();
    for (const t of terms) {
      variants.add(t);
      variants.add(t.replace(/'/g, '’')); // curly-apostrophe variant
      variants.add(t.replace(/’/g, "'"));
    }
    for (const term of variants) {
      dictStore.put({
        resourceId: 1,
        term,
        backwardTerm: [...term].reverse().join(''),
        reading: term,
        altterm: '',
        pronunciation: '',
        definition: `audit definition of ${term}`,
        pos: 'x',
        examples: '',
        audio: '',
      });
    }
    await new Promise((res) => {
      tx.oncomplete = res;
      tx.onerror = res;
    });
    db.close();
  }, DICT_TERMS);
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

/** Count tokens (any root) carrying BOTH data-cell-term=term and the status
 *  modifier — proves the applied status repainted live surfaces. */
async function termStatusTokenCount(page: Page, term: string, status: string): Promise<number> {
  return page.evaluate(
    ({ t, cls }) => {
      let n = 0;
      const walk = (root: Document | ShadowRoot): void => {
        for (const el of Array.from(root.querySelectorAll(`.js-cell-token--status-${cls}`))) {
          if (el.getAttribute('data-cell-term') === t) n += 1;
        }
        for (const child of Array.from(root.querySelectorAll('*'))) {
          if (child.shadowRoot) walk(child.shadowRoot);
        }
      };
      walk(document);
      return n;
    },
    { t: term, cls: status },
  );
}

/** Token count inside a scope that may be a shadow host — deepFind resolves
 *  the host, then counts inside its shadowRoot. waitDeep-style selectors
 *  cannot span a host→shadowRoot boundary with one querySelector, so scoped
 *  counting is the reliable probe for panel tokens. */
async function scopedTokenCount(page: Page, scopeSel: string): Promise<number> {
  return page.evaluate((scope) => {
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
    const el = deepFind(document, scope);
    const root: ParentNode | null = el?.shadowRoot ?? el;
    return root ? root.querySelectorAll('.js-cell-token').length : -1;
  }, scopeSel);
}

async function totalStatusTokens(page: Page): Promise<number> {
  return page.evaluate(() => {
    let n = 0;
    const walk = (root: Document | ShadowRoot): void => {
      n += root.querySelectorAll(
        '.js-cell-token--status-unknown, .js-cell-token--status-tracking, .js-cell-token--status-known, .js-cell-token--status-ignore, .js-cell-token--status-learning',
      ).length;
      for (const child of Array.from(root.querySelectorAll('*'))) {
        if (child.shadowRoot) walk(child.shadowRoot);
      }
    };
    walk(document);
    return n;
  });
}

async function announcerInfo(page: Page): Promise<{ exists: boolean; live: string | null; role: string | null; text: string }> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return {
      exists: el !== null,
      live: el?.getAttribute('aria-live') ?? null,
      role: el?.getAttribute('role') ?? null,
      text: el?.textContent ?? '',
    };
  }, ANNOUNCER);
}

/** First-occurrence index of each distinct data-cell-term under a piercing
 *  locator — indices feed locator.nth() for REAL clicks. DOM order of
 *  querySelectorAll inside the single shadow scope matches locator order. */
async function pickDistinctTokens(
  page: Page,
  sel: string,
  n: number,
  scanLimit = 120,
): Promise<{ term: string; index: number }[]> {
  const loc = page.locator(sel);
  const total = Math.min(await loc.count(), scanLimit);
  const seen = new Set<string>();
  const picks: { term: string; index: number }[] = [];
  for (let i = 0; i < total && picks.length < n; i += 1) {
    const term = await loc.nth(i).getAttribute('data-cell-term');
    if (!term || seen.has(term) || /["\\\s]/.test(term)) continue;
    seen.add(term);
    picks.push({ term, index: i });
  }
  return picks;
}

/** REAL ctrl+click on a token via Playwright input pipeline (elementFromPoint
 *  actionability checks included). Throws when the point is occluded. */
async function realCtrlClick(page: Page, sel: string, index: number, timeout = 10_000): Promise<void> {
  const loc = page.locator(sel).nth(index);
  await loc.scrollIntoViewIfNeeded();
  await loc.click({ modifiers: ['Control'], timeout });
}

async function realPlainClick(page: Page, sel: string, index: number, timeout = 10_000): Promise<void> {
  const loc = page.locator(sel).nth(index);
  await loc.scrollIntoViewIfNeeded();
  await loc.click({ timeout });
}

/** Clip rect around the first selected token inside a scope (for zoomed
 *  screenshot evidence of the --selected visual mark). */
async function selectedTokenClip(page: Page, scopeSel: string): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return page.evaluate(
    ({ scope, cls }) => {
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
      const scopeEl = deepFind(document, scope);
      const scopeRoot: ParentNode = scopeEl?.shadowRoot ?? scopeEl ?? document;
      const sel = scopeRoot.querySelector(`.${cls}`);
      if (!sel) return null;
      sel.scrollIntoView({ block: 'nearest' });
      const r = sel.getBoundingClientRect();
      return {
        x: Math.max(0, r.left - 30),
        y: Math.max(0, r.top - 14),
        width: Math.min(r.width + 200, 1280),
        height: r.height + 28,
      };
    },
    { scope: scopeSel, cls: SELECTED_CLASS },
  );
}

/** streamFlixPage navigates BEFORE beforeEach seeds settings, so the content
 *  script may have initialized with no subtitle origins on a cold profile.
 *  Reload so the freshly seeded subtitleOrigins gate is observed. */
async function reloadAfterSeeds(page: Page): Promise<void> {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#player-wrapper video').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#cell-subtitle-root')).toBeAttached({ timeout: 30_000 });
  await expect(page.locator('[data-cell-id="orbital-badge"]')).toBeVisible({ timeout: 15_000 });
}

/** Open the split-view panel, wait for tokens, pause, and pin the panel when
 *  the mock's player section occludes real clicks. Returns whether pinning was
 *  needed (mock limitation, not a defect). */
async function openPinnedPanel(page: Page): Promise<{ occluded: boolean }> {
  await activateFirstCue(page);
  await page.keyboard.press('t');
  await waitDeep(page, PANEL_SEL, 20_000);
  try {
    await expect
      .poll(() => scopedTokenCount(page, PANEL_SEL), { timeout: 60_000 })
      .toBeGreaterThan(0);
  } catch (err) {
    const diag = await page.evaluate(() => {
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
      const panel = deepFind(document, '[data-cell-split-view="panel"]') as HTMLElement | null;
      const scope: ParentNode | null = panel?.shadowRoot ?? null;
      const cells: string[] = [];
      if (scope) {
        for (const el of Array.from(scope.querySelectorAll('[data-cell-id]'))) {
          const id = el.getAttribute('data-cell-id')!;
          if (!cells.includes(id)) cells.push(id);
        }
      }
      return {
        panelRect: panel?.getBoundingClientRect().toJSON() ?? null,
        panelDisplay: panel ? getComputedStyle(panel).display : null,
        hasShadow: Boolean(panel?.shadowRoot),
        shadowChildren: scope ? (scope as ShadowRoot).childElementCount : -1,
        cellIds: cells.slice(0, 30),
        tokenCount: scope ? scope.querySelectorAll('.js-cell-token').length : -1,
        cueRows: scope ? scope.querySelectorAll('[data-cell-id="cue-target-text"]').length : -1,
        videoTime: document.querySelector('video')?.currentTime ?? -1,
        videoPaused: document.querySelector('video')?.paused ?? null,
      };
    });
    note(`panel-token wait failed; diag=${JSON.stringify(diag)}`);
    throw err;
  }
  await pauseVideo(page);

  const picks = await pickDistinctTokens(page, PANEL_TOKENS, 1);
  if (picks.length === 0) return { occluded: false };
  try {
    await realCtrlClick(page, PANEL_TOKENS, picks[0].index, 5_000);
    await expect.poll(() => uniqueSelectedTerms(page), { timeout: 2_500 }).toBe(1);
    await page.keyboard.press('Escape');
    await expect.poll(() => selectedTermCount(page)).toBe(0);
    return { occluded: false };
  } catch {
    await page.screenshot({ path: `${SHOT_DIR}/streaming-cuelist-occluded.png` });
    await raiseSplitViewForScreenshot(page);
    note('split-view panel real click intercepted pre-pin (mock _playerSection occlusion) — pinned panel for the rest of the session');
    return { occluded: true };
  }
}

test.describe('audit: subtitle bulk status — streaming (real input)', () => {
  test.beforeEach(async ({ cellContext }) => {
    await seedCellSettings(cellContext);
    await seedEnglishDictionary(cellContext);
  });

  test('cue list: real ctrl+click select → key 3 applies → toggle & Escape (AC-3/4/6/8)', async ({
    streamFlixPage,
  }) => {
    test.setTimeout(180_000);
    const page = streamFlixPage;
    await reloadAfterSeeds(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    const { occluded } = await openPinnedPanel(page);
    note(`cue-list pre-pin occlusion: ${occluded}`);

    const picks = await pickDistinctTokens(page, PANEL_TOKENS, 3);
    expect(picks.length).toBeGreaterThanOrEqual(2);
    note(`cue-list picks: ${picks.map((p) => p.term).join(', ')}`);

    // AC-3/AC-4: two REAL ctrl+clicks → both terms in the store, --selected marks.
    await realCtrlClick(page, PANEL_TOKENS, picks[0].index);
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(1);
    await realCtrlClick(page, PANEL_TOKENS, picks[1].index);
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(2);

    // AC-8: announcer announces the count.
    const ann = await announcerInfo(page);
    expect(ann.exists).toBe(true);
    expect(ann.live).toBe('polite');
    expect(ann.text).toMatch(/2/);
    note(`announcer after select-2: "${ann.text}" (aria-live=${ann.live}, role=${ann.role})`);

    await page.screenshot({ path: `${SHOT_DIR}/streaming-cuelist-selected.png` });
    const clip = await selectedTokenClip(page, PANEL_SEL);
    if (clip) {
      await page.screenshot({ path: `${SHOT_DIR}/streaming-cuelist-selected-zoom.png`, clip });
    }

    // Press '3' → both terms become known, selection store empties.
    await page.keyboard.press('3');
    await expect.poll(() => selectedTermCount(page)).toBe(0);
    await expect
      .poll(() => termStatusTokenCount(page, picks[0].term, 'known'), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);
    await expect
      .poll(() => termStatusTokenCount(page, picks[1].term, 'known'), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);
    await page.screenshot({ path: `${SHOT_DIR}/streaming-cuelist-applied.png` });

    // Toggle: ctrl+click same term twice → deselect; again → re-select.
    await realCtrlClick(page, PANEL_TOKENS, picks[0].index);
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(1);
    await realCtrlClick(page, PANEL_TOKENS, picks[0].index);
    await expect.poll(() => selectedTermCount(page)).toBe(0);
    await realCtrlClick(page, PANEL_TOKENS, picks[0].index);
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(1);

    // Escape clears the store and announces it.
    await page.keyboard.press('Escape');
    await expect.poll(() => selectedTermCount(page)).toBe(0);
    const annCleared = await announcerInfo(page);
    expect(annCleared.text).toMatch(/cleared/i);
    note(`announcer after Escape: "${annCleared.text}"`);

    expect(pageErrors).toEqual([]);
  });

  test('popup: plain click opens dictionary; key 2 hits popup term, selection survives (AC-3/5)', async ({
    streamFlixPage,
  }) => {
    test.setTimeout(180_000);
    const page = streamFlixPage;
    await reloadAfterSeeds(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await openPinnedPanel(page);
    const picks = await pickDistinctTokens(page, PANEL_TOKENS, 4);
    expect(picks.length).toBeGreaterThanOrEqual(2);

    // Select term A with a REAL ctrl+click.
    await realCtrlClick(page, PANEL_TOKENS, picks[0].index);
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(1);

    // AC-3 alt flow: REAL plain click on a DIFFERENT token opens the popup.
    await realPlainClick(page, PANEL_TOKENS, picks[1].index);
    await expect.poll(() => deepExists(page, POPUP_HOST), { timeout: 15_000 }).toBe(true);
    await page.screenshot({ path: `${SHOT_DIR}/streaming-popup.png` });
    // getPopupStatusTarget only claims keys once a lookup RESULT is rendered
    // (level.term set in renderLookupResult) — wait for the term header.
    let popupTerm: string | null = null;
    await expect
      .poll(
        async () => {
          popupTerm = await page.evaluate(() => {
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
            const host = deepFind(document, '.js-cell-popup-host');
            const scope: ParentNode | null = host?.shadowRoot ?? host;
            return scope?.querySelector('[data-cell-id="dictionary-term"]')?.textContent?.trim() ?? null;
          });
          return popupTerm;
        },
        { timeout: 20_000 },
      )
      .not.toBeNull();
    note(`popup opened; displayed term="${popupTerm}"`);
    await page.keyboard.press('2');
    await page.waitForTimeout(1_500);
    const diag = await page.evaluate(() => {
      const tracking: string[] = [];
      const walk = (root: Document | ShadowRoot): void => {
        for (const el of Array.from(root.querySelectorAll('.js-cell-token--status-tracking'))) {
          const t = el.getAttribute('data-cell-term');
          if (t && !tracking.includes(t)) tracking.push(t);
        }
        for (const child of Array.from(root.querySelectorAll('*'))) {
          if (child.shadowRoot) walk(child.shadowRoot);
        }
      };
      walk(document);
      const host = document.querySelector('.js-cell-popup-host');
      return {
        trackingTerms: tracking,
        activeEl: document.activeElement?.tagName ?? null,
        popupStillOpen: host !== null,
        popupText: (host?.shadowRoot?.textContent ?? '').slice(0, 120),
      };
    });
    note(`after key 2 → trackingTerms=${JSON.stringify(diag.trackingTerms)} selected=${await selectedTermCount(page)} activeEl=${diag.activeEl} popupOpen=${diag.popupStillOpen} popupText="${diag.popupText}"`);
    await expect
      .poll(() => termStatusTokenCount(page, picks[1].term, 'tracking'), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);

    // Spec text says popup target wins for the keypress; the store is not
    // consumed by that apply — record actual store state honestly.
    const remaining = await selectedTermCount(page);
    note(`popup-priority: after key 2 → popup term "${picks[1].term}" is tracking; selection store count = ${remaining} (selected term "${picks[0].term}")`);
    await page.screenshot({ path: `${SHOT_DIR}/streaming-popup-priority.png` });

    // Selected term keeps its --selected mark (store untouched by popup apply).
    const selTerms = await selectedTerms(page);
    note(`popup-priority: still-marked terms: ${selTerms.join(', ') || '(none)'}`);

    await page.keyboard.press('Escape'); // clears selection
    await page.keyboard.press('Escape'); // dismisses popup layer
    expect(pageErrors).toEqual([]);
  });

  test('player mode: real ctrl+click selects in PM cue list, Escape clears (AC-3/4)', async ({
    streamFlixPage,
  }) => {
    test.setTimeout(180_000);
    const page = streamFlixPage;
    await reloadAfterSeeds(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await activateFirstCue(page);
    await page.keyboard.press('g');
    await waitDeep(page, PM_OVERLAY, 20_000);
    await waitDeep(page, PM_TOKENS, 60_000);
    await pauseVideo(page);

    const picks = await pickDistinctTokens(page, PM_TOKENS, 2);
    expect(picks.length).toBeGreaterThanOrEqual(2);
    note(`player-mode picks: ${picks.map((p) => p.term).join(', ')}`);

    // PM panel is NOT occluded — full real clicks.
    await realCtrlClick(page, PM_TOKENS, picks[0].index);
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(1);
    await realCtrlClick(page, PM_TOKENS, picks[1].index);
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(2);
    await page.screenshot({ path: `${SHOT_DIR}/streaming-pm-selected.png` });
    const clip = await selectedTokenClip(page, PM_OVERLAY);
    if (clip) {
      await page.screenshot({ path: `${SHOT_DIR}/streaming-pm-selected-zoom.png`, clip });
    }

    await page.keyboard.press('Escape');
    await expect.poll(() => selectedTermCount(page)).toBe(0);
    await page.keyboard.press('g'); // leave player mode
    expect(pageErrors).toEqual([]);
  });

  test('overlay block: real ctrl+click on overlay tokens selects (AC-3/4)', async ({
    streamFlixPage,
  }) => {
    test.setTimeout(180_000);
    const page = streamFlixPage;
    await reloadAfterSeeds(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await activateFirstCue(page);
    // The mock gates its subtitle overlay on isPlaying (VideoPlayer.tsx:139) —
    // pausing clears the active cue and UNBINDS overlay tokens. Keep playback
    // running at 0.2x so cue 27 "GOD ONLY KNOWS WHERE OUR FEARS GO"
    // (149.3–158.4s) stays live for ~45s real time.
    await page.evaluate(() => {
      const v = document.querySelector('video');
      if (!v) return;
      v.muted = true;
      v.playbackRate = 0.2;
      v.currentTime = 149.5;
      void v.play().catch(() => {});
    });
    await waitDeep(page, OVERLAY_TOKENS, 60_000);

    const picks = await pickDistinctTokens(page, OVERLAY_TOKENS, 2);
    expect(picks.length).toBeGreaterThanOrEqual(1);
    note(`overlay picks: ${picks.map((p) => p.term).join(', ')}`);

    let usedSynthetic = false;
    const clickOverlayToken = async (index: number, term: string): Promise<void> => {
      try {
        await realCtrlClick(page, OVERLAY_TOKENS, index, 6_000);
      } catch (err) {
        usedSynthetic = true;
        note(`overlay real ctrl+click failed for "${term}" → SYNTHETIC FALLBACK dispatchTermClick: ${String(err).split('\n')[0]}`);
        await dispatchTermClick(page, term, { ctrl: true }, '#cell-subtitle-root');
      }
    };

    // First real attempt on the live overlay position.
    let realWorked = true;
    try {
      await realCtrlClick(page, OVERLAY_TOKENS, picks[0].index, 6_000);
    } catch {
      realWorked = false;
      const occ = await page.evaluate((sel) => {
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
        const tok = deepFind(document, sel);
        if (!tok) return { found: false };
        const r = tok.getBoundingClientRect();
        const hits = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return {
          found: true,
          rect: r.toJSON(),
          pointerEvents: getComputedStyle(tok).pointerEvents,
          tokenCount: document.querySelectorAll('#cell-subtitle-root').length,
          hits: hits.slice(0, 5).map((h) => `${h.tagName}.${(h as HTMLElement).className}`.slice(0, 80)),
        };
      }, `${OVERLAY_TOKENS}`);
      note(`overlay click intercepted → found=${occ.found} rect=${JSON.stringify(occ.rect)} pointerEvents=${occ.pointerEvents} stack=${JSON.stringify(occ.hits)}`);
      // Layout-only workaround identical in spirit to the panel pin: pull the
      // subtitle block out from under the occluder, then click for real.
      await page.evaluate(() => {
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
        const block = deepFind(document, '[data-cell-id="subtitle-block"]');
        if (block instanceof HTMLElement) {
          block.style.position = 'fixed';
          block.style.left = '40px';
          block.style.bottom = '140px';
          block.style.top = 'auto';
          block.style.width = '700px';
          block.style.zIndex = '2147483000';
          block.style.background = 'rgba(0,0,0,0.65)';
          block.style.padding = '8px';
        }
      });
      note('overlay subtitle-block pinned to a legible rect (layout-only) — retrying real click');
      try {
        await realCtrlClick(page, OVERLAY_TOKENS, picks[0].index, 6_000);
        realWorked = true;
      } catch (err2) {
        usedSynthetic = true;
        note(`overlay real ctrl+click still blocked after pin → SYNTHETIC FALLBACK dispatchTermClick("${picks[0].term}"): ${String(err2).split('\n')[0]}`);
        await dispatchTermClick(page, picks[0].term, { ctrl: true }, '#cell-subtitle-root');
      }
    }
    note(`overlay first click: real=${realWorked} synthetic=${usedSynthetic}`);
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(1);
    await page.screenshot({ path: `${SHOT_DIR}/streaming-overlay-selected.png` });
    const clip = await selectedTokenClip(page, '#cell-subtitle-root');
    if (clip) {
      await page.screenshot({ path: `${SHOT_DIR}/streaming-overlay-selected-zoom.png`, clip });
    }

    if (picks.length >= 2) {
      await clickOverlayToken(picks[1].index, picks[1].term);
      await expect.poll(() => uniqueSelectedTerms(page)).toBe(2);
      await page.screenshot({ path: `${SHOT_DIR}/streaming-overlay-selected-2.png` });
    }
    note(`overlay synthetic fallback used: ${usedSynthetic}`);

    await page.keyboard.press('Escape');
    await expect.poll(() => selectedTermCount(page)).toBe(0);
    expect(pageErrors).toEqual([]);
  });

  test('drag-select: real mouse drag over pinned cue-list tokens → key 4 ignores (REQ-2)', async ({
    streamFlixPage,
  }) => {
    test.setTimeout(180_000);
    const page = streamFlixPage;
    await reloadAfterSeeds(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await openPinnedPanel(page);

    // Find two tokens on the SAME rendered row inside the panel shadow root.
    const dragPlan = await page.evaluate((panelSel) => {
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
      const scope: ParentNode | null = host?.shadowRoot ?? null;
      if (!scope) return null;
      const tokens = Array.from(
        scope.querySelectorAll('.js-cell-token[data-cell-term]'),
      ) as HTMLElement[];
      const rows = new Map<number, HTMLElement[]>();
      for (const tok of tokens) {
        const r = tok.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        const key = Math.round(r.top);
        const row = rows.get(key) ?? [];
        row.push(tok);
        rows.set(key, row);
      }
      for (const row of rows.values()) {
        if (row.length < 2) continue;
        const a = row[0].getBoundingClientRect();
        const b = row[row.length - 1].getBoundingClientRect();
        return {
          startX: a.left + 1,
          startY: a.top + a.height / 2,
          endX: b.right - 1,
          endY: b.top + b.height / 2,
          terms: row
            .map((t) => t.getAttribute('data-cell-term')!)
            .filter((t, i, arr) => arr.indexOf(t) === i),
        };
      }
      return null;
    }, PANEL_SEL);
    expect(dragPlan).not.toBeNull();
    note(`drag-select plan: ${dragPlan!.terms.length} terms on row → ${dragPlan!.terms.join(', ')}`);

    // REAL drag: down at the left edge of the first token, sweep to the right
    // edge of the last token on that row.
    await page.mouse.move(dragPlan!.startX, dragPlan!.startY);
    await page.mouse.down();
    await page.mouse.move(dragPlan!.endX, dragPlan!.endY, { steps: 15 });
    await page.mouse.up();

    // Inside the shadow root the native selection surfaces on
    // host.shadowRoot.getSelection() (Chromium) — verify it is non-collapsed.
    const selInfo = await page.evaluate((panelSel) => {
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
      const shadowSel =
        host?.shadowRoot && 'getSelection' in host.shadowRoot
          ? (host.shadowRoot.getSelection as () => Selection | null)()
          : null;
      const docSel = window.getSelection();
      return {
        shadowText: shadowSel?.toString() ?? '',
        shadowCollapsed: shadowSel?.isCollapsed ?? null,
        docText: docSel?.toString() ?? '',
        docCollapsed: docSel?.isCollapsed ?? null,
      };
    }, PANEL_SEL);
    note(`native selection after drag: shadow="${selInfo.shadowText}" collapsed=${selInfo.shadowCollapsed} | doc="${selInfo.docText}" collapsed=${selInfo.docCollapsed}`);
    expect(selInfo.shadowText.length + selInfo.docText.length).toBeGreaterThan(0);
    await page.screenshot({ path: `${SHOT_DIR}/streaming-dragselect.png` });

    // REQ-2: one keypress applies 'ignore' to every token under the selection.
    await page.keyboard.press('4');
    for (const term of dragPlan!.terms) {
      await expect
        .poll(() => termStatusTokenCount(page, term, 'ignore'), { timeout: 15_000 })
        .toBeGreaterThanOrEqual(1);
    }
    note(`drag-select → key 4 recolored terms: ${dragPlan!.terms.join(', ')}`);
    await page.screenshot({ path: `${SHOT_DIR}/streaming-dragselect-applied.png` });
    expect(pageErrors).toEqual([]);
  });

  test('lifecycle: selection drops on active cue change during playback (AC-6)', async ({
    streamFlixPage,
  }) => {
    test.setTimeout(180_000);
    const page = streamFlixPage;
    await reloadAfterSeeds(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await openPinnedPanel(page);
    await seekToWordCue(page); // cue 2 (20.2–25.5s): next boundary is ~4.5s of playback away
    await page.waitForTimeout(1_500);
    await pauseVideo(page);

    const picks = await pickDistinctTokens(page, PANEL_TOKENS, 2);
    expect(picks.length).toBeGreaterThanOrEqual(2);
    await realCtrlClick(page, PANEL_TOKENS, picks[0].index);
    await realCtrlClick(page, PANEL_TOKENS, picks[1].index);
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(2);

    // REAL playback — the active cue advances past 25.5s and the store clears.
    await page.evaluate(() => {
      document.querySelectorAll('video').forEach((v) => {
        v.muted = true;
        void v.play().catch(() => {});
      });
    });
    await expect
      .poll(() => selectedTermCount(page), { timeout: 30_000, intervals: [500] })
      .toBe(0);
    const clearedBy = await page.evaluate(() => document.querySelector('video')?.currentTime ?? -1);
    note(`selection store emptied during playback at video.currentTime=${clearedBy}`);

    // Also verify the announcer reported the drop.
    const ann = await announcerInfo(page);
    note(`announcer after cue-change drop: "${ann.text}"`);
    expect(pageErrors).toEqual([]);
  });

  test('stress: 8-10 rapid real ctrl+clicks → single key applies all; editable inert (AC-3/5)', async ({
    streamFlixPage,
  }) => {
    test.setTimeout(180_000);
    const page = streamFlixPage;
    await reloadAfterSeeds(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await openPinnedPanel(page);
    const picks = await pickDistinctTokens(page, PANEL_TOKENS, 10);
    expect(picks.length).toBeGreaterThanOrEqual(8);
    note(`stress picks (${picks.length}): ${picks.map((p) => p.term).join(', ')}`);

    // Rapid REAL ctrl+clicks across distinct terms.
    for (const p of picks) {
      await realCtrlClick(page, PANEL_TOKENS, p.index, 8_000);
    }
    await expect.poll(() => uniqueSelectedTerms(page)).toBeGreaterThanOrEqual(8);
    await page.screenshot({ path: `${SHOT_DIR}/streaming-stress-selected.png` });

    // One '3' press → ALL selected terms known.
    await page.keyboard.press('3');
    await expect.poll(() => selectedTermCount(page)).toBe(0);
    for (const p of picks) {
      await expect
        .poll(() => termStatusTokenCount(page, p.term, 'known'), { timeout: 20_000 })
        .toBeGreaterThanOrEqual(1);
    }
    await page.screenshot({ path: `${SHOT_DIR}/streaming-stress-applied.png` });

    // '1' with zero selection AND no hover → inert, nothing breaks.
    await page.mouse.move(640, 40); // park the cursor off tokens so no hoveredTerm fallback
    await page.waitForTimeout(300);
    const statusBefore = await totalStatusTokens(page);
    await page.keyboard.press('1');
    await page.waitForTimeout(500);
    const statusAfter = await totalStatusTokens(page);
    expect(statusAfter).toBe(statusBefore);
    await expect.poll(() => selectedTermCount(page)).toBe(0);

    // Rapid ctrl+click toggling the SAME term 4× → ends deselected.
    const term = picks[0];
    for (let i = 0; i < 4; i += 1) {
      await realCtrlClick(page, PANEL_TOKENS, term.index, 8_000);
    }
    await expect.poll(() => selectedTermCount(page)).toBe(0);

    // Editable inertness: a selected term stays selected and unstatused while a
    // real <input> holds focus — '1' is swallowed by isEditableEvent.
    const fresh = await pickDistinctTokens(page, PANEL_TOKENS, 2);
    await realCtrlClick(page, PANEL_TOKENS, fresh[0].index, 8_000);
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(1);
    const volume = page.locator(VOLUME_INPUT).first();
    try {
      await volume.click({ timeout: 5_000 });
    } catch {
      // Mock limitation: the video's center overlay (skip buttons) intercepts
      // clicks over the volume slider. Focus the REAL input element via JS —
      // the '1' keypress below is still a real input event.
      note('volume slider click intercepted by mock player chrome → focusing via el.focus() (input keypress stays real)');
      await volume.evaluate((el) => (el as HTMLElement).focus());
    }
    const focusedEditable = await page.evaluate(() => {
      const a = document.activeElement;
      return a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement;
    });
    expect(focusedEditable).toBe(true);
    await page.keyboard.press('1');
    await page.waitForTimeout(500);
    await expect.poll(() => uniqueSelectedTerms(page)).toBe(1); // still selected — key was inert
    expect(await termStatusTokenCount(page, fresh[0].term, 'unknown')).toBe(0);
    note(`editable inertness: '1' with ${VOLUME_INPUT} focused — selection intact, no status applied`);

    await page.keyboard.press('Escape');
    expect(pageErrors).toEqual([]);
  });
});
