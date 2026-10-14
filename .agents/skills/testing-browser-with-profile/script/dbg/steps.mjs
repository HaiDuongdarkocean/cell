// Global debug steps — uniform signature (env, ...args) so run.mjs can
// compose them into named flows. Site steps under sites/<slug>.mjs use the
// same signature and override these by name (site wins).
//
// env = { site, match, url, settleMs, session, browser, ctx, page }
// Steps must read env.page lazily — `open` assigns it.

import { openPage, shot } from './browser.mjs';
import { emulate } from './emulate.mjs';

export const open = async (env) => {
  env.page = await openPage(env.ctx, env.match, { url: env.url, settleMs: env.settleMs });
};

export const settle = (env, ms = 1000) => env.page.waitForTimeout(ms);

export const emulateDims = (env, dims) => emulate(env.ctx, env.page, dims);

export const waitOverlay = async (env, timeout = 15000) => {
  const ok = await env.page.waitForSelector('#Tihoka-subtitle-root', { timeout })
    .then(() => true).catch(() => false);
  if (!ok) throw new Error('overlay never mounted — check /json for the extension SW');
};

export const toggleSplitView = async (env, waitMs = 1300) => {
  await env.page.evaluate(() => document.body.focus());
  await env.page.keyboard.press('t');
  await env.page.waitForTimeout(waitMs);
};

export const isSplitOpen = (env) => env.page.evaluate(
  () => !!document.querySelector('[data-tihoka-split-shell]'),
);

export const ensureSplit = async (env) => {
  if (!await isSplitOpen(env)) await toggleSplitView(env);
};

// Race repro — presses `t` n times with gaps tighter than the slide-out
// teardown window (ANIM_MS ≈ 410ms). Always pair with ensureSplit after:
// an even n ends closed, an odd one ends open.
export const spamToggles = async (env, n = 4, waitMs = 220) => {
  for (let i = 0; i < n; i++) {
    await env.page.evaluate(() => document.body.focus());
    await env.page.keyboard.press('t');
    await env.page.waitForTimeout(waitMs);
  }
};

// Hard gate — throws (fails the flow) on the known regressions instead of
// only logging geometry. The shell never leaves the host tree: open state =
// one marked shell shrunk beside one body-mounted panel (or bottom sheet on
// narrow viewports); closed = neither exists.
export const assertSplit = async (env, want = 'open', tag = '', minY = 1) => {
  // Geometry assertions only mean anything once the slide-in transition has
  // settled — getBoundingClientRect includes the in-flight translate, so a
  // sample taken mid-entry reads the start offset (e.g. +100% panel width).
  if (want === 'open') {
    await env.page.waitForFunction(() => {
      const p = document.querySelector('[data-tihoka-split-view="panel"]');
      if (!p) return true;
      const t = getComputedStyle(p).transform;
      return t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)';
    }, null, { timeout: 2500 }).catch(() => {});
  }
  const s = await env.page.evaluate(() => {
    const r = (el) => el ? {
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(el.getBoundingClientRect().height),
      x: Math.round(el.getBoundingClientRect().x),
      y: Math.round(el.getBoundingClientRect().y),
      right: Math.round(el.getBoundingClientRect().right),
    } : null;
    const shell = document.querySelector('[data-tihoka-split-shell]');
    const panel = document.querySelector('[data-tihoka-split-view="panel"]');
    return {
      inner: { w: innerWidth, h: innerHeight },
      shell: shell ? { ...r(shell), parent: shell.parentElement.tagName, tag: shell.tagName, id: shell.id || null } : null,
      shells: document.querySelectorAll('[data-tihoka-split-shell]').length,
      panel: panel ? { ...r(panel), parent: panel.parentElement.tagName, pos: panel.style.position, vis: panel.style.visibility } : null,
      panels: document.querySelectorAll('[data-tihoka-split-view="panel"]').length,
      video: r(document.querySelector('video')),
    };
  });
  const fail = (msg) => {
    throw new Error(`assertSplit(${want}) ${tag}: ${msg} — ${JSON.stringify(s)}`);
  };
  if (want === 'open') {
    if (!s.shell) fail('marked shell missing');
    if (s.shells !== 1) fail(`${s.shells} marked shells`);
    if (s.shell.h < 100) fail('shell height collapsed');
    if (s.shell.y <= minY) fail(`shell at page top (y=${s.shell.y}) — host slot lost`);
    if (!s.panel) fail('panel missing');
    if (s.panels !== 1) fail(`${s.panels} panels mounted`);
    const sheetMode = s.inner.w < 600;
    if (!sheetMode) {
      if (s.panel.parent !== 'BODY') fail(`panel parent ${s.panel.parent} — must mount on body`);
      if (Math.abs(s.panel.x - s.shell.right) > 8) fail(`panel not docked to shell (panel.x=${s.panel.x}, shell.right=${s.shell.right})`);
      if (Math.abs(s.panel.y - s.shell.y) > 8) fail(`panel not top-aligned with shell (panel.y=${s.panel.y}, shell.y=${s.shell.y})`);
      if (s.panel.h < s.shell.h - 8) fail('panel shorter than shell');
    } else {
      if (s.panel.h < 100) fail('sheet height collapsed');
    }
    if (!s.video || s.video.w < 1 || s.video.h < 1) fail('video has no box');
  } else if (want === 'closed') {
    if (s.shell) fail('shell marker still set');
    if (s.panels !== 0) fail(`${s.panels} orphan panels left in DOM`);
  } else {
    throw new Error(`assertSplit: unknown want "${want}"`);
  }
  console.log(`  assertSplit ${tag || want} OK`, JSON.stringify(s));
  return s;
};

const dumpFn = (t) => {
  const r = (el) => el ? {
    w: Math.round(el.getBoundingClientRect().width),
    h: Math.round(el.getBoundingClientRect().height),
    x: Math.round(el.getBoundingClientRect().x),
    y: Math.round(el.getBoundingClientRect().y),
  } : null;
  const sh = document.querySelector('[data-tihoka-split-shell]');
  const st = document.querySelector('[data-tihoka-split-view="stage"]');
  const pa = document.querySelector('[data-tihoka-split-view="panel"]');
  return {
    tag: t,
    inner: { w: innerWidth, h: innerHeight },
    bodyW: document.body.clientWidth,
    shell: sh ? { rect: r(sh), width: sh.style.width, parent: sh.parentElement.tagName } : null,
    stage: r(st),
    panel: pa ? { rect: r(pa), parent: pa.parentElement.tagName, pos: pa.style.position, vis: pa.style.visibility } : null,
    video: r(document.querySelector('video')),
    TihokaRoot: r(document.getElementById('Tihoka-subtitle-root')),
  };
};

export const dump = async (env, tag = '') => {
  const d = await env.page.evaluate(dumpFn, tag);
  console.log(`  ${tag || 'dump'}`, JSON.stringify(d));
  return d;
};

// One ordered capture point: optional re-emulate → settle → dump → shot.
export const capture = async (env, tag, dims) => {
  if (dims) {
    await emulateDims(env, dims);
    await env.page.waitForTimeout(1500);
  }
  const d = await env.page.evaluate(dumpFn, tag);
  console.log(`  ${tag}`, JSON.stringify(d));
  await shot(env.page, env.session, `${env.site}-${tag}.png`);
  return d;
};
