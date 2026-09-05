import { useEffect, useRef } from 'react';
import type { BilingualCue } from '@/entities/media';
import styles from './CueList.module.css';

interface CueListProps {
  cues: BilingualCue[];
  currentTimeMs: number;
  // ADR-019 sync: offset from content script. Highlight cue at
  // effective = currentTimeMs + offsetMs to match the overlay.
  offsetMs?: number;
  onSeek: (timeMs: number) => void;
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

export function CueList({ cues, currentTimeMs, offsetMs = 0, onSeek }: CueListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const highlightedRef = useRef<number | null>(null);

  // ponytail: infer hasHours from last cue end - offset (displayed max). O(1).
  // Edge case: offset shift could push an earlier cue's display ≥ 1h while last
  // is < 1h — rare; upgrade path: track max displayed time explicitly.
  const lastEnd = cues.length > 0 ? cues[cues.length - 1].end : 0;
  const hasHours = lastEnd - offsetMs >= 3_600_000;

  // ADR-019 sync: highlight cue at effective time so the highlighted cue
  // matches the overlay (which finds cues at currentTime + offsetMs).
  const effectiveMs = currentTimeMs + offsetMs;

  // Find current cue. Half-open [start, end): at boundary t = cue[i].end =
  // cue[i+1].start, only the NEXT cue matches (subtitle semantics: a cue is
  // visible from start inclusive to end exclusive). Closed interval [start,end]
  // would match both cues and findIndex returns the earlier one → replay-cue
  // "jumps back to previous cue" bug.
  const currentIndex = cues.findIndex(
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
    if (highlightedRef.current === currentIndex) return;
    highlightedRef.current = currentIndex;
    const el = itemRefs.current[currentIndex];
    const list = listRef.current;
    if (!el || !list) return;
    const targetScroll = el.offsetTop - (list.clientHeight - el.offsetHeight) / 2;
    list.scrollTop = Math.max(0, Math.min(targetScroll, list.scrollHeight - list.clientHeight));
  }, [currentIndex, effectiveMs]);

  return (
    <div ref={listRef} className={styles.list} role="list" data-cell-id="cue-list-scroll">
      {cues.map((cue, i) => {
        const isCurrent = i === currentIndex;
        return (
          <div
            key={cue.index}
            ref={(el) => { itemRefs.current[i] = el; }}
            role="listitem"
            data-cell-id="cue-item"
            data-cue-index={cue.index}
            data-current={isCurrent ? 'true' : 'false'}
            className={`${styles.cue} ${isCurrent ? styles.cueCurrent : ''}`}
          >
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
            <div className={styles.text}>
              <div data-cell-id="cue-target-text" className={styles.targetText}>
                {cue.targetText}
              </div>
              {cue.nativeText && (
                <div data-cell-id="cue-native-text" className={styles.nativeText}>
                  {cue.nativeText}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
