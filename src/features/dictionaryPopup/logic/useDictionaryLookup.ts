// useDictionaryLookup — headless React hook for dictionary search.
//
// Encapsulates search, loading, error, winner + candidate results,
// candidate selection, definition selection, and status cycling.
// No DOM dependency. Intended to be reused by the popup and the
// universal panel dictionary tab.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { LookupResult, LookupRequest, WordStatus, DefinitionEntry } from '../types';
import type { MessageResponse } from '@/entities/message';
import { nextStatus } from '../services/wordStatusStore';
import { initDefinitionSelection, getSelectedDefinitions } from '../ui/popupContent';

export interface UseDictionaryLookupOptions {
  /** Language code of the dictionary being searched (e.g. 'en', 'zh'). */
  readonly langCode: string;
  /** Source / target language for the term being looked up. Usually equals langCode. */
  readonly sourceLang: string;
  /** User's native language — used for translation and context. */
  readonly targetLang: string;
  /** Optional term to search on first mount or when it changes. */
  readonly initialTerm?: string;
}

export interface UseDictionaryLookupReturn {
  /** Current text in the search input (controlled). */
  readonly searchTerm: string;
  /** Update the search input text without submitting a lookup. */
  readonly setSearchTerm: (term: string) => void;
  /** Submit a dictionary lookup for the given term. */
  readonly search: (term: string) => void;
  /** The exact term used in the last successful lookup. */
  readonly latestSearchedTerm: string;
  /** Winner result from the last lookup, or null before any search. */
  readonly currentResult: LookupResult | null;
  /** Additional candidates returned by lookupOrchestratorMulti. */
  readonly candidates: readonly LookupResult[];
  /** Index of the candidate currently shown as currentResult. */
  readonly activeCandidateIndex: number;
  /** Switch to a different candidate. */
  readonly setActiveCandidate: (index: number) => void;
  /** True while waiting for LOOKUP_REQUEST. */
  readonly isLoading: boolean;
  /** Error message from the last failed lookup, or null. */
  readonly error: string | null;
  /** Current word status (mirrors currentResult.status). */
  readonly status: WordStatus;
  /** Cycle the word status to the next value and persist via background. */
  readonly cycleStatus: () => void;
  /** Map of definition id → selected state for the active candidate. */
  readonly definitionSelection: Map<string, boolean>;
  /** Toggle a definition's selected state. */
  readonly toggleDefinition: (id: string, selected: boolean) => void;
  /** Currently selected definitions for the active candidate. */
  readonly selectedDefinitions: readonly DefinitionEntry[];
  /** Cancel any in-flight lookup. Safe to call when no lookup is active. */
  readonly cancel: () => void;
  /** Reset all lookup state (results, loading, error, selections). */
  readonly reset: () => void;
}

/** Stable ID generator for lookup request ids. */
function makeRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `dp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useDictionaryLookup(options: UseDictionaryLookupOptions): UseDictionaryLookupReturn {
  const { langCode, initialTerm } = options;

  const [searchTerm, setSearchTerm] = useState(initialTerm ?? '');
  const [currentResult, setCurrentResult] = useState<LookupResult | null>(null);
  const [candidates, setCandidates] = useState<readonly LookupResult[]>([]);
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<WordStatus>('unknown');
  const [definitionSelection, setDefinitionSelection] = useState<Map<string, boolean>>(new Map());

  const requestIdRef = useRef<string | null>(null);
  const latestSearchRef = useRef<string>(initialTerm ?? '');

  const resetResultState = useCallback((): void => {
    setCurrentResult(null);
    setCandidates([]);
    setActiveCandidateIndex(0);
    setStatus('unknown');
    setDefinitionSelection(new Map());
  }, []);

  const reset = useCallback((): void => {
    cancelInFlight();
    resetResultState();
    setSearchTerm(initialTerm ?? '');
    setIsLoading(false);
    setError(null);
  }, [initialTerm, resetResultState]);

  const applyResult = useCallback((results: readonly LookupResult[], searchedTerm: string): void => {
    if (results.length === 0) {
      resetResultState();
      return;
    }
    const [winner, ...rest] = results;
    setCurrentResult(winner);
    setCandidates(rest);
    setActiveCandidateIndex(0);
    setStatus(winner.status);
    setDefinitionSelection(initDefinitionSelection(winner));
    latestSearchRef.current = searchedTerm;
  }, [resetResultState]);

  function cancelInFlight(): void {
    const id = requestIdRef.current;
    if (!id) return;
    requestIdRef.current = null;
    void sendMessage({ type: MESSAGE_TYPES.LOOKUP_CANCEL, payload: { requestId: id } });
  }

  const search = useCallback((term: string): void => {
    const trimmed = term.trim();
    if (!trimmed) return;

    cancelInFlight();
    setSearchTerm(trimmed);
    setIsLoading(true);
    setError(null);

    const requestId = makeRequestId();
    requestIdRef.current = requestId;

    const request: LookupRequest = {
      term: trimmed,
      langCode,
      contextSentence: trimmed,
      cursorOffset: 0,
      fallback: true,
    };

    void sendMessage<MessageResponse<LookupResult[]>>({
      type: MESSAGE_TYPES.LOOKUP_REQUEST,
      payload: { requestId, request },
    })
      .then((response) => {
        if (requestIdRef.current !== requestId) return;
        requestIdRef.current = null;
        setIsLoading(false);
        if (response?.success && response.data) {
          applyResult(response.data, trimmed);
        } else {
          setError(response?.error ?? 'Lookup failed');
          resetResultState();
        }
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return;
        requestIdRef.current = null;
        setIsLoading(false);
        setError(err instanceof Error ? err.message : String(err));
        resetResultState();
      });
  }, [langCode, applyResult, resetResultState]);

  const setActiveCandidate = useCallback((index: number): void => {
    const all = [currentResult, ...candidates].filter(Boolean);
    if (index < 0 || index >= all.length) return;
    const chosen = all[index]!;
    setActiveCandidateIndex(index);
    setCurrentResult(chosen);
    setStatus(chosen.status);
    setDefinitionSelection(initDefinitionSelection(chosen));
  }, [currentResult, candidates]);

  const cycleStatus = useCallback((): void => {
    const result = currentResult;
    if (!result) return;
    const newStatus = nextStatus(status);
    setStatus(newStatus);
    setCurrentResult({ ...result, status: newStatus });
    void sendMessage({ type: MESSAGE_TYPES.WORD_STATUS_SET, payload: { term: result.term, langCode: result.langCode, status: newStatus } });
  }, [currentResult, status, langCode]);

  const toggleDefinition = useCallback((id: string, selected: boolean): void => {
    setDefinitionSelection((prev) => new Map(prev).set(id, selected));
  }, []);

  const selectedDefinitions = useMemo(
    () => (currentResult ? getSelectedDefinitions(currentResult, definitionSelection) : []),
    [currentResult, definitionSelection],
  );

  const latestSearchedTerm = latestSearchRef.current;

  // Initial search when initialTerm is provided. Re-run if the prop changes
  // while the component is mounted.
  useEffect(() => {
    if (initialTerm?.trim()) {
      search(initialTerm.trim());
    }
    return () => { cancelInFlight(); };
    // search is a stable callback; only react to initialTerm changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTerm]);

  return {
    searchTerm,
    setSearchTerm,
    search,
    latestSearchedTerm,
    currentResult,
    candidates,
    activeCandidateIndex,
    setActiveCandidate,
    isLoading,
    error,
    status,
    cycleStatus,
    definitionSelection,
    toggleDefinition,
    selectedDefinitions,
    cancel: cancelInFlight,
    reset,
  };
}
