// subtitleTriggerController tests — spec §4.6.3 A2, §9.4, D9.

import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';
import {
  SubtitleTriggerController,
  wrapTokenSpans,
  buildLookupRequest,
  detectLangCode,
  tokenizeSubtitleText,
  nextRequestId,
  HOVER_DEBOUNCE_MS,
} from './subtitleTriggerController';
import type { LookupRequest, TriggerMode } from '../types';

// jsdom is available via jest-environment-jsdom (default for unit project).

// jsdom does not implement Range.getClientRects. Provide a default mock so
// existing tests (which dispatch events at 0,0) continue to register as
// "over text". Tests that need an "outside" geometry override it locally.
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

describe('detectLangCode', () => {
  it('detects Chinese from CJK text', () => {
    expect(detectLangCode('我喜欢你')).toBe('zh');
    expect(detectLangCode('你好世界')).toBe('zh');
  });

  it('detects English from latin text', () => {
    expect(detectLangCode('Hello world')).toBe('en');
    expect(detectLangCode('The answer was right under my nose')).toBe('en');
  });

  it('detects English from mixed text (mostly latin)', () => {
    expect(detectLangCode('Hello 世界')).toBe('en');
  });

  it('detects Chinese from mostly CJK text', () => {
    expect(detectLangCode('你好 a')).toBe('zh');
  });
});

describe('tokenizeSubtitleText', () => {
  it('tokenizes English by whitespace', () => {
    const tokens = tokenizeSubtitleText('Hello world.', 'en');
    expect(tokens).toHaveLength(2);
    expect(tokens[0]!.text).toBe('hello');
    expect(tokens[1]!.text).toBe('world');
  });

  it('tokenizes Chinese by single chars (empty probe)', () => {
    const tokens = tokenizeSubtitleText('我喜欢你', 'zh');
    expect(tokens).toHaveLength(4);
    expect(tokens.map((t) => t.text)).toEqual(['我', '喜', '欢', '你']);
  });
});

describe('wrapTokenSpans', () => {
  it('wraps English text into per-word token spans', () => {
    const parent = document.createElement('span');
    const spans = wrapTokenSpans(parent, 'Hello world.', 'en');
    expect(spans).toHaveLength(2);
    expect(spans[0]!.textContent).toBe('Hello');
    expect(spans[0]!.getAttribute('data-cell-term')).toBe('hello');
    expect(spans[0]!.getAttribute('data-cell-start')).toBe('0');
    expect(spans[0]!.getAttribute('data-cell-end')).toBe('5');
    expect(spans[1]!.textContent).toBe('world');
    expect(spans[1]!.getAttribute('data-cell-term')).toBe('world');
  });

  it('wraps Chinese text into per-char token spans', () => {
    const parent = document.createElement('span');
    const spans = wrapTokenSpans(parent, '我喜欢你', 'zh');
    expect(spans).toHaveLength(4);
    expect(spans[0]!.getAttribute('data-cell-term')).toBe('我');
    expect(spans[1]!.getAttribute('data-cell-term')).toBe('喜');
  });

  it('preserves whitespace between tokens as text nodes', () => {
    const parent = document.createElement('span');
    const spans = wrapTokenSpans(parent, 'Hello world', 'en');
    expect(spans).toHaveLength(2);
    // Check that there's a text node between the two spans.
    const nodes = Array.from(parent.childNodes);
    expect(nodes.length).toBeGreaterThanOrEqual(3); // span, text, span
  });

  it('handles empty text', () => {
    const parent = document.createElement('span');
    const spans = wrapTokenSpans(parent, '', 'en');
    expect(spans).toEqual([]);
  });
});

describe('buildLookupRequest', () => {
  it('builds a LookupRequest from a token span', () => {
    const parent = document.createElement('span');
    const spans = wrapTokenSpans(parent, 'Hello world.', 'en');
    const req = buildLookupRequest(spans[0]!, 'Hello world.', 'en');
    expect(req.term).toBe('hello');
    expect(req.langCode).toBe('en');
    expect(req.contextSentence).toBe('Hello world.');
    expect(req.cursorOffset).toBe(0);
    expect(req.fallback).toBe(false);
  });

  it('sets fallback=true when requested', () => {
    const parent = document.createElement('span');
    const spans = wrapTokenSpans(parent, 'Hello world.', 'en');
    const req = buildLookupRequest(spans[1]!, 'Hello world.', 'en', true);
    expect(req.fallback).toBe(true);
    expect(req.cursorOffset).toBe(6);
  });
});

describe('nextRequestId', () => {
  it('generates unique IDs', () => {
    const a = nextRequestId();
    const b = nextRequestId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^dp-\d+-\d+$/);
  });
});

describe('SubtitleTriggerController', () => {
  let onLookup: jest.Mock<(req: LookupRequest, requestId: string, anchorRect: DOMRect, highlightTarget: HTMLSpanElement) => void>;
  let onCancel: jest.Mock<(requestId: string) => void>;
  let onClear: jest.Mock<() => void>;
  let parent: HTMLSpanElement;
  let spans: HTMLSpanElement[];

  function makeController(mode: TriggerMode): SubtitleTriggerController {
    return new SubtitleTriggerController({
      triggerMode: mode,
      onLookup,
      onCancel,
      onClear,
    });
  }

  beforeEach(() => {
    onLookup = jest.fn<(req: LookupRequest, requestId: string, anchorRect: DOMRect, highlightTarget: HTMLSpanElement) => void>();
    onCancel = jest.fn<(requestId: string) => void>();
    onClear = jest.fn<() => void>();
    parent = document.createElement('span');
    spans = wrapTokenSpans(parent, 'Hello world.', 'en');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('click mode', () => {
    it('dispatches LOOKUP immediately on click', () => {
      const ctrl = makeController('click');
      ctrl.attach(spans, 'Hello world.', 'en');

      spans[0]!.click();
      expect(onLookup).toHaveBeenCalledTimes(1);
      expect(onLookup.mock.calls[0]![0].term).toBe('hello');

      ctrl.detach();
    });

    it('cancels previous in-flight on new click', () => {
      const ctrl = makeController('click');
      ctrl.attach(spans, 'Hello world.', 'en');

      spans[0]!.click();
      const firstRequestId = onLookup.mock.calls[0]![1];

      spans[1]!.click();
      expect(onCancel).toHaveBeenCalledWith(firstRequestId);
      expect(onLookup).toHaveBeenCalledTimes(2);

      ctrl.detach();
    });

    it('dispatches each rapid click and cancels previous in-flight', () => {
      const ctrl = makeController('click');
      ctrl.attach(spans, 'Hello world.', 'en');

      spans[0]!.click();
      spans[0]!.click();
      spans[0]!.click();
      // Each click cancels the previous one and dispatches a new lookup.
      expect(onLookup).toHaveBeenCalledTimes(3);
      expect(onCancel).toHaveBeenCalledTimes(2);

      ctrl.detach();
    });

    it('does not dispatch click when pointer is outside token geometry', () => {
      const ctrl = makeController('click');
      ctrl.attach(spans, 'Hello world.', 'en');

      // Simulate the token being laid out far from the click.
      Range.prototype.getClientRects = function() {
        return [new DOMRect(500, 500, 50, 20)] as unknown as DOMRectList;
      } as typeof Range.prototype.getClientRects;

      spans[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0 }));
      expect(onLookup).not.toHaveBeenCalled();

      ctrl.detach();
    });
  });

  describe('hover mode', () => {
    it('dispatches LOOKUP after hover debounce', () => {
      jest.useFakeTimers();
      const ctrl = makeController('hover');
      ctrl.attach(spans, 'Hello world.', 'en');

      spans[0]!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      expect(onLookup).not.toHaveBeenCalled();
      jest.advanceTimersByTime(HOVER_DEBOUNCE_MS);
      expect(onLookup).toHaveBeenCalledTimes(1);

      ctrl.detach();
    });

    it('cancels hover timer on mouseleave', () => {
      jest.useFakeTimers();
      const ctrl = makeController('hover');
      ctrl.attach(spans, 'Hello world.', 'en');

      spans[0]!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      spans[0]!.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      jest.advanceTimersByTime(HOVER_DEBOUNCE_MS);
      expect(onLookup).not.toHaveBeenCalled();

      ctrl.detach();
    });

    it('does not dispatch hover when pointer is outside token geometry', () => {
      jest.useFakeTimers();
      const ctrl = makeController('hover');
      ctrl.attach(spans, 'Hello world.', 'en');

      // Simulate the token being laid out far from the cursor.
      Range.prototype.getClientRects = function() {
        return [new DOMRect(500, 500, 50, 20)] as unknown as DOMRectList;
      } as typeof Range.prototype.getClientRects;

      spans[0]!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 0, clientY: 0 }));
      jest.advanceTimersByTime(HOVER_DEBOUNCE_MS);
      expect(onLookup).not.toHaveBeenCalled();

      ctrl.detach();
    });

    it('calls onClear when mouse leaves a token for empty space', () => {
      jest.useFakeTimers();
      const ctrl = makeController('hover');
      ctrl.attach(spans, 'Hello world.', 'en');

      spans[0]!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      spans[0]!.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, relatedTarget: null }));
      jest.advanceTimersByTime(0);
      expect(onClear).toHaveBeenCalled();

      ctrl.detach();
    });

    it('does not call onClear when moving between tokens', () => {
      jest.useFakeTimers();
      const ctrl = makeController('hover');
      ctrl.attach(spans, 'Hello world.', 'en');

      spans[0]!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      spans[0]!.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, relatedTarget: spans[1] }));
      jest.advanceTimersByTime(0);
      expect(onClear).not.toHaveBeenCalled();

      ctrl.detach();
    });

    it('does not call onClear when moving into the popup host', () => {
      jest.useFakeTimers();
      const ctrl = makeController('hover');
      ctrl.attach(spans, 'Hello world.', 'en');

      const popupHost = document.createElement('div');
      popupHost.className = 'js-cell-popup-host';
      document.body.appendChild(popupHost);

      spans[0]!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      spans[0]!.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, relatedTarget: popupHost }));
      jest.advanceTimersByTime(0);
      expect(onClear).not.toHaveBeenCalled();

      ctrl.detach();
      document.body.removeChild(popupHost);
    });
  });

  describe('hover-ctrl mode', () => {
    it('does not trigger without Ctrl', () => {
      jest.useFakeTimers();
      const ctrl = makeController('hover-ctrl');
      ctrl.attach(spans, 'Hello world.', 'en');

      spans[0]!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, ctrlKey: false }));
      jest.advanceTimersByTime(HOVER_DEBOUNCE_MS);
      expect(onLookup).not.toHaveBeenCalled();

      ctrl.detach();
    });

    it('triggers with Ctrl held', () => {
      jest.useFakeTimers();
      const ctrl = makeController('hover-ctrl');
      ctrl.attach(spans, 'Hello world.', 'en');

      spans[0]!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, ctrlKey: true }));
      jest.advanceTimersByTime(HOVER_DEBOUNCE_MS);
      expect(onLookup).toHaveBeenCalledTimes(1);

      ctrl.detach();
    });
  });

  describe('requestId routing', () => {
    it('isCurrentRequestId matches the latest dispatched request', () => {
      const ctrl = makeController('click');
      ctrl.attach(spans, 'Hello world.', 'en');

      spans[0]!.click();
      const requestId = onLookup.mock.calls[0]![1];
      expect(ctrl.isCurrentRequestId(requestId)).toBe(true);
      expect(ctrl.isCurrentRequestId('wrong-id')).toBe(false);

      ctrl.detach();
    });

    it('clearRequestId clears the in-flight ID', () => {
      const ctrl = makeController('click');
      ctrl.attach(spans, 'Hello world.', 'en');

      spans[0]!.click();
      const requestId = onLookup.mock.calls[0]![1];
      ctrl.clearRequestId(requestId);
      expect(ctrl.isCurrentRequestId(requestId)).toBe(false);

      ctrl.detach();
    });
  });

  describe('detach', () => {
    it('removes all listeners', () => {
      const ctrl = makeController('click');
      ctrl.attach(spans, 'Hello world.', 'en');
      ctrl.detach();

      spans[0]!.click();
      expect(onLookup).not.toHaveBeenCalled();
    });

    it('does NOT cancel in-flight request on detach (cue change safety)', () => {
      const ctrl = makeController('click');
      ctrl.attach(spans, 'Hello world.', 'en');

      spans[0]!.click();
      const requestId = onLookup.mock.calls[0]![1];
      ctrl.detach();
      // detach() removes listeners but does NOT cancel in-flight lookup —
      // cue changes call detach() frequently and cancelling would hide the
      // popup every time the subtitle line changes.
      expect(onCancel).not.toHaveBeenCalledWith(requestId);
    });
  });

  describe('setTriggerMode', () => {
    it('switches from click to hover mode', () => {
      jest.useFakeTimers();
      const ctrl = makeController('click');
      ctrl.attach(spans, 'Hello world.', 'en');

      ctrl.setTriggerMode('hover');

      // Click should no longer trigger (hover mode adds click as fallback,
      // but hover is the primary path).
      spans[0]!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      jest.advanceTimersByTime(HOVER_DEBOUNCE_MS);
      expect(onLookup).toHaveBeenCalledTimes(1);

      ctrl.detach();
    });

    it('updates deps.triggerMode so modifier-aware hover modes enforce the modifier', () => {
      jest.useFakeTimers();
      const ctrl = makeController('click');
      ctrl.attach(spans, 'Hello world.', 'en');

      ctrl.setTriggerMode('hover-ctrl');

      // Without ctrl key, hover should not trigger.
      spans[0]!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, ctrlKey: false }));
      jest.advanceTimersByTime(HOVER_DEBOUNCE_MS);
      expect(onLookup).not.toHaveBeenCalled();

      // With ctrl key, hover should trigger.
      spans[0]!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, ctrlKey: true }));
      jest.advanceTimersByTime(HOVER_DEBOUNCE_MS);
      expect(onLookup).toHaveBeenCalledTimes(1);

      ctrl.detach();
    });
  });

  describe('anchor rect (token only)', () => {
    it('passes token bounds only (line avoidance is separate via lineRect)', () => {
      jest.useFakeTimers();
      // Anchor stays on the token; cue/line avoidance is applied later as
      // PopupLineRect from the parent (computeLineRect in webText controller).
      const tokenRect = { top: 50, bottom: 70, left: 100, right: 130, width: 30, height: 20, x: 100, y: 50, toJSON: () => ({}) };
      const lineRect  = { top: 40, bottom: 80, left: 10, right: 500, width: 490, height: 40, x: 10, y: 40, toJSON: () => ({}) };
      spans[0]!.getBoundingClientRect = () => tokenRect as DOMRect;
      parent.getBoundingClientRect = () => lineRect as DOMRect;

      const ctrl = makeController('click');
      ctrl.attach(spans, 'Hello world.', 'en');

      spans[0]!.click();

      expect(onLookup).toHaveBeenCalledTimes(1);
      const anchorRect = onLookup.mock.calls[0]![2];
      expect(anchorRect.top).toBe(50);
      expect(anchorRect.bottom).toBe(70);
      expect(anchorRect.left).toBe(100);
      expect(anchorRect.right).toBe(130);

      ctrl.detach();
    });
  });
});
