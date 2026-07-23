import { describe, expect, it, jest } from '@jest/globals';
import { resolveWordAtTip, extractWordAtOffset } from './resolveWordAtTip';

describe('resolveWordAtTip', () => {
  it('returns null when the tip is only over badge-owned elements', () => {
    const badge = document.createElement('div');
    badge.setAttribute('data-cell-orbital-badge', 'true');
    document.body.appendChild(badge);

    const original = (document as unknown as { elementsFromPoint?: unknown }).elementsFromPoint;
    (document as unknown as { elementsFromPoint: (x: number, y: number) => Element[] }).elementsFromPoint = jest.fn(() => [badge]);
    const result = resolveWordAtTip({ x: 100, y: 100 });
    expect(result).toBeNull();

    (document as unknown as { elementsFromPoint?: unknown }).elementsFromPoint = original;
    badge.remove();
  });

  it('resolves a word at a text node under the tip', () => {
    const para = document.createElement('p');
    para.textContent = 'Hello orbital world';
    document.body.appendChild(para);

    const textNode = para.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 'Hello'.length);

    const target = document.createElement('span');
    target.textContent = 'Hello';
    document.body.appendChild(target);

    const originalElements = (document as unknown as { elementsFromPoint?: unknown }).elementsFromPoint;
    (document as unknown as { elementsFromPoint: (x: number, y: number) => Element[] }).elementsFromPoint = jest.fn(() => [target]);

    const docWithCaret = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
    const originalCaret = docWithCaret.caretRangeFromPoint;
    docWithCaret.caretRangeFromPoint = jest.fn(() => range);

    const result = resolveWordAtTip({ x: 10, y: 10 });
    expect(result).not.toBeNull();
    expect(result!.request.term).toBe('Hello');
    expect(result!.request.langCode).toBe('en');
    expect(result!.range.toString()).toBe('Hello');

    (document as unknown as { elementsFromPoint?: unknown }).elementsFromPoint = originalElements;
    docWithCaret.caretRangeFromPoint = originalCaret;
    para.remove();
    target.remove();
  });
});

describe('extractWordAtOffset', () => {
  it('extracts latin word boundaries', () => {
    expect(extractWordAtOffset('hello world', 6)).toEqual({ text: 'world', start: 6 });
    expect(extractWordAtOffset('hello world', 4)).toEqual({ text: 'hello', start: 0 });
  });

  it('returns null for whitespace or punctuation', () => {
    expect(extractWordAtOffset('hello world', 5)).toBeNull();
    expect(extractWordAtOffset('hello, world', 5)).toBeNull();
  });
});
