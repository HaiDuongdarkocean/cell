import { useMemo, useRef, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useAudioItemUrlMap } from '@/features/pronunciation/hooks/useAudioItemUrl';
import checkStyles from './DictionaryCheckable.module.css';
import styles from './AudioPanel.module.css';
import type { AudioItem } from '../types';

export interface AudioPanelProps {
  readonly items: readonly AudioItem[];
  readonly loading: boolean;
  readonly selection: Map<string, boolean>;
  readonly onToggle: (id: string, selected: boolean) => void;
  readonly onTtsWord: () => void;
  readonly onTtsSentence: () => void;
  readonly term: string;
  readonly sentence: string;
}

const TTS_WORD_ID = '__tts_word__';
const TTS_SENTENCE_ID = '__tts_sentence__';

export function AudioPanel({
  items,
  loading,
  selection,
  onToggle,
  onTtsWord,
  onTtsSentence,
  term,
  sentence,
}: AudioPanelProps): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeGroup, setActiveGroup] = useState<'word' | 'sentence'>('word');
  const { getUrl } = useAudioItemUrlMap(items);

  // Build display list: real items + TTS fallback item if no real items for group
  const displayItems = useMemo(() => {
    const real = items.filter((item) => item.kind === activeGroup).slice(0, 3);
    if (real.length > 0) return real;
    // Synthetic TTS item
    const ttsLabel = activeGroup === 'word' ? `${term} · TTS` : `${sentence || term} · TTS`;
    const ttsId = activeGroup === 'word' ? TTS_WORD_ID : TTS_SENTENCE_ID;
    return [{
      id: ttsId,
      kind: activeGroup,
      label: ttsLabel,
      url: undefined,
      source: 'system-tts' as const,
      state: 'idle' as const,
      defaultSelected: false,
    }];
  }, [items, activeGroup, term, sentence]);

  return (
    <div className={styles.cellAudio} data-cell-id="dictionary-audio-panel">
      {loading ? (
        <AudioSkeleton />
      ) : (
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

          {displayItems.map((item) => {
            const selected = selection.get(item.id) ?? item.defaultSelected;
            const parts = item.label.split(' · ');
            const itemUrl = getUrl(item);
            const isTts = !itemUrl;
            return (
              <div key={item.id} className={checkStyles.cellAudioItem}>
                <Button
                  shape="circle"
                  size="sm"
                  variant="outline"
                  material="solid"
                  className={styles.cellAudioPlay}
                  aria-label={isTts ? `Play TTS: ${item.label}` : `Play ${item.label}`}
                  onClick={(): void => {
                    (event?.target as HTMLElement)?.setAttribute('data-debug-click', JSON.stringify({isTts, hasUrl: !!itemUrl, url: itemUrl?.substring(0,50), activeGroup}));
                    if (isTts || !itemUrl) {
                      if (activeGroup === 'word') onTtsWord();
                      else onTtsSentence();
                      return;
                    }
                    if (audioRef.current) {
                      audioRef.current.pause();
                      audioRef.current = null;
                    }
                    const audio = new Audio(itemUrl);
                    audioRef.current = audio;
                    audio.addEventListener('ended', () => { audioRef.current = null; }, { once: true });
                    audio.addEventListener('pause', () => { if (audioRef.current === audio) audioRef.current = null; }, { once: true });
                    void audio.play().catch(() => { /* best-effort */ });
                  }}
                >
                  <Icon name="audioWave"  />
                </Button>
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
                <span className={`${checkStyles.cellDefCheckBox} ${selected ? checkStyles['cellAudioCheck--checked'] : ''}`} aria-hidden="true">
                  <Icon name="check"  />
                </span>
              </div>
            );
          })}
        </>
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
