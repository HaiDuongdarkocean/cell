import type { ComprehensionKind, ComprehensionStats } from '@/entities/comprehension';

export interface ComprehensionState {
  readonly media: ComprehensionStats | null;
  readonly text: ComprehensionStats | null;
  readonly active: ComprehensionKind;
}

export interface ComprehensionStore {
  getState(): ComprehensionState;
  setStats(kind: ComprehensionKind, stats: ComprehensionStats | null): void;
  setActive(kind: ComprehensionKind): void;
  subscribe(listener: (state: ComprehensionState) => void): () => void;
}

export function createComprehensionStore(): ComprehensionStore {
  const state = {
    media: null as ComprehensionStats | null,
    text: null as ComprehensionStats | null,
    active: 'media' as ComprehensionKind,
  };
  const listeners = new Set<(state: ComprehensionState) => void>();

  function notify(): void {
    for (const listener of listeners) listener(state);
  }

  return {
    getState: () => state,

    setStats(kind, stats) {
      if (state[kind] === stats) return;
      state[kind] = stats;
      notify();
    },

    setActive(kind) {
      if (state.active === kind) return;
      state.active = kind;
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const comprehensionStore = createComprehensionStore();
