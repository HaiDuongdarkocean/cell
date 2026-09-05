import { useEffect, useId, useState } from 'react';
import { useSrsStudy } from '@/features/srs/ui/SrsStudyProvider';
import { Box } from '@/shared/ui';
import { SrsReviewCardFront } from './SrsReviewCardFront';
import { SrsReviewCardBack } from './SrsReviewCardBack';
import styles from './SrsReviewCard.module.css';

export function SrsReviewCard(): React.JSX.Element | null {
  const {
    session,
    audioCache,
    imageCache,
    submit,
    markStudyAgain,
    resetCurrentComponent,
    resetCurrentCard,
  } = useSrsStudy();
  const [showAnswer, setShowAnswer] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const inputId = useId();

  useEffect(() => {
    setShowAnswer(false);
    setTypedInput('');
  }, [session?.card.id, session?.componentType]);

  if (!session) return null;

  const { note, componentType, stimulus } = session;
  const isSpelling = componentType === 'spelling';

  function handleShowAnswer(): void {
    setShowAnswer(true);
  }

  function handleSubmit(judgment: 'forget' | 'remember'): void {
    void submit(judgment, isSpelling ? typedInput : undefined);
  }

  return (
    <Box className={styles.card}>
      <div className={styles.progress} role="list" aria-label="Review progress">
        {(['sound', 'meaning', 'spelling'] as const).map((t) => (
          <div
            key={t}
            role="listitem"
            className={[styles.progressDot, t === componentType ? styles.progressDotActive : ''].join(' ')}
            aria-label={t}
            aria-current={t === componentType ? 'step' : undefined}
          />
        ))}
      </div>

      {showAnswer ? (
        <SrsReviewCardBack
          note={note}
          componentType={componentType}
          audioCache={audioCache}
          imageCache={imageCache}
          onSubmit={handleSubmit}
          markStudyAgain={markStudyAgain}
          resetCurrentComponent={resetCurrentComponent}
          resetCurrentCard={resetCurrentCard}
        />
      ) : (
        <SrsReviewCardFront
          componentType={componentType}
          stimulus={stimulus}
          isSpelling={isSpelling}
          typedInput={typedInput}
          onTypedInputChange={setTypedInput}
          inputId={inputId}
          onShowAnswer={handleShowAnswer}
        />
      )}
    </Box>
  );
}
