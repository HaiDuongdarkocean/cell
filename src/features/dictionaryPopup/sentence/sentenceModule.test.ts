// sentenceModule tests — SSOT sentence extraction + word extraction.

import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';
import {
  extractWordAtOffset,
  extractSentenceContext,
  createWordRange,
  createSentenceRange,
  resolveWordAtPoint,
} from './sentenceModule';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('extractWordAtOffset', () => {
  it('extracts a Latin word at offset', () => {
    expect(extractWordAtOffset('The quick brown fox', 6)).toEqual({ text: 'quick', start: 4 });
  });

  it('extracts a single CJK char at offset', () => {
    expect(extractWordAtOffset('我喜欢你', 0)).toEqual({ text: '我', start: 0 });
    expect(extractWordAtOffset('我喜欢你', 2)).toEqual({ text: '欢', start: 2 });
  });

  it('returns null for whitespace/punctuation', () => {
    expect(extractWordAtOffset('hello world', 5)).toBeNull();
  });

  it('returns null for out-of-bounds', () => {
    expect(extractWordAtOffset('hello', -1)).toBeNull();
    expect(extractWordAtOffset('hello', 5)).toBeNull();
  });

  it('extracts first and last word', () => {
    expect(extractWordAtOffset('hello world', 0)).toEqual({ text: 'hello', start: 0 });
    expect(extractWordAtOffset('hello world', 10)).toEqual({ text: 'world', start: 6 });
  });
});

describe('extractSentenceContext — punctuation split', () => {
  it('extracts sentence with punctuation split (not whole block)', () => {
    const p = document.createElement('p');
    p.textContent = 'The ocean is vast. The sky is blue. The sun is hot.';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    // Hover "sky" — offset 24 in full text (T=20,h=21,e=22,space=23,s=24).
    const ctx = extractSentenceContext(textNode, 24);
    expect(ctx).not.toBeNull();
    expect(ctx!.sentence).toBe('The sky is blue.');
    expect(ctx!.term).toBe('sky');
  });

  it('extracts first sentence', () => {
    const p = document.createElement('p');
    p.textContent = 'The ocean is vast. The sky is blue.';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    const ctx = extractSentenceContext(textNode, 4);
    expect(ctx!.sentence).toBe('The ocean is vast.');
    expect(ctx!.term).toBe('ocean');
  });

  it('extracts last sentence without trailing punctuation', () => {
    const p = document.createElement('p');
    p.textContent = 'First sentence. Second sentence';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    const ctx = extractSentenceContext(textNode, 20);
    expect(ctx!.sentence).toBe('Second sentence');
    expect(ctx!.term).toBe('Second');
  });

  it('does not split on decimal points', () => {
    const p = document.createElement('p');
    p.textContent = 'The depth is 3.5 km. That is deep.';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    // Hover "depth" — offset 5 (T=0,h=1,e=2,space=3,d=4,e=5).
    const ctx = extractSentenceContext(textNode, 5);
    expect(ctx!.sentence).toBe('The depth is 3.5 km.');
    expect(ctx!.term).toBe('depth');
  });

  it('handles CJK sentence punctuation', () => {
    const p = document.createElement('p');
    p.textContent = '海洋很大。它很深。';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    // Hover first CJK char — 4 CJK chars = 4 "words" >= 3 → no merge.
    const ctx = extractSentenceContext(textNode, 0);
    expect(ctx!.sentence).toBe('海洋很大。');
    expect(ctx!.term).toBe('海');
  });

  it('merges short CJK sentence (< 3 chars) with next', () => {
    const p = document.createElement('p');
    p.textContent = '去。海洋很大。';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    // Hover "去" — 1 CJK char < 3 → merge with "海洋很大。"
    const ctx = extractSentenceContext(textNode, 0);
    expect(ctx!.sentence).toBe('去。海洋很大。');
    expect(ctx!.term).toBe('去');
  });

  it('falls back to whole block when no punctuation', () => {
    const p = document.createElement('p');
    p.textContent = 'Ocean Currents';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    const ctx = extractSentenceContext(textNode, 0);
    expect(ctx!.sentence).toBe('Ocean Currents');
    expect(ctx!.term).toBe('Ocean');
  });
});

describe('extractSentenceContext — merge short sentences', () => {
  it('merges sentence < 3 words with the next one', () => {
    const p = document.createElement('p');
    p.textContent = 'Go. The ocean is vast and deep.';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    // Hover "Go" — sentence "Go." has 1 word → merge with next.
    const ctx = extractSentenceContext(textNode, 0);
    expect(ctx!.sentence).toBe('Go. The ocean is vast and deep.');
    expect(ctx!.term).toBe('Go');
  });

  it('does not merge when sentence has >= 3 words', () => {
    const p = document.createElement('p');
    p.textContent = 'I went home. The ocean is vast.';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    // Hover "went" — "I went home." has 3 words → no merge.
    const ctx = extractSentenceContext(textNode, 2);
    expect(ctx!.sentence).toBe('I went home.');
    expect(ctx!.term).toBe('went');
  });
});

describe('extractSentenceContext — multi text node', () => {
  it('handles inline elements splitting text', () => {
    const p = document.createElement('p');
    p.innerHTML = 'The <b>ocean</b> is vast. The sky is blue.';
    document.body.appendChild(p);
    // Find the text node inside <b>.
    const b = p.querySelector('b')!;
    const textNode = b.firstChild as Text;
    const ctx = extractSentenceContext(textNode, 2);
    expect(ctx).not.toBeNull();
    expect(ctx!.term).toBe('ocean');
    expect(ctx!.sentence).toBe('The ocean is vast.');
  });
});

describe('createWordRange', () => {
  it('creates a Range covering the word', () => {
    const p = document.createElement('p');
    p.textContent = 'The ocean is vast.';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    const ctx = extractSentenceContext(textNode, 4)!;
    const range = createWordRange(textNode, 4, ctx);
    expect(range).not.toBeNull();
    expect(range!.toString()).toBe('ocean');
  });

  it('returns null for invalid offsets', () => {
    const p = document.createElement('p');
    p.textContent = 'Hi.';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    const ctx = extractSentenceContext(textNode, 0)!;
    // Pass a bogus offsetInNode that would make nodeStart negative.
    const range = createWordRange(textNode, 100, ctx);
    expect(range).toBeNull();
  });
});

describe('createSentenceRange', () => {
  it('creates a Range covering the full sentence in one text node', () => {
    const p = document.createElement('p');
    p.textContent = 'The ocean is vast. The sky is blue.';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    const ctx = extractSentenceContext(textNode, 4)!;
    const range = createSentenceRange(textNode, 4, ctx);
    expect(range).not.toBeNull();
    // sentenceEnd includes the trailing whitespace consumed by the boundary.
    expect(range!.toString()).toBe('The ocean is vast. ');
  });

  it('creates a Range spanning multiple inline text nodes', () => {
    const p = document.createElement('p');
    p.innerHTML = 'The <b>ocean</b> is vast.';
    document.body.appendChild(p);
    const b = p.querySelector('b')!;
    const textNode = b.firstChild as Text;
    const ctx = extractSentenceContext(textNode, 2)!;
    const range = createSentenceRange(textNode, 2, ctx);
    expect(range).not.toBeNull();
    expect(range!.toString()).toBe('The ocean is vast.');
  });

  it('returns null for a mismatched block element', () => {
    const p = document.createElement('p');
    p.textContent = 'The ocean is vast.';
    document.body.appendChild(p);
    const ctx = extractSentenceContext(p.firstChild as Text, 4)!;
    // Move text node into a different block.
    const other = document.createElement('div');
    other.appendChild(p.firstChild as Text);
    document.body.appendChild(other);
    expect(createSentenceRange(other.firstChild as Text, 4, ctx)).toBeNull();
  });
});

describe('extractSentenceContext — edge cases', () => {
  it('returns null for empty block', () => {
    const p = document.createElement('p');
    p.textContent = '   ';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    expect(extractSentenceContext(textNode, 0)).toBeNull();
  });

  it('returns null when no block container found', () => {
    // Text node not in a block container — create a detached text node.
    const textNode = document.createTextNode('hello');
    expect(extractSentenceContext(textNode, 0)).toBeNull();
  });

  it('handles ellipsis (consecutive dots)', () => {
    const p = document.createElement('p');
    p.textContent = 'The ocean... it was vast. Very deep.';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    // Hover "ocean" — "The ocean..." should be the sentence (ellipsis counts as one boundary).
    const ctx = extractSentenceContext(textNode, 4);
    expect(ctx!.term).toBe('ocean');
    // "The ocean..." has 2 words → merge with "it was vast."
    expect(ctx!.sentence).toBe('The ocean... it was vast.');
  });
});

// resolveWordAtPoint — hybrid lookup algorithm (ADR: lookup 100% success).
// Goal: clicking anywhere inside a sentence that contains text MUST resolve
// to the nearest word. Only genuine empty space (beyond proximity gate) returns null.
describe('resolveWordAtPoint — 100% lookup success', () => {
  let originalCaretRange: typeof document.caretRangeFromPoint;
  let originalGetClientRects: typeof Range.prototype.getClientRects;
  let originalElementsFromPoint: typeof document.elementsFromPoint;

  beforeEach(() => {
    originalCaretRange = document.caretRangeFromPoint;
    originalGetClientRects = Range.prototype.getClientRects;
    originalElementsFromPoint = document.elementsFromPoint;
    // Default: every range is "over the point" so fast-path proximity passes.
    Range.prototype.getClientRects = function () {
      return [new DOMRect(0, 0, 200, 20)] as unknown as DOMRectList;
    } as typeof Range.prototype.getClientRects;
  });

  afterEach(() => {
    document.caretRangeFromPoint = originalCaretRange;
    Range.prototype.getClientRects = originalGetClientRects;
    document.elementsFromPoint = originalElementsFromPoint;
  });

  /** Helper: mock caretRangeFromPoint to return a collapsed range at (node, offset). */
  function mockCaretAt(node: Text, offset: number): void {
    const r = document.createRange();
    r.setStart(node, offset);
    r.setEnd(node, offset);
    document.caretRangeFromPoint = jest.fn(() => r) as typeof document.caretRangeFromPoint;
  }

  it('fast path: click on a word char resolves that word', () => {
    const p = document.createElement('p');
    p.textContent = 'The ocean is vast.';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    mockCaretAt(textNode, 4); // 'o' in 'ocean'
    const got = resolveWordAtPoint(10, 10);
    expect(got).not.toBeNull();
    expect(got!.ctx.term).toBe('ocean');
    expect(got!.range.toString()).toBe('ocean');
  });

  it('AC1: click on whitespace between two words resolves the nearest word (left on tie)', () => {
    const p = document.createElement('p');
    p.textContent = 'hello world';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    // offset 5 = space between 'hello' and 'world'. Tie (dist 1 each) → prefer left.
    mockCaretAt(textNode, 5);
    const got = resolveWordAtPoint(28, 10);
    expect(got).not.toBeNull();
    expect(got!.ctx.term).toBe('hello');
  });

  it('AC1: click on whitespace closer to the right word resolves the right word', () => {
    const p = document.createElement('p');
    p.textContent = 'hello   world';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    // offsets: h0 e1 l2 l3 o4 space5 space6 space7 w8...
    // click at offset 7 (3rd space): dist to 'o'(4)=3, dist to 'w'(8)=1 → right wins.
    mockCaretAt(textNode, 7);
    const got = resolveWordAtPoint(40, 10);
    expect(got).not.toBeNull();
    expect(got!.ctx.term).toBe('world');
  });

  it('AC1: click on punctuation resolves the nearest word to the left', () => {
    const p = document.createElement('p');
    p.textContent = 'The ocean is vast.';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    // offset 16 = '.' after 'vast'. Nearest word char is 't' at 15 (dist 1, left).
    mockCaretAt(textNode, 16);
    const got = resolveWordAtPoint(70, 10);
    expect(got).not.toBeNull();
    expect(got!.ctx.term).toBe('vast');
  });

  it('AC1: CJK — click between ideographs resolves the nearest CJK char', () => {
    const p = document.createElement('p');
    p.textContent = '我 爱 你';
    document.body.appendChild(p);
    const tn2 = p.firstChild as Text;
    mockCaretAt(tn2, 1); // space between 我 and 爱
    const got = resolveWordAtPoint(15, 10);
    expect(got).not.toBeNull();
    expect(got!.ctx.term).toBe('我'); // tie → left
  });

  it('AC2: click in genuine empty space (beyond proximity gate) returns null', () => {
    const p = document.createElement('p');
    p.textContent = 'hello world';
    document.body.appendChild(p);
    // Realistic empty-space case: caretRangeFromPoint returns null (no text at
    // the click point — the click is in the page margin / block padding), but
    // elementsFromPoint still returns the <p> (the block is under the click).
    document.caretRangeFromPoint = jest.fn(() => null) as typeof document.caretRangeFromPoint;
    document.elementsFromPoint = jest.fn(() => [p] as Element[]) as typeof document.elementsFromPoint;
    // Place the word rects far from the click point so the proximity gate rejects.
    Range.prototype.getClientRects = function () {
      return [new DOMRect(0, 0, 50, 20)] as unknown as DOMRectList;
    } as typeof Range.prototype.getClientRects;
    // Click at (500, 500): nearest word rect edge ~ (50, 20). Distance >> gate
    // (1.5 × 20 = 30px). → null.
    const got = resolveWordAtPoint(500, 500);
    expect(got).toBeNull();
  });

  it('AC3 / fallback 2: caret returns null → geometry fallback resolves nearest word', () => {
    const p = document.createElement('p');
    p.textContent = 'alpha beta gamma';
    document.body.appendChild(p);
    // caretRangeFromPoint returns null (e.g. user-select:none or obscured).
    document.caretRangeFromPoint = jest.fn(() => null) as typeof document.caretRangeFromPoint;
    // elementsFromPoint returns the block element.
    document.elementsFromPoint = jest.fn(() => [p] as Element[]) as typeof document.elementsFromPoint;
    // Geometry: lay words out left-to-right, 40px each. Word rects returned by
    // getClientRects depend on the range's text content.
    const words: string[] = ['alpha', 'beta', 'gamma'];
    Range.prototype.getClientRects = function (this: Range) {
      const txt = this.toString().trim();
      const idx = words.indexOf(txt);
      if (idx === -1) return [new DOMRect(0, 0, 0, 0)] as unknown as DOMRectList;
      return [new DOMRect(idx * 40, 0, 35, 20)] as unknown as DOMRectList;
    } as typeof Range.prototype.getClientRects;
    // Click at x=45 → nearest word is 'beta' (rect 40..75, center 57.5). 'alpha' center 17.5.
    const got = resolveWordAtPoint(45, 10);
    expect(got).not.toBeNull();
    expect(got!.ctx.term).toBe('beta');
  });

  it('AC1: click in inline element boundary resolves across inline tags', () => {
    // 'The <b>ocean</b> is vast.' — click on the space between 'The' and 'ocean'
    // (which lives in the parent text node, offset 3).
    const p = document.createElement('p');
    p.innerHTML = 'The <b>ocean</b> is vast.';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text; // "The " (offset 3 = space)
    mockCaretAt(textNode, 3);
    const got = resolveWordAtPoint(20, 10);
    expect(got).not.toBeNull();
    // Tie between 'The' (left, dist 1) and 'ocean' (right, dist 1) → prefer left.
    expect(got!.ctx.term).toBe('The');
  });

  it('returns null when block has no word characters at all', () => {
    const p = document.createElement('p');
    p.textContent = '   ...   ';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    mockCaretAt(textNode, 0);
    const got = resolveWordAtPoint(10, 10);
    expect(got).toBeNull();
  });
});
