import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';

import { useDictionaryPanel } from './useDictionaryPanel';
import { t } from '@/shared/i18n';
import { Alert } from '@/shared/ui/Alert';
import { HStack } from '@/shared/ui/Stack';
import { SearchField } from '@/shared/ui/SearchField';
import { Spinner } from '@/shared/ui/Spinner';
import { Skeleton } from '@/shared/ui/Skeleton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Heading } from '@/shared/ui/Heading';
import { Icon } from '@/shared/ui/Icon';
import { useIsMobile } from '@/shared/ui/useIsMobile';
import { BREAKPOINTS } from '@/shared/lib/tokens';
import {
  addSearchHistoryTerm,
  loadSearchHistory,
  persistSearchHistory,
  removeSearchHistoryTerm,
} from '@/features/dictionaryPopup/logic/searchHistory';
import { ViewportTracker } from '@/features/tokenize';
import { observeScrollDirection } from '@/shared/lib/dom/observeScrollDirection';
import { collapseOnScroll, findScrollableAncestor } from '@/shared/lib/dom/collapseOnScroll';
import { CandidateView } from './CandidateView';
import type { LookupResult, WordStatus, PopupCardCreatorPrefill, PopupTab, PopupSelectionSnapshot } from '@/entities/dictionary';
import type { AiNoteAnswer } from '@/features/aiBridge';
import candidateStyles from './CandidateView.module.css';
import checkStyles from './DictionaryCheckable.module.css';
import toolbarStyles from './DictionaryToolbar.module.css';
import styles from './DictionaryPanelView.module.css';

const SEARCH_INPUT_ID_PREFIX = 'dictionary-panel-search-input';
const NAV_CHROME_REVEAL_MS = 400;

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
  /** Late AI answers after a send — merged into the open card's note field. */
  readonly onAiNoteUpdate?: (answers: readonly AiNoteAnswer[]) => void;
  /** Called when the user cycles a candidate's word status. */
  readonly onStatusChange?: (term: string, langCode: string, status: WordStatus) => void;
  /** Called when the user switches to a different candidate (chip click). */
  readonly onCandidateChange?: (term: string) => void;
  /** Called from the empty-definitions state to open Settings → Resources. */
  readonly onOpenSettings?: () => void;
  /** Default media tab to open when the result first appears. */
  readonly defaultActiveTab?: PopupTab | null;
  /** True when this view is inside an open panel — used for auto-focus after animation. */
  readonly isOpen?: boolean;
  /** Optional external status sync (e.g. keyboard shortcut). */
  readonly syncStatus?: { readonly term: string; readonly status: WordStatus };
  /** Render mode: 'popup' is compact (no search row/history), 'integrated' is the full panel. */
  readonly variant?: 'popup' | 'integrated';
  /** Integrated-only: hide the search-history strip (e.g. settings embeds that
   *  don't want a second history surface). Auto-restore of the last term still
   *  runs — only the row is hidden. */
  readonly showHistory?: boolean;
  /** Optional popup selection snapshot used to clone checked state. */
  readonly selectionSnapshot?: PopupSelectionSnapshot;
  /** Popup variant only: drag-to-move session started from the candidate
   *  header row. Integrated surfaces never pass it. */
  readonly onHeaderPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  /** Lookup-chain identity (trail + result term). Changes whenever the shared
   *  mount repaints another level's content — scroll position is remembered
   *  per key so breadcrumb navigation restores where each level was left. */
  readonly scrollKey?: string;
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
  onAiNoteUpdate,
  onStatusChange,
  onCandidateChange,
  onOpenSettings,
  defaultActiveTab,
  isOpen = true,
  syncStatus,
  variant = 'integrated',
  showHistory = true,
  selectionSnapshot,
  onHeaderPointerDown,
  scrollKey,
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

  const searchInputId = `${SEARCH_INPUT_ID_PREFIX}-${useId()}`;
  const [searchHistory, setSearchHistory] = useState<readonly string[]>([]);
  const [activeChipIndex, setActiveChipIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSearchFocusRef = useRef(false);
  const userTypedRef = useRef(false);
  const isMobile = useIsMobile(BREAKPOINTS.expanded);
  const spySuppressRef = useRef(false);
  const spyQuietTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { searchTerm, setSearchTerm, search } = panel;

  // Per-level scroll memory: the shared popup mount repaints whichever level
  // the chain surfaces, so scrollTop is tracked under the live scrollKey and
  // restored when the key returns (breadcrumb back-navigation).
  const scrollerRef = useRef<HTMLElement | null>(null);
  const scrollMemRef = useRef(new Map<string, number>());
  const liveScrollKeyRef = useRef('');
  // The restored level may land mid-scroll — reveal the nav chrome (lookup
  // trail + candidate chips) and hold it briefly, or the restore jump reads
  // as a scroll-down and collapseOnScroll re-hides it within a frame.
  const collapsedHostRef = useRef<HTMLElement | null>(null);
  const chromeRevealUntilRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    const scroller = el ? findScrollableAncestor(el) : null;
    scrollerRef.current = scroller;
    if (!scroller) return;
    const onScroll = () => {
      const key = liveScrollKeyRef.current;
      if (key) scrollMemRef.current.set(key, scroller.scrollTop);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    liveScrollKeyRef.current = scrollKey ?? '';
    if (!scrollKey) return;
    chromeRevealUntilRef.current = performance.now() + NAV_CHROME_REVEAL_MS;
    collapsedHostRef.current?.removeAttribute('data-dict-collapsed');
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = scrollMemRef.current.get(scrollKey) ?? 0;
  }, [scrollKey]);

  const restoredInitialRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void loadSearchHistory().then((history) => {
      if (cancelled || history.length === 0) return;
      setSearchHistory(history);
      // Integrated surfaces reopen on the last looked-up term so the panel is
      // never blank on mount — and resource-change re-lookups have a term to
      // replay. The popup variant always carries its own initialTerm.
      if (
        !restoredInitialRef.current
        && variant === 'integrated'
        && !initialTerm
        && !initialResult
      ) {
        restoredInitialRef.current = true;
        search(history[0]!);
      }
    });
    return () => { cancelled = true; };
  }, [variant, initialTerm, initialResult, search]);

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

  useEffect(() => {
    const panel = containerRef.current;
    if (!panel) return;
    const host =
      panel.closest<HTMLElement>('[data-tihoka-id="popup-dictionary"]') ?? panel;
    collapsedHostRef.current = host;
    return collapseOnScroll(findScrollableAncestor(panel) ?? panel, {
      onCollapsed: (hidden) => {
        if (hidden && performance.now() < chromeRevealUntilRef.current) return;
        host.toggleAttribute('data-dict-collapsed', hidden);
      },
    });
  }, []);

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

  const handleSearchFocus = useCallback((e: React.FocusEvent<HTMLInputElement>): void => {
    const input = e.target;
    requestAnimationFrame(() => { input.select(); });
  }, []);

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
    const input = containerRef.current?.querySelector<HTMLInputElement>(
      '[data-tihoka-id="dictionary-search-input"]',
    );
    input?.focus();
  }, [panel.isLoading, panel.currentResult]);

  // Focus the search input after the panel enter animation completes.
  // Mobile (<840px, the panel's collapsed-chrome breakpoint) skips it —
  // autofocus there pops the virtual keyboard over half the content.
  useEffect(() => {
    if (!isOpen || isMobile) return;
    focusTimerRef.current = setTimeout(() => {
      containerRef.current
        ?.querySelector<HTMLInputElement>('[data-tihoka-id="dictionary-search-input"]')
        ?.focus();
    }, 250);
    return () => {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [isOpen, isMobile]);

  const allCandidates = useMemo<readonly LookupResult[]>(
    () => (panel.currentResult ? [panel.currentResult, ...panel.candidates] : []),
    [panel.currentResult, panel.candidates],
  );

  // Scroll-spy: keep the active chip in sync with the candidate occupying the
  // top half of the viewport. root=null (viewport) works in both modes — in
  // integrated mode .candidateList clips, in popup mode .content clips, and
  // ancestor clipping applies regardless of which element scrolls.
  // Suppressed during chip-click scroll so the chip doesn't flick through
  // intermediate candidates — unlock waits for scrollend (the slowest async
  // op), not an animation timer (experience: async-observer-unlock-on-scrollend).
  useEffect(() => {
    const container = containerRef.current;
    if (!container || allCandidates.length <= 1) return;
    const candidates = Array.from(
      container.querySelectorAll<HTMLElement>('[data-tihoka-id]'),
    ).filter((el) => /^dictionary-candidate-\d+$/.test(el.dataset.tihokaId ?? ''));

    const tracker = new ViewportTracker({ rootMargin: '0px 0px -50% 0px' });
    candidates.forEach((el) => {
      const idx = Number((el.dataset.tihokaId ?? '').slice('dictionary-candidate-'.length));
      if (Number.isNaN(idx)) return;
      tracker.observe(el, {
        onEnter: () => {
          if (!spySuppressRef.current) setActiveChipIndex(idx);
        },
      });
    });
    return () => tracker.destroy();
  }, [allCandidates]);

  useEffect(() => {
    const container = containerRef.current;
    const scroller = container?.querySelector<HTMLElement>('[data-tihoka-id="dictionary-candidates-scroll"]');
    const chip = container?.querySelector<HTMLElement>(
      `[data-tihoka-id="dictionary-candidate-chip-${activeChipIndex}"]`,
    );
    if (!scroller || !chip) return;
    const sRect = scroller.getBoundingClientRect();
    const cRect = chip.getBoundingClientRect();
    const delta = cRect.left < sRect.left
      ? cRect.left - sRect.left
      : cRect.right > sRect.right
        ? cRect.right - sRect.right
        : 0;
    if (delta === 0) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    scroller.scrollTo({
      left: scroller.scrollLeft + delta,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [activeChipIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const scrollers = [
      container.closest<HTMLElement>('[data-tihoka-id="popup-dictionary-content"]'),
      container.querySelector<HTMLElement>('[data-tihoka-id="dictionary-candidate-list"]'),
    ].filter((el): el is HTMLElement => el !== null);
    const stop = observeScrollDirection(scrollers, {
      threshold: 8,
      onScroll: () => {
        if (!spySuppressRef.current) return false;
        if (spyQuietTimerRef.current) clearTimeout(spyQuietTimerRef.current);
        spyQuietTimerRef.current = setTimeout(() => { spySuppressRef.current = false; }, 150);
        return true;
      },
      onDirection: () => undefined,
    });
    return () => {
      stop();
      if (spyQuietTimerRef.current) clearTimeout(spyQuietTimerRef.current);
    };
  }, [allCandidates]);

  const handleChipClick = useCallback((index: number): void => {
    setActiveChipIndex(index);
    // Query inside the container's root node so this works in both Shadow DOM
    // (popup variant — document.getElementById can't cross shadow boundaries)
    // and the integrated panel (regular document). data-tihoka-id avoids id
    // collisions if multiple popups coexist.
    const el = containerRef.current?.querySelector<HTMLElement>(
      `[data-tihoka-id="dictionary-candidate-${index}"]`,
    );
    if (el) {
      spySuppressRef.current = true;
      setTimeout(() => { spySuppressRef.current = false; }, 1500);
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
    <div ref={containerRef} className={`${styles.dictionaryPanel} ${variant === 'popup' ? styles.popupMode : styles.integratedMode}`} data-tihoka-id="dictionary-panel">
      {variant !== 'popup' && (
        <div className={styles.searchRow}>
          <SearchField
            id={searchInputId}
            data-tihoka-id="dictionary-search-input"
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            onFocus={handleSearchFocus}
            placeholder={t('dict.search.placeholder')}
            aria-label={t('dict.search.aria')}
            className={styles.searchField}
            prefix={null}
          />
        </div>
      )}

      {variant !== 'popup' && showHistory && searchHistory.length > 0 && (
        <section className={styles.searchHistory} aria-label={t('dict.history.aria')} data-tihoka-id="dictionary-search-history">
          <ul className={styles.searchHistoryList}>
            {searchHistory.map((term) => {
              const isActive = panel.currentResult?.term.toLowerCase() === term.toLowerCase();
              return (
                <li key={term} className={`${styles.searchHistoryItem} ${isActive ? styles.searchHistoryItemActive : ''}`}>
                  <Button variant="secondary"
                    className={styles.searchHistoryTerm}
                    aria-current={isActive ? 'true' : undefined}
                    leadingIcon={<Icon name="rotateCcw" size="xs" />}
                    onClick={() => {
                      setSearchTerm(term);
                      search(term);
                    }}
                    data-tihoka-id={`dictionary-search-history-term-${term}`}
                    data-compact-hit
                  >
                    {term}
                  </Button>
                  <Button variant="ghost" size="xs"
                    className={styles.searchHistoryRemove}
                    aria-label={t('dict.history.remove', [term])}
                    title={t('dict.history.removeShort', [term])}
                    onClick={() => handleRemoveHistory(term)}
                    data-tihoka-id={`dictionary-search-history-remove-${term}`}
                    data-compact-hit
                  >
                    <Icon name="x" size="xs" />
                  </Button>
                </li>
              );
            })}
          </ul>
          <Button shape="circle" size="xs" variant="ghost"
            className={styles.searchHistoryClear}
            aria-label={t('dict.history.clear')}
            title={t('dict.history.clear')}
            onClick={handleClearHistory}
            data-tihoka-id="dictionary-search-history-clear"
            data-compact-hit
          >
            <Icon name="trash2" size="xs" />
          </Button>
        </section>
      )}

      {panel.isLoading && !panel.currentResult && (
        panel.searchTerm.trim()
          ? <CandidateSkeleton term={panel.searchTerm.trim()} />
          : <HStack align="center" justify="center" gap="2" className={styles.loading} role="status" data-tihoka-id="dictionary-loading">
              <Spinner size="md" />
              <span>{t('dict.status.lookingUp')}</span>
            </HStack>
      )}

      {panel.error && (
        <Alert
          variant="error"
          icon={<Icon name="alertCircle"  />}
          description={panel.error}
          role="alert"
          data-tihoka-id="dictionary-error"
        />
      )}

      {!panel.isLoading && !panel.error && !panel.currentResult && (
        <EmptyState
          size="compact"
          className={styles.dictionaryEmpty}
          icon={<Icon name="bookOpen"  />}
          title={t('dict.empty.title')}
          description={t('dict.empty.desc')}
          data-tihoka-id="dictionary-empty"
        />
      )}

      {allCandidates.length > 0 && (
        <>
          <div className={styles.candidateList} data-tihoka-id="dictionary-candidate-list">
            {allCandidates.map((candidate, idx) => {
              // Pass the snapshot to the original popup winner when the snapshot
              // has no term, or to the candidate that matches the snapshot term.
              const fullSnapshot = selectionSnapshot as Partial<PopupCardCreatorPrefill> | undefined;
              const snapshotTerm = fullSnapshot?.term;
              const snapshotLang = fullSnapshot?.langCode;
              const matchesSnapshot = snapshotTerm
                ? candidate.term === snapshotTerm && candidate.langCode === (snapshotLang ?? candidate.langCode)
                : idx === 0;
              return (
                <CandidateView
                  key={`${candidate.term}-${idx}`}
                  candidate={candidate}
                  index={idx}
                  contextSentence={panel.contextSentence}
                  sourceLang={sourceLang}
                  targetLang={targetLang}
                  onSendToCard={onSendToCard}
                  onQuickAdd={onQuickAdd}
                  onAiNoteUpdate={onAiNoteUpdate}
                  onStatusChange={onStatusChange}
                  onOpenSettings={onOpenSettings}
                  defaultActiveTab={defaultActiveTab}
                  selectionSnapshot={matchesSnapshot ? selectionSnapshot : undefined}
                  preloadMedia={variant === 'integrated'}
                  onHeaderPointerDown={onHeaderPointerDown}
                />
              );
            })}
          </div>

          {allCandidates.length > 1 && (
            <div className={styles.TihokaCandidatesChips}>
              <div className={styles.TihokaCandidatesChipsScroll} data-tihoka-id="dictionary-candidates-scroll">
                {allCandidates.map((c, idx) => (
                  <p
                    key={`${c.term}-${idx}`}
                    className={styles.TihokaChip}
                    role="button"
                    tabIndex={0}
                    aria-current={idx === activeChipIndex ? 'true' : undefined}
                    onClick={() => handleChipClick(idx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleChipClick(idx);
                      }
                    }}
                    title={c.term}
                    data-tihoka-no-ripple
                    data-tihoka-id={`dictionary-candidate-chip-${idx}`}
                  >
                    {c.term}
                  </p>
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
 *
 * WARNING: this component manually mirrors CandidateView's DOM structure
 * (header → reading → status → toolbar → definitions). NOTHING enforces the
 * mirror — no type error, no test, no lint. When CandidateView's layout
 * changes, update the skeleton in the same commit or the loading state drifts
 * into a visible layout shift when results land.
 */
function CandidateSkeleton({ term }: { readonly term: string }): React.JSX.Element {
  // Token-derived sizes — SSOT, no magic numbers.
  const btnSm = 'var(--iconbutton-size-sm)';       // action buttons + toolbar tabs
  const checkbox = 'var(--space-4)';               // definition checkbox (16px)
  const pillH = 'var(--space-5)';                  // status/frequency pill height
  const statusW = 'calc(6 * var(--font-size-sm))'; // matches .TihokaHeaderStatus min-width: 6em
  const freqW = 'calc(10 * var(--font-size-sm))';  // representative frequency width
  const ipaW = 'calc(7 * var(--font-size-base))';  // representative IPA width
  const ipaH = 'calc(var(--font-size-base) * var(--leading-normal))';
  const textH = 'calc(var(--font-size-base) * var(--leading-normal))';
  const exH = 'calc(var(--font-size-xs) * var(--leading-normal))';

  return (
    <article className={candidateStyles.candidate} data-tihoka-id="dictionary-candidate-skeleton" aria-busy="true">
      <header className={candidateStyles.TihokaHeader}>
        <div className={candidateStyles.TihokaHeaderRow}>
          <div className={candidateStyles.TihokaHeaderMain}>
            <div className={candidateStyles.TihokaHeaderWordRow}>
              <Heading level={2} size={2} className={candidateStyles.TihokaHeaderWord} data-tihoka-id="dictionary-term">{term}</Heading>
            </div>
          </div>
          <div className={candidateStyles.TihokaHeaderActions}>
            <Skeleton width={btnSm} height={btnSm} shape="circle" className={styles.skeletonAction} />
            <Skeleton width={btnSm} height={btnSm} shape="circle" className={styles.skeletonAction} />
          </div>
        </div>
      </header>

      <div className={candidateStyles.TihokaContent} data-tihoka-id="dictionary-content-skeleton">
        <div className={candidateStyles.TihokaHeaderReading}>
          <Skeleton width={ipaW} height={ipaH} shape="rect" />
        </div>

        <div className={candidateStyles.TihokaHeaderSecond}>
          <Skeleton width={statusW} height={pillH} shape="rounded" />
          <Skeleton width={freqW} height={pillH} shape="rounded" />
        </div>

        <div className={toolbarStyles.TihokaToolbar} role="presentation">
          <Skeleton width={btnSm} height={btnSm} shape="rounded" />
          <Skeleton width={btnSm} height={btnSm} shape="rounded" />
          <Skeleton width={btnSm} height={btnSm} shape="rounded" />
          <Skeleton width={btnSm} height={btnSm} shape="rounded" />
        </div>

        <section className={styles.TihokaDef} aria-label={t('dict.definitions.aria')}>
          <div className={candidateStyles.TihokaDefGroup}>
            <div className={checkStyles.TihokaDefItem}>
              <div className={candidateStyles.TihokaDefRow}>
                <span className={`${checkStyles.TihokaDefCheck} ${styles.skeletonCheck}`}>
                  <Skeleton width={checkbox} height={checkbox} shape="rounded" />
                </span>
                <span className={candidateStyles.TihokaDefText}>
                  <Skeleton width="90%" height={textH} shape="rounded" />
                </span>
              </div>
            </div>
            <div className={candidateStyles.TihokaDefExamples}>
              <div className={checkStyles.TihokaDefExampleItem}>
                <span className={`${checkStyles.TihokaDefCheck} ${styles.skeletonCheck}`}>
                  <Skeleton width={checkbox} height={checkbox} shape="rounded" />
                </span>
                <span className={candidateStyles.TihokaDefExampleText}>
                  <Skeleton width="65%" height={exH} shape="rounded" />
                </span>
              </div>
            </div>
          </div>
          <div className={candidateStyles.TihokaDefGroup}>
            <div className={checkStyles.TihokaDefItem}>
              <div className={candidateStyles.TihokaDefRow}>
                <span className={`${checkStyles.TihokaDefCheck} ${styles.skeletonCheck}`}>
                  <Skeleton width={checkbox} height={checkbox} shape="rounded" />
                </span>
                <span className={candidateStyles.TihokaDefText}>
                  <Skeleton width="75%" height={textH} shape="rounded" />
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}
