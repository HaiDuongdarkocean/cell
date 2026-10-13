import { chromium } from '@playwright/test';
import fs from 'node:fs';

const OUT = 'tasks/shortcut-redesign';
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.connectOverCDP('http://127.0.0.1:9331');
const c = b.contexts()[0];
const pages = b.contexts().flatMap((x) => x.pages());
const p = pages.find((x) => !x.url().startsWith('chrome')) ?? pages[0];
if (!p) { console.log('NO PAGE'); process.exit(1); }
await p.goto('http://localhost:5181/src/entrypoints/design-system-showcase/index.html?showcase=Settings+Dialog+Page&mode=dark&viewport=full&view=direct&preset=dawn', { waitUntil: 'domcontentloaded' });
console.log('page:', p.url());
await p.bringToFront();
await p.waitForTimeout(3000);

const DOC = `(() => { const f = document.querySelector('iframe'); return f ? f.contentDocument : document; })()`;

async function shotShortcuts(name) {
  const info = await p.evaluate(`(() => {
    const doc = ${DOC};
    const sec = doc.querySelector('[data-section="shortcuts"]');
    if (!sec) return 'no-section';
    sec.scrollIntoView({ block: 'start' });
    doc.documentElement.scrollTop -= 20;
    const r = sec.getBoundingClientRect();
    const fr = doc.defaultView.frameElement.getBoundingClientRect();
    return { x: Math.round(fr.x + r.x), y: Math.round(fr.y + Math.max(r.y, 0)), width: Math.round(r.width), height: Math.min(Math.round(r.height - Math.max(0, -r.y)), Math.round(fr.height)) };
  })()`);
  console.log(name, 'clip:', JSON.stringify(info));
  if (info && typeof info === 'object' && info.height > 50) {
    await p.screenshot({ path: `${OUT}/${name}.png`, clip: info });
  }
  return info;
}

const dom = await p.evaluate(`(() => {
  const doc = ${DOC};
  const sec = doc.querySelector('[data-section="shortcuts"]');
  if (!sec) return 'no-section';
  const pills = [...sec.querySelectorAll('[data-tihoka-keycapture]')];
  const cards = [...sec.querySelectorAll('[class*=shortcutCard]')];
  const perCardEdges = cards.map((cd) => [...new Set([...cd.querySelectorAll('[data-tihoka-keycapture]')].map((e) => Math.round(e.getBoundingClientRect().right)))]);
  const masonry = sec.querySelector('[class*=shortcutMasonry]');
  return {
    pillCount: pills.length,
    cardCount: cards.length,
    perCardRightEdges: perCardEdges,
    cols: masonry ? doc.defaultView.getComputedStyle(masonry).columnCount : 'n/a',
  };
})()`);
console.log('dom:', JSON.stringify(dom));

await shotShortcuts('real-desktop-dark');

await p.goto(p.url().replace(/viewport=\w+/, 'viewport=1920'), { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);
const domWide = await p.evaluate(`(() => {
  const doc = ${DOC};
  const sec = doc.querySelector('[data-section="shortcuts"]');
  if (!sec) return 'no-section';
  const masonry = sec.querySelector('[class*=shortcutMasonry]');
  return { cols: masonry ? doc.defaultView.getComputedStyle(masonry).columnCount : 'n/a', frameW: doc.defaultView.frameElement.getBoundingClientRect().width };
})()`);
console.log('wide dom:', JSON.stringify(domWide));
await shotShortcuts('real-1920-dark');

// Mobile: showcase's own viewport param (iframe width), not window emulation
await p.goto(p.url().replace(/viewport=\w+/, 'viewport=375'), { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2500);
const dom2 = await p.evaluate(`(() => {
  const doc = ${DOC};
  const sec = doc.querySelector('[data-section="shortcuts"]');
  if (!sec) return 'no-section';
  const pills = [...sec.querySelectorAll('[data-tihoka-keycapture]')];
  const cards = [...sec.querySelectorAll('[class*=shortcutCard]')];
  const masonry = sec.querySelector('[class*=shortcutMasonry]');
  return {
    pillCount: pills.length,
    cardCount: cards.length,
    cols: masonry ? doc.defaultView.getComputedStyle(masonry).columnCount : 'n/a',
    hScroll: doc.documentElement.scrollWidth > doc.documentElement.clientWidth,
  };
})()`);
console.log('mobile dom:', JSON.stringify(dom2));
await shotShortcuts('real-mobile-dark');

for (const [name, patch] of [
  ['real-desktop-light', (u) => u.replace('mode=dark', 'mode=light').replace(/viewport=\w+/, 'viewport=full')],
  ['real-mobile-vi', (u) => u.replace('mode=light', 'mode=dark').replace(/viewport=\w+/, 'viewport=375') + '&lang=vi'],
]) {
  await p.goto(patch(p.url()), { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3000);
  await shotShortcuts(name);
}
process.exit(0);
