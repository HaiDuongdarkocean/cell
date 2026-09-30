const RIPPLE_ATTR = 'data-cell-ripple';
const SELF_ATTR = 'data-cell-ripple-self';
const SKIP_ATTR = 'data-cell-no-ripple';
const REMOVE_FALLBACK_MS = 1200;
const delegatedRoots = new WeakSet<ShadowRoot | Document>();

export function spawnRipple(host: HTMLElement, clientX: number, clientY: number): void {
  const rect = host.getBoundingClientRect();
  const diameter = Math.max(rect.width, rect.height) * 2.0;
  const radius = diameter / 2;
  const computed = getComputedStyle(host);
  if (computed.position === 'static') host.style.position = 'relative';
  if (computed.overflow === 'visible') host.style.overflow = 'hidden';
  const span = host.ownerDocument.createElement('span');
  span.setAttribute(RIPPLE_ATTR, '');
  span.style.width = span.style.height = `${diameter}px`;
  span.style.left = `${clientX - rect.left - radius}px`;
  span.style.top = `${clientY - rect.top - radius}px`;
  host.appendChild(span);
  const remove = (): void => span.remove();
  span.addEventListener('animationend', remove, { once: true });
  setTimeout(remove, REMOVE_FALLBACK_MS);
}

export function installRippleDelegation(root: ShadowRoot | Document): () => void {
  if (delegatedRoots.has(root)) return () => {};
  delegatedRoots.add(root);
  const onPointerDown = (event: Event): void => {
    if (!(event instanceof MouseEvent)) return;
    if (event.button !== 0) return;
    let candidate: HTMLElement | null = null;
    for (const node of event.composedPath()) {
      if (node === root) break;
      if (node instanceof ShadowRoot && delegatedRoots.has(node)) return;
      if (!(node instanceof Element)) continue;
      if (node.hasAttribute(SELF_ATTR) || node.hasAttribute(SKIP_ATTR)) return;
      if (candidate) continue;
      const isButton = node instanceof HTMLButtonElement || node.getAttribute('role') === 'button';
      if (!isButton) continue;
      if (node.getAttribute('aria-disabled') === 'true') return;
      if (node instanceof HTMLButtonElement && node.disabled) return;
      candidate = node as HTMLElement;
    }
    if (candidate) spawnRipple(candidate, event.clientX, event.clientY);
  };
  root.addEventListener('pointerdown', onPointerDown, true);
  return () => {
    root.removeEventListener('pointerdown', onPointerDown, true);
    delegatedRoots.delete(root);
  };
}
