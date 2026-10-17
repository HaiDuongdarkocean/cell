import { useCallback, useState } from 'react';
import { t } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { CollapsibleLine } from '@/shared/ui/CollapsibleLine';
import { playPhoneme } from '../services/phonemeAudioPlayer';
import { resolvePhonemeAudio } from '../services/phonemePackAudio';
import { supportsEspeakIpa } from '../services/espeakIpa';
import type { Phoneme } from '../types';
import styles from './PronunciationPanel.module.css';

export interface PhonemeListProps {
  readonly phonemes: readonly Phoneme[];
  /** BCP-47 / ISO code — gates eSpeak synthesis and picks the fallback voice. */
  readonly language: string;
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
  /** 'start' left-aligns chips (header row); default centers them (panel). */
  readonly align?: 'start';
}

export function PhonemeList({
  phonemes,
  language,
  onPlayPhoneme,
  accent,
  align,
}: PhonemeListProps): React.JSX.Element {
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
      const canSynth = supportsEspeakIpa(language);
      if (!canSynth) {
        setTimeout(() => setActiveIndex((current) => (current === index ? null : current)), 200);
        return;
      }

      void (async () => {
        try {
          const clip = await resolvePhonemeAudio(phoneme.ipa, accent, language);
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
    [onPlayPhoneme, language, accent],
  );

  return (
    <>
      <CollapsibleLine
        dataTihokaId="pronunciation-phoneme-list"
        contentClassName={`${styles.phonemeList} ${align === 'start' ? styles.phonemeListStart : ''}`}
      >
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
              data-tihoka-id="pronunciation-phoneme"
            >
              {phoneme.ipa}
            </Button>
          );
        })}
      </CollapsibleLine>
      {error && (
        <div className={styles.error} data-tihoka-id="pronunciation-audio-error">
          {error}
        </div>
      )}
    </>
  );
}
