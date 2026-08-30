import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { Icon } from '@/shared/icons/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import styles from './DictionaryPanelView.module.css';
import { PronunciationPanel } from '@/features/pronunciation/ui/PronunciationPanel';
import type { AudioEngineKind } from '@/features/pronunciation/types';
import type { PronunciationResult } from '@/features/pronunciation/types';
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
  readonly pronunciation: PronunciationResult | null;
}

const TTS_WORD_ID = '__tts_word__';
const TTS_SENTENCE_ID = '__tts_sentence__';

function toAudioEngineKind(source: AudioItem['source']): AudioEngineKind {
  switch (source) {
    case 'community':
      return 'native';
    case 'system-tts':
      return 'browserTts';
    case 'cloud-tts':
      return 'supertonic';
    case 'local':
      return 'localFile';
    default:
      return 'native';
  }
}

export function AudioPanel({
  items,
  loading,
  selection,
  onToggle,
  onTtsWord,
  onTtsSentence,
  term,
  sentence,
  pronunciation,
}: AudioPanelProps): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeGroup, setActiveGroup] = useState<'word' | 'sentence'>('word');
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | undefined>();
  const [activeAudioSource, setActiveAudioSource] = useState<AudioEngineKind>('native');

  // Phoneme playback only makes sense for word audio; clear it on sentence tab.
  useEffect(() => {
    if (activeGroup !== 'word') {
      setActiveAudioUrl(undefined);
    }
  }, [activeGroup]);

  // Build display list: real items + TTS fallback item if no real items for group
  const selectedWordUrl = useMemo(() => {
    const wordItems = items.filter((item) => item.kind === 'word' && item.url);
    const selected = wordItems.find((item) => selection.get(item.id) ?? item.defaultSelected);
    return selected?.url ?? wordItems[0]?.url;
  }, [items, selection]);

  // The URL fed to the pronunciation panel: prefer the item the user just played,
  // otherwise fall back to the selected/first word audio.
  const pronunciationAudioUrl = activeAudioUrl ?? selectedWordUrl;
  const pronunciationAudioSource = activeAudioUrl ? activeAudioSource : 'native';

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
      source: 'tts' as const,
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
              <Button material="solid" variant="secondary"
                key={group}
                role="tab"
                aria-selected={activeGroup === group}
                className={`${styles.cellAudioSubtab} ${activeGroup === group ? styles['cellAudioSubtab--active'] : ''}`}
                onClick={(): void => setActiveGroup(group)}
              >
                Play {group}
              </Button>
            ))}
          </div>

          <PronunciationPanel
            pronunciation={pronunciation}
            audioUrl={pronunciationAudioUrl}
            audioSource={pronunciationAudioSource}
          />

          {displayItems.map((item) => {
            const selected = selection.get(item.id) ?? item.defaultSelected;
            const parts = item.label.split(' · ');
            const isTts = item.source === 'tts';
            return (
              <div key={item.id} className={styles.cellAudioItem}>
                <IconButton material="solid" variant="ghost"
                  className={`icon-btn icon-btn--sm icon-btn--outlined ${styles.cellAudioPlay}`}
                  aria-label={isTts ? `Play TTS: ${item.label}` : `Play ${item.label}`}
                  onClick={(): void => {
                    (event?.target as HTMLElement)?.setAttribute('data-debug-click', JSON.stringify({isTts, hasUrl: !!item.url, url: item.url?.substring(0,50), activeGroup}));
                    if (isTts || !item.url) {
                      if (activeGroup === 'word') onTtsWord();
                      else onTtsSentence();
                      return;
                    }
                    if (activeGroup === 'word' && item.url) {
                      setActiveAudioUrl(item.url);
                      setActiveAudioSource(toAudioEngineKind(item.source));
                    }
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
                  <Icon name="audioWave"  />
                </IconButton>
                <Button material="solid" variant="secondary"
                  className={styles.cellAudioLabel}
                  aria-pressed={selected}
                  onClick={(): void => onToggle(item.id, !selected)}
                >
                  <span className={styles.cellAudioLabelName}>{parts[0] ?? item.label}</span>
                  {parts.length > 1 && (
                    <span className={styles.cellAudioLabelMeta}>{parts.slice(1).join(' · ')}</span>
                  )}
                </Button>
                <span className={`${styles.cellDefCheckBox} ${selected ? styles['cellAudioCheck--checked'] : ''}`} aria-hidden="true">
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
