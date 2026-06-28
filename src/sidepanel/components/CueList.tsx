import { useEffect, useRef } from 'react';
import type { BilingualCue } from '@/types/media';

interface CueListProps {
  cues: BilingualCue[];
  currentTimeMs: number;
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

export function CueList({ cues, currentTimeMs, onSeek }: CueListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const highlightedRef = useRef<number | null>(null);

  // Find current cue
  const currentIndex = cues.findIndex(
    (c) => c.start <= currentTimeMs && c.end >= currentTimeMs,
  );

  // Auto-scroll current cue into view
  useEffect(() => {
    if (currentIndex < 0) return;
    if (highlightedRef.current === currentIndex) return;
    highlightedRef.current = currentIndex;
    const el = itemRefs.current[currentIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentIndex, currentTimeMs]);

  return (
    <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
      {cues.map((cue, i) => {
        const isCurrent = i === currentIndex;
        return (
          <div
            key={cue.index}
            ref={(el) => { itemRefs.current[i] = el; }}
            data-testid="cue-item"
            data-cue-index={cue.index}
            onClick={() => onSeek(cue.start)}
            style={{
              padding: '6px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer',
              userSelect: 'text',
              backgroundColor: isCurrent ? 'rgba(0, 150, 255, 0.3)' : 'transparent',
            }}
          >
            <span
              data-testid="cue-timestamp"
              data-cue-index={cue.index}
              style={{
                display: 'block',
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '2px',
              }}
            >
              {formatTimestamp(cue.start)}
            </span>
            <div data-testid="cue-target-text" style={{ fontSize: '14px', color: '#fff', lineHeight: '1.3' }}>
              {cue.targetText}
            </div>
            {cue.nativeText && (
              <div data-testid="cue-native-text" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.3', marginTop: '2px' }}>
                {cue.nativeText}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
