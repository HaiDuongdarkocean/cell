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
  /** Optional context sentence for the initial term (used for Card Creator prefill). */
  readonly contextSentence?: string;
  /** Optional cursor offset inside `contextSentence` for phrase detection. */
  readonly cursorOffset?: number;
  /** Optional pre-fetched winner result. When provided, no initial lookup is performed. */
  readonly initialResult?: LookupResult;
  /** Optional pre-fetched additional candidates to display alongside the winner. */
  readonly initialCandidates?: readonly LookupResult[];
  /** Optional local token-status fallback for the winner. */
  readonly getTokenStatus?: (term: string) => WordStatus | undefined;
  /** Optional callback when a new result arrives (winner + candidates). */
  readonly onResult?: (winner: LookupResult, candidates: readonly LookupResult[], contextSentence: string) => void;
  /** Optional external status sync (e.g. keyboard shortcut). */
  readonly syncStatus?: { readonly term: string; readonly status: WordStatus };
}

export interface UseDictionaryLookupReturn {
  /** Current text in the search input (controlled). */
  readonly searchTerm: string;
  /** Update the search input text without submitting a lookup. */
  readonly setSearchTerm: (term: string) => void;
  /** Submit a dictionary lookup for the given term. */
  readonly search: (term: string, contextSentence?: string, cursorOffset?: number) => void;
  /** The exact term used in the last successful lookup. */
  readonly latestSearchedTerm: string;
  /** Context sentence for the current lookup (used for Card Creator prefill). */
  readonly contextSentence: string;
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

/** Apply a local token status fallback to a result if its status is unknown. */
function applyLocalStatusFallback(result: LookupResult, getTokenStatus?: (term: string) => WordStatus | undefined): LookupResult {
  if (result.status !== 'unknown') return result;
  const localStatus = getTokenStatus?.(result.term);
  if (!localStatus || localStatus === 'unknown') return result;
  return { ...result, status: localStatus };
}

export function useDictionaryLookup(options: UseDictionaryLookupOptions): UseDictionaryLookupReturn {
  const {
    langCode,
    initialTerm,
    contextSentence: initialContextSentence = '',
    cursorOffset: initialCursorOffset = 0,
    initialResult,
    initialCandidates = [],
    getTokenStatus,
    onResult,
    syncStatus,
  } = options;

  const [searchTerm, setSearchTerm] = useState(initialResult?.term ?? initialTerm ?? '');
  const [currentResult, setCurrentResult] = useState<LookupResult | null>(initialResult ?? null);
  const [candidates, setCandidates] = useState<readonly LookupResult[]>(initialCandidates);
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<WordStatus>(initialResult?.status ?? 'unknown');
  const [definitionSelection, setDefinitionSelection] = useState<Map<string, boolean>>(() =>
    initialResult ? initDefinitionSelection(initialResult) : new Map()
  );
  const [contextSentence, setContextSentence] = useState<string>(initialContextSentence);

  const requestIdRef = useRef<string | null>(null);
  const latestSearchRef = useRef<string>(initialResult?.term ?? initialTerm ?? '');

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
    setContextSentence(initialContextSentence);
  }, [initialTerm, initialContextSentence, resetResultState]);

  const applyResult = useCallback((results: readonly LookupResult[], searchedTerm: string, ctxSentence: string): void => {
    if (results.length === 0) {
      resetResultState();
      return;
    }
    const [winner, ...rest] = results;
    const finalWinner = applyLocalStatusFallback(winner, getTokenStatus);
    const finalResults = finalWinner === winner ? results : [finalWinner, ...rest];
    setCurrentResult(finalWinner);
    setCandidates(finalResults.slice(1));
    setActiveCandidateIndex(0);
    setStatus(finalWinner.status);
    setDefinitionSelection(initDefinitionSelection(finalWinner));
    setContextSentence(ctxSentence);
    latestSearchRef.current = searchedTerm;
    onResult?.(finalWinner, finalResults.slice(1), ctxSentence);
  }, [resetResultState, getTokenStatus, onResult]);

  function cancelInFlight(): void {
    const id = requestIdRef.current;
    if (!id) return;
    requestIdRef.current = null;
    void sendMessage({ type: MESSAGE_TYPES.LOOKUP_CANCEL, payload: { requestId: id } });
  }

  const search = useCallback((term: string, ctxSentence?: string, offset?: number): void => {
    const trimmed = term.trim();
    if (!trimmed) return;

    cancelInFlight();
    setSearchTerm(trimmed);
    setIsLoading(true);
    setError(null);

    const requestId = makeRequestId();
    requestIdRef.current = requestId;

    const sentence = (ctxSentence?.trim() || trimmed).slice(0, 500);
    const off = offset ?? 0;

    const request: LookupRequest = {
      term: trimmed,
      langCode,
      contextSentence: sentence,
      cursorOffset: off,
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
          applyResult(response.data, trimmed, sentence);
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

  // Re-apply when the caller supplies a new pre-fetched result or changes the
  // initial term. This lets a content-script controller feed results and
  // candidates into the same mounted component instead of re-mounting.
  useEffect(() => {
    if (initialResult) {
      applyResult([initialResult, ...initialCandidates], initialResult.term, initialContextSentence);
      return;
    }
    if (initialTerm?.trim()) {
      search(initialTerm.trim(), initialContextSentence, initialCursorOffset);
    }
    return () => { cancelInFlight(); };
    // Only react to meaningful external seed changes, not to every new object
    // identity on re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialResult?.term, initialCandidates.length, initialTerm, initialContextSentence, search, applyResult]);

  // Sync an externally-driven status (e.g. keyboard shortcut) to the active
  // result without persisting — the external source already owns persistence.
  useEffect(() => {
    if (!syncStatus || !currentResult) return;
    if (syncStatus.term.toLowerCase() !== currentResult.term.toLowerCase()) return;
    setCurrentResult({ ...currentResult, status: syncStatus.status });
    setStatus(syncStatus.status);
  }, [syncStatus, currentResult]);

  return {
    searchTerm,
    setSearchTerm,
    search,
    latestSearchedTerm,
    contextSentence,
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
