import { useMemo, useRef, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { InkTabs } from '@/shared/ui/InkTabs';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useAudioItemUrlMap } from '@/features/pronunciation/hooks/useAudioItemUrl';
import checkStyles from './DictionaryCheckable.module.css';
import styles from './AudioPanel.module.css';
import type { AudioItem } from '../types';
import { t } from '@/shared/i18n';

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
          <InkTabs
            aria-label={t('dict.audio.groups.aria')}
            items={[
              { value: 'word', label: t('dict.audio.group.word') },
              { value: 'sentence', label: t('dict.audio.group.sentence') },
            ]}
            value={activeGroup}
            onValueChange={(v): void => setActiveGroup(v as 'word' | 'sentence')}
          />

          <div className={styles.cellAudioItems}>
          {displayItems.map((item) => {
            const selected = selection.get(item.id) === true;
            const parts = item.label.split(' · ');
            const itemUrl = getUrl(item);
            const isTts = !itemUrl;
            return (
              <div key={item.id} className={checkStyles.cellAudioItem}>
                <Button
                  shape="circle"
                  size="sm"
                  variant="primary"
                  className={styles.cellAudioPlay}
                  aria-label={t('dict.audio.play', [item.label])}
                  onClick={(): void => {
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
                <Button
                  variant="transparent"
                  ripple={false}
                  className={styles.cellAudioLabel}
                  aria-pressed={selected}
                  onClick={(): void => onToggle(item.id, !selected)}
                >
                  <span className={styles.cellAudioLabelName}>{parts[0] ?? item.label}</span>
                  {parts.length > 1 && (
                    <span className={styles.cellAudioLabelMeta}>{parts.slice(1).join(' · ')}</span>
                  )}
                </Button>
                <span className={`${checkStyles.cellDefCheckBox} ${selected ? checkStyles['cellAudioCheck--checked'] : ''}`} aria-hidden="true">
                  <Icon name="check" size="md" />
                </span>
              </div>
            );
          })}
          </div>
        </>
      )}
    </div>
  );
}

function AudioSkeleton(): React.JSX.Element {
  return (
    <div className={styles.cellAudioSkeleton} aria-hidden="true">
      <div className={styles.cellAudioSkeletonSubtabs}>
        <Skeleton width="72px" height="var(--space-4-5)" className={styles.cellAudioSkeletonPart} />
        <Skeleton width="96px" height="var(--space-4-5)" className={styles.cellAudioSkeletonPart} />
      </div>
      {/* One row is the minimal hint — real items mount with the staggered
         cellAudioItemIn animation, so extra skeleton rows are unnecessary. */}
      <div className={styles.cellAudioSkeletonRow}>
        <Skeleton width="var(--iconbutton-size-sm)" height="var(--iconbutton-size-sm)" shape="circle" className={styles.cellAudioSkeletonPart} />
        <div className={styles.cellAudioSkeletonLabel}>
          <Skeleton width="45%" height="calc(var(--font-size-base) * var(--leading-normal))" className={styles.cellAudioSkeletonPart} />
          <Skeleton width="30%" height="calc(var(--font-size-xs) * var(--leading-normal))" className={styles.cellAudioSkeletonPart} />
        </div>
        <Skeleton width="var(--space-4)" height="var(--space-4)" className={`${styles.cellAudioSkeletonPart} ${styles.cellAudioSkeletonCheck}`} />
      </div>
    </div>
  );
}
