import { describe, expect, it } from '@jest/globals';
import type { Token, TokenBlock } from '@/features/tokenize/types';
import { bindTokenBlock, unbindTokenBlock } from './tokenSpanRenderer';
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
      { text: 'Hello', term: 'hello', start: 0, end: 5, isSeparator: false, sentenceIndex: 0, status: 'unknown', frequencyBand: 'high' },
      { text: 'world', term: 'world', start: 6, end: 11, isSeparator: false, sentenceIndex: 0, status: 'known', frequencyBand: 'medium' },
    ]);
    bindTokenBlock(block, { showStatus: true, showFrequency: true });

    const spans = Array.from(block.element.querySelectorAll('.js-cell-token'));
    expect(spans).toHaveLength(4); // 2 words + 2 separators (space + period)

    const hello = spans.find((s) => s.getAttribute('data-cell-term') === 'hello');
    expect(hello).toBeTruthy();
    expect(hello!.classList.contains('js-cell-token--status-unknown')).toBe(true);
    expect(hello!.classList.contains('js-cell-token--frequency-high')).toBe(true);
    expect(hello!.querySelector('.js-cell-token-status')).not.toBeNull();
  });

  it('unbind restores original text node', () => {
    const block = makeBlock('Hello world.', [
      { text: 'Hello', term: 'hello', start: 0, end: 5, isSeparator: false, sentenceIndex: 0, status: 'unknown', frequencyBand: 'none' },
    ]);
    bindTokenBlock(block, { showStatus: true, showFrequency: true });
    expect(block.element.textContent).toBe('Hello world.');
    unbindTokenBlock(block);
    expect(block.element.textContent).toBe('Hello world.');
    expect(block.element.querySelectorAll('.js-cell-token')).toHaveLength(0);
    expect(block.isBound).toBe(false);
  });

  it('hides status and frequency when toggled off', () => {
    const block = makeBlock('Hello.', [
      { text: 'Hello', term: 'hello', start: 0, end: 5, isSeparator: false, sentenceIndex: 0, status: 'unknown', frequencyBand: 'high' },
    ]);
    bindTokenBlock(block, { showStatus: false, showFrequency: false });
    const span = block.element.querySelector('.js-cell-token');
    expect(span!.classList.contains('js-cell-token--status-off')).toBe(true);
    expect(span!.classList.contains('js-cell-token--frequency-off')).toBe(true);
  });
});

describe('tokenSpanCss', () => {
  it('produces css with token classes and status colors', () => {
    const css = buildTokenSpanCss();
    expect(css).toContain('.js-cell-token');
    expect(css).toContain('--cell-token-status-known');
    expect(css).toContain('--cell-token-freq-high-bg');
  });
});
