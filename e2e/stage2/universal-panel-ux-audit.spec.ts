import { expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from '../fixtures/actors/universalPanel.fixture';
import { getE2EAgentPaths } from '../lib/agent-paths';

const { projectRoot } = getE2EAgentPaths();
const OUT = resolve(projectRoot, 'loop/universal-panel-ux');
const IMG = join(OUT, 'image');
const STATE = join(OUT, 'state');

const TABS = ['dictionary', 'vocabulary', 'studyModes', 'playlist', 'recap', 'settings'] as const;
type Tab = (typeof TABS)[number];

const VIEWPORTS = [
  { label: '1440x900', w: 1440, h: 900 },
  { label: '900x700', w: 900, h: 700 },
  { label: '768x1024', w: 768, h: 1024 },
  { label: '390x844', w: 390, h: 844 },
  { label: '320x568', w: 320, h: 568 },
] as const;

const METRIC_VIEWPORTS = new Set(['1440x900', '390x844']);

interface TriggerInfo {
  idx: number;
  kind: string;
  cellId: string;
  label: string;
}

const consoleLines: string[] = [];
const metricsStore: Record<string, Record<string, unknown>> = {};
const discoveredMenus: Record<string, TriggerInfo[]> = {};
const scrollers: Record<string, string> = {};
const failures: string[] = [];
const notes: string[] = [];
const capturedFiles: string[] = [];

function attachConsole(page: Page): void {
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      consoleLines.push(`[${type}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    consoleLines.push(`[pageerror] ${err.message}`);
  });
}

async function shot(page: Page, dir: string, name: string): Promise<string> {
  const p = join(IMG, dir, name);
  mkdirSync(dirname(p), { recursive: true });
  await page.screenshot({ path: p });
  capturedFiles.push(`${dir}/${name}`);
  return p;
}

async function panelOpen(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document
      .getElementById('cell-universal-panel-host')
      ?.shadowRoot?.querySelector('[data-cell-id="universal-panel"]');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 50 && r.height > 50;
  });
}

async function ensurePanelOpen(
  page: Page,
  universalPanel: { open(): Promise<void> },
): Promise<void> {
  if (!(await panelOpen(page))) {
    await universalPanel.open();
    await expect.poll(() => panelOpen(page), { timeout: 15_000 }).toBe(true);
  }
  await page.waitForTimeout(350);
}

async function clickTab(page: Page, tab: Tab): Promise<string | null> {
  const used = await page.evaluate((t) => {
    const root = document.getElementById('cell-universal-panel-host')?.shadowRoot;
    if (!root) return null;
    const candidates = [
      `[data-cell-id="universal-panel-tab-${t}"]`,
      `[data-cell-id="universal-panel-mobile-tab-${t}"]`,
    ];
    for (const sel of candidates) {
      const el = root.querySelector(sel) as HTMLElement | null;
      if (el && el.getBoundingClientRect().width > 0) {
        el.click();
        return sel;
      }
    }
    return null;
  }, tab);
  if (!used) return null;
  await expect
    .poll(
      () =>
        page.evaluate(
          (t) =>
            !!document
              .getElementById('cell-universal-panel-host')
              ?.shadowRoot?.querySelector(`[data-cell-id="universal-panel-content-${t}"]`),
          tab,
        ),
      { timeout: 10_000 },
    )
    .toBe(true);
  await page.waitForTimeout(300);
  return used;
}

async function scrollPaneToBottom(page: Page, tab: Tab): Promise<string> {
  const result = await page.evaluate((t) => {
    const root = document.getElementById('cell-universal-panel-host')?.shadowRoot;
    const pane = root?.querySelector(`[data-cell-id="universal-panel-content-${t}"]`);
    if (!pane) return null;
    const all: Element[] = [pane, ...Array.from(pane.querySelectorAll('*'))];
    let best: Element | null = null;
    let bestDelta = 0;
    for (const el of all) {
      const s = getComputedStyle(el);
      if (!/(auto|scroll)/.test(s.overflowY)) continue;
      const delta = el.scrollHeight - el.clientHeight;
      if (delta > 4 && delta >= bestDelta) {
        best = el;
        bestDelta = delta;
      }
    }
    if (!best) return 'none';
    best.scrollTop = best.scrollHeight;
    const el = best as HTMLElement;
    return el.getAttribute('data-cell-id') ?? `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`;
  }, tab);
  if (result === null) return 'missing';
  await page.waitForTimeout(300);
  return result;
}

async function discoverMenuTriggers(page: Page, tab: Tab): Promise<TriggerInfo[]> {
  return page.evaluate((t) => {
    const root = document.getElementById('cell-universal-panel-host')?.shadowRoot;
    const pane = root?.querySelector(`[data-cell-id="universal-panel-content-${t}"]`);
    if (!pane || !root) return [];
    root.querySelectorAll('[data-uxa-idx]').forEach((el) => el.removeAttribute('data-uxa-idx'));
    const vis = (el: Element): boolean => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
    };
    const resolved = new Set<Element>();
    const out: { idx: number; kind: string; cellId: string; label: string }[] = [];
    const add = (el: Element | null, kind: string): void => {
      if (!el || resolved.has(el) || !vis(el)) return;
      resolved.add(el);
      const idx = out.length;
      el.setAttribute('data-uxa-idx', String(idx));
      out.push({
        idx,
        kind,
        cellId: el.getAttribute('data-cell-id') ?? '',
        label: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 60),
      });
    };
    pane.querySelectorAll('[aria-haspopup]').forEach((el) => add(el, `haspopup:${el.getAttribute('aria-haspopup')}`));
    pane
      .querySelectorAll('[data-cell-id$="-menu"],[data-cell-id$="-select"],[data-cell-id$="-filter"],[data-cell-id$="-sort"]')
      .forEach((el) => {
        const inner = el.matches('button,[role="button"],[aria-haspopup]')
          ? el
          : el.querySelector('button,[aria-haspopup],[role="button"]');
        add(inner ?? el, `cell-id:${el.getAttribute('data-cell-id') ?? ''}`);
      });
    pane.querySelectorAll('button[aria-expanded]').forEach((el) => add(el, 'expander'));
    return out;
  }, tab);
}

async function overlayOpen(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.getElementById('cell-universal-panel-host')?.shadowRoot;
    if (!root) return false;
    const sels = [
      '[role="menu"]',
      '[role="listbox"]',
      '[data-cell-id="universal-panel-profile-dialog"]',
      '[data-cell-id="universal-panel-tools-sheet"]',
    ];
    return sels.some((sel) => {
      const el = root.querySelector(sel);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  });
}

async function collectMetrics(page: Page, tab: Tab, viewportLabel: string): Promise<void> {
  const isMobileWidth = (await page.evaluate(() => window.innerWidth)) <= 839;
  const threshold = isMobileWidth ? 44 : 40;
  const data = await page.evaluate(
    ({ t, touchTargetMin }) => {
      const host = document.getElementById('cell-universal-panel-host');
      const root = host?.shadowRoot;
      if (!root) return null;
      const vis = (el: Element): boolean => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
      };
      const snap = (el: Element) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          cellId: el.getAttribute('data-cell-id') ?? '',
          tag: el.tagName.toLowerCase(),
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          color: s.color,
          background: s.backgroundColor,
          padding: s.padding,
          gap: s.gap,
          borderRadius: s.borderRadius,
          border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
          minHeight: s.minHeight,
          boxShadow: s.boxShadow,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        };
      };
      const panel = root.querySelector('[data-cell-id="universal-panel"]');
      const header = root.querySelector('[data-cell-id="universal-panel-header"]');
      const pane = root.querySelector(`[data-cell-id="universal-panel-content-${t}"]`);
      if (!panel || !pane) return null;
      const desktopBar = root.querySelector('[data-cell-id="universal-panel-tab-bar"]');
      const bottomNav = root.querySelector('[data-cell-id="universal-panel-bottom-nav"]');
      const nav = desktopBar && vis(desktopBar) ? desktopBar : bottomNav;
      const navItems = nav ? Array.from(nav.querySelectorAll('button,[role="tab"]')).filter(vis).map(snap) : [];
      const cardCandidates = Array.from(
        pane.querySelectorAll('[class*="card" i],[class*="row" i],[class*="item" i],li,[role="listitem"],[role="radio"]'),
      ).filter(vis);
      const cards = cardCandidates.slice(0, 3).map(snap);
      const panelTop = panel.getBoundingClientRect().top;
      const interactives = Array.from(
        panel.querySelectorAll('button,[role="button"],input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])'),
      )
        .filter(vis)
        .filter((el) => el.getBoundingClientRect().top - panelTop < 2000)
        .slice(0, 200)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            ...snap(el),
            label: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 50),
            height: Math.round(r.height * 10) / 10,
          };
        });
      const tooSmall = interactives
        .filter((it) => it.height < touchTargetMin)
        .map((it) => ({ cellId: it.cellId, tag: it.tag, label: it.label, height: it.height }));
      return {
        tab: t,
        touchTargetMin,
        panel: snap(panel),
        header: header && vis(header) ? snap(header) : null,
        navKind: nav === desktopBar ? 'desktop-sidebar' : 'mobile-bottom-nav',
        navItems,
        cards,
        interactiveCount: interactives.length,
        touchTargetViolations: tooSmall,
      };
    },
    { t: tab, touchTargetMin: threshold },
  );
  if (!metricsStore[viewportLabel]) metricsStore[viewportLabel] = {};
  metricsStore[viewportLabel][tab] = data ?? { tab, error: 'panel or pane not found' };
}

async function hoverFirstPrimaryButton(
  page: Page,
  tab: Tab,
): Promise<{ x: number; y: number; id: string; label: string } | null> {
  return page.evaluate((t) => {
    const root = document.getElementById('cell-universal-panel-host')?.shadowRoot;
    const pane = root?.querySelector(`[data-cell-id="universal-panel-content-${t}"]`);
    if (!pane) return null;
    const btns = Array.from(pane.querySelectorAll('button')).filter((b) => {
      const r = b.getBoundingClientRect();
      const s = getComputedStyle(b);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
    });
    if (btns.length === 0) return null;
    const filled = btns.find((b) => {
      const bg = getComputedStyle(b).backgroundColor;
      return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
    });
    const target = filled ?? btns[0]!;
    const r = target.getBoundingClientRect();
    return {
      x: r.x + r.width / 2,
      y: r.y + r.height / 2,
      id: target.getAttribute('data-cell-id') ?? '',
      label: (target.getAttribute('aria-label') ?? target.textContent ?? '').trim().slice(0, 60),
    };
  }, tab);
}

test.describe('universal panel UX audit', () => {
  test.afterAll(() => {
    mkdirSync(STATE, { recursive: true });
    writeFileSync(join(STATE, 'computed-styles.json'), JSON.stringify(metricsStore, null, 2));
    writeFileSync(
      join(STATE, 'console.log'),
      consoleLines.length ? consoleLines.join('\n') : '(no console errors or warnings captured)',
    );
    const lines: string[] = [
      '# Universal Panel UX audit — discovery',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Captured files',
      '',
      ...capturedFiles.map((f) => `- \`image/${f}\``),
      '',
      '## Menu / overlay triggers discovered per tab',
      '',
    ];
    for (const tab of TABS) {
      const list = discoveredMenus[tab] ?? [];
      lines.push(`### ${tab} (${list.length})`);
      if (list.length === 0) lines.push('- none found');
      for (const trg of list) {
        lines.push(
          `- kind=\`${trg.kind}\` cell-id=\`${trg.cellId || '(none)'}\` label="${trg.label}"`,
        );
      }
      lines.push('');
    }
    lines.push('## Scroll regions (per viewport:tab)');
    lines.push('');
    for (const [k, v] of Object.entries(scrollers)) lines.push(`- ${k} → ${v}`);
    lines.push('');
    lines.push('## Notes');
    lines.push('');
    for (const n of notes) lines.push(`- ${n}`);
    lines.push('');
    lines.push('## Failures');
    lines.push('');
    if (failures.length === 0) lines.push('- none');
    for (const f of failures) lines.push(`- ${f}`);
    lines.push('');
    writeFileSync(join(STATE, '01-discover.md'), lines.join('\n'));
  });

  test('viewport x tab matrix + metrics', async ({ universalPanel, streamFlixPage }) => {
    test.setTimeout(600_000);
    const page = streamFlixPage;
    attachConsole(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.waitForTimeout(400);
      try {
        await ensurePanelOpen(page, universalPanel);
      } catch (err) {
        failures.push(`${vp.label}: panel open failed — ${String(err)}`);
        continue;
      }
      if (vp.label === '1440x900') await shot(page, vp.label, 'chrome-desktop.png');
      if (vp.label === '390x844') await shot(page, vp.label, 'chrome-mobile.png');
      for (const tab of TABS) {
        const sel = await clickTab(page, tab);
        if (!sel) {
          failures.push(`${vp.label}/${tab}: no visible tab item selector`);
          continue;
        }
        await shot(page, vp.label, `${tab}.png`);
        const scroller = await scrollPaneToBottom(page, tab);
        scrollers[`${vp.label}/${tab}`] = `${scroller} (via ${sel})`;
        if (scroller !== 'none' && scroller !== 'missing') {
          await shot(page, vp.label, `${tab}-bottom.png`);
        } else {
          notes.push(`${vp.label}/${tab}: no scrollable region (${scroller}) — bottom shot skipped`);
        }
        if (METRIC_VIEWPORTS.has(vp.label)) {
          try {
            await collectMetrics(page, tab, vp.label);
          } catch (err) {
            failures.push(`${vp.label}/${tab}: metrics failed — ${String(err)}`);
          }
        }
      }
    }
  });

  test('interactive states at desktop', async ({ universalPanel, streamFlixPage }) => {
    test.setTimeout(480_000);
    const page = streamFlixPage;
    attachConsole(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(400);
    await ensurePanelOpen(page, universalPanel);

    // Sidebar tab hover (desktop sidebar only).
    const sideTab = page.locator('[data-cell-id="universal-panel-tab-vocabulary"]');
    if (await sideTab.isVisible().catch(() => false)) {
      await sideTab.hover();
      await page.waitForTimeout(250);
      await shot(page, '1440x900', 'sidebar-hover.png');
      await page.mouse.move(5, 5);
    } else {
      failures.push('desktop: sidebar tab item not visible for hover');
    }

    for (const tab of TABS) {
      const sel = await clickTab(page, tab);
      if (!sel) {
        failures.push(`desktop/${tab}: tab click failed in interactive pass`);
        continue;
      }

      // Hover: first primary-looking button inside the tab pane.
      const hoverTarget = await hoverFirstPrimaryButton(page, tab);
      if (hoverTarget) {
        await page.mouse.move(hoverTarget.x, hoverTarget.y);
        await page.waitForTimeout(250);
        await shot(page, '1440x900', `${tab}-hover.png`);
        notes.push(`${tab}: hovered \`${hoverTarget.id || 'button'}\` "${hoverTarget.label}"`);
        await page.mouse.move(5, 5);
      } else {
        notes.push(`${tab}: no button found for hover shot`);
      }

      // Focus: real click on the nav item, then Tab → :focus-visible on next control.
      try {
        const navSel = `[data-cell-id="universal-panel-tab-${tab}"]`;
        const navItem = page.locator(navSel);
        if (await navItem.isVisible().catch(() => false)) {
          await navItem.click();
        }
        await page.keyboard.press('Tab');
        await page.waitForTimeout(250);
        await shot(page, '1440x900', `${tab}-focus.png`);
      } catch (err) {
        failures.push(`desktop/${tab}: focus capture failed — ${String(err)}`);
      }

      // Menus / overlays within the tab pane.
      let triggers: TriggerInfo[] = [];
      try {
        triggers = await discoverMenuTriggers(page, tab);
      } catch (err) {
        failures.push(`desktop/${tab}: trigger discovery failed — ${String(err)}`);
      }
      discoveredMenus[tab] = triggers;
      for (const trg of triggers) {
        const loc = page.locator(`[data-uxa-idx="${trg.idx}"]`);
        try {
          await loc.click({ timeout: 5_000 });
          await page.waitForTimeout(400);
          await shot(page, '1440x900', `${tab}-menu-${trg.idx}.png`);
          // Close: re-click toggles menus/selects/expanders; Escape as fallback.
          await loc.click({ timeout: 5_000 }).catch(() => {});
          await page.waitForTimeout(250);
          if (await overlayOpen(page)) {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(250);
          }
          if (!(await panelOpen(page))) {
            notes.push(`${tab}-menu-${trg.idx}: panel closed during dismissal — reopened`);
            await ensurePanelOpen(page, universalPanel);
            await clickTab(page, tab);
          }
        } catch (err) {
          failures.push(`desktop/${tab}: trigger ${trg.idx} (${trg.cellId || trg.kind}) failed — ${String(err)}`);
          if (!(await panelOpen(page))) {
            await ensurePanelOpen(page, universalPanel);
            await clickTab(page, tab);
          }
        }
      }
    }

    // Collapsed sidebar.
    const collapse = page.locator('[data-cell-id="collapsible-sidebar-toggle"]');
    if (await collapse.isVisible().catch(() => false)) {
      await collapse.click();
      await page.waitForTimeout(400);
      await shot(page, '1440x900', 'chrome-desktop-collapsed.png');
      await collapse.click();
      await page.waitForTimeout(300);
    } else {
      notes.push('desktop: no collapsible-sidebar-toggle found');
    }

    // Profile dialog (only rendered when language profiles exist).
    const profileBtn = page.locator('[data-cell-id="universal-panel-profile-button"]');
    if (await profileBtn.isVisible().catch(() => false)) {
      await profileBtn.click();
      await page.waitForTimeout(400);
      await shot(page, '1440x900', 'profile-dialog.png');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      if (!(await panelOpen(page))) {
        notes.push('profile-dialog: Escape closed the panel — reopened');
        await ensurePanelOpen(page, universalPanel);
      }
    } else {
      notes.push('desktop: no universal-panel-profile-button (no language profiles?)');
    }
  });

  test('mobile overlays at 390x844', async ({ universalPanel, streamFlixPage }) => {
    test.setTimeout(240_000);
    const page = streamFlixPage;
    attachConsole(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await ensurePanelOpen(page, universalPanel);

    const toolsBtn = page.locator('[data-cell-id="universal-panel-mobile-tools"]');
    if (await toolsBtn.isVisible().catch(() => false)) {
      await toolsBtn.click();
      await page.waitForTimeout(500);
      await shot(page, '390x844', 'tools-sheet.png');
      const sheetOpen = await page.evaluate(
        () =>
          !!document
            .getElementById('cell-universal-panel-host')
            ?.shadowRoot?.querySelector('[data-cell-id="universal-panel-tools-sheet"]'),
      );
      if (!sheetOpen) failures.push('mobile: tools sheet did not render');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      if (!(await panelOpen(page))) {
        notes.push('mobile: Escape from tools sheet closed panel — reopened');
        await ensurePanelOpen(page, universalPanel);
      }
    } else {
      failures.push('mobile: universal-panel-mobile-tools not visible at 390x844');
    }

    const profileBtn = page.locator('[data-cell-id="universal-panel-profile-button"]');
    if (await profileBtn.isVisible().catch(() => false)) {
      await profileBtn.click();
      await page.waitForTimeout(400);
      await shot(page, '390x844', 'profile-dialog-mobile.png');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      if (!(await panelOpen(page))) await ensurePanelOpen(page, universalPanel);
    } else {
      notes.push('mobile: no profile button in header');
    }
  });
});
