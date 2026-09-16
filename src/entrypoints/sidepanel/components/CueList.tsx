import { memo, useEffect, useMemo, useRef, useState } from 'react';
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
} from '@/features/tokenize/logic/cueListTokens';
import styles from './CueList.module.css';

const EMPTY_TOKEN_MAP: CueListTokenMap = new Map();

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
}

// Human-friendly timestamp: drop leading zeros + millisecond noise.
// < 1h → M:SS (1:28), ≥ 1h → H:MM:SS (1:28:27). YouTube mental model.
function formatTimestamp(ms: number, hasHours: boolean): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return hasHours ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const CueTokenText = memo(function CueTokenText({
  text,
  tokens,
  onTokenClick,
  resolving = false,
}: {
  text: string;
  tokens: readonly Token[];
  onTokenClick: (term: string, element: HTMLElement, contextSentence: string) => void;
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

export function CueList({ cues, currentTimeMs, offsetMs = 0, onSeek, renderCueContent, showNative = true, tokenize }: CueListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const highlightedRef = useRef<number | null>(null);
  const statusOverridesRef = useRef(new Map<string, Map<string, WordStatus>>());
  const [tokenMap, setTokenMap] = useState<CueListTokenMap>(EMPTY_TOKEN_MAP);
  const [resolving, setResolving] = useState(false);

  const visibleCues = useMemo(
    () => cues.filter((c) => c.targetText.trim().length > 0),
    [cues],
  );

  const tokenizeLangCode = tokenize?.langCode;
  const lastCuesRef = useRef<readonly BilingualCue[] | null>(null);
  const lastLangCodeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!tokenizeLangCode) {
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
    const statusOverrides = statusOverridesRef.current;
    let overrides = statusOverrides.get(tokenizeLangCode);
    if (!overrides) {
      overrides = new Map<string, WordStatus>();
      statusOverrides.set(tokenizeLangCode, overrides);
    }
    const unsubscribe = onWordStatusChanged((detail) => {
      if (detail.langCode !== tokenizeLangCode) return;
      overrides.set(detail.term, detail.status);
      setTokenMap((current) => applyCueListTokenStatus(current, detail.term, detail.status));
    });
    const immediate = applyCueListTokenStatuses(
      createCueListTokenMap(visibleCues, tokenizeLangCode),
      overrides,
    );
    setTokenMap(immediate);
    setResolving(true);
    let active = true;
    void resolveCueListTokenMetadata(immediate, tokenizeLangCode).then((resolved) => {
      if (!active) return;
      setResolving(false);
      setTokenMap(applyCueListTokenStatuses(resolved, overrides));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [visibleCues, tokenizeLangCode]);

  // ponytail: infer hasHours from last cue end - offset (displayed max). O(1).
  // Edge case: offset shift could push an earlier cue's display ≥ 1h while last
  // is < 1h — rare; upgrade path: track max displayed time explicitly.
  const lastEnd = visibleCues.length > 0 ? visibleCues[visibleCues.length - 1].end : 0;
  const hasHours = lastEnd - offsetMs >= 3_600_000;

  // ADR-019 sync: highlight cue at effective time so the highlighted cue
  // matches the overlay (which finds cues at currentTime + offsetMs).
  const effectiveMs = currentTimeMs + offsetMs;

  // Find current cue. Half-open [start, end): at boundary t = cue[i].end =
  // cue[i+1].start, only the NEXT cue matches (subtitle semantics: a cue is
  // visible from start inclusive to end exclusive). Closed interval [start,end]
  // would match both cues and findIndex returns the earlier one → replay-cue
  // "jumps back to previous cue" bug.
  const currentIndex = visibleCues.findIndex(
    (c) => c.start <= effectiveMs && c.end > effectiveMs,
  );

  // Auto-scroll current cue into view. Manual scrollTop on the list container
  // instead of scrollIntoView — scrollIntoView({ block: 'center' }) scrolls ALL
  // scrollable ancestors, not just the list. In split view (normal mode), the
  // panel is inserted into the host page DOM (YouTube watch page is scrollable).
  // When the cue is near the end of the list, the list can't center it (not
  // enough content below) → scrollIntoView scrolls the YouTube document to
  // center the panel in the viewport → page jumps ("giật màn hình").
  // Manual scrollTop only scrolls the list, clamped to [0, maxScrollTop].
  useEffect(() => {
    if (currentIndex < 0) return;
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
    };
    if (highlightedRef.current !== currentIndex) {
      highlightedRef.current = currentIndex;
      align();
    }
    const observer = new ResizeObserver(() => {
      const cueRect = el.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      if (cueRect.top < listRect.top || cueRect.bottom > listRect.bottom) align();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [currentIndex, effectiveMs]);



  return (
    <div ref={listRef} className={styles.list} role="list" data-cell-id="cue-list-scroll">
      {visibleCues.map((cue, i) => {
        const isCurrent = i === currentIndex;
        const customContent = renderCueContent?.(cue, i, isCurrent);
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
            className={`${styles.cue} ${isCurrent ? styles.cueCurrent : ''}`}
          >
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
                onClick={() => onSeek(cue.start)}
                aria-label={`Seek to ${formatTimestamp(cue.start - offsetMs, hasHours)}`}
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
  );
}
