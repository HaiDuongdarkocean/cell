import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { BilingualCue } from '@/entities/media';
import type { WordStatus } from '@/entities/dictionary';
import type { Token } from '@/features/tokenize/types';
import { onWordStatusChanged } from '@/features/dictionary/services/wordStatusEvents';
import {
  applyCueListTokenStatus,
  applyCueListTokenStatuses,
  createCueListTokenMap,
  resolveCueListTokenMetadata,
  type CueListTokenMap,
  type ResolveMeta,
} from '@/features/tokenize/logic/cueListTokens';
import { cueHeatBand, type CueDifficulty } from '@/features/subtitle/logic/cueDifficulty';
import { formatCueTimestamp } from '@/features/subtitle/logic/cueTime';
import { DEFAULT_BAND_THRESHOLDS } from '@/shared/lib/frequencyBand';
import { Button, Icon, VisuallyHidden } from '@/shared/ui';
import { t } from '@/shared/i18n';
import styles from './CueList.module.css';

const EMPTY_TOKEN_MAP: CueListTokenMap = new Map();

const UNRESOLVED_META: ResolveMeta = {
  resolved: false,
  failed: false,
  freqUnfiltered: false,
  rankByTerm: new Map(),
  thresholds: DEFAULT_BAND_THRESHOLDS,
};

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

export interface CueListTokenize {
  langCode: string;
  onTokenClick: (term: string, element: HTMLElement, contextSentence: string) => void;
  /** Hover enter/leave on a word token (null on leave) — feeds the owning
   *  controller's hoveredTerm so status keys 1-4 apply to the hovered word. */
  onTokenHover?: (term: string | null) => void;
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
  /** Per-cue difficulty for the ambient heat bar. Omit → no indicator. */
  cueDifficulty?: ReadonlyMap<number, CueDifficulty>;
}

const formatTimestamp = formatCueTimestamp;

const CueTokenText = memo(function CueTokenText({
  text,
  tokens,
  onTokenClick,
  onTokenHover,
  resolving = false,
}: {
  text: string;
  tokens: readonly Token[];
  onTokenClick: (term: string, element: HTMLElement, contextSentence: string) => void;
  onTokenHover?: (term: string | null) => void;
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
        ]
          .filter(Boolean)
          .join(' ')}
        data-cell-term={token.term}
        data-cell-start={token.start}
        data-cell-end={token.end}
        onClick={(event) => onTokenClick(token.term, event.currentTarget, text)}
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

export function CueList({ cues, currentTimeMs, offsetMs = 0, onSeek, renderCueContent, showNative = true, tokenize, onTokensResolved, cueFilter, filterEpoch, cueDifficulty }: CueListProps) {
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

  const visibleCues = useMemo(
    () => cues.filter((c) => c.targetText.trim().length > 0),
    [cues],
  );

  const filteredCues = useMemo(
    () => (cueFilter ? visibleCues.filter((c) => cueFilter(c.index)) : visibleCues),
    [visibleCues, cueFilter],
  );

  const tokenizeLangCode = tokenize?.langCode;
  const onTokenHover = tokenize?.onTokenHover;
  const lastCuesRef = useRef<readonly BilingualCue[] | null>(null);
  const lastLangCodeRef = useRef<string | null>(null);

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
    if (!tokenizeLangCode) {
      lastCuesRef.current = null;
      lastLangCodeRef.current = null;
      metaRef.current = UNRESOLVED_META;
      resolvingRef.current = false;
      setResolving(false);
      setTokenMap(EMPTY_TOKEN_MAP);
      return;
    }
    if (
      lastCuesRef.current !== null &&
      cuesAreEqual(visibleCues, lastCuesRef.current) &&
      tokenizeLangCode === lastLangCodeRef.current
    ) {
      return;
    }
    lastCuesRef.current = visibleCues;
    lastLangCodeRef.current = tokenizeLangCode;
    const overrides = statusOverridesRef.current.get(tokenizeLangCode);
    const immediate = applyCueListTokenStatuses(
      createCueListTokenMap(visibleCues, tokenizeLangCode),
      overrides ?? new Map<string, WordStatus>(),
    );
    setTokenMap(immediate);
    resolvingRef.current = true;
    setResolving(true);
    let active = true;
    void resolveCueListTokenMetadata(immediate, tokenizeLangCode).then(({ map, meta }) => {
      if (!active) return;
      metaRef.current = meta;
      resolvingRef.current = false;
      setResolving(false);
      setTokenMap(
        applyCueListTokenStatuses(
          map,
          statusOverridesRef.current.get(tokenizeLangCode) ?? new Map<string, WordStatus>(),
        ),
      );
    });
    return () => {
      active = false;
    };
  }, [visibleCues, tokenizeLangCode]);

  useEffect(() => {
    if (!resolvingRef.current) onTokensResolved?.(tokenMap, metaRef.current);
  }, [tokenMap, resolving, onTokensResolved]);

  // ponytail: infer hasHours from last cue end - offset (displayed max). O(1).
  // Edge case: offset shift could push an earlier cue's display ≥ 1h while last
  // is < 1h — rare; upgrade path: track max displayed time explicitly.
  const lastEnd = filteredCues.length > 0 ? filteredCues[filteredCues.length - 1].end : 0;
  const hasHours = lastEnd - offsetMs >= 3_600_000;

  // ADR-019 sync: highlight cue at effective time so the highlighted cue
  // matches the overlay (which finds cues at currentTime + offsetMs).
  const effectiveMs = currentTimeMs + offsetMs;

  // Find current cue. Half-open [start, end): at boundary t = cue[i].end =
  // cue[i+1].start, only the NEXT cue matches (subtitle semantics: a cue is
  // visible from start inclusive to end exclusive). Closed interval [start,end]
  // would match both cues and findIndex returns the earlier one → replay-cue
  // "jumps back to previous cue" bug.
  const currentIndex = filteredCues.findIndex(
    (c) => c.start <= effectiveMs && c.end > effectiveMs,
  );
  const currentCueIndex = currentIndex >= 0 ? filteredCues[currentIndex].index : null;

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
    if (desynced || currentIndex < 0) return;
    const el = itemRefs.current[currentIndex];
    const list = listRef.current;
    if (!el || !list) return;
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
  }, [currentIndex, currentCueIndex, effectiveMs, filterEpoch, desynced]);

  const handleListScroll = (): void => {
    const list = listRef.current;
    if (!list) return;
    if (Math.abs(list.scrollTop - expectedScrollTopRef.current) > 2) setDesynced(true);
  };

  const resumeFollow = useCallback((realign: boolean): void => {
    if (realign) highlightedRef.current = null;
    setDesynced(false);
  }, []);



  itemRefs.current.length = filteredCues.length;

  return (
    <div className={styles.cueWrap}>
      <div
        ref={listRef}
        className={`${styles.list} ${desynced ? styles.listDesynced : ''}`}
        role="list"
        data-cell-id="cue-list-scroll"
        onScroll={handleListScroll}
      >
      {filteredCues.map((cue, i) => {
        const isCurrent = i === currentIndex;
        const customContent = renderCueContent?.(cue, i, isCurrent);
        const heat = cueDifficulty?.get(cue.index);
        const band = heat === undefined ? undefined : cueHeatBand(heat);
        return (
          <div
            key={cue.index}
            ref={(el) => { itemRefs.current[i] = el; }}
            role="listitem"
            data-cell-id="cue-item"
            data-cue-index={cue.index}
            data-cue-start={cue.start}
            data-cue-end={cue.end}
            data-current={isCurrent ? 'true' : 'false'}
            data-heat={band}
            className={`${styles.cue} ${isCurrent ? styles.cueCurrent : ''}`}
          >
            {heat !== undefined && band !== undefined && (
              <>
                <span
                  className={`${styles.heat} ${styles[`heat_${band}`]}`}
                  data-cell-id="cue-heat"
                  title={t(`cueHeat.tooltip.${band}`, [heat.unknown + heat.tracking])}
                  aria-hidden="true"
                />
                <VisuallyHidden id={`cue-heat-sr-${cue.index}`}>
                  {t('cueHeat.srLabel', [heat.unknown + heat.tracking])}
                </VisuallyHidden>
              </>
            )}
            {customContent !== undefined ? (
              customContent
            ) : (
              <div className={styles.text} data-allow-lookup>
                <div data-cell-id="cue-target-text" className={styles.targetText}>
                  {tokenize ? (
                    <CueTokenText
                      text={cue.targetText}
                      tokens={tokenMap.get(cue.index) ?? []}
                      onTokenClick={tokenize.onTokenClick}
                      onTokenHover={onTokenHover}
                      resolving={resolving}
                    />
                  ) : (
                    cue.targetText
                  )}
                </div>
                {showNative && cue.nativeText && (
                  <div data-cell-id="cue-native-text" className={styles.nativeText}>
                    {cue.nativeText}
                  </div>
                )}
              </div>
            )}
            <div className={styles.actions} data-cell-id="cue-actions">
              <button
                type="button"
                data-cell-id="cue-timestamp"
                data-cue-index={cue.index}
                data-no-lookup
                onClick={() => {
                  resumeFollow(false);
                  onSeek(cue.start);
                }}
                aria-label={`Seek to ${formatTimestamp(cue.start - offsetMs, hasHours)}`}
                aria-describedby={band !== undefined ? `cue-heat-sr-${cue.index}` : undefined}
                className={styles.timestamp}
              >
                {/* ADR-019 sync: shift displayed timestamp by -offsetMs so the
                    list shows the VIDEO time at which this cue will display
                    (matches overlay + highlight). onSeek still sends raw
                    cue.start; SEEK_TO handler subtracts offset. */}
                {formatTimestamp(cue.start - offsetMs, hasHours)}
              </button>
            </div>
          </div>
        );
      })}
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
