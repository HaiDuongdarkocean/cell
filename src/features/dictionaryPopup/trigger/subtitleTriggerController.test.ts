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
  CLICK_DEBOUNCE_MS,
} from './subtitleTriggerController';
import type { LookupRequest, TriggerMode } from '../types';

// jsdom is available via jest-environment-jsdom (default for unit project).

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
    expect(spans[0]!.getAttribute('data-dp-term')).toBe('hello');
    expect(spans[0]!.getAttribute('data-dp-start')).toBe('0');
    expect(spans[0]!.getAttribute('data-dp-end')).toBe('5');
    expect(spans[1]!.textContent).toBe('world');
    expect(spans[1]!.getAttribute('data-dp-term')).toBe('world');
  });

  it('wraps Chinese text into per-char token spans', () => {
    const parent = document.createElement('span');
    const spans = wrapTokenSpans(parent, '我喜欢你', 'zh');
    expect(spans).toHaveLength(4);
    expect(spans[0]!.getAttribute('data-dp-term')).toBe('我');
    expect(spans[1]!.getAttribute('data-dp-term')).toBe('喜');
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
  let onLookup: jest.Mock<(req: LookupRequest, requestId: string) => void>;
  let onCancel: jest.Mock<(requestId: string) => void>;
  let parent: HTMLSpanElement;
  let spans: HTMLSpanElement[];

  function makeController(mode: TriggerMode): SubtitleTriggerController {
    return new SubtitleTriggerController({
      triggerMode: mode,
      onLookup: onLookup as unknown as (req: LookupRequest, requestId: string) => void,
      onCancel: onCancel as unknown as (requestId: string) => void,
    });
  }

  beforeEach(() => {
    onLookup = jest.fn<(req: LookupRequest, requestId: string) => void>();
    onCancel = jest.fn<(requestId: string) => void>();
    parent = document.createElement('span');
    spans = wrapTokenSpans(parent, 'Hello world.', 'en');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('click mode', () => {
    it('dispatches LOOKUP after click debounce', () => {
      jest.useFakeTimers();
      const ctrl = makeController('click');
      ctrl.attach(spans, 'Hello world.', 'en');

      spans[0]!.click();
      expect(onLookup).not.toHaveBeenCalled();
      jest.advanceTimersByTime(CLICK_DEBOUNCE_MS);
      expect(onLookup).toHaveBeenCalledTimes(1);
      expect(onLookup.mock.calls[0]![0].term).toBe('hello');

      ctrl.detach();
    });

    it('cancels previous in-flight on new click', () => {
      jest.useFakeTimers();
      const ctrl = makeController('click');
      ctrl.attach(spans, 'Hello world.', 'en');

      spans[0]!.click();
      jest.advanceTimersByTime(CLICK_DEBOUNCE_MS);
      const firstRequestId = onLookup.mock.calls[0]![1];

      spans[1]!.click();
      jest.advanceTimersByTime(CLICK_DEBOUNCE_MS);
      expect(onCancel).toHaveBeenCalledWith(firstRequestId);

      ctrl.detach();
    });

    it('debounces rapid clicks on same token', () => {
      jest.useFakeTimers();
      const ctrl = makeController('click');
      ctrl.attach(spans, 'Hello world.', 'en');

      spans[0]!.click();
      jest.advanceTimersByTime(CLICK_DEBOUNCE_MS - 1);
      spans[0]!.click();
      jest.advanceTimersByTime(CLICK_DEBOUNCE_MS - 1);
      spans[0]!.click();
      jest.advanceTimersByTime(CLICK_DEBOUNCE_MS);
      expect(onLookup).toHaveBeenCalledTimes(1);

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
      jest.useFakeTimers();
      const ctrl = makeController('click');
      ctrl.attach(spans, 'Hello world.', 'en');

      spans[0]!.click();
      jest.advanceTimersByTime(CLICK_DEBOUNCE_MS);
      const requestId = onLookup.mock.calls[0]![1];
      expect(ctrl.isCurrentRequestId(requestId)).toBe(true);
      expect(ctrl.isCurrentRequestId('wrong-id')).toBe(false);

      ctrl.detach();
    });

    it('clearRequestId clears the in-flight ID', () => {
      jest.useFakeTimers();
      const ctrl = makeController('click');
      ctrl.attach(spans, 'Hello world.', 'en');

      spans[0]!.click();
      jest.advanceTimersByTime(CLICK_DEBOUNCE_MS);
      const requestId = onLookup.mock.calls[0]![1];
      ctrl.clearRequestId(requestId);
      expect(ctrl.isCurrentRequestId(requestId)).toBe(false);

      ctrl.detach();
    });
  });

  describe('detach', () => {
    it('removes all listeners', () => {
      jest.useFakeTimers();
      const ctrl = makeController('click');
      ctrl.attach(spans, 'Hello world.', 'en');
      ctrl.detach();

      spans[0]!.click();
      jest.advanceTimersByTime(CLICK_DEBOUNCE_MS);
      expect(onLookup).not.toHaveBeenCalled();
    });

    it('cancels in-flight request on detach', () => {
      jest.useFakeTimers();
      const ctrl = makeController('click');
      ctrl.attach(spans, 'Hello world.', 'en');

      spans[0]!.click();
      jest.advanceTimersByTime(CLICK_DEBOUNCE_MS);
      const requestId = onLookup.mock.calls[0]![1];
      ctrl.detach();
      expect(onCancel).toHaveBeenCalledWith(requestId);
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
  });
});
