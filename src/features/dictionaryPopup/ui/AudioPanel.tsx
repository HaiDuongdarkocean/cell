import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { Icon } from '@/shared/icons/Icon';
import { Skeleton } from '@/shared/ui/Skeleton';
import styles from './DictionaryPanelView.module.css';
import { PronunciationPanel } from '@/features/pronunciation/ui/PronunciationPanel';
import { playEspeakWord, playEspeakPhoneme } from '@/features/pronunciation/services/espeakAudioEngine';
import type { AudioEngineKind, Phoneme } from '@/features/pronunciation/types';
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
    case 'espeak':
      return 'espeak';
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
  const [espeakError, setEspeakError] = useState<string | null>(null);
  const localBlobUrlsRef = useRef<Map<string, string>>(new Map());

  // Manage object URLs for items that carry raw audio bytes (local File System Access).
  // The background sends Uint8Array; the content-script creates blob URLs locally.
  useEffect(() => {
    const next = new Map<string, string>();
    const current = localBlobUrlsRef.current;
    const toRevoke: string[] = [];

    for (const item of items) {
      if (item.audioBytes) {
        const existing = current.get(item.id);
        if (existing) {
          next.set(item.id, existing);
        } else {
          next.set(item.id, URL.createObjectURL(new Blob([item.audioBytes.buffer as ArrayBuffer], { type: 'audio/mpeg' })));
        }
      }
    }

    for (const [id, url] of current) {
      if (!next.has(id)) {
        toRevoke.push(url);
      }
    }

    toRevoke.forEach(URL.revokeObjectURL);
    localBlobUrlsRef.current = next;

    return () => {
      for (const url of localBlobUrlsRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      localBlobUrlsRef.current = new Map();
    };
  }, [items]);

  const getAudioUrl = useCallback((item?: AudioItem): string | undefined => {
    if (!item) return undefined;
    return item.url ?? localBlobUrlsRef.current.get(item.id);
  }, []);

  const onPlayEspeakPhoneme = useCallback(
    async (phoneme: Phoneme): Promise<void> => {
      setEspeakError(null);
      try {
        await playEspeakPhoneme(phoneme);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'eSpeak phoneme playback failed';
        setEspeakError(message);
        throw err;
      }
    },
    [],
  );

  // Phoneme playback only makes sense for word audio; clear it on sentence tab.
  useEffect(() => {
    if (activeGroup !== 'word') {
      setActiveAudioUrl(undefined);
    }
  }, [activeGroup]);

  // Build display list: real items + TTS fallback item if no real items for group
  const selectedWordUrl = useMemo(() => {
    const wordItems = items.filter((item) => item.kind === 'word' && (item.url ?? localBlobUrlsRef.current.get(item.id)));
    const selected = wordItems.find((item) => selection.get(item.id) ?? item.defaultSelected);
    return getAudioUrl(selected) ?? getAudioUrl(wordItems[0]);
  }, [items, selection, getAudioUrl]);

  // The URL fed to the pronunciation panel: prefer the item the user just played,
  // otherwise fall back to the selected/first word audio.
  const pronunciationAudioUrl = activeAudioUrl ?? selectedWordUrl;
  const pronunciationAudioSource = activeAudioSource;

  const displayItems = useMemo(() => {
    const real = items.filter((item) => item.kind === activeGroup).slice(0, 3);
    const synthetic: AudioItem[] = [];

    if (real.length === 0) {
      // Fallback TTS item
      const ttsLabel = activeGroup === 'word' ? `${term} · TTS` : `${sentence || term} · TTS`;
      const ttsId = activeGroup === 'word' ? TTS_WORD_ID : TTS_SENTENCE_ID;
      synthetic.push({
        id: ttsId,
        kind: activeGroup,
        source: 'system-tts' as const,
        label: ttsLabel,
        url: undefined,
        state: 'idle' as const,
        defaultSelected: false,
      });
    }

    if (activeGroup === 'word') {
      synthetic.push({
        id: 'espeak-word',
        kind: 'word',
        source: 'espeak' as const,
        label: `${term} · eSpeak`,
        url: undefined,
        state: 'idle' as const,
        defaultSelected: false,
      });
    }

    return [...real, ...synthetic];
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
            onPlayPhoneme={pronunciationAudioSource === 'espeak' ? onPlayEspeakPhoneme : undefined}
          />

          {displayItems.map((item) => {
            const selected = selection.get(item.id) ?? item.defaultSelected;
            const parts = item.label.split(' · ');
            const isTts = item.source === 'system-tts';
            const isEspeak = item.source === 'espeak';
            return (
              <div key={item.id} className={styles.cellAudioItem}>
                <IconButton material="solid" variant="ghost"
                  className={`icon-btn icon-btn--sm icon-btn--outlined ${styles.cellAudioPlay}`}
                  aria-label={isTts || isEspeak ? `Play TTS: ${item.label}` : `Play ${item.label}`}
                  onClick={(e: MouseEvent<HTMLButtonElement>): void => {
                    (e.currentTarget as HTMLElement).setAttribute('data-debug-click', JSON.stringify({isTts, isEspeak, hasUrl: !!getAudioUrl(item), url: getAudioUrl(item)?.substring(0,50), activeGroup}));
                    if (isEspeak) {
                      setActiveAudioSource('espeak');
                      if (audioRef.current) {
                        audioRef.current.pause();
                        audioRef.current = null;
                      }
                      void (async (): Promise<void> => {
                        try {
                          await playEspeakWord(term);
                        } catch (err: unknown) {
                          setEspeakError(err instanceof Error ? err.message : 'eSpeak playback failed');
                        }
                      })();
                      return;
                    }
                    if (isTts) {
                      if (activeGroup === 'word') onTtsWord();
                      else onTtsSentence();
                      return;
                    }
                    const itemUrl = getAudioUrl(item);
                    if (activeGroup === 'word' && itemUrl) {
                      setActiveAudioUrl(itemUrl);
                      setActiveAudioSource(toAudioEngineKind(item.source));
                    }
                    if (audioRef.current) {
                      audioRef.current.pause();
                      audioRef.current = null;
                    }
                    if (!itemUrl) {
                      if (activeGroup === 'word') onTtsWord();
                      else onTtsSentence();
                      return;
                    }
                    const audio = new Audio(itemUrl);
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
          {espeakError && (
            <div className={styles.cellAudioError} data-cell-id="espeak-error">
              {espeakError}
            </div>
          )}
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
