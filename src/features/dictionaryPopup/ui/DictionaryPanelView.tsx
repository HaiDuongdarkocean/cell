import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDictionaryPanel } from './useDictionaryPanel';
import { SearchField } from '@/shared/ui/SearchField';
import { Spinner } from '@/shared/ui/Spinner';
import { Icon } from '@/shared/icons/Icon';
import {
  addSearchHistoryTerm,
  loadSearchHistory,
  persistSearchHistory,
  removeSearchHistoryTerm,
} from '@/features/universalPanel/searchHistory';
import { CandidateView } from './CandidateView';
import type { LookupResult, WordStatus, PopupCardCreatorPrefill, PopupTab } from '../types';
import styles from './DictionaryPanelView.module.css';
import componentsCss from '@/shared/styles/components.css?raw';

const SEARCH_INPUT_ID = 'dictionary-panel-search-input';

interface DictionaryPanelViewProps {
  readonly langCode: string;
  readonly sourceLang: string;
  readonly targetLang: string;
  readonly initialTerm?: string;
  readonly contextSentence?: string;
  readonly cursorOffset?: number;
  readonly initialResult?: LookupResult;
  readonly initialCandidates?: readonly LookupResult[];
  readonly getTokenStatus?: (term: string) => WordStatus | undefined;
  readonly isLoading?: boolean;
  readonly onResult?: (winner: LookupResult, candidates: readonly LookupResult[], contextSentence: string) => void;
  readonly onSendToCard?: (prefill: PopupCardCreatorPrefill) => void;
  readonly onQuickAdd?: (prefill: PopupCardCreatorPrefill) => void;
  /** Called when the user cycles a candidate's word status. */
  readonly onStatusChange?: (term: string, langCode: string, status: WordStatus) => void;
  /** Called when the user switches to a different candidate (chip click). */
  readonly onCandidateChange?: (term: string) => void;
  /** Default media tab to open when the result first appears. */
  readonly defaultActiveTab?: PopupTab | null;
  /** True when this view is inside an open panel — used for auto-focus after animation. */
  readonly isOpen?: boolean;
  /** Optional external status sync (e.g. keyboard shortcut). */
  readonly syncStatus?: { readonly term: string; readonly status: WordStatus };
}

export function DictionaryPanelView({
  langCode,
  sourceLang,
  targetLang,
  initialTerm,
  contextSentence,
  cursorOffset,
  initialResult,
  initialCandidates,
  getTokenStatus,
  isLoading: isLoadingProp,
  onResult,
  onSendToCard,
  onQuickAdd,
  onStatusChange,
  onCandidateChange,
  defaultActiveTab,
  isOpen = true,
  syncStatus,
}: DictionaryPanelViewProps): React.JSX.Element {
  const panel = useDictionaryPanel({
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
  });

  const [searchHistory, setSearchHistory] = useState<readonly string[]>([]);
  const [activeChipIndex, setActiveChipIndex] = useState(0);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSearchFocusRef = useRef(false);
  const userTypedRef = useRef(false);

  const { searchTerm, setSearchTerm, search } = panel;

  useEffect(() => {
    let cancelled = false;
    void loadSearchHistory().then((history) => {
      if (!cancelled && history.length > 0) setSearchHistory(history);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const term = panel.currentResult?.term;
    if (!term || panel.isLoading) return;
    setSearchHistory((previous) => {
      const next = addSearchHistoryTerm(previous, term);
      if (next.length !== previous.length || next.some((entry, index) => entry !== previous[index])) {
        void persistSearchHistory(next);
      }
      return next;
    });
  }, [panel.currentResult?.term, panel.isLoading]);

  useEffect(() => {
    setActiveChipIndex(0);
  }, [panel.currentResult?.term]);

  const handleRemoveHistory = useCallback((term: string): void => {
    setSearchHistory((previous) => {
      const next = removeSearchHistoryTerm(previous, term);
      void persistSearchHistory(next);
      return next;
    });
  }, []);

  const handleClearHistory = useCallback((): void => {
    setSearchHistory([]);
    void persistSearchHistory([]);
  }, []);

  const handleSearchChange = useCallback((value: string): void => {
    userTypedRef.current = true;
    pendingSearchFocusRef.current = true;
    setSearchTerm(value);
  }, [setSearchTerm]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
      userTypedRef.current = false;
      pendingSearchFocusRef.current = true;
      const trimmed = searchTerm.trim();
      if (trimmed) {
        search(trimmed);
      }
    }
  }, [search, searchTerm]);

  useEffect(() => {
    if (!userTypedRef.current) return;
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    pendingSearchFocusRef.current = true;
    searchDebounceRef.current = setTimeout(() => {
      userTypedRef.current = false;
      search(trimmed);
    }, 500);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchTerm, search]);

  useEffect(() => {
    if (panel.isLoading || !panel.currentResult || !pendingSearchFocusRef.current) return;
    pendingSearchFocusRef.current = false;
    const input = document.getElementById(SEARCH_INPUT_ID) as HTMLInputElement | null;
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }, [panel.isLoading, panel.currentResult]);

  // Inject shared .btn / .icon-btn classes so popup-style markup can reuse
  // the same global class names without duplication. Idempotent across mounts.
  useEffect(() => {
    const id = 'cell-dictionary-components';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = componentsCss;
      document.head.appendChild(style);
    }
  }, []);

  // Focus the search input after the panel enter animation completes.
  // If the input already has a term, move the caret to the end.
  useEffect(() => {
    if (!isOpen) return;
    focusTimerRef.current = setTimeout(() => {
      const input = document.getElementById(SEARCH_INPUT_ID) as HTMLInputElement | null;
      if (!input) return;
      input.focus();
      if (input.value) {
        const end = input.value.length;
        input.setSelectionRange(end, end);
      }
    }, 250);
    return () => {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [isOpen]);

  const allCandidates = useMemo<readonly LookupResult[]>(
    () => (panel.currentResult ? [panel.currentResult, ...panel.candidates] : []),
    [panel.currentResult, panel.candidates],
  );

  const handleChipClick = useCallback((index: number): void => {
    setActiveChipIndex(index);
    const element = document.getElementById(`dictionary-candidate-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const candidate = allCandidates[index];
    if (candidate) onCandidateChange?.(candidate.term);
  }, [allCandidates, onCandidateChange]);

  return (
    <div className={styles.dictionaryPanel} data-cell-id="dictionary-panel">
      <div className={styles.searchRow}>
        <SearchField
          id={SEARCH_INPUT_ID}
          data-cell-id="dictionary-search-input"
          value={searchTerm}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
          placeholder="Type a word"
          disabled={panel.isLoading}
          className={styles.searchField}
        />
      </div>

      {searchHistory.length > 0 && (
        <section className={styles.searchHistory} aria-label="Recent searches" data-cell-id="dictionary-search-history">
          <button
            type="button"
            className={`icon-btn icon-btn--xs ${styles.searchHistoryClear}`}
            aria-label="Clear recent searches"
            title="Clear recent searches"
            onClick={handleClearHistory}
            data-cell-id="dictionary-search-history-clear"
          >
            <Icon name="trash" size={16} />
          </button>
          <ul className={styles.searchHistoryList}>
            {searchHistory.map((term) => (
              <li key={term} className={styles.searchHistoryItem}>
                <button
                  type="button"
                  className={styles.searchHistoryTerm}
                  onClick={() => {
                    setSearchTerm(term);
                    search(term);
                  }}
                >
                  {term}
                </button>
                <button
                  type="button"
                  className={styles.searchHistoryRemove}
                  aria-label={`Remove ${term} from recent searches`}
                  title={`Remove ${term}`}
                  onClick={() => handleRemoveHistory(term)}
                >
                  <Icon name="x" size={10} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {panel.isLoading && !panel.currentResult && (
        <div className={styles.loading} data-cell-id="dictionary-loading">
          <Spinner size="md" />
          <span>Looking up {panel.searchTerm}…</span>
        </div>
      )}

      {panel.error && (
        <div className={styles.error} role="alert" data-cell-id="dictionary-error">
          <Icon name="alertCircle" size={20} />
          <span>{panel.error}</span>
        </div>
      )}

      {!panel.isLoading && !panel.error && !panel.currentResult && (
        <div className={styles.dictionaryEmpty} role="status" data-cell-id="dictionary-empty">
          <div className={styles.dictionaryEmptyIcon} aria-hidden="true">
            <Icon name="bookOpen" size={36} />
          </div>
          <div className={styles.dictionaryEmptyTitle}>Ready when you are</div>
          <div className={styles.dictionaryEmptyDescription}>Search for a word to explore its meaning.</div>
        </div>
      )}

      {allCandidates.length > 0 && (
        <>
          <div className={styles.candidateList} data-cell-id="dictionary-candidate-list">
            {allCandidates.map((candidate, idx) => (
              <CandidateView
                key={`${candidate.term}-${idx}`}
                candidate={candidate}
                index={idx}
                contextSentence={panel.contextSentence}
                sourceLang={sourceLang}
                targetLang={targetLang}
                onSendToCard={onSendToCard}
                onQuickAdd={onQuickAdd}
                onStatusChange={onStatusChange}
                defaultActiveTab={defaultActiveTab}
              />
            ))}
          </div>

          {allCandidates.length > 1 && (
            <div className={styles.cellCandidatesChips}>
              <div className={styles.cellCandidatesChipsScroll}>
                {allCandidates.map((c, idx) => (
                  <button
                    key={`${c.term}-${idx}`}
                    type="button"
                    className={`btn ${idx === activeChipIndex ? 'btn--primary' : 'btn--outline'} ${styles.cellChip}`}
                    aria-current={idx === activeChipIndex ? 'true' : undefined}
                    onClick={() => handleChipClick(idx)}
                    data-cell-id={`dictionary-candidate-chip-${idx}`}
                  >
                    {c.term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
