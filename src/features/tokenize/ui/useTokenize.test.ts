import { describe, expect, it } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useTokenize } from './useTokenize';
import type { TokenizeState, TokenizeStateStore } from '@/features/tokenize/services/tokenizeStateStore';

function createMockStore(initial = { enabled: false, showStatus: false, showFrequency: false }): TokenizeStateStore {
  const listeners = new Set<(state: TokenizeState) => void>();
  let state: TokenizeState = {
    ...initial,
    hoveredTerm: null,
    selectedTerms: new Set<string>() as ReadonlySet<string>,
  };

  function notify(): void {
    for (const listener of listeners) {
      listener(state);
    }
  }

  return {
    getState: () => state,
    setEnabled: (enabled: boolean) => { state = { ...state, enabled }; notify(); },
    setShowStatus: (show: boolean) => { state = { ...state, showStatus: show }; notify(); },
    setShowFrequency: (show: boolean) => { state = { ...state, showFrequency: show }; notify(); },
    setHoveredTerm: () => {},
    toggleSelectedTerm: () => {},
    addSelectedTerm: () => {},
    removeSelectedTerm: () => {},
    clearSelection: () => {},
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

describe('useTokenize', () => {
  it('starts with all toggles off when no store is provided', () => {
    const { result } = renderHook(() => useTokenize());
    expect(result.current.state).toEqual({ enabled: false, showStatus: false, showFrequency: false, subtitleEnabled: false });
  });

  it('reads initial state from the store', () => {
    const store = createMockStore({ enabled: true, showStatus: true, showFrequency: false });
    const { result } = renderHook(() => useTokenize({ store }));
    expect(result.current.state).toEqual({ enabled: true, showStatus: true, showFrequency: false, subtitleEnabled: false });
  });

  it('toggles internal state when no store is provided', () => {
    const { result } = renderHook(() => useTokenize());

    act(() => result.current.onToggle('enabled'));
    expect(result.current.state.enabled).toBe(true);

    act(() => result.current.onToggle('showStatus'));
    expect(result.current.state.showStatus).toBe(true);

    act(() => result.current.onToggle('showFrequency'));
    expect(result.current.state.showFrequency).toBe(true);

    act(() => result.current.onToggle('subtitleEnabled'));
    expect(result.current.state.subtitleEnabled).toBe(true);
  });

  it('dispatches store setters when a store is provided', () => {
    const store = createMockStore({ enabled: false, showStatus: false, showFrequency: false });
    const { result } = renderHook(() => useTokenize({ store }));

    act(() => result.current.onToggle('enabled'));
    expect(store.getState().enabled).toBe(true);
    expect(result.current.state.enabled).toBe(true);

    act(() => result.current.onToggle('showStatus'));
    expect(store.getState().showStatus).toBe(true);

    act(() => result.current.onToggle('showFrequency'));
    expect(store.getState().showFrequency).toBe(true);

    act(() => result.current.onToggle('subtitleEnabled'));
    expect(result.current.state.subtitleEnabled).toBe(true);
  });

  it('subscribes to store updates', () => {
    const store = createMockStore({ enabled: false, showStatus: false, showFrequency: false });
    const { result } = renderHook(() => useTokenize({ store }));

    act(() => { store.setEnabled(true); });
    expect(result.current.state.enabled).toBe(true);

    act(() => { store.setShowStatus(true); });
    expect(result.current.state.showStatus).toBe(true);

    act(() => { store.setShowFrequency(true); });
    expect(result.current.state.showFrequency).toBe(true);
  });
});
