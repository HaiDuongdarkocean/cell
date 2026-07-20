import { describe, expect, it, jest } from '@jest/globals';
import { createTokenizeStateStore } from './tokenizeStateStore';

describe('createTokenizeStateStore', () => {
  it('starts with provided initial values', () => {
    const store = createTokenizeStateStore({ initialEnabled: true, initialShowStatus: false });
    expect(store.getState().enabled).toBe(true);
    expect(store.getState().showStatus).toBe(false);
    expect(store.getState().showFrequency).toBe(true);
  });

  it('notifies subscribers on state changes', () => {
    const store = createTokenizeStateStore();
    const listener = jest.fn();
    store.subscribe(listener);
    store.setEnabled(true);
    expect(listener).toHaveBeenCalledWith(store.getState());
  });

  it('tracks selected terms', () => {
    const store = createTokenizeStateStore();
    store.toggleSelectedTerm('hello');
    store.toggleSelectedTerm('world');
    expect(store.getState().selectedTerms.has('hello')).toBe(true);
    expect(store.getState().selectedTerms.has('world')).toBe(true);
    store.toggleSelectedTerm('hello');
    expect(store.getState().selectedTerms.has('hello')).toBe(false);
  });

  it('clears selection', () => {
    const store = createTokenizeStateStore();
    store.addSelectedTerm('hello');
    store.clearSelection();
    expect(store.getState().selectedTerms.size).toBe(0);
  });
});
