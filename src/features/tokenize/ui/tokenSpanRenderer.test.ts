import { describe, expect, it } from '@jest/globals';
import type { Token, TokenBlock } from '@/features/tokenize/types';
import { bindTokenBlock, restyleTokenBlock, unbindTokenBlock, readSegments } from './tokenSpanRenderer';
import { collectSentenceRun } from '@/features/tokenize/logic/sentenceRun';
import { buildTokenSpanCss } from './tokenSpanCss';

function makeBlock(text: string, tokens: Token[]): TokenBlock {
  const element = document.createElement('p');
  const textNode = document.createTextNode(text);
  element.appendChild(textNode);
  return {
    id: 'block-1',
    element,
    sourceNodes: [textNode],
    originalText: text,
    tokens,
    isBound: false,
    lastAccessedAt: 0,
  };
}

describe('tokenSpanRenderer', () => {
  it('binds token spans into a block', () => {
    const block = makeBlock('Hello world.', [
      { text: 'Hello', term: 'hello', start: 0, end: 5, isSeparator: false, sentenceIndex: 0, status: 'unknown', frequencyBand: 'core', reading: undefined },
      { text: 'world', term: 'world', start: 6, end: 11, isSeparator: false, sentenceIndex: 0, status: 'known', frequencyBand: 'common', reading: undefined },
    ]);
    bindTokenBlock(block, { showStatus: true, showFrequency: true });

    const spans = Array.from(block.element.querySelectorAll('.js-Tihoka-token'));
    expect(spans).toHaveLength(4); // 2 words + 2 separators (space + period)

    const hello = spans.find((s) => s.getAttribute('data-tihoka-term') === 'hello');
    expect(hello).toBeTruthy();
    expect(hello!.classList.contains('js-Tihoka-token--status-unknown')).toBe(true);
    expect(hello!.classList.contains('js-Tihoka-token--frequency-core')).toBe(true);
    expect(hello!.querySelector('.js-Tihoka-token-status')).not.toBeNull();
  });

  it('marks only the single unknown word of a sentence as i+1', () => {
    const block = makeBlock('I ate durian. Then the aardvark met the platypus.', [
      { text: 'I', term: 'i', start: 0, end: 1, isSeparator: false, sentenceIndex: 0, status: 'known', frequencyBand: 'core', reading: undefined },
      { text: 'ate', term: 'ate', start: 2, end: 5, isSeparator: false, sentenceIndex: 0, status: 'known', frequencyBand: 'core', reading: undefined },
      { text: 'durian', term: 'durian', start: 6, end: 12, isSeparator: false, sentenceIndex: 0, status: 'unknown', frequencyBand: 'rare', reading: undefined },
      { text: 'aardvark', term: 'aardvark', start: 19, end: 27, isSeparator: false, sentenceIndex: 1, status: 'unknown', frequencyBand: 'rare', reading: undefined },
      { text: 'platypus', term: 'platypus', start: 36, end: 44, isSeparator: false, sentenceIndex: 1, status: 'unknown', frequencyBand: 'rare', reading: undefined },
    ]);
    bindTokenBlock(block, { showStatus: true, showFrequency: true });

    const cls = (term: string) =>
      block.element.querySelector<HTMLElement>(`[data-tihoka-term="${term}"]`)!.classList;
    expect(cls('durian').contains('js-Tihoka-token--i1-off')).toBe(false);
    expect(cls('aardvark').contains('js-Tihoka-token--i1-off')).toBe(true);
    expect(cls('platypus').contains('js-Tihoka-token--i1-off')).toBe(true);
    expect(cls('ate').contains('js-Tihoka-token--i1-off')).toBe(true);
  });

  it('counts the i+1 gap over the cross-block sentence, not the link fragment', () => {
    const p = document.createElement('p');
    const text1 = document.createTextNode('I like ');
    const a = document.createElement('a');
    const text2 = document.createTextNode('durian');
    a.appendChild(text2);
    const text3 = document.createTextNode(' today.');
    p.append(text1, a, text3);
    const t = (term: string, start: number, status: Token['status'], sentenceIndex = 0): Token => ({
      text: term,
      term,
      start,
      end: start + term.length,
      isSeparator: false,
      sentenceIndex,
      status,
      frequencyBand: undefined,
      reading: undefined,
    });
    const b1: TokenBlock = { id: 'b1', element: p, sourceNodes: [text1], originalText: 'I like ', tokens: [t('I', 0, 'known'), t('like', 2, 'known')], isBound: false, lastAccessedAt: 0 };
    const b2: TokenBlock = { id: 'b2', element: a, sourceNodes: [text2], originalText: 'durian', tokens: [t('durian', 0, 'unknown')], isBound: false, lastAccessedAt: 0 };
    const b3: TokenBlock = { id: 'b3', element: p, sourceNodes: [text3], originalText: ' today.', tokens: [t('today', 1, 'known')], isBound: false, lastAccessedAt: 0 };
    bindTokenBlock(b1, { showStatus: true, showFrequency: true });
    bindTokenBlock(b2, { showStatus: true, showFrequency: true });
    bindTokenBlock(b3, { showStatus: true, showFrequency: true });

    const cls = (term: string) => p.querySelector<HTMLElement>(`[data-tihoka-term="${term}"]`)!.classList;
    // The real sentence "I like durian today." has exactly one gap → durian marked.
    expect(cls('durian').contains('js-Tihoka-token--i1-off')).toBe(false);
    expect(cls('like').contains('js-Tihoka-token--i1-off')).toBe(true);

    // A second unknown in the same run makes it dense — nothing stays marked.
    b3.tokens![0]!.status = 'unknown';
    restyleTokenBlock(b3, { showStatus: true, showFrequency: true });
    expect(cls('durian').contains('js-Tihoka-token--i1-off')).toBe(true);
  });

  it('ends the sentence at an untokenized terminator text node between blocks', () => {
    // Wikipedia footnote pattern: <a>here</a>.<sup>[5]</sup> Second sentence…
    // The "." is its own text node — never a tokenize block — but it must
    // still close the sentence or the run swallows the next one.
    const p = document.createElement('p');
    const text1 = document.createTextNode('First ends ');
    const a = document.createElement('a');
    a.appendChild(document.createTextNode('here'));
    const period = document.createTextNode('.');
    const sup = document.createElement('sup');
    sup.appendChild(document.createTextNode('[5]'));
    const text3 = document.createTextNode(' Second starts.');
    p.append(text1, a, period, sup, text3);
    const t = (term: string, start: number): Token => ({
      text: term, term, start, end: start + term.length,
      isSeparator: false, sentenceIndex: 0, status: 'known',
      frequencyBand: undefined, reading: undefined,
    });
    const b1: TokenBlock = { id: 'b1', element: p, sourceNodes: [text1], originalText: 'First ends ', tokens: [t('first', 0), t('ends', 6)], isBound: false, lastAccessedAt: 0 };
    const b2: TokenBlock = { id: 'b2', element: a, sourceNodes: [a.firstChild as Text], originalText: 'here', tokens: [t('here', 0)], isBound: false, lastAccessedAt: 0 };
    const b3: TokenBlock = { id: 'b3', element: p, sourceNodes: [text3], originalText: ' Second starts.', tokens: [t('second', 1), t('starts', 8)], isBound: false, lastAccessedAt: 0 };
    bindTokenBlock(b1, { showStatus: true, showFrequency: true });
    bindTokenBlock(b2, { showStatus: true, showFrequency: true });
    bindTokenBlock(b3, { showStatus: true, showFrequency: true });

    const segs = readSegments(p);
    expect(segs).toHaveLength(3);
    expect(segs[1]!.trailingText).toContain('.');
    // Hovering "Second" must not reach back past the "." boundary.
    expect(collectSentenceRun(segs, 2, 0)).toEqual([{ segment: 2, sentenceIndex: 0 }]);
    // Hovering "here"/"First" must not wash forward into the second sentence.
    expect(collectSentenceRun(segs, 0, 0)).toEqual([
      { segment: 0, sentenceIndex: 0 },
      { segment: 1, sentenceIndex: 0 },
    ]);
  });

  it('never marks single-word fragments (nav links, headings) as i+1', () => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    const textNode = document.createTextNode('Intermediate');
    a.appendChild(textNode);
    li.appendChild(a);
    const block: TokenBlock = {
      id: 'nav-1',
      element: a,
      sourceNodes: [textNode],
      originalText: 'Intermediate',
      tokens: [{ text: 'Intermediate', term: 'intermediate', start: 0, end: 12, isSeparator: false, sentenceIndex: 0, status: 'unknown', frequencyBand: undefined, reading: undefined }],
      isBound: false,
      lastAccessedAt: 0,
    };
    bindTokenBlock(block, { showStatus: true, showFrequency: true });
    const span = a.querySelector<HTMLElement>('[data-tihoka-term="intermediate"]')!;
    expect(span.classList.contains('js-Tihoka-token--i1-off')).toBe(true);
  });

  it('stamps the sentence index on word and gap spans', () => {
    const block = makeBlock('One. Two three.', [
      { text: 'One', term: 'one', start: 0, end: 3, isSeparator: false, sentenceIndex: 0, status: 'known', frequencyBand: 'core', reading: undefined },
      { text: 'Two', term: 'two', start: 5, end: 8, isSeparator: false, sentenceIndex: 1, status: 'unknown', frequencyBand: 'rare', reading: undefined },
      { text: 'three', term: 'three', start: 9, end: 14, isSeparator: false, sentenceIndex: 1, status: 'unknown', frequencyBand: 'rare', reading: undefined },
    ]);
    bindTokenBlock(block, { showStatus: true, showFrequency: true });

    const sentenceOf = (term: string) =>
      block.element.querySelector(`[data-tihoka-term="${term}"]`)!.getAttribute('data-tihoka-sentence');
    expect(sentenceOf('one')).toBe('0');
    expect(sentenceOf('two')).toBe('1');
    // The gap holding the sentence-closing period belongs to sentence 0.
    const gap = block.element.querySelector('.js-Tihoka-token--separator')!;
    expect(gap.textContent).toBe('. ');
    expect(gap.getAttribute('data-tihoka-sentence')).toBe('0');
  });

  it('unbind restores original text node', () => {
    const block = makeBlock('Hello world.', [
      { text: 'Hello', term: 'hello', start: 0, end: 5, isSeparator: false, sentenceIndex: 0, status: 'unknown', frequencyBand: 'none', reading: undefined },
    ]);
    bindTokenBlock(block, { showStatus: true, showFrequency: true });
    expect(block.element.textContent).toBe('Hello world.');
    unbindTokenBlock(block);
    expect(block.element.textContent).toBe('Hello world.');
    expect(block.element.querySelectorAll('.js-Tihoka-token')).toHaveLength(0);
    expect(block.isBound).toBe(false);
  });

  it('soft-unbind preserves tokens so rebind does not re-tokenize (VDLT-Predict FR2)', () => {
    const tokens = [
      { text: 'Hello', term: 'hello', start: 0, end: 5, isSeparator: false, sentenceIndex: 0, status: 'unknown' as const, frequencyBand: 'none' as const, reading: undefined },
    ];
    const block = makeBlock('Hello world.', tokens);
    bindTokenBlock(block, { showStatus: true, showFrequency: true });
    unbindTokenBlock(block);
    // tokens must survive unbind so reverse-scroll rebind is cheap
    expect(block.tokens).toBe(tokens);
    expect(block.tokens).toHaveLength(1);
    // rebind uses the same tokens without re-tokenizing
    bindTokenBlock(block, { showStatus: true, showFrequency: true });
    expect(block.isBound).toBe(true);
    expect(block.tokens).toBe(tokens);
  });

  it('hides status and frequency when toggled off', () => {
    const block = makeBlock('Hello.', [
      { text: 'Hello', term: 'hello', start: 0, end: 5, isSeparator: false, sentenceIndex: 0, status: 'unknown', frequencyBand: 'core', reading: undefined },
    ]);
    bindTokenBlock(block, { showStatus: false, showFrequency: false });
    const span = block.element.querySelector('.js-Tihoka-token');
    expect(span!.classList.contains('js-Tihoka-token--status-off')).toBe(true);
    expect(span!.classList.contains('js-Tihoka-token--frequency-off')).toBe(true);
  });

  it('mirrors token.gloss onto data-gloss and marks gloss-off when hidden', () => {
    const block = makeBlock('Hello.', [
      { text: 'Hello', term: 'hello', start: 0, end: 5, isSeparator: false, sentenceIndex: 0, status: 'unknown', frequencyBand: 'none', reading: undefined, gloss: 'xin chào' },
    ]);
    bindTokenBlock(block, { showStatus: true, showFrequency: true, glossDisplay: 'always' });
    const span = block.element.querySelector('.js-Tihoka-token');
    expect(span!.getAttribute('data-gloss')).toBe('xin chào');
    expect(block.element.querySelector('.js-Tihoka-token--gloss-off')).toBeNull();

    unbindTokenBlock(block);
    bindTokenBlock(block, { showStatus: true, showFrequency: true });
    const off = block.element.querySelector('.js-Tihoka-token--gloss-off');
    expect(off).not.toBeNull();
  });

  describe('annotation display modes', () => {
    const sentence = (statuses: readonly ['unknown' | 'known', 'unknown' | 'known', 'unknown' | 'known']): TokenBlock =>
      makeBlock('Alpha beta gamma.', [
        { text: 'Alpha', term: 'alpha', start: 0, end: 5, isSeparator: false, sentenceIndex: 0, status: statuses[0], frequencyBand: 'none', reading: 'ɑ', gloss: 'a' },
        { text: 'beta', term: 'beta', start: 6, end: 10, isSeparator: false, sentenceIndex: 0, status: statuses[1], frequencyBand: 'none', reading: 'β', gloss: 'b' },
        { text: 'gamma', term: 'gamma', start: 11, end: 16, isSeparator: false, sentenceIndex: 0, status: statuses[2], frequencyBand: 'none', reading: 'γ', gloss: 'g' },
      ]);

    const cls = (block: TokenBlock, term: string) =>
      block.element.querySelector<HTMLElement>(`[data-tihoka-term="${term}"]`)!.classList;

    it('always shows both lanes on every token', () => {
      const block = sentence(['unknown', 'known', 'known']);
      bindTokenBlock(block, { showStatus: true, showFrequency: true, readingDisplay: 'always', glossDisplay: 'always' });
      expect(block.element.querySelector('.js-Tihoka-token--reading-off')).toBeNull();
      expect(block.element.querySelector('.js-Tihoka-token--gloss-off')).toBeNull();
      expect(cls(block, 'alpha').contains('js-Tihoka-token--reading-hover')).toBe(false);
    });

    it('off hides both lanes on every token', () => {
      const block = sentence(['unknown', 'known', 'known']);
      bindTokenBlock(block, { showStatus: true, showFrequency: true });
      expect(cls(block, 'alpha').contains('js-Tihoka-token--reading-off')).toBe(true);
      expect(cls(block, 'alpha').contains('js-Tihoka-token--gloss-off')).toBe(true);
    });

    it('hover marks the lane for CSS hover-gating without suppressing it', () => {
      const block = sentence(['unknown', 'known', 'known']);
      bindTokenBlock(block, { showStatus: true, showFrequency: true, readingDisplay: 'hover', glossDisplay: 'hover' });
      expect(cls(block, 'beta').contains('js-Tihoka-token--reading-hover')).toBe(true);
      expect(cls(block, 'beta').contains('js-Tihoka-token--gloss-hover')).toBe(true);
      expect(cls(block, 'beta').contains('js-Tihoka-token--reading-off')).toBe(false);
      const span = block.element.querySelector<HTMLElement>('[data-tihoka-term="beta"]');
      expect(span!.getAttribute('data-reading')).toBe('β');
    });

    it('unknown shows lanes only on not-known tokens', () => {
      const block = sentence(['unknown', 'known', 'known']);
      bindTokenBlock(block, { showStatus: true, showFrequency: true, readingDisplay: 'unknown', glossDisplay: 'unknown' });
      expect(cls(block, 'alpha').contains('js-Tihoka-token--reading-off')).toBe(false);
      expect(cls(block, 'alpha').contains('js-Tihoka-token--gloss-off')).toBe(false);
      expect(cls(block, 'beta').contains('js-Tihoka-token--reading-off')).toBe(true);
      expect(cls(block, 'beta').contains('js-Tihoka-token--gloss-off')).toBe(true);
      expect(cls(block, 'gamma').contains('js-Tihoka-token--reading-off')).toBe(true);
    });

    it('i1 shows lanes only on the single i+1 word of the sentence', () => {
      const block = sentence(['known', 'unknown', 'known']);
      bindTokenBlock(block, { showStatus: true, showFrequency: true, readingDisplay: 'i1', glossDisplay: 'i1' });
      expect(cls(block, 'beta').contains('js-Tihoka-token--reading-i1')).toBe(true);
      expect(cls(block, 'beta').contains('js-Tihoka-token--reading-off')).toBe(false);
      expect(cls(block, 'beta').contains('js-Tihoka-token--gloss-off')).toBe(false);
      expect(cls(block, 'alpha').contains('js-Tihoka-token--reading-off')).toBe(true);
      expect(cls(block, 'gamma').contains('js-Tihoka-token--gloss-off')).toBe(true);
    });

    it('i1 hides every lane when the sentence has more than one new word', () => {
      const block = sentence(['unknown', 'unknown', 'known']);
      bindTokenBlock(block, { showStatus: true, showFrequency: true, readingDisplay: 'i1' });
      expect(block.element.querySelectorAll('.js-Tihoka-token--reading-off')).toHaveLength(3);
    });
  });

  it('marks carded terms with js-Tihoka-token--has-card and leaves uncarded terms clean', () => {
    const block = makeBlock('Hello world.', [
      { text: 'Hello', term: 'hello', start: 0, end: 5, isSeparator: false, sentenceIndex: 0, status: 'unknown', frequencyBand: 'core', reading: undefined, hasCard: true },
      { text: 'world', term: 'world', start: 6, end: 11, isSeparator: false, sentenceIndex: 0, status: 'unknown', frequencyBand: 'common', reading: undefined },
    ]);
    bindTokenBlock(block, { showStatus: true, showFrequency: true });

    const cls = (term: string) =>
      block.element.querySelector<HTMLElement>(`[data-tihoka-term="${term}"]`)!.classList;
    expect(cls('hello').contains('js-Tihoka-token--has-card')).toBe(true);
    expect(cls('world').contains('js-Tihoka-token--has-card')).toBe(false);
  });

  it('applies and clears the has-card class on in-place restyle', () => {
    const token: Token = { text: 'Hello', term: 'hello', start: 0, end: 5, isSeparator: false, sentenceIndex: 0, status: 'unknown', frequencyBand: 'core', reading: undefined };
    const block = makeBlock('Hello.', [token]);
    bindTokenBlock(block, { showStatus: true, showFrequency: true });
    const span = block.element.querySelector<HTMLElement>('[data-tihoka-term="hello"]')!;

    token.hasCard = true;
    expect(restyleTokenBlock(block, { showStatus: true, showFrequency: true })).toBe(true);
    expect(span.classList.contains('js-Tihoka-token--has-card')).toBe(true);

    token.hasCard = false;
    expect(restyleTokenBlock(block, { showStatus: true, showFrequency: true })).toBe(true);
    expect(span.classList.contains('js-Tihoka-token--has-card')).toBe(false);
  });

  it('fires separator handlers so gaps can wash the sentence on hover/click', () => {
    const block = makeBlock('Hello world.', [
      { text: 'Hello', term: 'hello', start: 0, end: 5, isSeparator: false, sentenceIndex: 0, status: 'unknown', frequencyBand: 'core', reading: undefined },
      { text: 'world', term: 'world', start: 6, end: 11, isSeparator: false, sentenceIndex: 0, status: 'known', frequencyBand: 'common', reading: undefined },
    ]);
    const fired: string[] = [];
    bindTokenBlock(block, {
      showStatus: true,
      showFrequency: true,
      onSeparatorEnter: () => fired.push('enter'),
      onSeparatorLeave: () => fired.push('leave'),
      onSeparatorClick: () => fired.push('click'),
    });
    const sep = block.element.querySelector('.js-Tihoka-token--separator')!;
    sep.dispatchEvent(new MouseEvent('mouseenter'));
    sep.dispatchEvent(new MouseEvent('mouseleave'));
    sep.dispatchEvent(new MouseEvent('click'));
    expect(fired).toEqual(['enter', 'leave', 'click']);
    // The separator must carry its sentence index so the controller can key
    // the pinned wash off it.
    expect(sep.getAttribute('data-tihoka-sentence')).toBe('0');
  });
});

describe('tokenSpanCss', () => {
  it('produces css with token classes and status colors', () => {
    const css = buildTokenSpanCss();
    expect(css).toContain('.js-Tihoka-token');
    expect(css).toContain('--Tihoka-token-status-known');
    expect(css).toContain('--Tihoka-token-freq-core-bg');
  });
});
