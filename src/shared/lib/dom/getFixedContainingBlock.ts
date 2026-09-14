const CONTAINING_BLOCK_WILL_CHANGE = new Set([
  'transform',
  'filter',
  'perspective',
]);

function willChangeCreatesContainingBlock(value: string): boolean {
  if (!value || value === 'auto') return false;
  return value
    .split(',')
    .some((part) => CONTAINING_BLOCK_WILL_CHANGE.has(part.trim().toLowerCase()));
}

function containCreatesContainingBlock(value: string): boolean {
  if (!value || value === 'none') return false;
  const tokens = value.toLowerCase().split(/\s+/);
  return tokens.some(
    (token) => token === 'layout' || token === 'paint' || token === 'strict' || token === 'content',
  );
}

function hasNonNone(value: string | undefined): boolean {
  return Boolean(value) && value !== 'none';
}

function establishesFixedContainingBlock(
  style: CSSStyleDeclaration,
  isRoot: boolean,
): boolean {
  if (isRoot) return false;

  const display = style.display;
  if (display === 'none' || display === 'contents') return false;

  if (hasNonNone(style.transform)) return true;
  if (hasNonNone(style.filter)) return true;
  if (hasNonNone(style.perspective)) return true;
  if (hasNonNone(style.backdropFilter)) return true;
  if (willChangeCreatesContainingBlock(style.willChange)) return true;
  if (containCreatesContainingBlock(style.contain)) return true;

  return false;
}

function getFlatParentElement(element: Element): Element | null {
  if (element.assignedSlot) return element.assignedSlot;

  const parent = element.parentElement;
  if (parent) return parent;

  const root = element.getRootNode();
  if (root instanceof ShadowRoot) {
    return root.host ?? null;
  }

  return null;
}

export function getFixedContainingBlock(start: Element): Element | null {
  let current: Element | null = getFlatParentElement(start);
  while (current) {
    const doc = current.ownerDocument;
    const isRoot = current === doc?.documentElement;
    const style = getComputedStyle(current);
    if (establishesFixedContainingBlock(style, isRoot)) {
      return current;
    }
    current = getFlatParentElement(current);
  }
  return null;
}
