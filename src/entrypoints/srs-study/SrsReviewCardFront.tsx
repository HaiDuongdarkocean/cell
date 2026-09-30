import { Box, Heading, InputField } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import type { SrsNote, SrsStimulus } from '@/entities/srs/types';
import { stimulusLabel } from './srsLabels';
import { formatFieldValue, HighlightedSentence, playAudioUrl } from './srsCardShared';
import styles from './SrsReviewCard.module.css';

const FRONT_SKIP_FIELDS: ReadonlySet<string> = new Set(['sentence', 'ipa']);

function StimulusView({ stimulus, targetWord, skipFieldIds }: { stimulus: SrsStimulus; targetWord: string; skipFieldIds?: ReadonlySet<string> }): React.JSX.Element {
  const entries = Object.entries(stimulus.payload).filter(([fieldId]) => !skipFieldIds?.has(fieldId));

  return (
    <Box className={styles.stimulus}>
      {entries.map(([fieldId, value]) => (
        <Box key={fieldId} className={styles.stimulusField}>
          {value.kind === 'image' ? (
            <img src={value.value} alt={stimulusLabel(stimulus.type)} className={styles.stimulusImage} />
          ) : value.kind === 'audio' ? (
            <button
              type="button"
              className={fieldId === 'sentAudio' ? styles.stimulusAudioPill : styles.stimulusAudioButton}
              onClick={(e) => { e.stopPropagation(); playAudioUrl(value.value); }}
              aria-label={fieldId === 'sentAudio' ? t('srs.review.playSentence') : t('srs.review.playWord')}
            >
              <Icon name={fieldId === 'sentAudio' ? 'audioWave' : 'volumeHigh'} />
            </button>
          ) : (
            <HighlightedSentence sentence={formatFieldValue(value)} target={targetWord} />
          )}
        </Box>
      ))}
    </Box>
  );
}

interface SrsReviewCardFrontProps {
  readonly note: SrsNote;
  readonly stimulus: SrsStimulus;
  readonly isSpelling: boolean;
  readonly typedInput: string;
  readonly onTypedInputChange: (value: string) => void;
  readonly inputId: string;
  readonly onFlip: () => void;
}

export function SrsReviewCardFront({
  note,
  stimulus,
  isSpelling,
  typedInput,
  onTypedInputChange,
  inputId,
  onFlip,
}: SrsReviewCardFrontProps): React.JSX.Element {
  return (
    <div
      className={styles.front}
      role="button"
      tabIndex={0}
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('input,button,audio')) return;
        e.preventDefault();
      }}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('input,button,audio')) return;
        if (!isSpelling) onFlip();
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
        if (isSpelling) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFlip();
        }
      }}
    >
      <Heading level={1} className={styles.targetWord}>{note.targetWord}</Heading>
      {note.fields.sentence?.kind === 'text' && note.fields.sentence.value && (
        <HighlightedSentence sentence={note.fields.sentence.value} target={note.targetWord} />
      )}
      <StimulusView stimulus={stimulus} targetWord={note.targetWord} skipFieldIds={FRONT_SKIP_FIELDS} />

      {isSpelling && (
        <InputField
          id={inputId}
          label={t('srs.review.typeWord')}
          value={typedInput}
          onChange={(e) => onTypedInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation();
              onFlip();
            }
          }}
          className={styles.spellingInput}
          autoFocus
        />
      )}
    </div>
  );
}
