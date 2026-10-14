// Shared Tihoka debug steps — reuse these in every sites/ script instead
// of re-writing probes. Site scripts only compose + assert.

// Waits for the overlay host to mount (content script + caption detect).
// Returns false instead of throwing so a site script can decide.
export async function waitForOverlay(page, timeout = 15000) {
  return page.waitForSelector('#Tihoka-subtitle-root', { timeout })
    .then(() => true)
    .catch(() => false);
}

export async function toggleSplitView(page, { waitMs = 1300 } = {}) {
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press('t');
  await page.waitForTimeout(waitMs);
}

export async function isSplitViewOpen(page) {
  return page.evaluate(
    () => !!document.querySelector('[data-tihoka-split-view="wrapper"]'),
  );
}

// Geometry snapshot of the split-view DOM + player chain. Rects rounded.
export function dumpLayout(page, tag = '') {
  return page.evaluate((t) => {
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
  }, tag);
}
