import { Box, Button, InputField, Text } from '@/shared/ui';
import type { SrsFieldValue, SrsStimulus } from '@/entities/srs/types';
import styles from './SrsReviewCard.module.css';

function formatFieldValue(value: SrsFieldValue): string {
  if (value.kind === 'list') return value.value.join(', ');
  return value.value;
}

function StimulusView({ stimulus }: { stimulus: SrsStimulus }): React.JSX.Element {
  const entries = Object.entries(stimulus.payload);

  return (
    <Box className={styles.stimulus}>
      <Text className={styles.stimulusType}>{stimulus.type}</Text>
      {entries.map(([fieldId, value]) => (
        <Box key={fieldId} className={styles.stimulusField}>
          {value.kind === 'image' ? (
            <img src={value.value} alt={fieldId} className={styles.stimulusImage} />
          ) : value.kind === 'audio' ? (
            <audio controls src={value.value} className={styles.stimulusAudio} />
          ) : (
            <Text className={styles.stimulusText}>{formatFieldValue(value)}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}

interface SrsReviewCardFrontProps {
  readonly componentType: string;
  readonly stimulus: SrsStimulus;
  readonly isSpelling: boolean;
  readonly typedInput: string;
  readonly onTypedInputChange: (value: string) => void;
  readonly inputId: string;
  readonly onShowAnswer: () => void;
}

export function SrsReviewCardFront({
  componentType,
  stimulus,
  isSpelling,
  typedInput,
  onTypedInputChange,
  inputId,
  onShowAnswer,
}: SrsReviewCardFrontProps): React.JSX.Element {
  return (
    <Box className={styles.front}>
      <Text className={styles.componentType}>{componentType}</Text>
      <StimulusView stimulus={stimulus} />

      {isSpelling && (
        <InputField
          id={inputId}
          label="Type the word"
          value={typedInput}
          onChange={(e) => onTypedInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onShowAnswer();
            }
          }}
          className={styles.spellingInput}
          autoFocus
        />
      )}

      <Button
        material="solid"
        variant="secondary"
        fullWidth
        onClick={onShowAnswer}
        className={styles.showAnswerButton}
      >
        {isSpelling ? 'Check answer' : 'Show answer'}
      </Button>
    </Box>
  );
}
