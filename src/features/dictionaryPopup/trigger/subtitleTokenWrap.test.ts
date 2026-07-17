// subtitleTokenWrap tests — spec §4.6.3 A1, token-level subtitle overlay.

import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import {
  createTokenWrapState,
  updateOverlayWithTokens,
  enableTokenWrap,
  disableTokenWrap,
  setTriggerMode,
} from './subtitleTokenWrap';
import type { LookupRequest } from '../types';

describe('createTokenWrapState', () => {
  it('creates a disabled state with no trigger controller', () => {
    const state = createTokenWrapState();
    expect(state.enabled).toBe(false);
    expect(state.triggerController).toBeNull();
    expect(state.currentSpans).toEqual([]);
  });
});

describe('updateOverlayWithTokens', () => {
  let overlay: HTMLDivElement;
  let textSpan: HTMLSpanElement;

  beforeEach(() => {
    overlay = document.createElement('div');
    textSpan = document.createElement('span');
    textSpan.setAttribute('data-testid', 'overlay-target-text');
    overlay.appendChild(textSpan);
  });

  it('uses plain text when disabled', () => {
    const state = createTokenWrapState();
    const result = updateOverlayWithTokens(overlay, 'Hello world.', state);
    expect(result).toBe(false);
    expect(textSpan.textContent).toBe('Hello world.');
  });

  it('wraps tokens when enabled', () => {
    const state = createTokenWrapState();
    const onLookup = jest.fn<(req: LookupRequest, id: string) => void>();
    const onCancel = jest.fn<(id: string) => void>();
    enableTokenWrap(state, 'click', onLookup as unknown as (req: LookupRequest, id: string) => void, onCancel as unknown as (id: string) => void);

    const result = updateOverlayWithTokens(overlay, 'Hello world.', state);
    expect(result).toBe(true);
    // Should have token spans as children.
    const spans = textSpan.querySelectorAll('span.js-cell-token');
    expect(spans.length).toBe(2);
  });

  it('detects Chinese and wraps per-char', () => {
    const state = createTokenWrapState();
    const onLookup = jest.fn<(req: LookupRequest, id: string) => void>();
    const onCancel = jest.fn<(id: string) => void>();
    enableTokenWrap(state, 'click', onLookup as unknown as (req: LookupRequest, id: string) => void, onCancel as unknown as (id: string) => void);

    updateOverlayWithTokens(overlay, '我喜欢你', state);
    const spans = textSpan.querySelectorAll('span.js-cell-token');
    expect(spans.length).toBe(4);
    expect(state.currentLangCode).toBe('zh');
  });

  it('handles empty text when enabled', () => {
    const state = createTokenWrapState();
    const onLookup = jest.fn<(req: LookupRequest, id: string) => void>();
    const onCancel = jest.fn<(id: string) => void>();
    enableTokenWrap(state, 'click', onLookup as unknown as (req: LookupRequest, id: string) => void, onCancel as unknown as (id: string) => void);

    const result = updateOverlayWithTokens(overlay, '', state);
    expect(result).toBe(false);
  });

  it('updates currentSentence + currentLangCode in state', () => {
    const state = createTokenWrapState();
    const onLookup = jest.fn<(req: LookupRequest, id: string) => void>();
    const onCancel = jest.fn<(id: string) => void>();
    enableTokenWrap(state, 'click', onLookup as unknown as (req: LookupRequest, id: string) => void, onCancel as unknown as (id: string) => void);

    updateOverlayWithTokens(overlay, 'Hello world.', state);
    expect(state.currentSentence).toBe('Hello world.');
    expect(state.currentLangCode).toBe('en');
  });

  it('detaches previous trigger on new cue', () => {
    const state = createTokenWrapState();
    const onLookup = jest.fn<(req: LookupRequest, id: string) => void>();
    const onCancel = jest.fn<(id: string) => void>();
    enableTokenWrap(state, 'click', onLookup as unknown as (req: LookupRequest, id: string) => void, onCancel as unknown as (id: string) => void);

    // First cue.
    updateOverlayWithTokens(overlay, 'Hello world.', state);
    const firstSpans = state.currentSpans;

    // Second cue — should detach previous.
    updateOverlayWithTokens(overlay, 'Goodbye.', state);
    expect(state.currentSpans).not.toBe(firstSpans);
    expect(state.currentSentence).toBe('Goodbye.');
  });
});

describe('enableTokenWrap / disableTokenWrap', () => {
  it('enable creates a trigger controller', () => {
    const state = createTokenWrapState();
    const onLookup = jest.fn<(req: LookupRequest, id: string) => void>();
    const onCancel = jest.fn<(id: string) => void>();
    enableTokenWrap(state, 'hover', onLookup as unknown as (req: LookupRequest, id: string) => void, onCancel as unknown as (id: string) => void);
    expect(state.enabled).toBe(true);
    expect(state.triggerController).not.toBeNull();
  });

  it('disable detaches + clears state', () => {
    const state = createTokenWrapState();
    const onLookup = jest.fn<(req: LookupRequest, id: string) => void>();
    const onCancel = jest.fn<(id: string) => void>();
    enableTokenWrap(state, 'click', onLookup as unknown as (req: LookupRequest, id: string) => void, onCancel as unknown as (id: string) => void);
    disableTokenWrap(state);
    expect(state.enabled).toBe(false);
    expect(state.currentSpans).toEqual([]);
    expect(state.currentSentence).toBe('');
  });

  it('enable is idempotent (does not create second controller)', () => {
    const state = createTokenWrapState();
    const onLookup = jest.fn<(req: LookupRequest, id: string) => void>();
    const onCancel = jest.fn<(id: string) => void>();
    enableTokenWrap(state, 'click', onLookup as unknown as (req: LookupRequest, id: string) => void, onCancel as unknown as (id: string) => void);
    const first = state.triggerController;
    enableTokenWrap(state, 'click', onLookup as unknown as (req: LookupRequest, id: string) => void, onCancel as unknown as (id: string) => void);
    expect(state.triggerController).toBe(first);
  });
});

describe('setTriggerMode', () => {
  it('updates the trigger mode on the controller', () => {
    const state = createTokenWrapState();
    const onLookup = jest.fn<(req: LookupRequest, id: string) => void>();
    const onCancel = jest.fn<(id: string) => void>();
    enableTokenWrap(state, 'click', onLookup as unknown as (req: LookupRequest, id: string) => void, onCancel as unknown as (id: string) => void);
    // Should not throw.
    expect(() => setTriggerMode(state, 'hover')).not.toThrow();
  });

  it('is a no-op when no controller exists', () => {
    const state = createTokenWrapState();
    expect(() => setTriggerMode(state, 'hover')).not.toThrow();
  });
});
