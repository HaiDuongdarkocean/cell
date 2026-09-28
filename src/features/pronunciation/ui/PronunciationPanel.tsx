import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { decodeAudioUrl } from '../services/audioDecoder';
import { playPhoneme } from '../services/phonemeAudioPlayer';
import { estimateTimeline } from '../services/phonemeTimelineEstimator';
import type { AudioEngineKind, Phoneme, PronunciationAudio, PronunciationResult } from '../types';
import styles from './PronunciationPanel.module.css';

export interface PronunciationPanelProps {
  readonly pronunciation: PronunciationResult | null;
  /** Optional word audio URL to decode and segment for phoneme playback. */
  readonly audioUrl?: string;
  /** Source kind for the provided audio URL. */
  readonly audioSource?: AudioEngineKind;
  /**
   * Optional custom phoneme playback handler.
   * When provided (e.g. for the eSpeak robot source), it is called instead of
   * slicing the decoded word audio. The handler is responsible for playing the
   * phoneme and returning a promise that resolves when playback ends.
   */
  readonly onPlayPhoneme?: (phoneme: Phoneme) => Promise<void>;
}

export function PronunciationPanel({
  pronunciation,
  audioUrl,
  audioSource = 'native',
  onPlayPhoneme,
}: PronunciationPanelProps): React.JSX.Element | null {
  const [audio, setAudio] = useState<PronunciationAudio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;
    if (!audioUrl) {
      setAudio(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setAudio(null);

    decodeAudioUrl(audioUrl, audioSource)
      .then((decoded) => {
        if (abortRef.current) return;
        setAudio(decoded);
        setLoading(false);
      })
      .catch(() => {
        if (abortRef.current) return;
        setError(t('pronunciation.audio.decodeFailed'));
        setLoading(false);
      });

    return () => {
      abortRef.current = true;
    };
  }, [audioUrl, audioSource]);

  // Re-estimate phoneme timeline once the decoded audio duration is known.
  const phonemes = useMemo(() => {
    if (!pronunciation) return [];
    if (!audio) return pronunciation.phonemes;
    return estimateTimeline(pronunciation.phonemes, audio.duration * 1000);
  }, [pronunciation, audio]);

  const handleClick = useCallback(
    async (phoneme: Phoneme, index: number) => {
      setActiveIndex(index);

      if (onPlayPhoneme) {
        try {
          await onPlayPhoneme(phoneme);
        } catch {
          setError(t('pronunciation.audio.playFailed'));
        } finally {
          setActiveIndex((current) => (current === index ? null : current));
        }
        return;
      }

      if (!audio) {
        // No word audio decoded yet; keep the visual highlight as feedback.
        setTimeout(() => setActiveIndex((current) => (current === index ? null : current)), 200);
        return;
      }
      void playPhoneme(audio, phoneme)
        .catch(() => {
          setError(t('pronunciation.audio.playFailed'));
        })
        .finally(() => {
          setActiveIndex((current) => (current === index ? null : current));
        });
    },
    [audio, onPlayPhoneme],
  );

  if (!pronunciation) return null;

  return (
    <section className={styles.pronunciation} aria-label={t('pronunciation.panel.aria')}>
      {pronunciation.ipa && (
        <div className={styles.ipa} data-cell-id="pronunciation-ipa">
          /{pronunciation.ipa}/
        </div>
      )}

      <div className={styles.phonemeList} data-cell-id="pronunciation-phoneme-list">
        {phonemes.map((phoneme, idx) => {
          const isStress = phoneme.type === 'stress';
          const isSeparator = phoneme.type === 'separator';
          if (isSeparator) {
            return <span key={idx} className={styles.separator} />;
          }
          return (
            <Button
              key={idx}
              variant="outline"
              size="sm"
              active={activeIndex === idx}
              className={`${styles.phoneme} ${isStress ? styles.phonemeStress : ''}`}
              onClick={() => { void handleClick(phoneme, idx); }}
              aria-label={t('pronunciation.phoneme.aria', [phoneme.ipa])}
              data-cell-id="pronunciation-phoneme"
            >
              {phoneme.ipa}
            </Button>
          );
        })}
      </div>

      {loading && (
        <div className={styles.meta} data-cell-id="pronunciation-audio-loading">
          {t('pronunciation.audio.loading')}
        </div>
      )}
      {error && (
        <div className={styles.error} data-cell-id="pronunciation-audio-error">
          {error}
        </div>
      )}
      {!audioUrl && (
        <div className={styles.meta} data-cell-id="pronunciation-no-audio">
          {t('pronunciation.audio.selectHint')}
        </div>
      )}
    </section>
  );
}
