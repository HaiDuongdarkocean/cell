import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, act } from '@testing-library/react';
import { mountTokenizeFab } from './mountTokenizeFab';
import type { TokenizeState, TokenizeStateStore } from '@/features/tokenize/services/tokenizeStateStore';

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: jest.fn(() => Promise.resolve({})),
        set: jest.fn(() => Promise.resolve()),
      },
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
  } as unknown as typeof chrome;
  window.matchMedia = jest.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  } as MediaQueryList)) as unknown as typeof window.matchMedia;
});

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
    setEnabled: jest.fn((enabled: boolean) => { state = { ...state, enabled }; notify(); }),
    setShowStatus: jest.fn((show: boolean) => { state = { ...state, showStatus: show }; notify(); }),
    setShowFrequency: jest.fn((show: boolean) => { state = { ...state, showFrequency: show }; notify(); }),
    setHoveredTerm: jest.fn(),
    toggleSelectedTerm: jest.fn(),
    addSelectedTerm: jest.fn(),
    removeSelectedTerm: jest.fn(),
    clearSelection: jest.fn(),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function getFabButton(host: HTMLElement): HTMLElement | null {
  return (host.shadowRoot as ShadowRoot | null)?.querySelector('[data-cell-id="tokenize-fab-button"]') as HTMLElement | null;
}

function getPanel(host: HTMLElement): HTMLElement | null {
  return (host.shadowRoot as ShadowRoot | null)?.querySelector('[data-cell-id="tokenize-fab-panel"]') as HTMLElement | null;
}

describe('mountTokenizeFab', () => {
  it('mounts a host with the expected class and shadow root', () => {
    const store = createMockStore();
    let destroy: () => void = () => {};
    act(() => { ({ destroy } = mountTokenizeFab({ store })); });

    const host = document.querySelector('.js-cell-tokenize-fab-host') as HTMLElement | null;
    expect(host).toBeInTheDocument();
    expect(host?.shadowRoot).toBeTruthy();

    act(() => { destroy(); });
    expect(document.querySelector('.js-cell-tokenize-fab-host')).not.toBeInTheDocument();
  });

  it('renders the FAB button inside the shadow root', () => {
    const store = createMockStore();
    let destroy: () => void = () => {};
    act(() => { ({ destroy } = mountTokenizeFab({ store })); });
    const host = document.querySelector('.js-cell-tokenize-fab-host') as HTMLElement;

    const button = getFabButton(host);
    expect(button).toBeTruthy();

    act(() => { destroy(); });
  });

  it('opens the panel when the FAB is clicked', () => {
    const store = createMockStore();
    let destroy: () => void = () => {};
    act(() => { ({ destroy } = mountTokenizeFab({ store })); });
    const host = document.querySelector('.js-cell-tokenize-fab-host') as HTMLElement;

    const button = getFabButton(host);
    expect(getPanel(host)).toBeNull();
    act(() => { fireEvent.click(button!); });
    expect(getPanel(host)).toBeTruthy();

    act(() => { destroy(); });
  });

  it('dispatches store setters when toggles are clicked', () => {
    const store = createMockStore();
    let destroy: () => void = () => {};
    act(() => { ({ destroy } = mountTokenizeFab({ store })); });
    const host = document.querySelector('.js-cell-tokenize-fab-host') as HTMLElement;

    const button = getFabButton(host);
    act(() => { fireEvent.click(button!); });

    const shadow = host.shadowRoot as ShadowRoot;
    const enabledToggle = shadow.querySelector('[data-cell-id="tokenize-fab-toggle-enabled"]') as HTMLElement;
    act(() => { fireEvent.click(enabledToggle); });
    expect(store.setEnabled).toHaveBeenCalledWith(true);

    act(() => { destroy(); });
  });

  it('calls onOpenDictionary when the dictionary button is clicked', () => {
    const onOpenDictionary = jest.fn();
    const store = createMockStore({ enabled: true, showStatus: false, showFrequency: false });
    let destroy: () => void = () => {};
    act(() => { ({ destroy } = mountTokenizeFab({ store, onOpenDictionary })); });
    const host = document.querySelector('.js-cell-tokenize-fab-host') as HTMLElement;

    const button = getFabButton(host);
    act(() => { fireEvent.click(button!); });

    const dictButton = (host.shadowRoot as ShadowRoot).querySelector('[data-cell-id="tokenize-fab-dictionary"]') as HTMLElement;
    act(() => { fireEvent.click(dictButton); });
    expect(onOpenDictionary).toHaveBeenCalled();

    act(() => { destroy(); });
  });

  it('re-parents the host when fullscreen changes', () => {
    const store = createMockStore();
    let destroy: () => void = () => {};
    act(() => { ({ destroy } = mountTokenizeFab({ store })); });
    const host = document.querySelector('.js-cell-tokenize-fab-host') as HTMLElement;

    const fsContainer = document.createElement('div');
    (document as unknown as { fullscreenElement: Element }).fullscreenElement = fsContainer;
    document.dispatchEvent(new Event('fullscreenchange'));

    expect(fsContainer.contains(host)).toBe(true);

    delete (document as unknown as { fullscreenElement?: Element }).fullscreenElement;
    document.dispatchEvent(new Event('fullscreenchange'));

    expect(document.body.contains(host)).toBe(true);

    act(() => { destroy(); });
  });
});
