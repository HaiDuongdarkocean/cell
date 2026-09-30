import { useEffect, useId, useState } from 'react';
import { useSrsStudy } from '@/features/srs/ui/SrsStudyProvider';
import { Box, Button, Text } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import type { ComponentType } from '@/entities/srs/types';
import { componentLabel } from './srsLabels';
import { SrsReviewCardFront } from './SrsReviewCardFront';
import { SrsReviewCardBack } from './SrsReviewCardBack';
import { SrsEditCardPanel } from './SrsEditCardPanel';
import styles from './SrsReviewCard.module.css';

const COMPONENT_ICONS: Record<ComponentType, 'volumeHigh' | 'bookOpen' | 'pencil'> = {
  sound: 'volumeHigh',
  meaning: 'bookOpen',
  spelling: 'pencil',
};

const COMPONENT_ORDER: readonly ComponentType[] = ['sound', 'meaning', 'spelling'];

export interface SrsReviewCardProps {
  readonly onManage?: () => void;
}

export function SrsReviewCard({ onManage }: SrsReviewCardProps): React.JSX.Element | null {
  const {
    session,
    stats,
    audioCache,
    imageCache,
    submit,
    markStudyAgain,
    endSession,
    deleteCurrentCard,
  } = useSrsStudy();
  const [showAnswer, setShowAnswer] = useState(false);
  const [editing, setEditing] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const inputId = useId();

  useEffect(() => {
    setShowAnswer(false);
    setEditing(false);
    setTypedInput('');
  }, [session?.card.id, session?.componentType]);

  if (!session) return null;

  const { note, componentType, stimulus, card } = session;
  const isSpelling = componentType === 'spelling';
  const isNew = card.components[componentType].exploreCount === 0;

  function handleShowAnswer(): void {
    setShowAnswer(true);
  }

  function handleSubmit(judgment: 'forget' | 'remember'): void {
    void submit(judgment, isSpelling ? typedInput : undefined);
  }

  function handleDelete(): void {
    if (window.confirm(t('srs.manage.confirmDeleteCard'))) {
      void deleteCurrentCard();
    }
  }

  function handleManage(): void {
    endSession();
    onManage?.();
  }

  if (editing) {
    return (
      <Box className={styles.stage}>
        <SrsEditCardPanel onClose={() => { setEditing(false); }} />
      </Box>
    );
  }

  return (
    <Box className={styles.stage}>
      <Box className={styles.cornerTopLeft}>
        <Button
          shape="circle"
          size="sm"
          variant="ghost"
          onClick={endSession}
          aria-label={t('srs.review.closeSession')}
          className={styles.chromeButton}
        >
          <Icon name="x" />
        </Button>
      </Box>

      <div className={styles.cornerTopCenter} role="list" aria-label={t('srs.review.progressAria')}>
        {COMPONENT_ORDER.map((ct) => (
          <span
            key={ct}
            role="listitem"
            className={[styles.stepDot, ct === componentType ? styles.stepDotActive : ''].join(' ')}
            aria-label={componentLabel(ct)}
            aria-current={ct === componentType ? 'step' : undefined}
            title={componentLabel(ct)}
          >
            <Icon name={COMPONENT_ICONS[ct]} />
          </span>
        ))}
      </div>

      {stats && (
        <Text className={styles.cornerTopRight}>{t('srs.review.dueCount', [stats.dueNow])}</Text>
      )}

      <Box className={styles.cornerBottomLeft}>
        <Button
          shape="circle"
          size="sm"
          variant="ghost"
          onClick={() => { void markStudyAgain(componentType); }}
          aria-label={t('srs.review.studyAgain')}
          className={styles.chromeButton}
        >
          <Icon name="repeat" />
        </Button>
        <Button
          shape="circle"
          size="sm"
          variant="ghost"
          onClick={handleManage}
          aria-label={t('srs.review.manage')}
          className={styles.chromeButton}
        >
          <Icon name="layers" />
        </Button>
      </Box>

      <Box className={styles.cornerBottomRight}>
        <Button
          shape="circle"
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          aria-label={t('srs.review.deleteCard')}
          className={styles.chromeButton}
        >
          <Icon name="trash" />
        </Button>
        <Button
          shape="circle"
          size="sm"
          variant="ghost"
          onClick={() => { setEditing(true); }}
          aria-label={t('srs.review.editCard')}
          className={styles.chromeButton}
        >
          <Icon name="pencil" />
        </Button>
      </Box>

      <Box className={styles.card}>
        {isNew && <Text className={styles.badgeNew}>{t('srs.review.badgeNew')}</Text>}
        {showAnswer ? (
          <SrsReviewCardBack
            note={note}
            audioCache={audioCache}
            imageCache={imageCache}
          />
        ) : (
          <SrsReviewCardFront
            note={note}
            stimulus={stimulus}
            isSpelling={isSpelling}
            typedInput={typedInput}
            onTypedInputChange={setTypedInput}
            inputId={inputId}
            onShowAnswer={handleShowAnswer}
          />
        )}
      </Box>

      <Box className={styles.gradeRow}>
        <Button
          shape="circle"
          size="lg"
          variant="ghost"
          onClick={() => handleSubmit('forget')}
          aria-label={t('srs.review.forget')}
          className={[styles.gradeButton, styles.forgetButton].join(' ')}
        >
          <Icon name="x" />
        </Button>
        <Button
          shape="circle"
          size="lg"
          variant="primary"
          onClick={() => (showAnswer ? handleSubmit('remember') : handleShowAnswer())}
          aria-label={showAnswer ? t('srs.review.remember') : t('srs.review.showAnswer')}
          className={[styles.gradeButton, styles.rememberButton].join(' ')}
        >
          <Icon name="check" />
        </Button>
      </Box>
    </Box>
  );
}
