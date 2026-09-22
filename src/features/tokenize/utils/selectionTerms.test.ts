import { extractTermsFromSelection } from './selectionTerms';

function makeToken(term: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'js-cell-token';
  span.setAttribute('data-cell-term', term);
  span.textContent = term;
  return span;
}

function selectRange(startNode: Node, startOffset: number, endNode: Node, endOffset: number): Selection {
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
  return sel;
}

describe('extractTermsFromSelection', () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    document.body.innerHTML = '';
  });

  it('returns empty for null selection', () => {
    expect(extractTermsFromSelection(null)).toEqual([]);
  });

  it('returns empty for collapsed selection', () => {
    const p = document.createElement('p');
    p.textContent = 'hello world';
    document.body.appendChild(p);
    const sel = selectRange(p.firstChild!, 0, p.firstChild!, 0);
    expect(extractTermsFromSelection(sel)).toEqual([]);
  });

  it('collects terms from token spans intersecting the selection', () => {
    const p = document.createElement('p');
    const t1 = makeToken('hello');
    const t2 = makeToken('world');
    p.appendChild(t1);
    p.appendChild(document.createTextNode(' '));
    p.appendChild(t2);
    document.body.appendChild(p);
    // Select across both tokens.
    const sel = selectRange(p.firstChild!, 0, p.lastChild!, 0);
    const terms = extractTermsFromSelection(sel);
    expect(terms.sort()).toEqual(['hello', 'world']);
  });

  it('de-duplicates terms', () => {
    const p = document.createElement('p');
    const t1 = makeToken('hello');
    p.appendChild(t1);
    p.appendChild(document.createTextNode(' '));
    const t2 = makeToken('hello');
    p.appendChild(t2);
    document.body.appendChild(p);
    const sel = selectRange(p.firstChild!, 0, p.lastChild!, 0);
    expect(extractTermsFromSelection(sel)).toEqual(['hello']);
  });

  it('only includes tokens that intersect the selection', () => {
    const p = document.createElement('p');
    const t1 = makeToken('hello');
    p.appendChild(t1);
    p.appendChild(document.createTextNode(' '));
    const t2 = makeToken('world');
    p.appendChild(t2);
    document.body.appendChild(p);
    // Select only inside the first token.
    const sel = selectRange(t1.firstChild!, 0, t1.firstChild!, 2);
    expect(extractTermsFromSelection(sel)).toEqual(['hello']);
  });

  it('extracts terms from a range inside a supplied shadow root', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const cue = document.createElement('span');
    cue.appendChild(makeToken('alpha'));
    cue.appendChild(document.createTextNode(' '));
    cue.appendChild(makeToken('beta'));
    shadow.appendChild(cue);
    document.body.appendChild(host);

    const range = document.createRange();
    range.selectNodeContents(cue);
    const shadowSelection = {
      isCollapsed: false,
      rangeCount: 1,
      getRangeAt: () => range,
    } as unknown as Selection;

    expect(extractTermsFromSelection(shadowSelection, [shadow]).sort()).toEqual(['alpha', 'beta']);
  });

  it('extracts terms when the document selection reports collapsed but getComposedRanges returns a shadow range', () => {
    // Real Chromium shape for a drag selection fully inside a shadow root:
    // document.getSelection() retargets anchor/focus to the host → isCollapsed
    // true, legacy range collapsed; only getComposedRanges exposes the real
    // range. (Programmatic addRange reports isCollapsed=false — e2e-only.)
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const cue = document.createElement('span');
    cue.appendChild(makeToken('alpha'));
    cue.appendChild(document.createTextNode(' '));
    cue.appendChild(makeToken('beta'));
    shadow.appendChild(cue);
    document.body.appendChild(host);

    const collapsedRange = document.createRange();
    collapsedRange.setStart(document.body, 1);
    collapsedRange.collapse(true);
    const shadowSelection = {
      isCollapsed: true,
      rangeCount: 1,
      getRangeAt: () => collapsedRange,
      getComposedRanges: ({ shadowRoots }: { shadowRoots: ShadowRoot[] }) =>
        shadowRoots.includes(shadow)
          ? [{
              collapsed: false,
              startContainer: cue.firstChild!.firstChild!,
              startOffset: 0,
              endContainer: cue.lastChild!.firstChild!,
              endOffset: 4,
            }]
          : [],
    } as unknown as Selection;

    expect(extractTermsFromSelection(shadowSelection, [shadow]).sort()).toEqual(['alpha', 'beta']);
  });

  it('returns empty when the document selection is collapsed and no composed range exists', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    document.body.appendChild(host);

    const collapsedRange = document.createRange();
    collapsedRange.setStart(document.body, 0);
    collapsedRange.collapse(true);
    const shadowSelection = {
      isCollapsed: true,
      rangeCount: 1,
      getRangeAt: () => collapsedRange,
      getComposedRanges: () => [{ collapsed: true }],
    } as unknown as Selection;

    expect(extractTermsFromSelection(shadowSelection, [shadow])).toEqual([]);
  });

  it('ignores a range inside a shadow root that was not supplied', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const cue = document.createElement('span');
    cue.appendChild(makeToken('alpha'));
    shadow.appendChild(cue);
    document.body.appendChild(host);

    const range = document.createRange();
    range.selectNodeContents(cue);
    const shadowSelection = {
      isCollapsed: false,
      rangeCount: 1,
      getRangeAt: () => range,
    } as unknown as Selection;

    expect(extractTermsFromSelection(shadowSelection)).toEqual([]);
  });

  it('scopes the query to the common ancestor', () => {
    const container = document.createElement('div');
    const p1 = document.createElement('p');
    p1.appendChild(makeToken('alpha'));
    const p2 = document.createElement('p');
    p2.appendChild(makeToken('beta'));
    container.appendChild(p1);
    container.appendChild(p2);
    document.body.appendChild(container);
    // Select across both paragraphs — common ancestor is container.
    const sel = selectRange(p1.firstChild!.firstChild!, 0, p2.firstChild!.firstChild!, 0);
    const terms = extractTermsFromSelection(sel);
    expect(terms.sort()).toEqual(['alpha', 'beta']);
  });
});
