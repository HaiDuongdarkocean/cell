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
  () => !!document.querySelector('[data-tihoka-split-view="wrapper"]'),
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
// only logging geometry:
//  open   — one wrapper with real height, not glued to page top (y<=minY is
//           the body-top fallback when the flow-slot keeper probe misses),
//           exactly one panel, stage fills the wrapper.
//  closed — nothing left in the DOM (sheet panels reparented to <body> must
//           be removed too, not just the wrapper).
export const assertSplit = async (env, want = 'open', tag = '', minY = 1) => {
  const s = await env.page.evaluate(() => {
    const r = (el) => el ? {
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(el.getBoundingClientRect().height),
      y: Math.round(el.getBoundingClientRect().y),
    } : null;
    const w = document.querySelector('[data-tihoka-split-view="wrapper"]');
    return {
      wrapper: w ? { ...r(w), parent: w.parentElement.tagName } : null,
      stage: r(document.querySelector('[data-tihoka-split-view="stage"]')),
      wrappers: document.querySelectorAll('[data-tihoka-split-view="wrapper"]').length,
      panels: document.querySelectorAll('[data-tihoka-split-view="panel"]').length,
      video: r(document.querySelector('video')),
    };
  });
  const fail = (msg) => {
    throw new Error(`assertSplit(${want}) ${tag}: ${msg} — ${JSON.stringify(s)}`);
  };
  if (want === 'open') {
    if (!s.wrapper) fail('wrapper missing');
    if (s.wrappers !== 1) fail(`${s.wrappers} wrappers mounted`);
    if (s.wrapper.h < 100) fail('wrapper height collapsed');
    if (s.wrapper.y <= minY) fail(`wrapper at page top (y=${s.wrapper.y}) — slot keeper missed`);
    if (s.panels !== 1) fail(`${s.panels} panels mounted`);
    if (!s.stage || s.stage.h < s.wrapper.h - 2) fail('stage does not fill wrapper');
  } else if (want === 'closed') {
    if (s.wrapper) fail('wrapper still mounted');
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
  const w = document.querySelector('[data-tihoka-split-view="wrapper"]');
  const st = document.querySelector('[data-tihoka-split-view="stage"]');
  const pa = document.querySelector('[data-tihoka-split-view="panel"]');
  return {
    tag: t,
    inner: { w: innerWidth, h: innerHeight },
    bodyW: document.body.clientWidth,
    wrapper: w ? { rect: r(w), pos: w.style.position, flexDir: w.style.flexDirection } : null,
    stage: r(st),
    panel: pa ? { rect: r(pa), parent: pa.parentElement.tagName, pos: pa.style.position } : null,
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
