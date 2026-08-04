import { useRef, useState } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import styles from './DictionaryPanelView.module.css';
import type { AudioItem } from '../types';

export interface AudioPanelProps {
  readonly items: readonly AudioItem[];
  readonly loading: boolean;
  readonly selection: Map<string, boolean>;
  readonly onToggle: (id: string, selected: boolean) => void;
  readonly onTts: () => void;
}

export function AudioPanel({
  items,
  loading,
  selection,
  onToggle,
  onTts,
}: AudioPanelProps): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeGroup, setActiveGroup] = useState<'word' | 'sentence'>('word');

  // Switch group + fallback TTS if no items for that group
  const handleGroupSwitch = (group: 'word' | 'sentence'): void => {
    setActiveGroup(group);
    if (!items.some((item) => item.kind === group)) {
      onTts();
    }
  };

  return (
    <div className={styles.cellAudio} data-cell-id="dictionary-audio-panel">
      {loading ? (
        <AudioSkeleton />
      ) : (
        <AudioPanelContent
          items={items}
          selection={selection}
          onToggle={onToggle}
          onTts={onTts}
          activeGroup={activeGroup}
          setActiveGroup={handleGroupSwitch}
          audioRef={audioRef}
        />
      )}
    </div>
  );
}

function AudioSkeleton(): React.JSX.Element {
  return (
    <div className={styles.cellAudioSkeleton} aria-hidden="true">
      <div className={styles.cellAudioSkeletonSubtabs}>
        <Skeleton width="72px" height="var(--space-4-5)" />
        <Skeleton width="96px" height="var(--space-4-5)" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className={styles.cellAudioSkeletonRow}>
          <Skeleton width="var(--touch-target-mobile)" height="var(--touch-target-mobile)" shape="circle" className={styles.cellAudioSkeletonPlay} />
          <div className={styles.cellAudioSkeletonLabel}>
            <Skeleton width="100%" height="calc(var(--space-5) + var(--border-width-hairline))" />
            <Skeleton width="100%" height="var(--space-4-5)" />
          </div>
          <Skeleton width="var(--space-4)" height="var(--space-4)" />
        </div>
      ))}
    </div>
  );
}

interface AudioPanelContentProps {
  readonly items: readonly AudioItem[];
  readonly selection: Map<string, boolean>;
  readonly onToggle: (id: string, selected: boolean) => void;
  readonly onTts: () => void;
  readonly activeGroup: 'word' | 'sentence';
  readonly setActiveGroup: (group: 'word' | 'sentence') => void;
  readonly audioRef: React.MutableRefObject<HTMLAudioElement | null>;
}

function AudioPanelContent({
  items,
  selection,
  onToggle,
  activeGroup,
  setActiveGroup,
  audioRef,
}: AudioPanelContentProps): React.JSX.Element {
  const filteredItems = items.filter((item) => item.kind === activeGroup).slice(0, 3);

  return (
    <>
      <div className={styles.cellAudioSubtabs} role="tablist" aria-label="Audio groups">
        {(['word', 'sentence'] as const).map((group) => (
          <button
            key={group}
            type="button"
            role="tab"
            aria-selected={activeGroup === group}
            className={`${styles.cellAudioSubtab} ${activeGroup === group ? styles['cellAudioSubtab--active'] : ''}`}
            onClick={(): void => setActiveGroup(group)}
          >
            Play {group}
          </button>
        ))}
      </div>

      {filteredItems.map((item) => {
        const selected = selection.get(item.id) ?? item.defaultSelected;
        const parts = item.label.split(' · ');
        return (
          <div key={item.id} className={styles.cellAudioItem}>
            <button
              type="button"
              className={`icon-btn icon-btn--sm icon-btn--outlined ${styles.cellAudioPlay}`}
              aria-label={item.state === 'error' || !item.url ? `Audio unavailable for ${item.label}` : `Play ${item.label}`}
              disabled={item.state === 'error' || !item.url}
              onClick={(): void => {
                if (!item.url) return;
                if (audioRef.current) {
                  audioRef.current.pause();
                  audioRef.current = null;
                }
                const audio = new Audio(item.url);
                audioRef.current = audio;
                audio.addEventListener('ended', () => { audioRef.current = null; }, { once: true });
                audio.addEventListener('pause', () => { if (audioRef.current === audio) audioRef.current = null; }, { once: true });
                void audio.play().catch(() => { /* best-effort */ });
              }}
            >
              <Icon name="audioWave" size={20} />
            </button>
            <button
              type="button"
              className={styles.cellAudioLabel}
              aria-pressed={selected}
              onClick={(): void => onToggle(item.id, !selected)}
            >
              <span className={styles.cellAudioLabelName}>{parts[0] ?? item.label}</span>
              {parts.length > 1 && (
                <span className={styles.cellAudioLabelMeta}>{parts.slice(1).join(' · ')}</span>
              )}
            </button>
            <span className={`${styles.cellDefCheckBox} ${selected ? styles['cellAudioCheck--checked'] : ''}`} aria-hidden="true">
              <Icon name="check" size={16} />
            </span>
          </div>
        );
      })}
    </>
  );
}
