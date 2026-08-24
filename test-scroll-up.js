async () => {
  const overlays = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
  const settings = Array.from(overlays).find(o => o.getAttribute('aria-label') === 'Settings Dialog Page');
  const body = settings?.querySelector('[class*="fullscreenBody"]');
  const iframe = body?.querySelector('iframe');
  const doc = iframe?.contentDocument;
  if (!doc) return { error: 'no iframe doc' };
  const aside = doc.querySelector('aside');
  const nav = aside?.querySelector('nav');
  const mainCol = doc.querySelector('[class*="mainCol"]');
  const items = Array.from(nav?.querySelectorAll('button') ?? []);
  const firstItem = items[0];
  const lastItem = items[items.length - 1];
  lastItem?.click();
  await new Promise(r => setTimeout(r, 1500));
  const before = {
    bg: getComputedStyle(nav, '::before').transform,
    scroll: Math.round(mainCol?.scrollTop ?? 0)
  };
  firstItem?.click();
  const samples = [];
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 60));
    samples.push({
      bg: getComputedStyle(nav, '::before').transform,
      scroll: Math.round(mainCol?.scrollTop ?? 0)
    });
  }
  return { before, samples };
}
