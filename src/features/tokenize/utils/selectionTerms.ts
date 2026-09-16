// selectionTerms — extract token terms from a native text selection.
//
// Used by the keyboard status shortcuts (1/2/3/4) so the user can select a
// passage of text and batch-change the status of every token inside it.
// Reuses the .js-cell-token spans emitted by the tokenize controllers; terms
// are read from the data-cell-term attribute and de-duplicated (status is
// keyed by term in the DB, so one apply covers every occurrence on the page).

const TOKEN_SELECTOR = '.js-cell-token';

interface ComposedRangeOptions {
  readonly shadowRoots?: readonly ShadowRoot[];
}

interface SelectionWithComposedRanges extends Selection {
  getComposedRanges(options?: ComposedRangeOptions): StaticRange[];
}

function getSelectionRanges(
  selection: Selection,
  shadowRoots: readonly ShadowRoot[],
): Range[] {
  const ranges: Range[] = [];

  const withComposed = selection as SelectionWithComposedRanges;
  if (shadowRoots.length > 0 && typeof withComposed.getComposedRanges === 'function') {
    try {
      const staticRanges = withComposed.getComposedRanges({ shadowRoots });
      for (const sr of staticRanges) {
        if (sr.collapsed) continue;
        const r = document.createRange();
        r.setStart(sr.startContainer, sr.startOffset);
        r.setEnd(sr.endContainer, sr.endOffset);
        ranges.push(r);
      }
    } catch {
      // getComposedRanges may fail for closed shadow roots or cross-tree ranges.
      // Fall back to the legacy non-composed range below.
    }
  }

  if (ranges.length === 0) {
    const legacy = selection.getRangeAt(0);
    if (!legacy.collapsed) ranges.push(legacy);
  }

  return ranges;
}

function getRangeRoot(range: Range): Document | ShadowRoot {
  const root = range.commonAncestorContainer.getRootNode();
  return root instanceof ShadowRoot ? root : document;
}

function rectsIntersect(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** Extract unique terms from token spans (.js-cell-token) intersecting the
 *  given text selection. Returns an empty array when there is no selection,
 *  the selection is collapsed, or no token spans overlap it.
 *
 *  `shadowRoots` should contain the shadow root(s) that may hold selected
 *  tokens (e.g. the subtitle overlay shadow). Without them, selections inside
 *  a shadow tree are retargeted to the host and the tokens cannot be found.
 *
 *  Intersection is tested against the range's painted client rects rather than
 *  Range.intersectsNode so selections still match the tokens they visually
 *  cover even when boundary points are retargeted (e.g. a range reported at
 *  a shadow host's element boundary). When no geometry is available (jsdom)
 *  it falls back to intersectsNode.
 *
 *  ponytail ceiling: O(n) over the token spans under the selection's common
 *  ancestor. On pages with 100k+ tokens under a single ancestor (e.g. a long
 *  article in one container) this scans every token per keypress, but
 *  keypress only fires while a selection exists and selections are small.
 *  Upgrade path: maintain a per-block token index and intersect by block. */
export function extractTermsFromSelection(
  selection: Selection | null,
  shadowRoots: readonly ShadowRoot[] = [],
): string[] {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return [];

  const ranges = getSelectionRanges(selection, shadowRoots);
  if (ranges.length === 0) return [];

  const allowedRoots =
    shadowRoots.length > 0
      ? new Set<Document | ShadowRoot>(shadowRoots)
      : new Set<Document | ShadowRoot>([document]);

  const terms = new Set<string>();
  for (const range of ranges) {
    if (!allowedRoots.has(getRangeRoot(range))) continue;

    const ancestor = range.commonAncestorContainer;
    const container =
      ancestor.nodeType === Node.ELEMENT_NODE
        ? (ancestor as Element)
        : ancestor.parentElement;

    const scoped = container
      ? Array.from(container.querySelectorAll(TOKEN_SELECTOR))
      : [];
    if (container?.matches(TOKEN_SELECTOR)) scoped.unshift(container);
    if (scoped.length === 0) {
      for (const root of allowedRoots) {
        scoped.push(...root.querySelectorAll(TOKEN_SELECTOR));
      }
    }

    const selectionRects =
      typeof range.getClientRects === 'function' ? Array.from(range.getClientRects()) : [];
    for (const token of scoped) {
      const term = token.getAttribute('data-cell-term');
      if (!term || terms.has(term)) continue;
      const hit =
        selectionRects.length > 0
          ? selectionRects.some((rect) => rectsIntersect(rect, token.getBoundingClientRect()))
          : range.intersectsNode(token);
      if (hit) terms.add(term);
    }
  }

  if (shadowRoots.length > 0) {
    const allRects = ranges.flatMap((range) =>
      typeof range.getClientRects === 'function' ? Array.from(range.getClientRects()) : [],
    );
    if (allRects.length > 0) {
      for (const root of shadowRoots) {
        for (const token of root.querySelectorAll(TOKEN_SELECTOR)) {
          const term = token.getAttribute('data-cell-term');
          if (!term || terms.has(term)) continue;
          const tokenRect = token.getBoundingClientRect();
          if (allRects.some((rect) => rectsIntersect(rect, tokenRect))) terms.add(term);
        }
      }
    }
  }
  return [...terms];
}
