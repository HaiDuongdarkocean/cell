import { useEffect, useId, useState } from 'react';
import { useSrsStudy } from '@/features/srs/ui/SrsStudyProvider';
import { useSrsUiPrefs } from '@/features/srs/ui/srsUiPrefs';
import { Box, Button, ConfirmDialog, Text } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import type { ComponentType } from '@/entities/srs/types';
import { componentLabel } from '@/features/srs/ui/srsLabels';
import { SrsReviewCardFront } from '@/features/srs/ui/SrsReviewCardFront';
import { SrsReviewCardBack } from '@/features/srs/ui/SrsReviewCardBack';
import { SrsEditCardPanel } from './SrsEditCardPanel';
import styles from '@/features/srs/ui/SrsReviewCard.module.css';

const COMPONENT_ICONS: Record<ComponentType, 'volumeHigh' | 'bookOpen' | 'pencil'> = {
  sound: 'volumeHigh',
  meaning: 'bookOpen',
  spelling: 'pencil',
};

const COMPONENT_ORDER: readonly ComponentType[] = ['sound', 'meaning', 'spelling'];

export function SrsReviewCard(): React.JSX.Element | null {
  const {
    session,
    stats,
    audioCache,
    imageCache,
    submit,
    canGoBack,
    goBack,
    endSession,
    deleteCurrentCard,
  } = useSrsStudy();
  const [showAnswer, setShowAnswer] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editMounted, setEditMounted] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const prefs = useSrsUiPrefs();
  const inputId = useId();

  useEffect(() => {
    setShowAnswer(false);
    setTypedInput('');
  }, [session?.card.id, session?.componentType]);

  useEffect(() => {
    if (editing) {
      setEditMounted(true);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEditOpen(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    setEditOpen(false);
  }, [editing]);

  if (!session) return null;

  const { note, componentType, stimulus, card } = session;
  const isSpelling = componentType === 'spelling';
  const isNew = card.components[componentType].exploreCount === 0;

  function handleFlip(): void {
    setShowAnswer((v) => !v);
  }

  function handleSubmit(judgment: 'forget' | 'remember'): void {
    void submit(judgment, isSpelling ? typedInput : undefined);
  }

  function handleDelete(): void {
    setConfirmDelete(false);
    void deleteCurrentCard();
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

      {!prefs.hideProgress && (
        <>
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
        </>
      )}

      <Box className={styles.cornerBottomLeft}>
        <Button
          shape="circle"
          size="sm"
          variant="ghost"
          onClick={goBack}
          disabled={!canGoBack}
          aria-label={t('srs.review.goBack')}
          className={styles.chromeButton}
        >
          <Icon name="rotateCcw" />
        </Button>
      </Box>

      <Box className={styles.cornerBottomRight}>
        <Button
          shape="circle"
          size="sm"
          variant="ghost"
          onClick={() => { setConfirmDelete(true); }}
          aria-label={t('srs.review.deleteCard')}
          className={[styles.chromeButton, styles.deleteButton].join(' ')}
        >
          <Icon name="trash" />
        </Button>
        <Button
          shape="circle"
          size="sm"
          variant="ghost"
          onClick={() => { setEditing((v) => !v); }}
          aria-label={t('srs.review.editCard')}
          aria-pressed={editing}
          className={styles.chromeButton}
        >
          <Icon name="pencil" />
        </Button>
      </Box>

      <Box className={styles.reviewArea}>
      <Box className={editMounted ? `${styles.card} ${styles.cardEditing}` : styles.card}>
        <div className={styles.cardRow}>
        <div className={styles.faceArea}>
        {isNew && <Text className={styles.badgeNew}>{t('srs.review.badgeNew')}</Text>}
        {showAnswer ? (
          <SrsReviewCardBack
            note={note}
            audioCache={audioCache}
            imageCache={imageCache}
            onFlipBack={handleFlip}
          />
        ) : editing ? (
          <div
            className={styles.front}
            role="button"
            tabIndex={0}
            data-cell-no-ripple
            aria-label={t('srs.review.showAnswer')}
            onClick={handleFlip}
            onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
              if ((e.target as HTMLElement).closest('button,input,audio,a,textarea,select')) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleFlip();
              }
            }}
          >
            <Box className={styles.editingNote}>
              <Icon name="eyeOff" size="lg" color="secondary" />
              <Text variant="heading-3">{t('srs.review.editingFront')}</Text>
              <Text variant="supporting" color="secondary">{t('srs.review.editingFrontHint')}</Text>
            </Box>
          </div>
        ) : (
          <SrsReviewCardFront
            note={note}
            stimulus={stimulus}
            isSpelling={isSpelling}
            typedInput={typedInput}
            onTypedInputChange={setTypedInput}
            inputId={inputId}
            onFlip={handleFlip}
            audioCache={audioCache}
            imageCache={imageCache}
          />
        )}
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
            onClick={() => (showAnswer ? handleSubmit('remember') : handleFlip())}
            aria-label={showAnswer ? t('srs.review.remember') : t('srs.review.showAnswer')}
            className={[styles.gradeButton, styles.rememberButton].join(' ')}
          >
            <Icon name="check" />
          </Button>
        </Box>
        </div>

        {editMounted && (
          <aside
            className={editOpen ? `${styles.editSection} ${styles.editSectionOpen}` : styles.editSection}
            onTransitionEnd={(e) => {
              if (e.target === e.currentTarget && e.propertyName === 'width' && !editing) setEditMounted(false);
            }}
          >
            <SrsEditCardPanel onClose={() => { setEditing(false); }} />
          </aside>
        )}
        </div>
      </Box>
      </Box>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('srs.review.deleteCard')}
        description={t('srs.manage.confirmDeleteCard')}
        cancelLabel={t('srs.edit.cancel')}
        confirmLabel={t('srs.manage.delete')}
        onConfirm={handleDelete}
      />
    </Box>
  );
}
