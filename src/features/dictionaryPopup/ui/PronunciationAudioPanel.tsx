import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { InkTabs } from '@/shared/ui/InkTabs';
import { Skeleton } from '@/shared/ui/Skeleton';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { claimExclusiveAudio } from '@/shared/lib/exclusiveAudio';
import { markAudio, measureAudio, clearAudioMarks } from '@/shared/lib/perfMarks';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { useAudioItemUrlMap } from '@/features/pronunciation';
import { Panel, PanelItem, PanelList } from './PopupPanel';
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

  useEffect(() => {
    if (loading || items.length === 0) return;
    const raf = requestAnimationFrame(() => {
      markAudio('render', term);
      measureAudio('applied', 'render', term);
      measureAudio('start', 'render', term);
      clearAudioMarks(term);
    });
    return () => cancelAnimationFrame(raf);
  }, [loading, items, term]);

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
    const audio = new Audio(url);
    audioRef.current = audio;
    const release = claimExclusiveAudio(() => audio.pause());
    audio.addEventListener('ended', () => {
      release();
      if (audioRef.current === audio) audioRef.current = null;
      playQueue(urls.slice(1));
    });
    audio.addEventListener('pause', () => { if (audioRef.current === audio) audioRef.current = null; }, { once: true });
    void audio.play().catch(() => { release(); });
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
    <Panel id="dictionary-audio-panel">
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
              className={styles.TihokaAudioReconnect}
              data-tihoka-id="local-audio-reconnect"
              onClick={(): void => {
                void sendMessage({
                  type: MESSAGE_TYPES.LOCAL_AUDIO_OPEN_RECONNECT,
                  payload: {},
                }).catch(() => undefined);
              }}
            >
              <Icon name="triangleAlert" size="sm" />
              <span className={styles.TihokaAudioReconnectLabel}>{t('dict.audio.localReconnect')}</span>
            </button>
          )}

          <PanelList gap="sm">
          {displayItems.map((item) => {
            const selected = selection.get(item.id) === true;
            const parts = item.label.split(' · ');
            return (
              <PanelItem
                key={item.id}
                checkMode="audio"
                bare
                checked={selected}
                ariaLabel={t('dict.audio.select', [item.label])}
                onToggle={() => onToggle(item.id, !selected)}
              >
                <span
                  className={styles.TihokaAudioPlay}
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
                <span className={styles.TihokaAudioLabel} aria-hidden="true">
                  <span className={styles.TihokaAudioLabelName}>{parts[0] ?? item.label}</span>
                  {parts.length > 1 && (
                    <span className={styles.TihokaAudioLabelMeta}>{parts.slice(1).join(' · ')}</span>
                  )}
                </span>
              </PanelItem>
            );
          })}
          </PanelList>
        </>
      )}
    </Panel>
  );
}

function AudioSkeleton(): React.JSX.Element {
  return (
    <div className={styles.TihokaAudioSkeleton} aria-hidden="true">
      <div className={styles.TihokaAudioSkeletonSubtabs}>
        <Skeleton width="72px" height="var(--space-4-5)" className={styles.TihokaAudioSkeletonPart} />
        <Skeleton width="96px" height="var(--space-4-5)" className={styles.TihokaAudioSkeletonPart} />
      </div>
      {/* One row is the minimal hint — real items mount with the staggered
         TihokaAudioItemIn animation, so extra skeleton rows are unnecessary. */}
      <div className={styles.TihokaAudioSkeletonRow}>
        <Skeleton width="var(--iconbutton-size-sm)" height="var(--iconbutton-size-sm)" shape="circle" className={styles.TihokaAudioSkeletonPart} />
        <div className={styles.TihokaAudioSkeletonLabel}>
          <Skeleton width="45%" height="calc(var(--font-size-base) * var(--leading-normal))" className={styles.TihokaAudioSkeletonPart} />
          <Skeleton width="30%" height="calc(var(--font-size-xs) * var(--leading-normal))" className={styles.TihokaAudioSkeletonPart} />
        </div>
        <Skeleton width="var(--space-4)" height="var(--space-4)" className={`${styles.TihokaAudioSkeletonPart} ${styles.TihokaAudioSkeletonCheck}`} />
      </div>
    </div>
  );
}
