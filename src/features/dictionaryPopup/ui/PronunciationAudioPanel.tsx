import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { InkTabs } from '@/shared/ui/InkTabs';
import { Skeleton } from '@/shared/ui/Skeleton';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { useAudioItemUrlMap } from '@/features/pronunciation/hooks/useAudioItemUrl';
import checkStyles from './DictionaryCheckable.module.css';
import styles from './PronunciationAudioPanel.module.css';
import type { AudioItem } from '@/entities/dictionary';
import { t } from '@/shared/i18n';

export interface PronunciationAudioPanelProps {
  readonly items: readonly AudioItem[];
  readonly loading: boolean;
  readonly localAudioNeedsRegrant?: boolean;
  readonly selection: Map<string, boolean>;
  readonly onToggle: (id: string, selected: boolean) => void;
  readonly onTtsWord: () => void;
  readonly onTtsSentence: () => void;
  readonly term: string;
  readonly sentence: string;
  readonly autoplayCount?: number;
}

const TTS_WORD_ID = '__tts_word__';
const TTS_SENTENCE_ID = '__tts_sentence__';

export function PronunciationAudioPanel({
  items,
  loading,
  localAudioNeedsRegrant,
  selection,
  onToggle,
  onTtsWord,
  onTtsSentence,
  term,
  sentence,
  autoplayCount = 0,
}: PronunciationAudioPanelProps): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeGroup, setActiveGroup] = useState<'word' | 'sentence'>('word');
  const { getUrl } = useAudioItemUrlMap(items);

  // Build display list: real items + TTS fallback item if no real items for group
  const displayItems = useMemo(() => {
    const real = items.filter((item) => item.kind === activeGroup).slice(0, 3);
    if (real.length > 0) return real;
    // Synthetic TTS item
    const ttsLabel = t('dict.audio.itemLabel', [activeGroup === 'word' ? term : (sentence || term), t('audio.engine.browserTts')]);
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

  const playQueue = useCallback((urls: readonly string[]): void => {
    const url = urls[0];
    if (!url) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.addEventListener('ended', () => {
      if (audioRef.current === audio) audioRef.current = null;
      playQueue(urls.slice(1));
    });
    audio.addEventListener('pause', () => { if (audioRef.current === audio) audioRef.current = null; }, { once: true });
    void audio.play().catch(() => { /* best-effort */ });
  }, []);

  const playItem = useCallback((item: AudioItem): void => {
    const itemUrl = getUrl(item);
    if (!itemUrl) {
      if (item.kind === 'word') onTtsWord(); else onTtsSentence();
      return;
    }
    playQueue([itemUrl]);
  }, [getUrl, onTtsWord, onTtsSentence, playQueue]);

  const autoplayedTermRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading || autoplayCount <= 0 || autoplayedTermRef.current === term) return;
    autoplayedTermRef.current = term;
    if (audioRef.current) return;
    const wordUrls = items
      .filter((i) => i.kind === 'word')
      .slice(0, 3)
      .slice(0, autoplayCount)
      .map(getUrl)
      .filter((u): u is string => Boolean(u));
    if (wordUrls.length > 0) playQueue(wordUrls);
    else onTtsWord();
  }, [loading, items, term, autoplayCount, getUrl, playQueue, onTtsWord]);

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

          {localAudioNeedsRegrant && (
            <button
              type="button"
              className={styles.cellAudioReconnect}
              data-cell-id="local-audio-reconnect"
              onClick={(): void => {
                void sendMessage({
                  type: MESSAGE_TYPES.LOCAL_AUDIO_OPEN_RECONNECT,
                  payload: {},
                }).catch(() => undefined);
              }}
            >
              <Icon name="triangleAlert" size="sm" />
              <span className={styles.cellAudioReconnectLabel}>{t('dict.audio.localReconnect')}</span>
            </button>
          )}

          <div className={styles.cellAudioItems}>
          {displayItems.map((item) => {
            const selected = selection.get(item.id) === true;
            const parts = item.label.split(' · ');
            return (
              <div
                key={item.id}
                className={checkStyles.cellAudioItem}
                role="checkbox"
                aria-checked={selected}
                aria-label={t('dict.audio.select', [item.label])}
                tabIndex={0}
                onClick={() => onToggle(item.id, !selected)}
                onKeyDown={(e): void => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    onToggle(item.id, !selected);
                  }
                }}
              >
                <span
                  className={styles.cellAudioPlay}
                  role="button"
                  aria-label={t('dict.audio.play', [item.label])}
                  tabIndex={0}
                  onClick={(e): void => {
                    e.stopPropagation();
                    playItem(item);
                  }}
                  onKeyDown={(e): void => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      playItem(item);
                    }
                  }}
                >
                  <Icon name="audioWave"  />
                </span>
                <span className={styles.cellAudioLabel} aria-hidden="true">
                  <span className={styles.cellAudioLabelName}>{parts[0] ?? item.label}</span>
                  {parts.length > 1 && (
                    <span className={styles.cellAudioLabelMeta}>{parts.slice(1).join(' · ')}</span>
                  )}
                </span>
                <span
                  className={`${checkStyles.cellDefCheckBox} ${selected ? checkStyles['cellAudioCheck--checked'] : ''}`}
                  aria-hidden="true"
                >
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
