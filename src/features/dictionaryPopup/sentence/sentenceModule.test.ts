// sentenceModule tests — SSOT sentence extraction + word extraction.

import { describe, expect, it, beforeEach } from '@jest/globals';
import { extractWordAtOffset, extractSentenceContext, createWordRange, createSentenceRange } from './sentenceModule';

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
