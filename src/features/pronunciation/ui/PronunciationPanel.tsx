import { t } from '@/shared/i18n';
import { PhonemeList } from './PhonemeList';
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
  if (!pronunciation) return null;

  return (
    <section className={styles.pronunciation} aria-label={t('pronunciation.panel.aria')}>
      {pronunciation.ipa && (
        <div className={styles.ipa} data-tihoka-id="pronunciation-ipa">
          /{pronunciation.ipa}/
        </div>
      )}

      <PhonemeList
        phonemes={pronunciation.phonemes}
        language={pronunciation.language}
        onPlayPhoneme={onPlayPhoneme}
        accent={accent}
      />

      <div className={styles.meta} data-tihoka-id="pronunciation-no-audio">
        {t('pronunciation.audio.selectHint')}
      </div>
    </section>
  );
}
