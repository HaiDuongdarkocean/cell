export const CUE_LIST_SCROLL_SELECTOR = '[data-cell-id="cue-list-scroll"]';
export const SPLIT_VIEW_PANEL_SELECTOR = '[data-cell-split-view="panel"]';

export function findScrollElement(
  root: Document | ShadowRoot | HTMLElement = document,
): HTMLElement | null {
  const panel = root.querySelector(SPLIT_VIEW_PANEL_SELECTOR);
  if (!panel) return null;
  const shadow = panel.shadowRoot;
  if (!shadow) return null;
  return shadow.querySelector<HTMLElement>(CUE_LIST_SCROLL_SELECTOR);
}

export function saveScrollPosition(): number | null {
  const el = findScrollElement();
  return el ? el.scrollTop : null;
}

export function restoreScrollPosition(
  target: HTMLElement,
  saved: number | null,
): boolean {
  if (saved == null) return false;
  const shadow = target.shadowRoot;
  if (!shadow) return false;
  const el = shadow.querySelector<HTMLElement>(CUE_LIST_SCROLL_SELECTOR);
  if (!el) return false;
  el.scrollTop = saved;
  return el.scrollTop === saved;
}
