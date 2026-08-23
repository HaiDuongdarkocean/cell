import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDictionaryPanel } from './useDictionaryPanel';
import { Alert } from '@/shared/ui/Alert';
import { HStack } from '@/shared/ui/Stack';
import { SearchField } from '@/shared/ui/SearchField';
import { Spinner } from '@/shared/ui/Spinner';
import { Skeleton } from '@/shared/ui/Skeleton';
import { EmptyState } from '@/shared/ui/EmptyState';
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
  /** Render mode: 'popup' is compact (no search row/history), 'integrated' is the full panel. */
  readonly variant?: 'popup' | 'integrated';
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
  variant = 'integrated',
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
  const containerRef = useRef<HTMLDivElement>(null);
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
    // Query inside the container's root node so this works in both Shadow DOM
    // (popup variant — document.getElementById can't cross shadow boundaries)
    // and the integrated panel (regular document). data-cell-id avoids id
    // collisions if multiple popups coexist.
    const el = containerRef.current?.querySelector<HTMLElement>(
      `[data-cell-id="dictionary-candidate-${index}"]`,
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const candidate = allCandidates[index];
    if (candidate) {
      const surface = candidate.detectedPhrase?.surface;
      const phraseTerm = surface && surface.includes(' ') ? surface : candidate.term;
      onCandidateChange?.(phraseTerm);
    }
  }, [allCandidates, onCandidateChange]);

  return (
    <div ref={containerRef} className={`${styles.dictionaryPanel} ${variant === 'popup' ? styles.popupMode : ''}`} data-cell-id="dictionary-panel">
      {variant !== 'popup' && (
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
      )}

      {variant !== 'popup' && searchHistory.length > 0 && (
        <section className={styles.searchHistory} aria-label="Recent searches" data-cell-id="dictionary-search-history">
          <button
            type="button"
            className={`icon-btn icon-btn--xs ${styles.searchHistoryClear}`}
            aria-label="Clear recent searches"
            title="Clear recent searches"
            onClick={handleClearHistory}
            data-cell-id="dictionary-search-history-clear"
          >
            <Icon name="trash"  />
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
                  <Icon name="x"  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {panel.isLoading && !panel.currentResult && (
        panel.searchTerm.trim()
          ? <CandidateSkeleton term={panel.searchTerm.trim()} />
          : <HStack align="center" justify="center" gap="2" className={styles.loading} role="status" data-cell-id="dictionary-loading">
              <Spinner size="md" />
              <span>Looking up…</span>
            </HStack>
      )}

      {panel.error && (
        <Alert
          variant="error"
          icon={<Icon name="alertCircle"  />}
          description={panel.error}
          role="alert"
          data-cell-id="dictionary-error"
        />
      )}

      {!panel.isLoading && !panel.error && !panel.currentResult && (
        <EmptyState
          size="compact"
          className={styles.dictionaryEmpty}
          icon={<Icon name="bookOpen"  />}
          title="Ready when you are"
          description="Search for a word to explore its meaning."
          data-cell-id="dictionary-empty"
        />
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

/**
 * CandidateSkeleton — instant-feedback placeholder shown while a lookup is in
 * flight. Renders the real header with the term so the user sees the word
 * immediately, plus skeleton blocks mirroring the candidate content layout
 * (reading, status, frequency, toolbar, definitions). Every dimension
 * references design tokens via var()/calc() — no hardcoded px — so the
 * skeleton stays in sync with the real CandidateView if tokens change.
 */
function CandidateSkeleton({ term }: { readonly term: string }): React.JSX.Element {
  // Token-derived sizes — SSOT, no magic numbers.
  const btnSm = 'var(--iconbutton-size-sm)';       // action buttons + toolbar tabs
  const btnXs = 'var(--iconbutton-size-xs)';       // audio buttons
  const checkbox = 'var(--space-4)';               // definition checkbox (16px)
  const pillH = 'var(--space-5)';                  // status/frequency pill height
  const statusW = 'calc(6 * var(--font-size-sm))'; // matches .cellHeaderStatus min-width: 6em
  const freqW = 'calc(10 * var(--font-size-sm))';  // representative frequency width
  const ipaW = 'calc(7 * var(--font-size-base))';  // representative IPA width
  const ipaH = 'calc(var(--font-size-base) * var(--leading-normal))';
  const textH = 'calc(var(--font-size-base) * var(--leading-normal))';
  const exH = 'calc(var(--font-size-xs) * var(--leading-normal))';

  return (
    <article className={styles.candidate} data-cell-id="dictionary-candidate-skeleton" aria-busy="true">
      <header className={styles.cellHeader}>
        <div className={styles.cellHeaderRow}>
          <div className={styles.cellHeaderMain}>
            <div className={styles.cellHeaderWordRow}>
              <h2 className={styles.cellHeaderWord} data-cell-id="dictionary-term">{term}</h2>
            </div>
          </div>
          <div className={styles.cellHeaderActions}>
            <Skeleton width={btnSm} height={btnSm} shape="circle" className={styles.skeletonAction} />
            <Skeleton width={btnSm} height={btnSm} shape="circle" className={styles.skeletonAction} />
          </div>
        </div>
      </header>

      <div className={styles.cellContent} data-cell-id="dictionary-content-skeleton">
        <div className={styles.cellHeaderReading}>
          <Skeleton width={ipaW} height={ipaH} shape="rect" />
          <span className={styles.cellHeaderAudioGroup}>
            <Skeleton width={btnXs} height={btnXs} shape="circle" />
            <Skeleton width={btnXs} height={btnXs} shape="circle" />
          </span>
        </div>

        <div className={styles.cellHeaderSecond}>
          <Skeleton width={statusW} height={pillH} shape="rounded" />
          <Skeleton width={freqW} height={pillH} shape="rounded" />
        </div>

        <div className={styles.cellToolbar} role="presentation">
          <Skeleton width={btnSm} height={btnSm} shape="rounded" />
          <Skeleton width={btnSm} height={btnSm} shape="rounded" />
          <Skeleton width={btnSm} height={btnSm} shape="rounded" />
          <Skeleton width={btnSm} height={btnSm} shape="rounded" />
        </div>

        <section className={styles.cellDef} aria-label="Definitions">
          <div className={styles.cellDefItem}>
            <span className={styles.cellDefCheck}>
              <Skeleton width={checkbox} height={checkbox} shape="rounded" />
            </span>
            <div className={styles.cellDefText}>
              <Skeleton width="90%" height={textH} shape="rounded" />
              <div className={styles.cellDefExamples}>
                <Skeleton width="65%" height={exH} shape="rounded" />
              </div>
            </div>
          </div>
          <div className={styles.cellDefItem}>
            <span className={styles.cellDefCheck}>
              <Skeleton width={checkbox} height={checkbox} shape="rounded" />
            </span>
            <div className={styles.cellDefText}>
              <Skeleton width="75%" height={textH} shape="rounded" />
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}
