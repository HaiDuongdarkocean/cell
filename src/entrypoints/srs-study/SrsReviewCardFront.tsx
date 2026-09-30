import { Box, Heading, InputField } from '@/shared/ui';
import { t } from '@/shared/i18n';
import type { SrsNote, SrsStimulus } from '@/entities/srs/types';
import { stimulusLabel } from './srsLabels';
import { formatFieldValue, HighlightedSentence } from './srsCardShared';
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
            <audio controls src={value.value} className={styles.stimulusAudio} />
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
  readonly onShowAnswer: () => void;
}

export function SrsReviewCardFront({
  note,
  stimulus,
  isSpelling,
  typedInput,
  onTypedInputChange,
  inputId,
  onShowAnswer,
}: SrsReviewCardFrontProps): React.JSX.Element {
  return (
    <div
      className={styles.front}
      role="button"
      tabIndex={0}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('input,button,audio')) return;
        if (!isSpelling) onShowAnswer();
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
        if (isSpelling) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onShowAnswer();
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
              onShowAnswer();
            }
          }}
          className={styles.spellingInput}
          autoFocus
        />
      )}
    </div>
  );
}
