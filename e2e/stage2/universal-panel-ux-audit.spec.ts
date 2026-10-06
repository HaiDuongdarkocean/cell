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

interface CollectedMetrics {
  pointerCoarse?: boolean;
  touchTargetMin?: number;
  interactiveCount?: number;
  touchTargetViolations?: { cellId: string; tag: string; label: string; width: number; height: number }[];
  touchTargetOverlaps?: { a: string; b: string; overlapWidth: number; overlapHeight: number }[];
  [key: string]: unknown;
}

async function collectMetrics(page: Page, tab: Tab, viewportLabel: string): Promise<CollectedMetrics | null> {
  const data = await page.evaluate(
    ({ t }) => {
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      const touchTargetMin = coarse ? 44 : 40;
      const host = document.getElementById('cell-universal-panel-host');
      const root = host?.shadowRoot;
      if (!root) return null;
      // Element box intersected with the padding boxes of every clipping
      // ancestor — the part that can actually be seen and tapped. A card
      // scrolled under the fixed bottom nav reports a full border box via
      // getBoundingClientRect even though the overflow:hidden pane clips it,
      // so raw rects create phantom target overlaps.
      const effectiveRect = (el: Element): { left: number; top: number; right: number; bottom: number; width: number; height: number } => {
        let { left, top, right, bottom } = el.getBoundingClientRect();
        for (let p = el.parentElement; p; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (!/(hidden|auto|scroll|clip)/.test(`${s.overflowX} ${s.overflowY}`)) continue;
          const pr = p.getBoundingClientRect();
          const bl = parseFloat(s.borderLeftWidth) || 0;
          const bt = parseFloat(s.borderTopWidth) || 0;
          const br = parseFloat(s.borderRightWidth) || 0;
          const bb = parseFloat(s.borderBottomWidth) || 0;
          left = Math.max(left, pr.left + bl);
          top = Math.max(top, pr.top + bt);
          right = Math.min(right, pr.right - br);
          bottom = Math.min(bottom, pr.bottom - bb);
        }
        const width = Math.max(0, right - left);
        const height = Math.max(0, bottom - top);
        return { left, top, right, bottom, width, height };
      };
      const vis = (el: Element): boolean => {
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        const r = effectiveRect(el);
        return r.width > 0 && r.height > 0;
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
      const describe = (el: Element): string =>
        `${el.getAttribute('data-cell-id') || el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}"`;
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
      const interactiveEls = Array.from(
        panel.querySelectorAll('button,[role="button"],input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])'),
      )
        .filter(vis)
        .filter((el) => el.getBoundingClientRect().top - panelTop < 2000)
        .slice(0, 200);
      const interactives = interactiveEls.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          ...snap(el),
          label: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 50),
          width: Math.round(r.width * 10) / 10,
          height: Math.round(r.height * 10) / 10,
        };
      });
      const tooSmall = interactives
        .filter((it) => it.width < touchTargetMin || it.height < touchTargetMin)
        .map((it) => ({ cellId: it.cellId, tag: it.tag, label: it.label, width: it.width, height: it.height }));
      const overlaps: { a: string; b: string; overlapWidth: number; overlapHeight: number }[] = [];
      let whitelistedContainments = 0;
      for (let i = 0; i < interactiveEls.length; i += 1) {
        const a = interactiveEls[i]!;
        const ra = effectiveRect(a);
        for (let j = i + 1; j < interactiveEls.length; j += 1) {
          const b = interactiveEls[j]!;
          const rb = effectiveRect(b);
          const ow = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const oh = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          // Subpixel seams (e.g. two halves of a segmented capsule sharing an
          // edge at a fractional width) are float noise, not intersecting
          // targets; anything ≥ 0.5px on both axes is a real overlap.
          if (ow < 0.5 || oh < 0.5) continue;
          // Whitelisted ancestor containment: one target sits fully inside the
          // other (DOM ancestor — e.g. icon inside a button — or the designed
          // overlay case like the mode-card kebab painted over its radio card).
          // Partial intersections between disjoint targets are real defects.
          const smallerArea = Math.min(ra.width * ra.height, rb.width * rb.height);
          if (a.contains(b) || b.contains(a) || ow * oh >= smallerArea - 0.5) {
            whitelistedContainments += 1;
            continue;
          }
          overlaps.push({
            a: describe(a),
            b: describe(b),
            overlapWidth: Math.round(ow * 10) / 10,
            overlapHeight: Math.round(oh * 10) / 10,
          });
        }
      }
      return {
        tab: t,
        pointerCoarse: coarse,
        touchTargetMin,
        panel: snap(panel),
        header: header && vis(header) ? snap(header) : null,
        navKind: nav === desktopBar ? 'desktop-sidebar' : 'mobile-bottom-nav',
        navItems,
        cards,
        interactiveCount: interactives.length,
        touchTargetViolations: tooSmall,
        touchTargetOverlaps: overlaps,
        whitelistedContainments,
      };
    },
    { t: tab },
  );
  if (!metricsStore[viewportLabel]) metricsStore[viewportLabel] = {};
  metricsStore[viewportLabel][tab] = data ?? { tab, error: 'panel or pane not found' };
  return data as CollectedMetrics | null;
}

interface A11yStructure {
  navs?: { cellId: string | null; tag: string; ariaLabel: string | null; visible: boolean; itemCount: number; currentValue: string | null }[];
  panes?: { role: string | null; ariaLabel: string | null; hidden: boolean }[];
  domOrder?: { sidebarBeforeBody: string; bodyBeforeBottomNav: string; lastFocusableInBottomNav: boolean };
  advancedSwitch?: {
    ariaChecked: string | null;
    ariaControls: string | null;
    ariaDescribedby: string | null;
    ariaExpanded: string | null;
    describedbyExists: boolean;
    controlledExists: boolean;
    controlledRole: string | null;
    controlledLabel: string | null;
  } | null;
  radiogroups?: { ariaLabel: string | null; ariaLabelledby: string | null; radios: number }[];
  statusRegions?: { cellId: string | null; ariaAtomic: string | null; visible: boolean; text: string }[];
  ariaLiveInActivePane?: number | null;
  initialFocus?: { insidePanel: boolean; visible: boolean; cellId: string | null; label: string };
  error?: string;
  [key: string]: unknown;
}

async function collectA11yStructure(page: Page): Promise<A11yStructure> {
  return page.evaluate(() => {
    const root = document.getElementById('cell-universal-panel-host')?.shadowRoot;
    if (!root) return { error: 'no shadow root' } as A11yStructure;
    const panel = root.querySelector('[data-cell-id="universal-panel"]');
    if (!panel) return { error: 'no panel' } as A11yStructure;
    const vis = (el: Element): boolean => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
    };
    const attr = (el: Element | null | undefined, name: string): string | null =>
      el?.getAttribute(name) ?? null;
    const navs = Array.from(panel.querySelectorAll('nav,[role="navigation"]')).map((el) => {
      const current = el.querySelector('[aria-current]');
      return {
        cellId: attr(el, 'data-cell-id'),
        tag: el.tagName.toLowerCase(),
        ariaLabel: attr(el, 'aria-label'),
        visible: vis(el),
        itemCount: el.querySelectorAll('button,[role="tab"],a').length,
        currentValue: attr(current, 'aria-current'),
      };
    });
    const contentWrap = panel.querySelector('[data-cell-id^="universal-panel-content-"]');
    const panes = contentWrap
      ? Array.from(contentWrap.children).map((el) => ({
          role: attr(el, 'role'),
          ariaLabel: attr(el, 'aria-label'),
          hidden: el.hasAttribute('hidden'),
        }))
      : [];
    const sidebar = panel.querySelector('[data-cell-id="universal-panel-tab-bar"]');
    const bottomNav = panel.querySelector('[data-cell-id="universal-panel-bottom-nav"]');
    const headerEl = panel.querySelector('[data-cell-id="universal-panel-header"]');
    const body = headerEl?.parentElement ?? null;
    const pos = (a: Element | null, b: Element | null): string => {
      if (!a || !b) return 'unknown';
      if (a === b) return 'same';
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? 'before' : 'after';
    };
    const focusableSel = 'button,[role="button"],input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])';
    const focusables = Array.from(panel.querySelectorAll(focusableSel)).filter(vis);
    const lastFocusable = focusables[focusables.length - 1] ?? null;
    const sw = panel.querySelector('[role="switch"]');
    const controlledId = attr(sw, 'aria-controls');
    const describedId = attr(sw, 'aria-describedby');
    const controlled = controlledId ? root.getElementById(controlledId) : null;
    const described = describedId ? root.getElementById(describedId) : null;
    const advancedSwitch = sw
      ? {
          ariaChecked: attr(sw, 'aria-checked'),
          ariaControls: controlledId,
          ariaDescribedby: describedId,
          ariaExpanded: attr(sw, 'aria-expanded'),
          describedbyExists: !!described,
          controlledExists: !!controlled,
          controlledRole: attr(controlled, 'role'),
          controlledLabel: attr(controlled, 'aria-label'),
        }
      : null;
    const radiogroups = Array.from(panel.querySelectorAll('[role="radiogroup"]')).map((el) => ({
      ariaLabel: attr(el, 'aria-label'),
      ariaLabelledby: attr(el, 'aria-labelledby'),
      radios: el.querySelectorAll('[role="radio"]').length,
    }));
    const statusRegions = Array.from(panel.querySelectorAll('[role="status"]')).map((el) => ({
      cellId: attr(el, 'data-cell-id'),
      ariaAtomic: attr(el, 'aria-atomic'),
      visible: vis(el),
      text: (el.textContent ?? '').trim().slice(0, 120),
    }));
    const ae = (root as unknown as DocumentOrShadowRoot).activeElement as HTMLElement | null;
    const initialFocus = ae
      ? {
          insidePanel: panel.contains(ae),
          visible: vis(ae),
          cellId: attr(ae, 'data-cell-id'),
          label: (attr(ae, 'aria-label') ?? ae.textContent ?? '').trim().slice(0, 60),
        }
      : { insidePanel: false, visible: false, cellId: null, label: '' };
    return {
      navs,
      panes,
      domOrder: {
        sidebarBeforeBody: pos(sidebar, body),
        bodyBeforeBottomNav: pos(body, bottomNav),
        lastFocusableInBottomNav: !!(lastFocusable && bottomNav?.contains(lastFocusable)),
      },
      advancedSwitch,
      radiogroups,
      statusRegions,
      ariaLiveInActivePane: (() => {
        if (!contentWrap) return null;
        const active = Array.from(contentWrap.children).find((c) => !c.hasAttribute('hidden'));
        return active ? active.querySelectorAll('[aria-live]').length : null;
      })(),
      initialFocus,
    } as A11yStructure;
  });
}

async function focusTrail(page: Page, steps: number): Promise<string[]> {
  const seq: string[] = [];
  for (let i = 0; i < steps; i += 1) {
    const label = await page.evaluate(() => {
      const root = document.getElementById('cell-universal-panel-host')?.shadowRoot;
      const panel = root?.querySelector('[data-cell-id="universal-panel"]');
      const ae = root?.activeElement as HTMLElement | null;
      if (!ae) return 'none';
      if (panel && !panel.contains(ae)) return 'OUTSIDE-PANEL';
      const id = ae.getAttribute('data-cell-id') || ae.tagName.toLowerCase();
      const txt = (ae.getAttribute('aria-label') ?? ae.textContent ?? '').trim().slice(0, 40);
      return `${id}|${txt}`;
    });
    seq.push(label);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(80);
  }
  return seq;
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

  test('a11y: pointer-adaptive hit target floor, focus and semantics', async ({ universalPanel, streamFlixPage }) => {
    test.setTimeout(600_000);
    const page = streamFlixPage;
    attachConsole(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(400);
    await ensurePanelOpen(page, universalPanel);

    // --- Fine pointer (desktop default) — floor is 40px in both dims ---
    expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(false);
    for (const tab of TABS) {
      await clickTab(page, tab);
      const data = await collectMetrics(page, tab, 'a11y-fine-1440x900');
      expect(data?.pointerCoarse).toBe(false);
      expect(data?.touchTargetMin).toBe(40);
      expect(data?.touchTargetViolations ?? []).toEqual([]);
      expect(data?.touchTargetOverlaps ?? []).toEqual([]);
    }
    await shot(page, 'a11y', 'fine-desktop-studyModes.png');

    // --- Desktop semantics ---
    await clickTab(page, 'studyModes');
    const desktop = await collectA11yStructure(page);
    metricsStore['a11y'] = { desktop };
    const desktopNav = desktop.navs?.find((n) => n.cellId === 'universal-panel-tab-bar');
    expect(desktopNav?.tag).toBe('nav');
    expect(desktopNav?.ariaLabel).toBeTruthy();
    expect(desktopNav?.currentValue).toBe('page');
    expect(desktop.panes?.every((p) => p.role === 'region' && !!p.ariaLabel)).toBe(true);
    expect(desktop.panes?.filter((p) => !p.hidden)).toHaveLength(1);
    expect(desktop.domOrder?.sidebarBeforeBody).toBe('before');
    expect(desktop.domOrder?.bodyBeforeBottomNav).toBe('before');
    const adv = desktop.advancedSwitch;
    expect(adv?.ariaChecked).not.toBeNull();
    expect(adv?.ariaControls).toBe('advanced-settings-region');
    expect(adv?.controlledExists).toBe(true);
    expect(adv?.controlledRole).toBe('region');
    expect(adv?.controlledLabel).toBeTruthy();
    expect(adv?.ariaDescribedby).toBe('advanced-settings-toggle-hint');
    expect(adv?.describedbyExists).toBe(true);
    expect(adv?.ariaExpanded).toBeNull();
    expect(desktop.radiogroups?.length).toBeGreaterThanOrEqual(1);
    expect(desktop.initialFocus?.insidePanel).toBe(true);
    expect(desktop.initialFocus?.visible).toBe(true);

    // Focus trap: Tab stays inside the panel.
    const trail = await focusTrail(page, 10);
    metricsStore['a11y-focus-trail-desktop'] = { trail };
    expect(trail.every((s) => s !== 'OUTSIDE-PANEL' && s !== 'none')).toBe(true);

    // --- Playlist single status announcer ---
    await clickTab(page, 'playlist');
    const playlist = await collectA11yStructure(page);
    metricsStore['a11y'] = { ...(metricsStore['a11y'] ?? {}), playlist };
    const announcers = playlist.statusRegions?.filter((s) => s.cellId === 'playlist-status-announcer') ?? [];
    expect(announcers).toHaveLength(1);
    expect(announcers[0]?.ariaAtomic).toBe('true');
    expect(playlist.ariaLiveInActivePane).toBe(0);

    // --- Mobile DOM order + bottom nav last ---
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await ensurePanelOpen(page, universalPanel);
    const mobile = await collectA11yStructure(page);
    metricsStore['a11y'] = { ...(metricsStore['a11y'] ?? {}), mobile };
    const mobileNav = mobile.navs?.find((n) => n.cellId === 'universal-panel-bottom-nav');
    expect(mobileNav?.visible).toBe(true);
    expect(mobileNav?.ariaLabel).toBeTruthy();
    expect(mobileNav?.currentValue).toBe('page');
    expect(mobile.domOrder?.sidebarBeforeBody).toBe('before');
    expect(mobile.domOrder?.bodyBeforeBottomNav).toBe('before');
    expect(mobile.domOrder?.lastFocusableInBottomNav).toBe(true);
    const mobileTrail = await focusTrail(page, 8);
    metricsStore['a11y-focus-trail-mobile'] = { trail: mobileTrail };
    expect(mobileTrail.every((s) => s !== 'OUTSIDE-PANEL' && s !== 'none')).toBe(true);
    await shot(page, 'a11y', 'fine-mobile-dom-order.png');

    // --- Coarse pointer via CDP touch emulation: a primary touch point makes
    // (pointer: coarse) match, which is what the floor tokens respond to. ---
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(true);
      for (const tab of TABS) {
        await clickTab(page, tab);
        const data = await collectMetrics(page, tab, 'a11y-coarse-390x844');
        expect(data?.pointerCoarse).toBe(true);
        expect(data?.touchTargetMin).toBe(44);
        expect(data?.touchTargetViolations ?? []).toEqual([]);
        expect(data?.touchTargetOverlaps ?? []).toEqual([]);
      }
      await shot(page, 'a11y', 'coarse-mobile-studyModes.png');
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(300);
      await clickTab(page, 'studyModes');
      const desktopCoarse = await collectMetrics(page, 'studyModes', 'a11y-coarse-1440x900');
      expect(desktopCoarse?.touchTargetViolations ?? []).toEqual([]);
      await shot(page, 'a11y', 'coarse-desktop-studyModes.png');
    } finally {
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false }).catch(() => {});
      await cdp.detach().catch(() => {});
    }
  });
});
