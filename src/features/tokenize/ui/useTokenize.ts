import { useCallback, useEffect, useState } from 'react';
import type { TokenizeStateStore } from '@/features/tokenize/services/tokenizeStateStore';
import type { TokenizePanelState } from '@/features/tokenize/types';

export type TokenizeKey = 'enabled' | 'showStatus' | 'showFrequency' | 'subtitleEnabled';

export interface UseTokenizeOptions {
  /** Optional external store to sync with (e.g. `createTokenizeStateStore`). */
  readonly store?: TokenizeStateStore;
}

export interface UseTokenizeReturn {
  /** Current panel state (enabled + showStatus + showFrequency). */
  readonly state: TokenizePanelState;
  /** Toggle one of the three tokenize keys. */
  readonly onToggle: (key: TokenizeKey) => void;
}

function toPanelState(s: { enabled: boolean; showStatus: boolean; showFrequency: boolean }): TokenizePanelState {
  return { enabled: s.enabled, showStatus: s.showStatus, showFrequency: s.showFrequency, subtitleEnabled: false };
}

/**
 * React hook that encapsulates tokenize panel state and toggle callbacks.
 *
 * - When a `store` is provided, it subscribes to the external store and
 *   dispatches `setEnabled`/`setShowStatus`/`setShowFrequency` on toggle.
 * - When no `store` is provided, it manages an internal `useState` copy.
 */
export function useTokenize(options: UseTokenizeOptions = {}): UseTokenizeReturn {
  const { store } = options;

  const [state, setState] = useState<TokenizePanelState>(() => {
    if (store) {
      return toPanelState(store.getState());
    }
    return { enabled: false, showStatus: false, showFrequency: false, subtitleEnabled: false };
  });

  useEffect(() => {
    if (!store) return undefined;
    setState(toPanelState(store.getState()));
    return store.subscribe((next) => {
      setState(toPanelState(next));
    });
  }, [store]);

  const onToggle = useCallback(
    (key: TokenizeKey): void => {
      const next = !state[key];
      if (store) {
        if (key === 'enabled') store.setEnabled(next);
        else if (key === 'showStatus') store.setShowStatus(next);
        else if (key === 'showFrequency') store.setShowFrequency(next);
      }
      setState((prev) => ({ ...prev, [key]: next }));
    },
    [state, store],
  );

  return { state, onToggle };
}
