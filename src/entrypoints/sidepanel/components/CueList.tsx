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

function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const millis = ms % 1000;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const msStr = millis > 0 ? `.${String(millis).padStart(3, '0')}` : '';
  return `${pad(h)}:${pad(m)}:${pad(s)}${msStr}`;
}

export function CueList({ cues, currentTimeMs, offsetMs = 0, onSeek }: CueListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const highlightedRef = useRef<number | null>(null);

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

  // Auto-scroll current cue into view
  useEffect(() => {
    if (currentIndex < 0) return;
    if (highlightedRef.current === currentIndex) return;
    highlightedRef.current = currentIndex;
    const el = itemRefs.current[currentIndex];
    if (el) {
      // ponytail: 'auto' (instant) instead of 'smooth' — smooth scroll across
      // a long cue list (full movie) causes motion sickness. Upgrade path:
      // distance-aware behavior (smooth for small jumps, auto for large).
      el.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  }, [currentIndex, effectiveMs]);

  return (
    <div ref={listRef} className={styles.list}>
      {cues.map((cue, i) => {
        const isCurrent = i === currentIndex;
        return (
          <div
            key={cue.index}
            ref={(el) => { itemRefs.current[i] = el; }}
            data-testid="cue-item"
            data-cue-index={cue.index}
            data-current={isCurrent ? 'true' : 'false'}
            className={`${styles.cue} ${isCurrent ? styles.cueCurrent : ''}`}
          >
            <span
              data-testid="cue-timestamp"
              data-cue-index={cue.index}
              onClick={() => onSeek(cue.start)}
              className={styles.timestamp}
            >
              {/* ADR-019 sync: shift displayed timestamp by -offsetMs so the
                  list shows the VIDEO time at which this cue will display
                  (matches overlay + highlight). onSeek still sends raw
                  cue.start; SEEK_TO handler subtracts offset. */}
              {formatTimestamp(cue.start - offsetMs)}
            </span>
            <div data-testid="cue-target-text" className={styles.targetText}>
              {cue.targetText}
            </div>
            {cue.nativeText && (
              <div data-testid="cue-native-text" className={styles.nativeText}>
                {cue.nativeText}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
