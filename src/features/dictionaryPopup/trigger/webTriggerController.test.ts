// webTriggerController tests — spec §4.6 P1.1: generic web-text lookup.

import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import {
  extractWordAtOffset,
  buildSelectionLookupRequest,
  WebTriggerController,
} from './webTriggerController';

// jsdom does not implement Range.getClientRects. Provide a default mock that
// makes every test point (within 0,0..200,50) register as "over text" so the
// existing assertions continue to pass. Tests that need an "outside" geometry
// can override this for a single test.
let originalGetClientRects: typeof Range.prototype.getClientRects;

beforeEach(() => {
  originalGetClientRects = Range.prototype.getClientRects;
  Range.prototype.getClientRects = function() {
    return [new DOMRect(0, 0, 200, 50)] as unknown as DOMRectList;
  } as typeof Range.prototype.getClientRects;
});

afterEach(() => {
  Range.prototype.getClientRects = originalGetClientRects;
});

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

    it('hover outside word geometry does not dispatch lookup', () => {
      const p = document.createElement('p');
      p.textContent = 'The quick brown fox';
      document.body.appendChild(p);

      const textNode = p.firstChild as Text;
      const mockRange = document.createRange();
      mockRange.setStart(textNode, 4);
      mockRange.setEnd(textNode, 9);
      document.caretRangeFromPoint = jest.fn(() => mockRange) as typeof document.caretRangeFromPoint;

      // Simulate the word being laid out far from the cursor.
      Range.prototype.getClientRects = function() {
        return [new DOMRect(500, 500, 50, 20)] as unknown as DOMRectList;
      } as typeof Range.prototype.getClientRects;

      let lookupCount = 0;
      const ctrl = new WebTriggerController({
        triggerMode: 'hover',
        onLookup: () => { lookupCount++; },
        onCancel: () => {},
      });
      ctrl.attach();

      const event = new MouseEvent('mousemove', { bubbles: true, clientX: 0, clientY: 0 });
      Object.defineProperty(event, 'target', { value: p });
      document.dispatchEvent(event);

      jest.advanceTimersByTime(200);
      expect(lookupCount).toBe(0);

      ctrl.detach();
      document.body.removeChild(p);
    });

    it('hover does not dispatch lookup while cursor is moving quickly', () => {
      const p = document.createElement('p');
      p.textContent = 'The quick brown fox';
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

      // Rapidly move the cursor across the paragraph; each move resets the timer.
      for (let i = 0; i < 10; i++) {
        const event = new MouseEvent('mousemove', { bubbles: true, clientX: i * 20, clientY: 10 });
        Object.defineProperty(event, 'target', { value: p });
        document.dispatchEvent(event);
        jest.advanceTimersByTime(30);
      }

      expect(lookupCount).toBe(0);

      ctrl.detach();
      document.body.removeChild(p);
    });

    it('hover dispatches lookup after the cursor stops moving', () => {
      const p = document.createElement('p');
      p.textContent = 'The quick brown fox';
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

      // Move quickly, then stop.
      for (let i = 0; i < 5; i++) {
        const event = new MouseEvent('mousemove', { bubbles: true, clientX: i * 20, clientY: 10 });
        Object.defineProperty(event, 'target', { value: p });
        document.dispatchEvent(event);
        jest.advanceTimersByTime(30);
      }

      // Cursor now still — wait for the stop debounce.
      jest.advanceTimersByTime(100);
      expect(lookupCount).toBe(1);

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

    it('hover over empty space calls onClear and cancels pending hover', () => {
      const p = document.createElement('p');
      p.textContent = 'The quick brown fox';
      document.body.appendChild(p);

      document.caretRangeFromPoint = jest.fn(() => null) as typeof document.caretRangeFromPoint;

      const onClear = jest.fn();
      const ctrl = new WebTriggerController({
        triggerMode: 'hover',
        onLookup: () => {},
        onCancel: () => {},
        onClear,
      });
      ctrl.attach();

      const event = new MouseEvent('mousemove', { bubbles: true, clientX: 0, clientY: 0 });
      Object.defineProperty(event, 'target', { value: p });
      document.dispatchEvent(event);

      expect(onClear).toHaveBeenCalled();

      ctrl.detach();
      document.body.removeChild(p);
    });

    it('hover into popup host does not call onClear', () => {
      const popupHost = document.createElement('div');
      popupHost.className = 'js-cell-popup-host';
      document.body.appendChild(popupHost);

      const onClear = jest.fn();
      const ctrl = new WebTriggerController({
        triggerMode: 'hover',
        onLookup: () => {},
        onCancel: () => {},
        onClear,
      });
      ctrl.attach();

      const event = new MouseEvent('mousemove', { bubbles: true, clientX: 5, clientY: 5 });
      Object.defineProperty(event, 'target', { value: popupHost });
      document.dispatchEvent(event);

      expect(onClear).not.toHaveBeenCalled();

      ctrl.detach();
      document.body.removeChild(popupHost);
    });

    it('click mode on empty space calls onClear', () => {
      const p = document.createElement('p');
      p.textContent = 'The quick brown fox';
      document.body.appendChild(p);

      document.caretRangeFromPoint = jest.fn(() => null) as typeof document.caretRangeFromPoint;

      const onClear = jest.fn();
      const ctrl = new WebTriggerController({
        triggerMode: 'click',
        onLookup: () => {},
        onCancel: () => {},
        onClear,
      });
      ctrl.attach();

      const event = new MouseEvent('mouseup', { bubbles: true, clientX: 0, clientY: 0 });
      Object.defineProperty(event, 'target', { value: p });
      document.dispatchEvent(event);

      expect(onClear).toHaveBeenCalled();

      ctrl.detach();
      document.body.removeChild(p);
    });

    it('click on subtitle token does not dispatch lookup or onClear', () => {
      const p = document.createElement('p');
      p.textContent = 'The quick brown fox';
      const token = document.createElement('span');
      token.className = 'js-cell-token';
      token.textContent = 'quick';
      p.appendChild(token);
      document.body.appendChild(p);

      document.caretRangeFromPoint = jest.fn(() => null) as typeof document.caretRangeFromPoint;

      let lookupCount = 0;
      const onClear = jest.fn();
      const ctrl = new WebTriggerController({
        triggerMode: 'click',
        onLookup: () => { lookupCount++; },
        onCancel: () => {},
        onClear,
      });
      ctrl.attach();

      const event = new MouseEvent('mouseup', { bubbles: true, clientX: 50, clientY: 10 });
      Object.defineProperty(event, 'target', { value: token });
      document.dispatchEvent(event);

      expect(lookupCount).toBe(0);
      expect(onClear).not.toHaveBeenCalled();

      ctrl.detach();
      document.body.removeChild(p);
    });

    it('selectionchange does not call onClear (must not dismiss open popup)', () => {
      const p = document.createElement('p');
      p.textContent = 'The quick brown fox';
      document.body.appendChild(p);

      const onClear = jest.fn();
      const ctrl = new WebTriggerController({
        triggerMode: 'click',
        onLookup: () => {},
        onCancel: () => {},
        onClear,
      });
      ctrl.attach();

      document.dispatchEvent(new Event('selectionchange'));

      expect(onClear).not.toHaveBeenCalled();

      ctrl.detach();
      document.body.removeChild(p);
    });

    it('setTriggerMode updates deps.triggerMode and enforces modifier checks', () => {
      const p = document.createElement('p');
      p.textContent = 'The quick brown fox';
      document.body.appendChild(p);

      const textNode = p.firstChild as Text;
      const mockRange = document.createRange();
      mockRange.setStart(textNode, 4);
      mockRange.setEnd(textNode, 9);
      document.caretRangeFromPoint = jest.fn(() => mockRange) as typeof document.caretRangeFromPoint;

      let lookupCount = 0;
      const ctrl = new WebTriggerController({
        triggerMode: 'click',
        onLookup: () => { lookupCount++; },
        onCancel: () => {},
      });
      ctrl.attach();

      // Switch from click to a modifier-aware hover mode.
      ctrl.setTriggerMode('hover-ctrl');

      // Without Ctrl: hover should not trigger.
      const moveNoCtrl = new MouseEvent('mousemove', { bubbles: true, clientX: 50, clientY: 10 });
      Object.defineProperty(moveNoCtrl, 'target', { value: p });
      document.dispatchEvent(moveNoCtrl);
      jest.advanceTimersByTime(200);
      expect(lookupCount).toBe(0);

      // With Ctrl: hover should trigger.
      const moveCtrl = new MouseEvent('mousemove', { bubbles: true, clientX: 50, clientY: 10, ctrlKey: true });
      Object.defineProperty(moveCtrl, 'target', { value: p });
      document.dispatchEvent(moveCtrl);
      jest.advanceTimersByTime(200);
      expect(lookupCount).toBe(1);

      ctrl.detach();
      document.body.removeChild(p);
    });

    it('disables pointer-events on popup/orbital hosts and their shadow children while resolving caret range', () => {
      const p = document.createElement('p');
      p.textContent = 'The quick brown fox';
      document.body.appendChild(p);

      const host = document.createElement('div');
      host.className = 'js-cell-popup-host';
      host.style.pointerEvents = 'auto';
      const shadow = host.attachShadow({ mode: 'open' });
      const child = document.createElement('div');
      child.style.pointerEvents = 'auto';
      shadow.appendChild(child);
      document.body.appendChild(host);

      const textNode = p.firstChild as Text;
      const mockRange = document.createRange();
      mockRange.setStart(textNode, 4);
      mockRange.setEnd(textNode, 9);

      let capturedHostPointerEvents = '';
      let capturedChildPointerEvents = '';
      document.caretRangeFromPoint = jest.fn(() => {
        capturedHostPointerEvents = host.style.getPropertyValue('pointer-events');
        capturedChildPointerEvents = child.style.getPropertyValue('pointer-events');
        return mockRange;
      }) as typeof document.caretRangeFromPoint;

      const ctrl = new WebTriggerController({
        triggerMode: 'hover',
        onLookup: () => {},
        onCancel: () => {},
      });
      ctrl.attach();

      const event = new MouseEvent('mousemove', { bubbles: true, clientX: 50, clientY: 10 });
      Object.defineProperty(event, 'target', { value: p });
      document.dispatchEvent(event);
      jest.advanceTimersByTime(100);

      expect(capturedHostPointerEvents).toBe('none');
      expect(capturedChildPointerEvents).toBe('none');
      expect(host.style.getPropertyValue('pointer-events')).toBe('auto');
      expect(child.style.getPropertyValue('pointer-events')).toBe('auto');

      ctrl.detach();
      document.body.removeChild(p);
      document.body.removeChild(host);
    });

    it('processPoint dispatches pointer with badgeCenter and badgeRadius', () => {
      const p = document.createElement('p');
      p.textContent = 'The quick brown fox';
      document.body.appendChild(p);

      const textNode = p.firstChild as Text;
      const mockRange = document.createRange();
      mockRange.setStart(textNode, 4);
      mockRange.setEnd(textNode, 9);
      document.caretRangeFromPoint = jest.fn(() => mockRange) as typeof document.caretRangeFromPoint;

      let capturedPointer: unknown = null;
      const ctrl = new WebTriggerController({
        triggerMode: 'hover',
        onLookup: (_req, _id, _rect, _range, pointer) => { capturedPointer = pointer; },
        onCancel: () => {},
      });
      ctrl.attach();
      ctrl.processPoint(50, 10, { x: 30, y: 10 }, 18, 4.5);

      expect(capturedPointer).toEqual({ x: 50, y: 10, badgeCenter: { x: 30, y: 10 }, badgeRadius: 18, pointerRadius: 4.5 });

      ctrl.detach();
      document.body.removeChild(p);
    });

    it('processPoint re-dispatches when the same term appears at a different offset', () => {
      const p = document.createElement('p');
      p.textContent = 'quick quick';
      document.body.appendChild(p);

      const textNode = p.firstChild as Text;
      document.caretRangeFromPoint = jest.fn((x: number) => {
        const range = document.createRange();
        // First occurrence at x < 100, second at x >= 100.
        const offset = x < 100 ? 0 : 6;
        range.setStart(textNode, offset);
        range.setEnd(textNode, offset + 5);
        return range;
      }) as typeof document.caretRangeFromPoint;

      let lookupCount = 0;
      const ctrl = new WebTriggerController({
        triggerMode: 'hover',
        onLookup: () => { lookupCount++; },
        onCancel: () => {},
      });
      ctrl.attach();

      ctrl.processPoint(50, 10);
      expect(lookupCount).toBe(1);

      // Same term at a different occurrence should trigger again (reposition).
      ctrl.processPoint(150, 10);
      expect(lookupCount).toBe(2);

      // Same occurrence and tiny pointer movement should not re-trigger.
      ctrl.processPoint(152, 10);
      expect(lookupCount).toBe(2);

      ctrl.detach();
      document.body.removeChild(p);
    });
  });

  describe('click / modifier fallback', () => {
    let originalCaretRange: typeof document.caretRangeFromPoint;

    beforeEach(() => {
      originalCaretRange = document.caretRangeFromPoint;
      window.getSelection()?.removeAllRanges();
    });

    afterEach(() => {
      document.caretRangeFromPoint = originalCaretRange;
    });

    function setupCaretRange(p: HTMLParagraphElement): Range {
      const textNode = p.firstChild as Text;
      const mockRange = document.createRange();
      mockRange.setStart(textNode, 4);
      mockRange.setEnd(textNode, 9);
      document.caretRangeFromPoint = jest.fn(() => mockRange) as typeof document.caretRangeFromPoint;
      return mockRange;
    }

    it('click fallback requires modifier in hover-ctrl mode', () => {
      const p = document.createElement('p');
      p.textContent = 'The quick brown fox';
      document.body.appendChild(p);
      setupCaretRange(p);

      let lookupCount = 0;
      const ctrl = new WebTriggerController({
        triggerMode: 'hover-ctrl',
        onLookup: () => { lookupCount++; },
        onCancel: () => {},
      });
      ctrl.attach();

      const noMod = new MouseEvent('mouseup', { bubbles: true, clientX: 50, clientY: 10 });
      Object.defineProperty(noMod, 'target', { value: p });
      document.dispatchEvent(noMod);
      expect(lookupCount).toBe(0);

      const withCtrl = new MouseEvent('mouseup', { bubbles: true, clientX: 50, clientY: 10, ctrlKey: true });
      Object.defineProperty(withCtrl, 'target', { value: p });
      document.dispatchEvent(withCtrl);
      expect(lookupCount).toBe(1);

      ctrl.detach();
      document.body.removeChild(p);
    });

    it('click fallback works without modifier in click and hover modes', () => {
      const p = document.createElement('p');
      p.textContent = 'The quick brown fox';
      document.body.appendChild(p);
      setupCaretRange(p);

      for (const mode of ['click', 'hover'] as const) {
        let lookupCount = 0;
        const ctrl = new WebTriggerController({
          triggerMode: mode,
          onLookup: () => { lookupCount++; },
          onCancel: () => {},
        });
        ctrl.attach();
        const event = new MouseEvent('mouseup', { bubbles: true, clientX: 50, clientY: 10 });
        Object.defineProperty(event, 'target', { value: p });
        document.dispatchEvent(event);
        expect(lookupCount).toBe(1);
        ctrl.detach();
      }

      document.body.removeChild(p);
    });

    it('click fallback does not dispatch lookup when the click is on genuine empty space', () => {
      const p = document.createElement('p');
      p.textContent = 'The quick brown fox';
      document.body.appendChild(p);

      // Realistic empty-space case: caretRangeFromPoint returns null (no text
      // at the click point — the click is in the page margin / block padding).
      // The new hybrid lookup trusts the caret for clicks (100% success goal),
      // so a null caret means "no text here" → no lookup. The previous test
      // mocked a word-char caret with a mismatched far rect, which encoded the
      // old hard geometry gate that caused "lúc được lúc không".
      document.caretRangeFromPoint = jest.fn(() => null) as typeof document.caretRangeFromPoint;

      let lookupCount = 0;
      const ctrl = new WebTriggerController({
        triggerMode: 'click',
        onLookup: () => { lookupCount++; },
        onCancel: () => {},
      });
      ctrl.attach();

      const event = new MouseEvent('mouseup', { bubbles: true, clientX: 0, clientY: 0 });
      Object.defineProperty(event, 'target', { value: p });
      document.dispatchEvent(event);
      expect(lookupCount).toBe(0);

      ctrl.detach();
      document.body.removeChild(p);
    });

    it('click fallback resolves the nearest word when the click lands on whitespace between words', () => {
      const p = document.createElement('p');
      p.textContent = 'The quick brown fox';
      document.body.appendChild(p);
      const textNode = p.firstChild as Text;
      // Caret lands on the space between 'The' and 'quick' (offset 3).
      // The char-scan fallback resolves the nearest word ('The', tie → left).
      const mockRange = document.createRange();
      mockRange.setStart(textNode, 3);
      mockRange.setEnd(textNode, 3);
      document.caretRangeFromPoint = jest.fn(() => mockRange) as typeof document.caretRangeFromPoint;

      let capturedTerm: string | null = null;
      const ctrl = new WebTriggerController({
        triggerMode: 'click',
        onLookup: (req) => { capturedTerm = req.term; },
        onCancel: () => {},
      });
      ctrl.attach();

      const event = new MouseEvent('mouseup', { bubbles: true, clientX: 20, clientY: 10 });
      Object.defineProperty(event, 'target', { value: p });
      document.dispatchEvent(event);
      expect(capturedTerm).toBe('The');

      ctrl.detach();
      document.body.removeChild(p);
    });

    it('click fallback does not dispatch lookup when clicking on the popup or badge host', () => {
      const p = document.createElement('p');
      p.textContent = 'The quick brown fox';
      document.body.appendChild(p);
      setupCaretRange(p);

      const host = document.createElement('div');
      host.className = 'js-cell-popup-host';
      document.body.appendChild(host);

      let lookupCount = 0;
      const ctrl = new WebTriggerController({
        triggerMode: 'click',
        onLookup: () => { lookupCount++; },
        onCancel: () => {},
      });
      ctrl.attach();

      const event = new MouseEvent('mouseup', { bubbles: true, clientX: 50, clientY: 10 });
      Object.defineProperty(event, 'target', { value: host });
      document.dispatchEvent(event);
      expect(lookupCount).toBe(0);

      ctrl.detach();
      document.body.removeChild(p);
      document.body.removeChild(host);
    });
  });
});
