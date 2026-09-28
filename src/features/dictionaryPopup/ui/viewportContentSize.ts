const FIREFOX_OVERLAY_SCROLLBAR_PX = 12;

let scrollbarSize: { readonly w: number; readonly h: number } | undefined;

function measureScrollbarSize(): { readonly w: number; readonly h: number } {
  if (!scrollbarSize) {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:100px;height:100px;overflow:scroll;';
    document.documentElement.appendChild(probe);
    scrollbarSize = { w: probe.offsetWidth - probe.clientWidth, h: probe.offsetHeight - probe.clientHeight };
    probe.remove();
  }
  return scrollbarSize;
}

function scrollbarGutter(axis: 'x' | 'y'): number {
  const el = document.scrollingElement ?? document.documentElement;
  const scrollable = axis === 'x' ? el.scrollHeight > el.clientHeight : el.scrollWidth > el.clientWidth;
  if (!scrollable) return 0;
  const style = getComputedStyle(el);
  const overflow = axis === 'x' ? style.overflowY : style.overflowX;
  if (overflow === 'hidden' || overflow === 'clip' || style.scrollbarWidth === 'none') return 0;
  const size = measureScrollbarSize();
  const measured = axis === 'x' ? size.w : size.h;
  if (measured > 0) return measured;
  // Firefox never subtracts the root scrollbar from clientWidth and uses
  // overlay scrollbars that report 0 width yet draw over the rightmost ~12px
  // of content — reserve that lane so edge-docked UI stays clear of it.
  return navigator.userAgent.includes('Firefox') ? FIREFOX_OVERLAY_SCROLLBAR_PX : 0;
}

export function getViewportContentWidth(): number {
  const client = document.documentElement?.clientWidth ?? 0;
  if (client > 0 && client < window.innerWidth) return client;
  return window.innerWidth - scrollbarGutter('x');
}

export function getViewportContentHeight(): number {
  const client = document.documentElement?.clientHeight ?? 0;
  if (client > 0 && client < window.innerHeight) return client;
  return window.innerHeight - scrollbarGutter('y');
}
