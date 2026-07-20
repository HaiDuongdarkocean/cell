/**
 * In-memory reactive state for the active tokenize session.
 *
 * This store intentionally does NOT persist to chrome.storage. It tracks UI
 * state for the current page (selected terms, hover, layer toggles). The
 * controller subscribes and re-binds visible blocks when toggles change.
 */
export interface TokenizeState {
  enabled: boolean;
  showStatus: boolean;
  showFrequency: boolean;
  hoveredTerm: string | null;
  selectedTerms: ReadonlySet<string>;
}

export interface TokenizeStateStore {
  getState(): TokenizeState;
  setEnabled(enabled: boolean): void;
  setShowStatus(show: boolean): void;
  setShowFrequency(show: boolean): void;
  setHoveredTerm(term: string | null): void;
  toggleSelectedTerm(term: string): void;
  addSelectedTerm(term: string): void;
  removeSelectedTerm(term: string): void;
  clearSelection(): void;
  subscribe(listener: (state: TokenizeState) => void): () => void;
}

export interface CreateTokenizeStateStoreOptions {
  initialEnabled?: boolean;
  initialShowStatus?: boolean;
  initialShowFrequency?: boolean;
}

export function createTokenizeStateStore(options: CreateTokenizeStateStoreOptions = {}): TokenizeStateStore {
  const state: TokenizeState = {
    enabled: options.initialEnabled ?? false,
    showStatus: options.initialShowStatus ?? true,
    showFrequency: options.initialShowFrequency ?? true,
    hoveredTerm: null,
    selectedTerms: new Set<string>(),
  };

  const listeners = new Set<(state: TokenizeState) => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener(state);
    }
  }

  function set<K extends keyof TokenizeState>(key: K, value: TokenizeState[K]): void {
    if (state[key] === value) return;
    state[key] = value;
    notify();
  }

  return {
    getState: () => state,

    setEnabled: (enabled) => set('enabled', enabled),
    setShowStatus: (show) => set('showStatus', show),
    setShowFrequency: (show) => set('showFrequency', show),
    setHoveredTerm: (term) => set('hoveredTerm', term),

    toggleSelectedTerm(term) {
      const next = new Set(state.selectedTerms as Set<string>);
      if (next.has(term)) next.delete(term);
      else next.add(term);
      set('selectedTerms', next as ReadonlySet<string>);
    },

    addSelectedTerm(term) {
      const next = new Set(state.selectedTerms as Set<string>);
      next.add(term);
      set('selectedTerms', next as ReadonlySet<string>);
    },

    removeSelectedTerm(term) {
      const next = new Set(state.selectedTerms as Set<string>);
      next.delete(term);
      set('selectedTerms', next as ReadonlySet<string>);
    },

    clearSelection() {
      set('selectedTerms', new Set<string>() as ReadonlySet<string>);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
