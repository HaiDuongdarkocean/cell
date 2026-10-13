import { expect, type BrowserContext, type Page } from '@playwright/test';
import { test } from '../fixtures/TihokaEnvironment.fixture';

const OUT = 'tmp/backlog7-audit/img';
const VIDEO = '#player-wrapper video';


async function seedOverlaySettings(context: BrowserContext): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(() => {
    const subtitleUrls: Record<string, boolean> = {};
    for (const key of ['http://127.0.0.1:4321/', 'http://127.0.0.1:4321/index.html']) {
      subtitleUrls[key] = true;
    }
    return new Promise<void>((resolve, reject) => {
      chrome.storage.local.set(
        {
          settings: { schemaVersion: 29, subtitleOverlayTargetLanguage: 'en' },
          tokenizeSettings: { schemaVersion: 1, origins: {}, urls: {}, subtitleUrls },
        },
        () =>
          chrome.runtime.lastError
            ? reject(new Error(String(chrome.runtime.lastError.message)))
            : resolve(),
      );
    });
  });
}

async function writeStudyModes(context: BrowserContext, activeModeId: string): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate((id) => {
    const studyModes = {
      version: 1,
      activeModeId: id,
      customModes: [],
      advanced: { skipNoDialogue: 'OFF', removeBracketed: false },
    };
    return new Promise<void>((resolve, reject) => {
      chrome.storage.local.set({ studyModes }, () =>
        chrome.runtime.lastError
          ? reject(new Error(String(chrome.runtime.lastError.message)))
          : resolve(),
      );
    });
  }, activeModeId);
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

function panelQuery(page: Page) {
  return {
    count: (sel: string) =>
      page.evaluate(
        (s) =>
          document
            .querySelector('[data-tihoka-split-view="panel"]')
            ?.shadowRoot?.querySelectorAll(s).length ?? -1,
        sel,
      ),
    text: (sel: string) =>
      page.evaluate(
        (s) =>
          document
            .querySelector('[data-tihoka-split-view="panel"]')
            ?.shadowRoot?.querySelector(s)
            ?.textContent?.trim() ?? null,
        sel,
      ),
    click: (sel: string) =>
      page.evaluate((s) => {
        const panel = document.querySelector('[data-tihoka-split-view="panel"]');
        const el = panel?.shadowRoot?.querySelector<HTMLElement>(s);
        if (!el) return false;
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
        return true;
      }, sel),
    eval: <R>(fn: (root: ShadowRoot | null) => R) =>
      page.evaluate(
        (f) => {
          const panel = document.querySelector('[data-tihoka-split-view="panel"]');
          const fnBody = new Function(`return (${f})`)() as (r: ShadowRoot | null) => R;
          return fnBody(panel?.shadowRoot ?? null);
        },
        fn.toString(),
      ),
  };
}

async function collectCueTerms(page: Page): Promise<{ cueKey: string; terms: string[] }[]> {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-tihoka-split-view="panel"]');
    const root = panel?.shadowRoot;
    if (!root) return [];
    const items = [...root.querySelectorAll('[data-tihoka-id="cue-item"]')];
    return items.map((item) => {
      const start = item.getAttribute('data-cue-start') ?? '?';
      const terms = [...item.querySelectorAll('.js-Tihoka-token[data-tihoka-term]')]
        .map((t) => (t.getAttribute('data-tihoka-term') ?? '').toLowerCase())
        .filter(Boolean);
      return { cueKey: start, terms };
    });
  });
}

async function seedStatuses(
  context: BrowserContext,
  entries: { term: string; status: string }[],
): Promise<number> {
  const page = context.pages().find((p) => p.url().includes('local-player'));
  if (!page) return -1;
  return page.evaluate(async (rows) => {
    let ok = 0;
    for (const r of rows) {
      try {
        const res = await chrome.runtime.sendMessage({
          type: 'WORD_STATUS_SET',
          payload: { term: r.term, langCode: 'en', status: r.status },
        });
        if (res?.success) ok++;
      } catch {
        // count failures via ok
      }
    }
    return ok;
  }, entries);
}

async function playFrom(page: Page, t: number): Promise<void> {
  const video = page.locator(VIDEO).first();
  await video.evaluate((v: HTMLVideoElement, time) => {
    v.muted = true;
    v.currentTime = time;
    void v.play();
  }, t);
}

async function pauseAt(page: Page, t: number): Promise<void> {
  const video = page.locator(VIDEO).first();
  await video.evaluate((v: HTMLVideoElement, time) => {
    v.muted = true;
    v.pause();
    v.currentTime = time;
  }, t);
}

test.describe('Stage 2: Backlog-7 features audit on StreamFlix', () => {
  test('full journey: tokenize → heat + FAB + adaptive + i1-replay → local player', async ({
    TihokaContext,
    streamFlixPage: page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

    await seedOverlaySettings(TihokaContext);
    await writeStudyModes(TihokaContext, 'normal');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#Tihoka-subtitle-root')).toBeAttached({ timeout: 30_000 });
    await pauseAt(page, 20.6);

    const panel = panelQuery(page);

    await test.step('open split view + wait for tokenize/cues', async () => {
      await page.keyboard.press('t');
      await expect(page.locator('[data-tihoka-split-view="panel"]')).toBeVisible({
        timeout: 15_000,
      });
      await expect
        .poll(() => panel.count('[data-tihoka-id="cue-item"]'), { timeout: 30_000 })
        .toBeGreaterThan(0);
      await expect
        .poll(() => panel.count('.js-Tihoka-token[data-tihoka-term]'), { timeout: 30_000 })
        .toBeGreaterThan(0);
      await shot(page, '01-split-view-cues');
    });

    const cueTerms = await collectCueTerms(page);
    console.log(`[audit] cues=${cueTerms.length}`);
    console.log(
      `[audit] cue terms sample: ${JSON.stringify(cueTerms.slice(0, 5).map((c) => ({ k: c.cueKey, n: c.terms.length, t: c.terms.slice(0, 8) })))}`,
    );

    await test.step('seed mixed statuses so bands vary', async () => {
      const lp = await TihokaContext.newPage();
      const sw = TihokaContext.serviceWorkers()[0];
      const extId = new URL(sw?.url() ?? (await TihokaContext.waitForEvent('serviceworker').then((w) => w.url()))).host;
      await lp.goto(`chrome-extension://${extId}/src/entrypoints/local-player/index.html`);
      await lp.waitForLoadState('domcontentloaded');

      const allTerms = [...new Set(cueTerms.flatMap((c) => c.terms))];
      const keepUnknown = new Set<string>();
      let i1Made = 0;
      for (const cue of cueTerms) {
        const uniq = [...new Set(cue.terms)];
        if (i1Made < 4 && uniq.length >= 4) {
          for (const t of uniq.slice(0, 2)) keepUnknown.add(t);
          i1Made++;
        }
      }
      const denseKeep = new Set<string>();
      for (const cue of cueTerms.slice(0, 6)) {
        for (const t of [...new Set(cue.terms)]) denseKeep.add(t);
      }
      const rows = allTerms.map((term) => ({
        term,
        status: keepUnknown.has(term) ? 'unknown' : denseKeep.has(term) ? 'unknown' : 'known',
      }));
      const ok = await seedStatuses(TihokaContext, rows);
      console.log(`[audit] WORD_STATUS_SET ok=${ok}/${rows.length}`);
      await page.waitForTimeout(2000);
      console.log(
        `[audit] statuses seeded: total=${allTerms.length} unknown=${rows.filter((r) => r.status === 'unknown').length}`,
      );
    });

    await test.step('cue-difficulty-map: heat bars render', async () => {
      const heat = await panel.eval((root) => {
        if (!root) return null;
        const items = [...root.querySelectorAll('[data-tihoka-id="cue-item"]')];
        const dist: Record<string, number> = {};
        for (const it of items) {
          const h = it.getAttribute('data-heat') ?? 'none';
          dist[h] = (dist[h] ?? 0) + 1;
        }
        const bars = root.querySelectorAll('[data-tihoka-id="cue-heat"]').length;
        return { dist, bars, items: items.length };
      });
      console.log(`[audit] heat: ${JSON.stringify(heat)}`);
      await shot(page, '02-heat-bars');
    });

    await test.step('cue-recommend-fab: badge + menu + filter', async () => {
      const fabInfo = await panel.eval((root) => {
        if (!root) return null;
        const fab = root.querySelector('[data-tihoka-id="cue-filter-fab"]');
        const badge = root.querySelector('[data-tihoka-id="cue-filter-badge"]');
        const rect = fab?.getBoundingClientRect();
        return {
          fab: !!fab,
          badge: badge?.textContent?.trim() ?? null,
          ariaLabel: fab?.getAttribute('aria-label') ?? null,
          rect: rect ? { w: rect.width, h: rect.height, x: rect.x, y: rect.y } : null,
        };
      });
      console.log(`[audit] fab: ${JSON.stringify(fabInfo)}`);
      if (fabInfo?.fab) {
        await panel.click('[data-tihoka-id="cue-filter-fab"]');
        await page.waitForTimeout(400);
        const menu = await panel.eval((root) => {
          if (!root) return null;
          const items = [...root.querySelectorAll('[role="menuitemradio"]')].map((el) => ({
            text: el.textContent?.trim(),
            checked: el.getAttribute('aria-checked'),
          }));
          const menuEl = root.querySelector('[role="menu"]');
          const rect = menuEl?.getBoundingClientRect();
          return { count: items.length, items, menuRect: rect };
        });
        console.log(`[audit] fab menu: ${JSON.stringify(menu)}`);
        await shot(page, '03-fab-menu');

        const i1Item = await panel.eval((root) => {
          if (!root) return false;
          const items = [...root.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
          const el = items.find((i) => /i\+1/i.test(i.textContent ?? ''));
          if (!el) return false;
          el.dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }),
          );
          return true;
        });
        console.log(`[audit] i1 select clicked=${i1Item}`);
        await page.waitForTimeout(800);
        const after = await panel.eval((root) => {
          if (!root) return null;
          const strip = root.querySelector('[data-tihoka-id="cue-filter-strip"]');
          const items = root.querySelectorAll('[data-tihoka-id="cue-item"]').length;
          const empty = root.querySelector('[data-tihoka-id="cue-filter-empty"]');
          return {
            stripText: strip?.textContent?.trim() ?? null,
            items,
            emptyShown: !!empty,
          };
        });
        console.log(`[audit] after i1 filter: ${JSON.stringify(after)}`);
        await shot(page, '04-i1-filtered');
      }
    });

    await test.step('adaptive-subtitles: visibility follows band', async () => {
      await writeStudyModes(TihokaContext, 'adaptive');
      await page.waitForTimeout(500);
      const overlayState = async () =>
        page.evaluate(() => {
          const root = document.getElementById('Tihoka-subtitle-root')?.shadowRoot;
          const vis = (role: string) => {
            const el = root?.querySelector(`[data-role="${role}"]`) as HTMLElement | null;
            if (!el) return 'absent';
            const s = getComputedStyle(el);
            const text = (el.textContent ?? '').trim();
            const hidden =
              s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0' || text === '';
            return hidden ? 'hidden' : 'shown';
          };
          return { target: vis('target'), native: vis('native') };
        });
      const samples: unknown[] = [];
      await playFrom(page, 5);
      for (let i = 0; i < 8; i++) {
        const v = page.locator(VIDEO).first();
        const t = await v.evaluate((vid: HTMLVideoElement) => vid.currentTime);
        samples.push({ t: Math.round(t * 10) / 10, ...(await overlayState()) });
        await page.waitForTimeout(1200);
      }
      console.log(`[audit] adaptive samples: ${JSON.stringify(samples)}`);
      await shot(page, '06-adaptive');
      await pauseAt(page, 20.6);
    });

    await test.step('dense-cue-replay: i1-replay skips easy cues', async () => {
      await writeStudyModes(TihokaContext, 'i1-replay');
      const v = page.locator(VIDEO).first();
      const samples: { t: number; paused: boolean }[] = [];
      await playFrom(page, 0);
      for (let i = 0; i < 10; i++) {
        samples.push(await v.evaluate((vid: HTMLVideoElement) => ({ t: Math.round(vid.currentTime * 10) / 10, paused: vid.paused })));
        await page.waitForTimeout(900);
      }
      console.log(`[audit] i1-replay timeline: ${JSON.stringify(samples)}`);
      await shot(page, '07-i1-replay');
      await writeStudyModes(TihokaContext, 'normal');
      await pauseAt(page, 20.6);
    });

    await test.step('local player: ImmersionStats + fit sort', async () => {
      const lp = TihokaContext.pages().find((p) => p.url().includes('local-player'));
      expect(lp).toBeTruthy();
      await lp!.bringToFront();
      await lp!.waitForTimeout(1000);
      const stats = await lp!.evaluate(() => {
        const statsEl = document.querySelector('[data-tihoka-id="immersion-stats"], [class*="ImmersionStats"], [role="progressbar"]');
        const selects = [...document.querySelectorAll('select')].map((s) => ({
          options: [...s.options].map((o) => o.textContent),
          value: s.value,
        }));
        const bodyText = document.body.innerText.slice(0, 600);
        return {
          statsText: statsEl?.textContent?.trim() ?? null,
          progressbar: !!document.querySelector('[role="progressbar"]'),
          selects,
          bodyText,
        };
      });
      console.log(`[audit] local player: ${JSON.stringify(stats)}`);
      await shot(lp!, '08-local-player');
      await lp!.close();
    });

    console.log(`[audit] console errors (${consoleErrors.length}): ${JSON.stringify(consoleErrors.slice(0, 20))}`);
  });
});
