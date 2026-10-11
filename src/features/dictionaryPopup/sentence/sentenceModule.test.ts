// sentenceModule tests — SSOT sentence extraction + word extraction.

import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';
import {
  extractWordAtOffset,
  extractSentenceContext,
  createWordRange,
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

  it('keeps a short CJK sentence to its own terminator', () => {
    const p = document.createElement('p');
    p.textContent = '去。海洋很大。';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    const ctx = extractSentenceContext(textNode, 0);
    expect(ctx!.sentence).toBe('去。');
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

describe('extractSentenceContext — tokenizer boundaries', () => {
  it('keeps a one-word sentence to its own terminator (wash parity)', () => {
    const p = document.createElement('p');
    p.textContent = 'Go. The ocean is vast and deep.';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    const ctx = extractSentenceContext(textNode, 0);
    expect(ctx!.sentence).toBe('Go.');
    expect(ctx!.term).toBe('Go');
  });

  it('extracts a mid-length sentence verbatim', () => {
    const p = document.createElement('p');
    p.textContent = 'I went home. The ocean is vast.';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
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
    // Hover "ocean" — the ellipsis closes the sentence.
    const ctx = extractSentenceContext(textNode, 4);
    expect(ctx!.term).toBe('ocean');
    expect(ctx!.sentence).toBe('The ocean...');
  });
});

// resolveWordAtPoint — strict lookup: only resolves when the caret lands
// directly on a word character. Click on whitespace/punctuation/outside text
// returns null (no lookup). "Click đúng vào từ mới tra cứu."
describe('resolveWordAtPoint — strict word-char lookup', () => {
  let originalCaretRange: typeof document.caretRangeFromPoint;

  beforeEach(() => {
    originalCaretRange = document.caretRangeFromPoint;
  });

  afterEach(() => {
    document.caretRangeFromPoint = originalCaretRange;
  });

  /** Helper: mock caretRangeFromPoint to return a collapsed range at (node, offset). */
  function mockCaretAt(node: Text, offset: number): void {
    const r = document.createRange();
    r.setStart(node, offset);
    r.setEnd(node, offset);
    document.caretRangeFromPoint = jest.fn(() => r) as typeof document.caretRangeFromPoint;
  }

  it('click on a word char resolves that word', () => {
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

  it('click on whitespace between words returns null (no lookup)', () => {
    const p = document.createElement('p');
    p.textContent = 'hello world';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    mockCaretAt(textNode, 5); // space between 'hello' and 'world'
    const got = resolveWordAtPoint(28, 10);
    expect(got).toBeNull();
  });

  it('click on punctuation returns null (no lookup)', () => {
    const p = document.createElement('p');
    p.textContent = 'The ocean is vast.';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    // offset 17 = '.' after 'vast' (T=0..t=16, .=17).
    mockCaretAt(textNode, 17);
    const got = resolveWordAtPoint(70, 10);
    expect(got).toBeNull();
  });

  it('caret returns null (outside text) → returns null', () => {
    document.caretRangeFromPoint = jest.fn(() => null) as typeof document.caretRangeFromPoint;
    const got = resolveWordAtPoint(500, 500);
    expect(got).toBeNull();
  });

  it('click on CJK ideograph resolves that ideograph', () => {
    const p = document.createElement('p');
    p.textContent = '我爱你';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    mockCaretAt(textNode, 1); // '爱'
    const got = resolveWordAtPoint(15, 10);
    expect(got).not.toBeNull();
    expect(got!.ctx.term).toBe('爱');
  });

  it('click on space between CJK ideographs returns null', () => {
    const p = document.createElement('p');
    p.textContent = '我 爱 你';
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    mockCaretAt(textNode, 1); // space between 我 and 爱
    const got = resolveWordAtPoint(15, 10);
    expect(got).toBeNull();
  });

  it('click in inline element on a word char resolves across inline tags', () => {
    // 'The <b>ocean</b> is vast.' — click on 'o' inside <b>
    const p = document.createElement('p');
    p.innerHTML = 'The <b>ocean</b> is vast.';
    document.body.appendChild(p);
    const b = p.querySelector('b')!;
    const textNode = b.firstChild as Text;
    mockCaretAt(textNode, 0); // 'o' in 'ocean'
    const got = resolveWordAtPoint(20, 10);
    expect(got).not.toBeNull();
    expect(got!.ctx.term).toBe('ocean');
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

// Non-content text — icon-font ligatures and decorative text nodes are real
// text nodes but not readable words ("pause" the glyph ≠ "pause" the word).
// Guard: aria-hidden / translate="no" / .notranslate ancestors, or an icon
// font on the text node's element. Control elements themselves are NOT
// excluded — real labels inside buttons/chips stay resolvable.
describe('resolveWordAtPoint — non-content text exclusion', () => {
  let originalCaretRange: typeof document.caretRangeFromPoint;

  beforeEach(() => {
    originalCaretRange = document.caretRangeFromPoint;
  });

  afterEach(() => {
    document.caretRangeFromPoint = originalCaretRange;
  });

  function mockCaretAt(node: Text, offset: number): void {
    const r = document.createRange();
    r.setStart(node, offset);
    r.setEnd(node, offset);
    document.caretRangeFromPoint = jest.fn(() => r) as typeof document.caretRangeFromPoint;
  }

  function caretText(html: string, selector: string): Text {
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
    return wrap.querySelector(selector)!.firstChild as Text;
  }

  it('icon ligature inside aria-hidden element does not resolve', () => {
    const textNode = caretText(
      '<button><span class="mat-button-wrapper"><i aria-hidden="true" class="mat-icon">pause</i></span></button>',
      'i',
    );
    mockCaretAt(textNode, 1);
    expect(resolveWordAtPoint(10, 10)).toBeNull();
  });

  it('text inside .notranslate element does not resolve', () => {
    const textNode = caretText('<button><span class="notranslate">pause</span></button>', 'span');
    mockCaretAt(textNode, 1);
    expect(resolveWordAtPoint(10, 10)).toBeNull();
  });

  it('text inside translate="no" element does not resolve', () => {
    const textNode = caretText('<div translate="no"><span>pause</span></div>', 'span');
    mockCaretAt(textNode, 1);
    expect(resolveWordAtPoint(10, 10)).toBeNull();
  });

  it('icon-font text without markers does not resolve', () => {
    const textNode = caretText(
      '<button><i style="font-family: \'Material Icons\'">pause</i></button>',
      'i',
    );
    mockCaretAt(textNode, 1);
    expect(resolveWordAtPoint(10, 10)).toBeNull();
  });

  it('aria-hidden marker on a distant ancestor still blocks', () => {
    const textNode = caretText(
      '<div aria-hidden="true"><div><span><i>pause</i></span></div></div>',
      'i',
    );
    mockCaretAt(textNode, 1);
    expect(resolveWordAtPoint(10, 10)).toBeNull();
  });

  it('real label text inside <button> still resolves', () => {
    const textNode = caretText('<button><span>Sign in</span></button>', 'span');
    mockCaretAt(textNode, 1);
    const got = resolveWordAtPoint(10, 10);
    expect(got).not.toBeNull();
    expect(got!.ctx.term).toBe('Sign');
  });

  it('text inside a role="option" chip still resolves', () => {
    const textNode = caretText('<div role="option">Indonesian</div>', 'div');
    mockCaretAt(textNode, 2);
    const got = resolveWordAtPoint(10, 10);
    expect(got).not.toBeNull();
    expect(got!.ctx.term).toBe('Indonesian');
  });

  it('link text still resolves', () => {
    const textNode = caretText('<p>see <a href="#">article</a> now</p>', 'a');
    mockCaretAt(textNode, 2);
    const got = resolveWordAtPoint(10, 10);
    expect(got).not.toBeNull();
    expect(got!.ctx.term).toBe('article');
  });
});
