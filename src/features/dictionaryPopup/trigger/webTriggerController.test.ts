// webTriggerController tests — spec §4.6 P1.1: generic web-text lookup.

import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import {
  extractWordAtOffset,
  buildSelectionLookupRequest,
  WebTriggerController,
} from './webTriggerController';

describe('extractWordAtOffset', () => {
  it('extracts a Latin word at offset', () => {
    const text = 'The quick brown fox';
    const word = extractWordAtOffset(text, 6); // "quick"
    expect(word).not.toBeNull();
    expect(word!.text).toBe('quick');
    expect(word!.start).toBe(4);
  });

  it('extracts a single CJK char at offset', () => {
    const text = '我喜欢你';
    const word = extractWordAtOffset(text, 0);
    expect(word).not.toBeNull();
    expect(word!.text).toBe('我');
    expect(word!.start).toBe(0);
  });

  it('extracts CJK char at offset 2', () => {
    const text = '我喜欢你';
    const word = extractWordAtOffset(text, 2);
    expect(word).not.toBeNull();
    expect(word!.text).toBe('欢');
    expect(word!.start).toBe(2);
  });

  it('returns null for whitespace at offset', () => {
    const text = 'hello world';
    const word = extractWordAtOffset(text, 5); // space
    expect(word).toBeNull();
  });

  it('returns null for out-of-bounds offset', () => {
    expect(extractWordAtOffset('hello', -1)).toBeNull();
    expect(extractWordAtOffset('hello', 5)).toBeNull();
  });

  it('extracts word at start of string', () => {
    const word = extractWordAtOffset('hello world', 0);
    expect(word!.text).toBe('hello');
    expect(word!.start).toBe(0);
  });

  it('extracts word at end of string', () => {
    const word = extractWordAtOffset('hello world', 10); // 'd' in 'world'
    expect(word!.text).toBe('world');
    expect(word!.start).toBe(6);
  });
});

describe('buildSelectionLookupRequest', () => {
  it('builds a request from a text selection', () => {
    // Mock Selection
    const mockRange = {
      startContainer: { nodeType: Node.TEXT_NODE, textContent: 'hello' },
      startOffset: 0,
    };
    const mockSelection = {
      toString: () => 'hello',
      rangeCount: 1,
      getRangeAt: () => mockRange,
    };
    const request = buildSelectionLookupRequest(mockSelection as unknown as Selection);
    expect(request).not.toBeNull();
    expect(request!.term).toBe('hello');
    expect(request!.fallback).toBe(true);
    expect(request!.langCode).toBe('en');
  });

  it('returns null for empty selection', () => {
    const mockSelection = {
      toString: () => '',
      rangeCount: 0,
      getRangeAt: () => null,
    };
    expect(buildSelectionLookupRequest(mockSelection as unknown as Selection)).toBeNull();
  });

  it('returns null for too-long selection', () => {
    const longText = 'a'.repeat(101);
    const mockRange = {
      startContainer: { nodeType: Node.TEXT_NODE, textContent: longText },
      startOffset: 0,
    };
    const mockSelection = {
      toString: () => longText,
      rangeCount: 1,
      getRangeAt: () => mockRange,
    };
    expect(buildSelectionLookupRequest(mockSelection as unknown as Selection)).toBeNull();
  });

  it('detects Chinese from selection', () => {
    const mockRange = {
      startContainer: { nodeType: Node.TEXT_NODE, textContent: '我喜欢' },
      startOffset: 0,
    };
    const mockSelection = {
      toString: () => '我喜欢',
      rangeCount: 1,
      getRangeAt: () => mockRange,
    };
    const request = buildSelectionLookupRequest(mockSelection as unknown as Selection);
    expect(request!.langCode).toBe('zh');
  });
});

describe('WebTriggerController', () => {
  it('creates with click mode', () => {
    const ctrl = new WebTriggerController({
      triggerMode: 'click',
      onLookup: () => {},
      onCancel: () => {},
    });
    ctrl.attach();
    ctrl.detach();
    expect(ctrl.isCurrentRequestId('test')).toBe(false);
  });

  it('creates with hover mode', () => {
    const ctrl = new WebTriggerController({
      triggerMode: 'hover',
      onLookup: () => {},
      onCancel: () => {},
    });
    ctrl.attach();
    ctrl.detach();
  });

  it('cancelInFlight calls onCancel', () => {
    let cancelled = '';
    const ctrl = new WebTriggerController({
      triggerMode: 'click',
      onLookup: (_req, id) => { ctrl['inFlightRequestId'] = id; },
      onCancel: (id) => { cancelled = id; },
    });
    // Simulate in-flight
    ctrl['inFlightRequestId'] = 'test-123';
    ctrl.cancelInFlight();
    expect(cancelled).toBe('test-123');
  });

  it('clearRequestId clears matching id', () => {
    const ctrl = new WebTriggerController({
      triggerMode: 'click',
      onLookup: () => {},
      onCancel: () => {},
    });
    ctrl['inFlightRequestId'] = 'abc';
    ctrl.clearRequestId('abc');
    expect(ctrl.isCurrentRequestId('abc')).toBe(false);
  });

  it('clearRequestId does not clear non-matching id', () => {
    const ctrl = new WebTriggerController({
      triggerMode: 'click',
      onLookup: () => {},
      onCancel: () => {},
    });
    ctrl['inFlightRequestId'] = 'abc';
    ctrl.clearRequestId('xyz');
    expect(ctrl.isCurrentRequestId('abc')).toBe(true);
  });

  describe('hover dispatch', () => {
    let originalCaretRange: typeof document.caretRangeFromPoint;

    beforeEach(() => {
      originalCaretRange = document.caretRangeFromPoint;
      jest.useFakeTimers();
    });

    afterEach(() => {
      document.caretRangeFromPoint = originalCaretRange;
      jest.useRealTimers();
    });

    it('hover dispatches lookup with anchorRect after debounce', () => {
      // Create a real text node in a paragraph for the hover test.
      const p = document.createElement('p');
      p.textContent = 'The quick brown fox';
      document.body.appendChild(p);

      // Mock caretRangeFromPoint to return a range pointing at the text node.
      const textNode = p.firstChild as Text;
      const mockRange = document.createRange();
      mockRange.setStart(textNode, 4); // "quick"
      mockRange.setEnd(textNode, 9);
      document.caretRangeFromPoint = jest.fn(() => mockRange) as typeof document.caretRangeFromPoint;

      let lookupCalled = false;
      let capturedRect: DOMRect | null = null;

      const ctrl = new WebTriggerController({
        triggerMode: 'hover',
        onLookup: (_req, _id, rect, _range) => {
          lookupCalled = true;
          capturedRect = rect;
        },
        onCancel: () => {},
      });
      ctrl.attach();

      // Simulate mousemove over the paragraph.
      const event = new MouseEvent('mousemove', {
        bubbles: true,
        clientX: 50,
        clientY: 10,
      });
      Object.defineProperty(event, 'target', { value: p });
      document.dispatchEvent(event);

      // Before debounce — no lookup yet.
      expect(lookupCalled).toBe(false);

      // After 150ms — lookup dispatched with rect.
      jest.advanceTimersByTime(150);
      expect(lookupCalled).toBe(true);
      expect(capturedRect).not.toBeNull();

      ctrl.detach();
      document.body.removeChild(p);
    });

    it('hover over non-text cancels pending timer', () => {
      const p = document.createElement('p');
      p.textContent = 'Hello world';
      document.body.appendChild(p);

      const textNode = p.firstChild as Text;
      const mockRange = document.createRange();
      mockRange.setStart(textNode, 0);
      mockRange.setEnd(textNode, 5);
      document.caretRangeFromPoint = jest.fn(() => mockRange) as typeof document.caretRangeFromPoint;

      let lookupCount = 0;
      const ctrl = new WebTriggerController({
        triggerMode: 'hover',
        onLookup: () => { lookupCount++; },
        onCancel: () => {},
      });
      ctrl.attach();

      // First mousemove over text — starts timer.
      const event1 = new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 10 });
      Object.defineProperty(event1, 'target', { value: p });
      document.dispatchEvent(event1);

      // Second mousemove — caretRangeFromPoint returns null (cursor over image).
      document.caretRangeFromPoint = jest.fn(() => null) as typeof document.caretRangeFromPoint;
      const event2 = new MouseEvent('mousemove', { bubbles: true, clientX: 200, clientY: 200 });
      Object.defineProperty(event2, 'target', { value: p });
      document.dispatchEvent(event2);

      // Advance past debounce — no lookup should fire (timer was cancelled).
      jest.advanceTimersByTime(200);
      expect(lookupCount).toBe(0);

      ctrl.detach();
      document.body.removeChild(p);
    });

    it('hover dispatches lookup with Range passed for highlighting', () => {
      const p = document.createElement('p');
      p.textContent = 'The quick brown fox';
      document.body.appendChild(p);

      const textNode = p.firstChild as Text;
      const mockRange = document.createRange();
      mockRange.setStart(textNode, 4);
      mockRange.setEnd(textNode, 9);
      document.caretRangeFromPoint = jest.fn(() => mockRange) as typeof document.caretRangeFromPoint;

      let capturedRange: Range | null = null;
      const ctrl = new WebTriggerController({
        triggerMode: 'hover',
        onLookup: (_req, _id, _rect, range) => { capturedRange = range; },
        onCancel: () => {},
      });
      ctrl.attach();

      const event = new MouseEvent('mousemove', { bubbles: true, clientX: 50, clientY: 10 });
      Object.defineProperty(event, 'target', { value: p });
      document.dispatchEvent(event);

      jest.advanceTimersByTime(150);
      expect(capturedRange).not.toBeNull();

      ctrl.detach();
      document.body.removeChild(p);
    });

    it('hover over subtitle token does not dispatch lookup', () => {
      const p = document.createElement('p');
      p.textContent = 'The quick brown fox';
      const token = document.createElement('span');
      token.className = 'js-cell-token';
      token.textContent = 'quick';
      p.appendChild(token);
      document.body.appendChild(p);

      const mockRange = document.createRange();
      const tokenText = token.firstChild as Text;
      mockRange.setStart(tokenText, 0);
      mockRange.setEnd(tokenText, 5);
      document.caretRangeFromPoint = jest.fn(() => mockRange) as typeof document.caretRangeFromPoint;

      let lookupCount = 0;
      const ctrl = new WebTriggerController({
        triggerMode: 'hover',
        onLookup: () => { lookupCount++; },
        onCancel: () => {},
      });
      ctrl.attach();

      const event = new MouseEvent('mousemove', { bubbles: true, clientX: 50, clientY: 10 });
      Object.defineProperty(event, 'target', { value: token });
      document.dispatchEvent(event);

      jest.advanceTimersByTime(200);
      expect(lookupCount).toBe(0);

      ctrl.detach();
      document.body.removeChild(p);
    });
  });
});
