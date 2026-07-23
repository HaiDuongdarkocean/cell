// selectionTerms — extract token terms from a native text selection.
//
// Used by the keyboard status shortcuts (1/2/3/4) so the user can select a
// passage of text and batch-change the status of every token inside it.
// Reuses the .js-cell-token spans emitted by the tokenize controllers; terms
// are read from the data-cell-term attribute and de-duplicated (status is
// keyed by term in the DB, so one apply covers every occurrence on the page).

const TOKEN_SELECTOR = '.js-cell-token';

/** Extract unique terms from token spans (.js-cell-token) intersecting the
 *  given text selection. Returns an empty array when there is no selection,
 *  the selection is collapsed, or no token spans overlap it.
 *
 *  ponytail ceiling: O(n) over the token spans under the selection's common
 *  ancestor. On pages with 100k+ tokens under a single ancestor (e.g. a long
 *  article in one container) this scans every token per keypress, but
 *  keypress only fires while a selection exists and selections are small.
 *  Upgrade path: maintain a per-block token index and intersect by block. */
export function extractTermsFromSelection(selection: Selection | null): string[] {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return [];
  const range = selection.getRangeAt(0);
  if (range.collapsed) return [];

  // Scope the query to the selection's common ancestor so we don't walk the
  // whole document when the selection lives inside a single block. Falls back
  // to document when the ancestor is not an element (e.g. text node whose
  // parent is detached) or the query returns nothing.
  const ancestor = range.commonAncestorContainer;
  const container = ancestor.nodeType === Node.ELEMENT_NODE
    ? (ancestor as Element)
    : ancestor.parentElement;
  const tokens = container
    ? Array.from(container.querySelectorAll(TOKEN_SELECTOR))
    : Array.from(document.querySelectorAll(TOKEN_SELECTOR));

  // If the common ancestor has no tokens but the range spans multiple blocks,
  // fall back to a document-wide scan so tokens in sibling blocks are caught.
  let scoped = tokens;
  if (tokens.length === 0) {
    scoped = Array.from(document.querySelectorAll(TOKEN_SELECTOR));
  }

  const terms = new Set<string>();
  for (const token of scoped) {
    if (range.intersectsNode(token)) {
      const term = token.getAttribute('data-cell-term');
      if (term) terms.add(term);
    }
  }
  return [...terms];
}
