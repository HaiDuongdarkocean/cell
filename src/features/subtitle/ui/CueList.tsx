import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { BilingualCue } from '@/entities/media';
import type { ClickModifierState, WordStatus } from '@/entities/dictionary';
import type { Token } from '@/features/tokenize';
import { onDictionaryChanged, onWordStatusChanged } from '@/features/dictionary';
import { getWordTranslations } from '@/features/translate';
import { getSrsCardTermSet, invalidateSrsCardTermSet, onSrsCardsChanged } from '@/features/srs';
import {
  applyCueListCardFlags,
  applyCueListTokenStatus,
  applyCueListTokenStatuses,
  createCueListResolveCache,
  createTokenList,
  resolveCueListTokenMetadata,
  type CueListTokenMap,
  type ResolveMeta,
} from '@/features/tokenize';
import { sentenceContextForIndex } from '@/features/tokenize';
import { formatCueTimestamp } from '@/features/subtitle/logic/cueTime';
import { DEFAULT_BAND_THRESHOLDS } from '@/shared/lib/frequencyBand';
import { spawnRipple } from '@/shared/lib/dom/ripple';
import { Button, CueCard, EmptyState, Icon } from '@/shared/ui';
import { t } from '@/shared/i18n';
import styles from './CueList.module.css';

const EMPTY_TOKEN_MAP: CueListTokenMap = new Map();
const EMPTY_SELECTED_TERMS: ReadonlySet<string> = new Set();
const RESOLVE_MAX_ATTEMPTS = 3;
const RESOLVE_RETRY_DELAY_MS = 1500;
const TOKENIZE_BUDGET_MS = 24;
const TOKENIZE_MIN_CUES = 8;
const EMIT_THROTTLE_MS = 250;
const ROW_ESTIMATE_PX = 72;
const OVERSCAN_PX = 480;
const VIRTUALIZE_MIN_ROWS = 80;

const UNRESOLVED_META: ResolveMeta = {
  resolved: false,
  failed: false,
  freqUnfiltered: false,
  rankByTerm: new Map(),
  thresholds: DEFAULT_BAND_THRESHOLDS,
};

function buildRowPositions(heights: Float64Array, count: number, gapPx: number): number[] {
  const pos = new Array<number>(count + 1);
  pos[0] = 0;
  for (let i = 0; i < count; i++) {
    pos[i + 1] = pos[i] + (heights[i] > 0 ? heights[i] : ROW_ESTIMATE_PX) + gapPx;
  }
  if (count > 0) pos[count] -= gapPx;
  return pos;
}

function findRowAt(pos: number[], y: number): number {
  let lo = 0;
  let hi = pos.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (pos[mid] <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function orderFromCurrent(cues: readonly BilingualCue[], currentCueIndex: number | null): BilingualCue[] {
  if (currentCueIndex === null) return [...cues];
  const split = cues.findIndex((c) => c.index >= currentCueIndex);
  if (split < 0) return [...cues];
  return [...cues.slice(split), ...cues.slice(0, split)];
}

function cuesAreEqual(a: readonly BilingualCue[], b: readonly BilingualCue[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ac = a[i];
    const bc = b[i];
    if (
      ac.index !== bc.index ||
      ac.start !== bc.start ||
      ac.end !== bc.end ||
      ac.targetText !== bc.targetText
    ) {
      return false;
    }
  }
  return true;
}

export interface CueListTokenSelection {
  getTerms(): ReadonlySet<string>;
  subscribe(cb: (terms: ReadonlySet<string>) => void): () => void;
}

export interface CueListTokenize {
  langCode: string;
  onTokenClick: (term: string, element: HTMLElement, contextSentence: string, event: ClickModifierState, cursorOffset?: number) => void;
  /** Hover enter/leave on a word token (null on leave) — feeds the owning
   *  controller's hoveredTerm so status keys 1-4 apply to the hovered word. */
  onTokenHover?: (term: string | null) => void;
  /** Ctrl/Cmd+click a word token — toggles it in the bulk selection instead
   *  of opening the dictionary. Absent → modifier-click falls back to click. */
  onTokenCtrlClick?: (term: string) => void;
  /** Live bulk-selection set shared with the owning controller. */
  selection?: CueListTokenSelection;
  /** Profile `showReadings` — fetch + render reading caps on word tokens. */
  showReadings?: boolean;
  /** Profile `showWordTranslations` — fetch + render gloss lane under word tokens. */
  showGlosses?: boolean;
  /** Gloss destination language (`subtitleOverlayNativeLanguage`). */
  glossTargetLanguage?: string;
}

interface CueListProps {
  cues: BilingualCue[];
  currentTimeMs: number;
  // ADR-019 sync: offset from content script. Highlight cue at
  // effective = currentTimeMs + offsetMs to match the overlay.
  offsetMs?: number;
  onSeek: (timeMs: number) => void;
  renderCueContent?: (cue: BilingualCue, index: number, isCurrent: boolean) => ReactNode | undefined;
  showNative?: boolean;
  tokenize?: CueListTokenize | null;
  onTokensResolved?: (map: CueListTokenMap, meta: ResolveMeta) => void;
  cueFilter?: (cueIndex: number) => boolean;
  filterEpoch?: string;
  /** Player Mode mobile (<600px): card visuals, non-scroll region. */
  mobile?: boolean;
  /** 'list' = full cue list; 'active' = only the current (or next upcoming) card. */
  displayMode?: 'list' | 'active';
  /** Session override for displayMode='active' — render the full list. */
  showAllCues?: boolean;
  /** Actions rendered inside the current cue card, top-right (pm mobile). */
  cardActions?: ReactNode;
  /** One-action sentence capture into the mining queue — adds a save button to
   *  every cue row (spec mining-queue). */
  onSaveCue?: (cue: BilingualCue) => void;
}

const formatTimestamp = formatCueTimestamp;

const CueTokenText = memo(function CueTokenText({
  text,
  tokens,
  onTokenClick,
  onTokenHover,
  onTokenCtrlClick,
  selectedTerms,
  showReadings = false,
  showGlosses = false,
  resolving = false,
}: {
  text: string;
  tokens: readonly Token[];
  onTokenClick: (term: string, element: HTMLElement, contextSentence: string, event: ClickModifierState, cursorOffset?: number) => void;
  onTokenHover?: (term: string | null) => void;
  onTokenCtrlClick?: (term: string) => void;
  selectedTerms?: ReadonlySet<string>;
  showReadings?: boolean;
  showGlosses?: boolean;
  resolving?: boolean;
}) {
  const children: React.ReactNode[] = [];
  let lastEnd = 0;
  for (const token of tokens) {
    if (token.isSeparator) continue;
    if (token.start > lastEnd) {
      children.push(
        <span key={`gap-${token.start}`} className="js-cell-token js-cell-token--separator">
          {text.slice(lastEnd, token.start)}
        </span>,
      );
    }
    children.push(
      <span
        key={`tok-${token.start}`}
        className={[
          'js-cell-token',
          'js-cell-token--word',
          resolving ? 'js-cell-token--resolving' : '',
          `js-cell-token--status-${token.status ?? 'unknown'}`,
          token.frequencyBand && token.frequencyBand !== 'none'
            ? `js-cell-token--frequency-${token.frequencyBand}`
            : '',
          selectedTerms?.has(token.term) ? 'js-cell-token--selected' : '',
          token.hasCard ? 'js-cell-token--has-card' : '',
          showReadings ? '' : 'js-cell-token--reading-off',
          showGlosses ? '' : 'js-cell-token--gloss-off',
        ]
          .filter(Boolean)
          .join(' ')}
        data-cell-term={token.term}
        data-cell-start={token.start}
        data-cell-end={token.end}
        data-reading={showReadings ? token.reading : undefined}
        data-gloss={showGlosses ? token.gloss || undefined : undefined}
        onClick={(event) => {
          if ((event.ctrlKey || event.metaKey) && onTokenCtrlClick) {
            event.preventDefault();
            onTokenCtrlClick(token.term);
            return;
          }
          const ctx = sentenceContextForIndex(tokens, text, token.sentenceIndex, token.start);
          onTokenClick(token.term, event.currentTarget, ctx?.sentence ?? text, event, ctx?.cursorOffset ?? token.start);
        }}
        onMouseEnter={onTokenHover ? () => onTokenHover(token.term) : undefined}
        onMouseLeave={onTokenHover ? () => onTokenHover(null) : undefined}
      >
        <span className="js-cell-token-word">{token.text}</span>
        <span className="js-cell-token-status" aria-hidden="true" />
      </span>,
    );
    lastEnd = token.end;
  }
  if (lastEnd < text.length) {
    children.push(
      <span key="tail" className="js-cell-token js-cell-token--separator">
        {text.slice(lastEnd)}
      </span>,
    );
  }
  return <>{children}</>;
});

export function CueList({ cues, currentTimeMs, offsetMs = 0, onSeek, renderCueContent, showNative = true, tokenize, onTokensResolved, cueFilter, filterEpoch, mobile = false, displayMode = 'list', showAllCues = false, cardActions, onSaveCue }: CueListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const highlightedRef = useRef<number | null>(null);
  const statusOverridesRef = useRef(new Map<string, Map<string, WordStatus>>());
  const metaRef = useRef<ResolveMeta>(UNRESOLVED_META);
  const resolvingRef = useRef(false);
  const [tokenMap, setTokenMap] = useState<CueListTokenMap>(EMPTY_TOKEN_MAP);
  const [resolving, setResolving] = useState(false);
  const [desynced, setDesynced] = useState(false);
  const expectedScrollTopRef = useRef(0);
  const heightsRef = useRef<Float64Array>(new Float64Array(0));
  const positionsRef = useRef<number[]>([0]);
  const heightsDirtyRef = useRef(true);
  const gapPxRef = useRef(12);
  const rowElsRef = useRef(new Map<HTMLElement, number>());
  const rowByIndexRef = useRef(new Map<number, HTMLElement>());
  const rowRORef = useRef<ResizeObserver | null>(null);
  const updateWindowRef = useRef<(() => void) | null>(null);
  const scrollRafRef = useRef(0);
  const lastRenderedRef = useRef<readonly BilingualCue[] | null>(null);
  const [viewWindow, setViewWindow] = useState({ start: 0, end: VIRTUALIZE_MIN_ROWS });

  const visibleCues = useMemo(
    () => cues.filter((c) => c.targetText.trim().length > 0),
    [cues],
  );

  const filteredCues = useMemo(
    () => (cueFilter ? visibleCues.filter((c) => cueFilter(c.index)) : visibleCues),
    [visibleCues, cueFilter],
  );

  const activeOnly = displayMode === 'active' && !showAllCues;
  const effectiveMs = currentTimeMs + offsetMs;
  const currentIndex = filteredCues.findIndex(
    (c) => c.start <= effectiveMs && c.end > effectiveMs,
  );
  const currentCueIndex = currentIndex >= 0 ? filteredCues[currentIndex].index : null;
  const upcomingIndex = activeOnly && currentIndex < 0
    ? filteredCues.findIndex((c) => c.start > effectiveMs)
    : -1;
  let renderedCues: BilingualCue[];
  if (activeOnly) {
    renderedCues = currentIndex >= 0
      ? [filteredCues[currentIndex]]
      : upcomingIndex >= 0
        ? [filteredCues[upcomingIndex]]
        : [];
  } else {
    renderedCues = filteredCues;
  }
  const renderedCurrentIndex = renderedCues.findIndex((c) => c.index === currentCueIndex);

  const virtualized = !activeOnly && renderedCues.length > VIRTUALIZE_MIN_ROWS;
  if (renderedCues !== lastRenderedRef.current) {
    lastRenderedRef.current = renderedCues;
    heightsRef.current = new Float64Array(renderedCues.length);
    heightsDirtyRef.current = true;
    rowElsRef.current = new Map();
  }
  const rowCount = renderedCues.length;
  const ensurePositions = useCallback((): number[] => {
    if (heightsDirtyRef.current) {
      positionsRef.current = buildRowPositions(heightsRef.current, rowCount, gapPxRef.current);
      heightsDirtyRef.current = false;
    }
    return positionsRef.current;
  }, [rowCount]);
  const positions = virtualized ? ensurePositions() : null;
  const vStart = virtualized ? Math.min(viewWindow.start, rowCount) : 0;
  const vEnd = virtualized ? Math.min(viewWindow.end, rowCount) : rowCount;

  const tokenizeLangCode = tokenize?.langCode;
  const onTokenHover = tokenize?.onTokenHover;
  const selection = tokenize?.selection;
  const showReadings = tokenize?.showReadings ?? false;
  const showGlosses = tokenize?.showGlosses ?? false;
  const glossTargetLanguage = tokenize?.glossTargetLanguage;
  const [selectedTerms, setSelectedTerms] = useState<ReadonlySet<string>>(
    () => selection?.getTerms() ?? EMPTY_SELECTED_TERMS,
  );
  const lastCuesRef = useRef<readonly BilingualCue[] | null>(null);
  const lastLangCodeRef = useRef<string | null>(null);
  const lastShowReadingsRef = useRef<boolean>(showReadings);
  const lastShowGlossesRef = useRef<boolean>(showGlosses);
  const lastGlossTargetLanguageRef = useRef<string | undefined>(glossTargetLanguage);
  // Bumped when the dictionary corpus changes → full metadata re-resolve so
  // readings/frequency bands reflect imported/toggled resources.
  const [dictEpoch, setDictEpoch] = useState(0);
  const lastDictEpochRef = useRef(0);

  useEffect(() => {
    setSelectedTerms(selection?.getTerms() ?? EMPTY_SELECTED_TERMS);
    return selection?.subscribe(setSelectedTerms);
  }, [selection]);

  // A token unmount (panel close, cue reload, tokenize off) fires no
  // mouseleave — clear the hover so a stale term can't absorb a status key.
  useEffect(() => () => onTokenHover?.(null), [onTokenHover]);

  useEffect(() => {
    if (!tokenizeLangCode) return;
    const statusOverrides = statusOverridesRef.current;
    let overrides = statusOverrides.get(tokenizeLangCode);
    if (!overrides) {
      overrides = new Map<string, WordStatus>();
      statusOverrides.set(tokenizeLangCode, overrides);
    }
    return onWordStatusChanged((detail) => {
      if (detail.langCode !== tokenizeLangCode) return;
      overrides.set(detail.term, detail.status);
      setTokenMap((current) => applyCueListTokenStatus(current, detail.term, detail.status));
    });
  }, [tokenizeLangCode]);

  useEffect(() => {
    if (!tokenizeLangCode) return;
    return onDictionaryChanged(({ langCode }) => {
      if (langCode && langCode !== tokenizeLangCode) return;
      setDictEpoch((n) => n + 1);
    });
  }, [tokenizeLangCode]);

  useEffect(() => {
    if (!tokenizeLangCode) return;
    return onSrsCardsChanged((langCode) => {
      if (langCode !== tokenizeLangCode) return;
      invalidateSrsCardTermSet(langCode);
      void getSrsCardTermSet(langCode)
        .then((cardTerms) => {
          setTokenMap((current) => applyCueListCardFlags(current, cardTerms));
        })
        .catch(() => {});
    });
  }, [tokenizeLangCode]);

  const coveredCueIndicesRef = useRef<Set<number>>(new Set());
  const scopeGenRef = useRef(0);
  const resolveCacheRef = useRef(createCueListResolveCache());
  const glossCacheRef = useRef(new Map<string, string>());
  const glossPendingRef = useRef(new Set<string>());
  const renderedCountRef = useRef(0);
  const lastEmitAtRef = useRef(0);
  const emitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!tokenizeLangCode) {
      lastCuesRef.current = null;
      lastLangCodeRef.current = null;
      metaRef.current = UNRESOLVED_META;
      resolvingRef.current = false;
      coveredCueIndicesRef.current.clear();
      setResolving(false);
      setTokenMap(EMPTY_TOKEN_MAP);
      return;
    }
    const scopeChanged =
      lastCuesRef.current === null ||
      !cuesAreEqual(visibleCues, lastCuesRef.current) ||
      tokenizeLangCode !== lastLangCodeRef.current ||
      showReadings !== lastShowReadingsRef.current ||
      showGlosses !== lastShowGlossesRef.current ||
      glossTargetLanguage !== lastGlossTargetLanguageRef.current ||
      dictEpoch !== lastDictEpochRef.current;
    if (scopeChanged) {
      scopeGenRef.current += 1;
      resolveCacheRef.current = createCueListResolveCache();
      glossCacheRef.current = new Map();
      glossPendingRef.current.clear();
      lastCuesRef.current = visibleCues;
      lastLangCodeRef.current = tokenizeLangCode;
      lastShowReadingsRef.current = showReadings;
      lastShowGlossesRef.current = showGlosses;
      lastGlossTargetLanguageRef.current = glossTargetLanguage;
      lastDictEpochRef.current = dictEpoch;
      coveredCueIndicesRef.current.clear();
      setTokenMap(EMPTY_TOKEN_MAP);
    }
    renderedCountRef.current = renderedCues.length;
    const uncovered = orderFromCurrent(
      renderedCues.filter((c) => !coveredCueIndicesRef.current.has(c.index)),
      currentCueIndex,
    );
    if (uncovered.length === 0) return;

    let active = true;
    const scopeGen = scopeGenRef.current;
    const resolveCache = resolveCacheRef.current;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let chunkTimer: ReturnType<typeof setTimeout> | undefined;
    let idleHandle = 0;

    const scheduleChunk = (fn: () => void): void => {
      if (typeof requestIdleCallback === 'function') {
        idleHandle = requestIdleCallback(() => fn(), { timeout: 2000 });
      } else {
        chunkTimer = setTimeout(fn, 0);
      }
    };

    const resolveChunk = (chunkMap: CueListTokenMap, attempt: number): void => {
      resolvingRef.current = true;
      setResolving(true);
      void resolveCueListTokenMetadata(chunkMap, tokenizeLangCode, {
        includeReadings: showReadings,
        includeGlosses: false,
        glossTargetLanguage,
        cache: resolveCache,
      })
        .then(({ map, meta }) => {
          if (scopeGenRef.current !== scopeGen) return;
          metaRef.current = meta;
          const statuses = statusOverridesRef.current.get(tokenizeLangCode);
          const glossCache = glossCacheRef.current;
          const nextChunk = statuses && statuses.size > 0 ? applyCueListTokenStatuses(map, statuses) : map;
          setTokenMap((current) => {
            const merged = new Map(current);
            for (const [cueIndex, tokens] of nextChunk) {
              merged.set(
                cueIndex,
                tokens.map((token) =>
                  !token.isSeparator && token.gloss === undefined && glossCache.has(token.term)
                    ? { ...token, gloss: glossCache.get(token.term) }
                    : token,
                ),
              );
            }
            return merged;
          });
          if (meta.failed && attempt < RESOLVE_MAX_ATTEMPTS) {
            retryTimer = setTimeout(() => resolveChunk(chunkMap, attempt + 1), RESOLVE_RETRY_DELAY_MS);
          }
        })
        .catch(() => {
          if (!active || scopeGenRef.current !== scopeGen) return;
          if (attempt < RESOLVE_MAX_ATTEMPTS) {
            retryTimer = setTimeout(() => resolveChunk(chunkMap, attempt + 1), RESOLVE_RETRY_DELAY_MS);
          }
        })
        .finally(() => {
          if (!active) return;
          resolvingRef.current = false;
          setResolving(false);
        });
    };

    const buildChunk = (pending: readonly BilingualCue[], offset: number): void => {
      const statuses = statusOverridesRef.current.get(tokenizeLangCode);
      const chunkMap = new Map<number, readonly Token[]>();
      const deadline = performance.now() + TOKENIZE_BUDGET_MS;
      let i = offset;
      while (i < pending.length && (i - offset < TOKENIZE_MIN_CUES || performance.now() < deadline)) {
        const cue = pending[i];
        let tokens = createTokenList(cue.targetText, tokenizeLangCode);
        if (statuses) {
          tokens = tokens.map((token) => {
            if (token.isSeparator) return token;
            const status = statuses.get(token.term);
            return status && token.status !== status ? { ...token, status } : token;
          });
        }
        chunkMap.set(cue.index, tokens);
        coveredCueIndicesRef.current.add(cue.index);
        i++;
      }
      setTokenMap((current) => {
        const merged = new Map(current);
        for (const [cueIndex, tokens] of chunkMap) merged.set(cueIndex, tokens);
        return merged;
      });
      resolveChunk(chunkMap, 1);
      if (i < pending.length) {
        scheduleChunk(() => buildChunk(pending, i));
      }
    };
    buildChunk(uncovered, 0);
    return () => {
      active = false;
      if (retryTimer !== undefined) clearTimeout(retryTimer);
      if (chunkTimer !== undefined) clearTimeout(chunkTimer);
      if (idleHandle && typeof cancelIdleCallback === 'function') cancelIdleCallback(idleHandle);
    };
  }, [visibleCues, renderedCues, tokenizeLangCode, showReadings, showGlosses, glossTargetLanguage, dictEpoch, currentCueIndex]);

  useEffect(() => {
    if (resolvingRef.current || !onTokensResolved) return;
    const allCovered = coveredCueIndicesRef.current.size >= renderedCountRef.current;
    const emit = (): void => {
      lastEmitAtRef.current = performance.now();
      onTokensResolved(tokenMap, metaRef.current);
    };
    if (allCovered || performance.now() - lastEmitAtRef.current >= EMIT_THROTTLE_MS) {
      emit();
      return;
    }
    if (emitTimerRef.current !== null) clearTimeout(emitTimerRef.current);
    emitTimerRef.current = setTimeout(emit, EMIT_THROTTLE_MS);
    return () => {
      if (emitTimerRef.current !== null) {
        clearTimeout(emitTimerRef.current);
        emitTimerRef.current = null;
      }
    };
  }, [tokenMap, resolving, onTokensResolved]);

  useEffect(() => {
    if (!tokenizeLangCode || !showGlosses || !glossTargetLanguage) return;
    const cache = glossCacheRef.current;
    const pending = glossPendingRef.current;
    const needed = new Set<string>();
    for (const cue of renderedCues.slice(vStart, vEnd)) {
      const tokens = tokenMap.get(cue.index);
      if (!tokens) continue;
      for (const token of tokens) {
        if (token.isSeparator || token.gloss !== undefined) continue;
        if (!cache.has(token.term) && !pending.has(token.term)) needed.add(token.term);
      }
    }
    if (needed.size === 0) return;
    for (const term of needed) pending.add(term);
    const scopeGen = scopeGenRef.current;
    void getWordTranslations(tokenizeLangCode, glossTargetLanguage, [...needed])
      .then((glosses) => {
        if (scopeGenRef.current !== scopeGen || !glosses) return;
        for (const term of needed) {
          pending.delete(term);
          cache.set(term, glosses.get(term) ?? '');
        }
        setTokenMap((current) => {
          const merged = new Map(current);
          let changed = false;
          for (const [cueIndex, tokens] of current) {
            const nextTokens = tokens.map((token) =>
              !token.isSeparator && token.gloss === undefined && cache.has(token.term)
                ? { ...token, gloss: cache.get(token.term) }
                : token,
            );
            if (nextTokens.some((t, i) => t !== tokens[i])) {
              changed = true;
              merged.set(cueIndex, nextTokens);
            }
          }
          return changed ? merged : current;
        });
      })
      .catch(() => {
        for (const term of needed) pending.delete(term);
      });
  }, [tokenMap, vStart, vEnd, renderedCues, tokenizeLangCode, showGlosses, glossTargetLanguage]);

  useEffect(() => {
    if (!virtualized) return;
    const updateWindow = (): void => {
      const list = listRef.current;
      if (!list) return;
      const pos = ensurePositions();
      const scrollTop = list.scrollTop;
      const viewportH = list.clientHeight;
      const start = Math.min(
        Math.max(0, findRowAt(pos, Math.max(0, scrollTop - OVERSCAN_PX))),
        Math.max(0, rowCount - 1),
      );
      const end = Math.max(
        start + 1,
        Math.min(rowCount, findRowAt(pos, scrollTop + viewportH + OVERSCAN_PX) + 1),
      );
      setViewWindow((w) => (w.start === start && w.end === end ? w : { start, end }));
    };
    updateWindowRef.current = updateWindow;
    const list = listRef.current;
    if (list) {
      gapPxRef.current = parseFloat(getComputedStyle(list).rowGap) || 12;
      const ro = new ResizeObserver(() => updateWindow());
      ro.observe(list);
      updateWindow();
      return () => ro.disconnect();
    }
    return undefined;
  }, [virtualized, rowCount, ensurePositions]);

  useEffect(() => {
    if (!virtualized) return;
    const ro = new ResizeObserver((entries) => {
      const map = rowElsRef.current;
      const heights = heightsRef.current;
      let dirty = false;
      for (const entry of entries) {
        const i = map.get(entry.target as HTMLElement);
        if (i === undefined) continue;
        const h =
          entry.borderBoxSize?.[0]?.blockSize ??
          (entry.target as HTMLElement).offsetHeight;
        if (h > 0 && heights[i] !== h) {
          heights[i] = h;
          dirty = true;
        }
      }
      if (dirty) {
        heightsDirtyRef.current = true;
        updateWindowRef.current?.();
      }
    });
    rowRORef.current = ro;
    return () => {
      ro.disconnect();
      rowRORef.current = null;
    };
  }, [virtualized]);

  // ponytail: infer hasHours from last cue end - offset (displayed max). O(1).
  // Edge case: offset shift could push an earlier cue's display ≥ 1h while last
  // is < 1h — rare; upgrade path: track max displayed time explicitly.
  const lastEnd = filteredCues.length > 0 ? filteredCues[filteredCues.length - 1].end : 0;
  const hasHours = lastEnd - offsetMs >= 3_600_000;

  // 'active' display mode (PM mobile): render only the current cue; in a gap,
  // fall back to the next upcoming cue rendered dimmed; past the last cue the
  // region shows a compact empty state instead of a stale card.

  useEffect(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTop = 0;
      expectedScrollTopRef.current = 0;
    }
    highlightedRef.current = null;
    setDesynced(false);
  }, [filterEpoch]);

  // Auto-scroll current cue into view. Manual scrollTop on the list container
  // instead of scrollIntoView — scrollIntoView({ block: 'center' }) scrolls ALL
  // scrollable ancestors, not just the list. In split view (normal mode), the
  // panel is inserted into the host page DOM (YouTube watch page is scrollable).
  // When the cue is near the end of the list, the list can't center it (not
  // enough content below) → scrollIntoView scrolls the YouTube document to
  // center the panel in the viewport → page jumps ("giật màn hình").
  // Manual scrollTop only scrolls the list, clamped to [0, maxScrollTop].
  useEffect(() => {
    const alignIndex = renderedCurrentIndex;
    if (desynced || alignIndex < 0) return;
    const el = itemRefs.current[alignIndex];
    const list = listRef.current;
    if (!list) return;
    if (!el) {
      if (!virtualized) return;
      const pos = ensurePositions();
      const estH = heightsRef.current[alignIndex] || ROW_ESTIMATE_PX;
      const top = pos[alignIndex];
      const target =
        estH >= list.clientHeight ? top : top - (list.clientHeight - estH) / 2;
      const max = Math.max(0, pos[pos.length - 1] - list.clientHeight);
      const next = Math.max(0, Math.min(target, max));
      if (Math.abs(list.scrollTop - next) > 2) {
        highlightedRef.current = currentCueIndex;
        list.scrollTop = next;
        expectedScrollTopRef.current = next;
      }
      return;
    }
    const cueTop = (): number => {
      const cueRect = el.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      return cueRect.top - listRect.top + list.scrollTop;
    };
    const align = (): void => {
      const top = cueTop();
      const targetScroll = el.offsetHeight >= list.clientHeight
        ? top
        : top - (list.clientHeight - el.offsetHeight) / 2;
      list.scrollTop = Math.max(0, Math.min(targetScroll, list.scrollHeight - list.clientHeight));
      expectedScrollTopRef.current = list.scrollTop;
    };
    if (highlightedRef.current !== currentCueIndex) {
      highlightedRef.current = currentCueIndex;
      align();
    }
    const observer = new ResizeObserver(() => {
      const cueRect = el.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      if (cueRect.top < listRect.top || cueRect.bottom > listRect.bottom) align();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [renderedCurrentIndex, renderedCues.length, currentCueIndex, effectiveMs, filterEpoch, desynced, virtualized, viewWindow, ensurePositions]);

  const handleListScroll = (): void => {
    const list = listRef.current;
    if (!list) return;
    if (Math.abs(list.scrollTop - expectedScrollTopRef.current) > 2) setDesynced(true);
    if (virtualized && !scrollRafRef.current) {
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = 0;
        updateWindowRef.current?.();
      });
    }
  };

  const resumeFollow = useCallback((realign: boolean): void => {
    if (realign) highlightedRef.current = null;
    setDesynced(false);
  }, []);



  itemRefs.current.length = renderedCues.length;

  return (
    <div className={`${styles.cueWrap} ${mobile ? styles.pmMobile : ''}`}>
      <div
        ref={listRef}
        className={`${styles.list} ${desynced ? styles.listDesynced : ''}`}
        role="list"
        data-cell-id="cue-list-scroll"
        onScroll={handleListScroll}
      >
      {renderedCues.length === 0 && (
        <EmptyState size="compact" title={t('panel.empty.title')} style={{ flex: 1 }} />
      )}
      {virtualized && positions && vStart > 0 && (
        <div style={{ height: positions[vStart], flexShrink: 0 }} aria-hidden="true" />
      )}
      {renderedCues.slice(vStart, vEnd).map((cue, j) => {
        const i = vStart + j;
        const isCurrent = i === renderedCurrentIndex;
        const isUpcoming = activeOnly && currentIndex < 0;
        const customContent = renderCueContent?.(cue, i, isCurrent);
        return (
          <CueCard
            key={cue.index}
            ref={(el) => {
              itemRefs.current[i] = el;
              if (!virtualized) return;
              const rows = rowByIndexRef.current;
              const old = rows.get(i);
              if (old && old !== el) {
                rowRORef.current?.unobserve(old);
                rowElsRef.current.delete(old);
                rows.delete(i);
              }
              if (el) {
                rows.set(i, el);
                rowElsRef.current.set(el, i);
                rowRORef.current?.observe(el);
                const h = el.offsetHeight;
                if (h > 0 && heightsRef.current[i] !== h) {
                  heightsRef.current[i] = h;
                  heightsDirtyRef.current = true;
                  updateWindowRef.current?.();
                }
              }
            }}
            role="listitem"
            data-cell-id="cue-item"
            data-cue-index={cue.index}
            data-cue-start={cue.start}
            data-cue-end={cue.end}
            data-cell-ripple-self={mobile ? undefined : ''}
            onPointerDown={(event) => {
              if (!mobile && event.button === 0) spawnRipple(event.currentTarget, event.clientX, event.clientY);
            }}
            current={isCurrent}
            upcoming={isUpcoming}
            content={customContent}
            title={
              tokenize ? (
                <CueTokenText
                  text={cue.targetText}
                  tokens={tokenMap.get(cue.index) ?? []}
                  onTokenClick={tokenize.onTokenClick}
                  onTokenHover={onTokenHover}
                  onTokenCtrlClick={tokenize.onTokenCtrlClick}
                  selectedTerms={selectedTerms}
                  showReadings={tokenize?.showReadings ?? false}
                  showGlosses={showGlosses}
                  resolving={resolving}
                />
              ) : (
                cue.targetText
              )
            }
            subtitle={showNative && cue.nativeText ? cue.nativeText : undefined}
            textProps={mobile && isCurrent ? { 'data-cell-id': 'pm-cue-active-card' } : undefined}
            actions={
              <>
                <button
                  type="button"
                  data-cell-id="cue-timestamp"
                  data-cue-index={cue.index}
                  data-no-lookup
                  onClick={() => {
                    resumeFollow(false);
                    onSeek(cue.start);
                  }}
                  aria-label={t('cueList.seekTo', [formatTimestamp(cue.start - offsetMs, hasHours)])}
                  className={styles.timestamp}
                >
                  {/* ADR-019 sync: shift displayed timestamp by -offsetMs so the
                      list shows the VIDEO time at which this cue will display
                      (matches overlay + highlight). onSeek still sends raw
                      cue.start; SEEK_TO handler subtracts offset. */}
                  {`${formatTimestamp(cue.start - offsetMs, hasHours)} – ${formatTimestamp(cue.end - offsetMs, hasHours)}`}
                </button>
                {onSaveCue && (
                  <button
                    type="button"
                    data-cell-id="cue-save"
                    data-cue-index={cue.index}
                    data-no-lookup
                    aria-label={t('queue.action.saveSentence')}
                    title={t('queue.action.saveSentence')}
                    className={styles.saveCue}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSaveCue(cue);
                    }}
                  >
                    <Icon name="bookmark" size="xs" />
                  </button>
                )}
                {mobile && isCurrent && cardActions && (
                  <div className={styles.cardActions} data-cell-id="pm-card-actions">
                    {cardActions}
                  </div>
                )}
              </>
            }
          />
        );
      })}
      {virtualized && positions && vEnd < rowCount && (
        <div
          style={{ height: positions[positions.length - 1] - positions[vEnd], flexShrink: 0 }}
          aria-hidden="true"
        />
      )}
      </div>
      {desynced && (
        <Button
          variant="overlay"
          size="sm"
          elevation="med"
          className={styles.syncPill}
          leadingIcon={<Icon name="crosshair" size="xs" />}
          onClick={() => resumeFollow(true)}
          data-cell-id="cue-list-sync"
        >
          {t('cueList.syncToVideo')}
        </Button>
      )}
    </div>
  );
}
