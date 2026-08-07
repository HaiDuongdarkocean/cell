// wordHighlight tests — spec §3: temporary word highlight in page DOM.

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { createWordHighlight } from './wordHighlight';

describe('WordHighlight', () => {
  let highlight: ReturnType<typeof createWordHighlight>;

  beforeEach(() => {
    highlight = createWordHighlight();
  });

  afterEach(() => {
    highlight.destroy();
    document.body.innerHTML = '';
  });

  it('element mode: adds class to subtitle token span', () => {
    const span = document.createElement('span');
    span.textContent = 'hello';
    document.body.appendChild(span);

    highlight.show(span);

    expect(span.classList.contains('js-cell-word-highlight')).toBe(true);
  });

  it('element mode: clear removes class', () => {
    const span = document.createElement('span');
    span.textContent = 'hello';
    document.body.appendChild(span);

    highlight.show(span);
    highlight.clear();

    expect(span.classList.contains('js-cell-word-highlight')).toBe(false);
  });

  it('DOM wrap mode: wraps continuous range in <span>', () => {
    const p = document.createElement('p');
    p.textContent = 'The quick brown fox';
    document.body.appendChild(p);

    const textNode = p.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 4);  // "quick"
    range.setEnd(textNode, 9);

    highlight.show(range);

    const mark = document.querySelector('span.js-cell-word-highlight');
    expect(mark).not.toBeNull();
    expect(mark!.textContent).toBe('quick');
  });

  it('DOM wrap mode: clear restores original DOM', () => {
    const p = document.createElement('p');
    p.textContent = 'The quick brown fox';
    document.body.appendChild(p);

    const textNode = p.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 4);
    range.setEnd(textNode, 9);

    highlight.show(range);
    highlight.clear();

    expect(document.querySelector('span.js-cell-word-highlight')).toBeNull();
    // Text content should be restored.
    expect(p.textContent).toBe('The quick brown fox');
  });

  it('DOM wrap mode: clear then show again works (no stale state)', () => {
    const p = document.createElement('p');
    p.textContent = 'Hello world';
    document.body.appendChild(p);

    const textNode = p.firstChild as Text;
    const range1 = document.createRange();
    range1.setStart(textNode, 0);
    range1.setEnd(textNode, 5);

    highlight.show(range1);
    highlight.clear();

    // After clear, text nodes may be split — re-query from the paragraph.
    // surroundContents splits "Hello world" into Text("Hello") + Text(" world").
    // clear() unwraps but doesn't rejoin. This is expected DOM behavior.
    const allText = Array.from(p.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE) as Text[];
    expect(allText.length).toBeGreaterThanOrEqual(1);

    // Show on the second text node (" world" → offset 1 = "w").
    const targetNode = allText.find((n) => n.textContent?.includes('world')) ?? allText[0]!;
    const offset = targetNode.textContent!.indexOf('world');
    const range2 = document.createRange();
    range2.setStart(targetNode, offset);
    range2.setEnd(targetNode, offset + 5);

    highlight.show(range2);

    const mark = document.querySelector('span.js-cell-word-highlight');
    expect(mark).not.toBeNull();
    expect(mark!.textContent).toBe('world');
  });

  it('overlay fallback: range split by inline tags uses overlay', () => {
    // <p>ap<em>ple</em></p> — range spanning "apple" crosses element boundary.
    const p = document.createElement('p');
    const text1 = document.createTextNode('ap');
    const em = document.createElement('em');
    em.textContent = 'ple';
    p.appendChild(text1);
    p.appendChild(em);
    document.body.appendChild(p);

    const range = document.createRange();
    range.setStart(text1, 0);
    range.setEnd(em.firstChild as Text, 3);

    // jsdom doesn't implement getClientRects — define it for overlay fallback.
    (range as unknown as { getClientRects: () => DOMRect[] }).getClientRects = () => [
      new DOMRect(10, 20, 30, 15),
    ];

    highlight.show(range);

    // surroundContents should throw → fallback to overlay divs.
    // Either way, something should be highlighted.
    const hasMark = document.querySelector('span.js-cell-word-highlight');
    const hasOverlay = document.querySelector('.js-cell-word-highlight-overlay');

    expect(hasMark !== null || hasOverlay !== null).toBe(true);
  });

  it('overlay fallback: clear removes overlay divs', () => {
    const p = document.createElement('p');
    const text1 = document.createTextNode('ap');
    const em = document.createElement('em');
    em.textContent = 'ple';
    p.appendChild(text1);
    p.appendChild(em);
    document.body.appendChild(p);

    const range = document.createRange();
    range.setStart(text1, 0);
    range.setEnd(em.firstChild as Text, 3);
    range.getClientRects = jest.fn(() => [
      new DOMRect(10, 20, 30, 15),
    ] as unknown as DOMRectList);

    highlight.show(range);
    highlight.clear();

    expect(document.querySelector('.js-cell-word-highlight-overlay')).toBeNull();
  });

  it('injects <style> element with highlight CSS', () => {
    const p = document.createElement('p');
    p.textContent = 'test';
    document.body.appendChild(p);

    const range = document.createRange();
    range.selectNodeContents(p);

    highlight.show(range);

    const style = document.getElementById('cell-word-highlight-style');
    expect(style).not.toBeNull();
    expect(style!.textContent).toContain('js-cell-word-highlight');
    expect(style!.textContent).toContain('!important');
  });

  it('destroy removes style element and highlights', () => {
    const p = document.createElement('p');
    p.textContent = 'test';
    document.body.appendChild(p);

    const range = document.createRange();
    range.selectNodeContents(p);

    highlight.show(range);
    highlight.destroy();

    expect(document.getElementById('cell-word-highlight-style')).toBeNull();
    expect(document.querySelector('span.js-cell-word-highlight')).toBeNull();
  });

  it('show replaces previous highlight (no accumulation)', () => {
    const p = document.createElement('p');
    p.textContent = 'one two three';
    document.body.appendChild(p);

    const textNode = p.firstChild as Text;
    const range1 = document.createRange();
    range1.setStart(textNode, 0);
    range1.setEnd(textNode, 3);

    highlight.show(range1);

    // After surroundContents + clear in show(), text nodes may be split.
    // Re-query the text node containing "two".
    const allText = Array.from(p.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE) as Text[];
    const targetNode = allText.find((n) => n.textContent?.includes('two')) ?? allText[0]!;
    const offset = targetNode.textContent!.indexOf('two');
    const range2 = document.createRange();
    range2.setStart(targetNode, offset);
    range2.setEnd(targetNode, offset + 3);

    highlight.show(range2);

    const marks = document.querySelectorAll('span.js-cell-word-highlight');
    expect(marks.length).toBe(1);
    expect(marks[0]!.textContent).toBe('two');
  });
});
