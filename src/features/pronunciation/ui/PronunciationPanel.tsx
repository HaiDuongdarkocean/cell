import { useCallback, useState } from 'react';
import { t } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { playPhoneme } from '../services/phonemeAudioPlayer';
import { resolvePhonemeAudio } from '../services/phonemePackAudio';
import { supportsEspeakIpa } from '../services/espeakIpa';
import type { Phoneme, PronunciationResult } from '../types';
import styles from './PronunciationPanel.module.css';

export interface PronunciationPanelProps {
  readonly pronunciation: PronunciationResult | null;
  /**
   * Optional custom phoneme playback handler.
   * When provided, it is called instead of synthesizing the phoneme through
   * eSpeak `[[mnemonic]]` input. The handler is responsible for playing the
   * phoneme and returning a promise that resolves when playback ends.
   */
  readonly onPlayPhoneme?: (phoneme: Phoneme) => Promise<void>;
  /** Dictionary accent label ('AmE' | 'BrE' | …) — picks the recording
   *  accent and the eSpeak fallback voice. */
  readonly accent?: string;
}

export function PronunciationPanel({
  pronunciation,
  onPlayPhoneme,
  accent,
}: PronunciationPanelProps): React.JSX.Element | null {
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

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

      // Phoneme chips always synthesize eSpeak `[[mnemonic]]` input — the whole
      // returned clip is the phoneme itself, so no audio slicing is needed.
      const canSynth = pronunciation && supportsEspeakIpa(pronunciation.language);
      if (!canSynth) {
        setTimeout(() => setActiveIndex((current) => (current === index ? null : current)), 200);
        return;
      }

      void (async () => {
        try {
          const clip = await resolvePhonemeAudio(phoneme.ipa, accent, pronunciation.language);
          if (clip) {
            await playPhoneme(clip, { ...phoneme, startMs: 0, endMs: clip.duration * 1000 });
          } else {
            await new Promise((r) => setTimeout(r, 200));
          }
        } catch {
          setError(t('pronunciation.audio.playFailed'));
        } finally {
          setActiveIndex((current) => (current === index ? null : current));
        }
      })();
    },
    [onPlayPhoneme, pronunciation, accent],
  );

  if (!pronunciation) return null;

  return (
    <section className={styles.pronunciation} aria-label={t('pronunciation.panel.aria')}>
      {pronunciation.ipa && (
        <div className={styles.ipa} data-tihoka-id="pronunciation-ipa">
          /{pronunciation.ipa}/
        </div>
      )}

      <div className={styles.phonemeList} data-tihoka-id="pronunciation-phoneme-list">
        {pronunciation.phonemes.map((phoneme, idx) => {
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
              data-tihoka-id="pronunciation-phoneme"
            >
              {phoneme.ipa}
            </Button>
          );
        })}
      </div>

      {error && (
        <div className={styles.error} data-tihoka-id="pronunciation-audio-error">
          {error}
        </div>
      )}
      <div className={styles.meta} data-tihoka-id="pronunciation-no-audio">
        {t('pronunciation.audio.selectHint')}
      </div>
    </section>
  );
}
