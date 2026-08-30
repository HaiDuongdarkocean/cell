import { useCallback, useEffect, useRef, useState } from 'react';
import { decodeAudioUrl } from '../services/audioDecoder';
import { playPhoneme } from '../services/phonemeAudioPlayer';
import type { AudioEngineKind, Phoneme, PronunciationAudio, PronunciationResult } from '../types';
import styles from './PronunciationPanel.module.css';

export interface PronunciationPanelProps {
  readonly pronunciation: PronunciationResult | null;
  /** Optional word audio URL to decode and segment for phoneme playback. */
  readonly audioUrl?: string;
  /** Source kind for the provided audio URL. */
  readonly audioSource?: AudioEngineKind;
}

export function PronunciationPanel({
  pronunciation,
  audioUrl,
  audioSource = 'native',
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
      .catch((err) => {
        if (abortRef.current) return;
        setError(err instanceof Error ? err.message : 'Audio decode failed');
        setLoading(false);
      });

    return () => {
      abortRef.current = true;
    };
  }, [audioUrl, audioSource]);

  const handleClick = useCallback(
    (phoneme: Phoneme, index: number) => {
      setActiveIndex(index);
      if (!audio) return;
      void playPhoneme(audio, phoneme)
        .catch(() => { /* best-effort; highlight is already shown */ })
        .finally(() => {
          setActiveIndex((current) => (current === index ? null : current));
        });
    },
    [audio],
  );

  if (!pronunciation) return null;

  return (
    <section className={styles.pronunciation} aria-label="Phonemes">
      {pronunciation.ipa && (
        <div className={styles.ipa} data-cell-id="pronunciation-ipa">
          /{pronunciation.ipa}/
        </div>
      )}

      <div className={styles.phonemeList} data-cell-id="pronunciation-phoneme-list">
        {pronunciation.phonemes.map((phoneme, idx) => {
          const isStress = phoneme.type === 'stress';
          const isSeparator = phoneme.type === 'separator';
          if (isSeparator) {
            return <span key={idx} className={styles.separator} />;
          }
          return (
            <button
              key={idx}
              type="button"
              className={`${styles.phoneme} ${isStress ? styles.phonemeStress : ''} ${activeIndex === idx ? styles.phonemeActive : ''}`}
              onClick={() => handleClick(phoneme, idx)}
              aria-label={`Phoneme ${phoneme.ipa}`}
              data-cell-id="pronunciation-phoneme"
            >
              {phoneme.ipa}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className={styles.meta} data-cell-id="pronunciation-audio-loading">
          Loading audio…
        </div>
      )}
      {error && (
        <div className={styles.error} data-cell-id="pronunciation-audio-error">
          {error}
        </div>
      )}
      {!audioUrl && (
        <div className={styles.meta} data-cell-id="pronunciation-no-audio">
          Select a word audio above to hear individual sounds.
        </div>
      )}
    </section>
  );
}
