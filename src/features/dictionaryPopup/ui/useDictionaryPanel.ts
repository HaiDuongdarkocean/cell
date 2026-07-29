// useDictionaryPanel — React state hook for the universal panel's dictionary left pane.
//
// Composes useDictionaryLookup (search + results). Per-candidate media, tab
// state, and selection now live inside `useCandidate` and `CandidateView`.

import { useCallback } from 'react';
import { useDictionaryLookup } from '../logic/useDictionaryLookup';
import type { LookupResult, WordStatus } from '../types';

export interface UseDictionaryPanelOptions {
  /** Language code of the dictionary being searched (e.g. 'en', 'zh'). */
  readonly langCode: string;
  /** Source / target language for the term being looked up. Usually equals langCode. */
  readonly sourceLang: string;
  /** User's native language — used for translation tab and card-creator prefill. */
  readonly targetLang: string;
  /** Optional term to search on first mount. */
  readonly initialTerm?: string;
  /** Context sentence for the term (used for Card Creator prefill). */
  readonly contextSentence?: string;
  /** Optional cursor offset inside `contextSentence` for phrase detection. */
  readonly cursorOffset?: number;
  /** Optional pre-fetched winner result. When provided, no initial lookup is performed. */
  readonly initialResult?: LookupResult;
  /** Optional pre-fetched additional candidates. */
  readonly initialCandidates?: readonly LookupResult[];
  /** Optional local token-status fallback for the winner. */
  readonly getTokenStatus?: (term: string) => WordStatus | undefined;
  /** Called when a new result arrives. */
  readonly onResult?: (winner: LookupResult, candidates: readonly LookupResult[], contextSentence: string) => void;
  /** Force a loading state (e.g. while a parent controller is fetching the first result). */
  readonly isLoading?: boolean;
  /** Optional external status sync (e.g. keyboard shortcut). */
  readonly syncStatus?: { readonly term: string; readonly status: WordStatus };
}

export interface UseDictionaryPanelReturn {
  /** Current text in the search input (controlled). */
  readonly searchTerm: string;
  /** Update the search input text without submitting a lookup. */
  readonly setSearchTerm: (term: string) => void;
  /** Submit a dictionary lookup for the given term. */
  readonly search: (term: string) => void;
  /** Context sentence for the current lookup (used for Card Creator prefill). */
  readonly contextSentence: string;
  /** Winner result from the last lookup, or null before any search. */
  readonly currentResult: LookupResult | null;
  /** Additional candidates returned by lookupOrchestratorMulti (phrase matches, surface token, lemmas). */
  readonly candidates: readonly LookupResult[];
  /** True while waiting for LOOKUP_REQUEST. */
  readonly isLoading: boolean;
  /** Error message from the last failed lookup, or null. */
  readonly error: string | null;
}

export function useDictionaryPanel(options: UseDictionaryPanelOptions): UseDictionaryPanelReturn {
  const {
    langCode,
    sourceLang,
    targetLang,
    initialTerm,
    contextSentence,
    cursorOffset,
    initialResult,
    initialCandidates,
    getTokenStatus,
    onResult,
    isLoading: isLoadingProp,
    syncStatus,
  } = options;

  const lookup = useDictionaryLookup({
    langCode,
    sourceLang,
    targetLang,
    initialTerm,
    contextSentence,
    cursorOffset,
    initialResult,
    initialCandidates,
    isLoading: isLoadingProp,
    getTokenStatus,
    onResult,
    syncStatus,
  });

  const { search: lookupSearch, currentResult, candidates, contextSentence: lookupContext } = lookup;

  const search = useCallback((term: string): void => {
    lookupSearch(term, term);
  }, [lookupSearch]);

  return {
    searchTerm: lookup.searchTerm,
    setSearchTerm: lookup.setSearchTerm,
    search,
    contextSentence: lookupContext,
    currentResult,
    candidates,
    isLoading: isLoadingProp ?? lookup.isLoading,
    error: lookup.error,
  };
}
