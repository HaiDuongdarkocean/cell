import { useEffect, useId, useRef, useState } from 'react';
import { useSrsStudy } from '@/features/srs/ui/SrsStudyProvider';
import { getSrsUiPrefs, setSrsUiPrefs, setVariantToggle, useSrsUiPrefs } from '@/features/srs/ui/srsUiPrefs';
import { Box, Button, ConfirmDialog, Text } from '@/shared/ui';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import type { ResolvedVariantToggles, VariantAudioToggle, VariantScopeToggle } from '@/entities/srs/types';
import { SRS_INPUT_FIELD_ID } from '@/entities/srs/types';
import { variantLabel } from '@/features/srs/ui/srsLabels';
import { SrsVariantFront } from '@/features/srs/ui/SrsVariantFront';
import { SrsReviewCardBack } from '@/features/srs/ui/SrsReviewCardBack';
import { SrsEditCardPanel } from './SrsEditCardPanel';
import { ICON_CATALOG, type IconCatalogKey } from '@/shared/icons';
import styles from '@/features/srs/ui/SrsReviewCard.module.css';

function variantIcon(icon: string | undefined): IconCatalogKey {
  return icon && icon in ICON_CATALOG ? (icon as IconCatalogKey) : 'layers';
}

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
  const [editWidth, setEditWidth] = useState<number | null>(() => getSrsUiPrefs().editPaneWidth);
  const [editDragging, setEditDragging] = useState(false);
  const editDragRef = useRef<{ startX: number; startW: number; maxW: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [toggles, setToggles] = useState<ResolvedVariantToggles | null>(null);
  const prefs = useSrsUiPrefs();
  const inputId = useId();

  useEffect(() => {
    setShowAnswer(false);
    setTypedInput('');
    setToggles(session?.toggles ?? null);
  }, [session?.card.id, session?.variant.id, session?.toggles]);

  const [narrowEdit, setNarrowEdit] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches,
  );
  const narrowEditRef = useRef(narrowEdit);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const onChange = () => setNarrowEdit(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (narrowEditRef.current === narrowEdit) return;
    narrowEditRef.current = narrowEdit;
    if (!editing) return;
    setEditOpen(false);
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEditOpen(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [narrowEdit, editing]);

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

  const { note, variant, variants, stimulus, card } = session;
  const effectiveToggles = toggles ?? session.toggles;
  const hasInput = variant.fieldIds.includes(SRS_INPUT_FIELD_ID);
  const isNew = (card.components[variant.id]?.exploreCount ?? 0) === 0;

  function handleFlip(): void {
    setShowAnswer((v) => !v);
  }

  function handleSubmit(judgment: 'forget' | 'remember'): void {
    void submit(judgment, hasInput ? typedInput : undefined, effectiveToggles);
  }

  function handleScopeChange(scope: VariantScopeToggle): void {
    setToggles({ ...effectiveToggles, scope });
    setVariantToggle(variant.id, { scope });
  }

  function handleAudioChange(audio: VariantAudioToggle): void {
    setToggles({ ...effectiveToggles, audio });
    setVariantToggle(variant.id, { audio });
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
        {variants.map((v) => (
          <span
            key={v.id}
            role="listitem"
            className={[styles.stepDot, v.id === variant.id ? styles.stepDotActive : ''].join(' ')}
            aria-label={variantLabel(v)}
            aria-current={v.id === variant.id ? 'step' : undefined}
            title={variantLabel(v)}
          >
            <Icon name={variantIcon(v.icon)} />
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
      <Box className={editMounted && !narrowEdit ? `${styles.card} ${styles.cardEditing}` : styles.card}>
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
        ) : (
          <SrsVariantFront
            variant={variant}
            note={note}
            stimulus={stimulus}
            toggles={effectiveToggles}
            onScopeChange={handleScopeChange}
            onAudioChange={handleAudioChange}
            typedInput={typedInput}
            onTypedInputChange={hasInput ? setTypedInput : undefined}
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

        {editMounted && !narrowEdit && (
          <aside
            className={[
              styles.editSection,
              editOpen ? styles.editSectionOpen : '',
              editDragging ? styles.editSectionResizing : '',
            ].filter(Boolean).join(' ')}
            style={editOpen && editWidth !== null ? { width: editWidth } : undefined}
            onTransitionEnd={(e) => {
              if (e.target === e.currentTarget && e.propertyName === 'width' && !editing) setEditMounted(false);
            }}
          >
            <div
              className={styles.editDivider}
              role="separator"
              aria-orientation="vertical"
              aria-label={t('srs.edit.resize')}
              aria-valuenow={editWidth ?? undefined}
              tabIndex={0}
              onDoubleClick={() => { setEditWidth(null); setSrsUiPrefs({ editPaneWidth: null }); }}
              onPointerDown={(e) => {
                const aside = e.currentTarget.parentElement;
                const cardEl = aside?.closest(`.${styles.card}`) ?? aside?.parentElement?.parentElement;
                if (!aside || !cardEl) return;
                editDragRef.current = {
                  startX: e.clientX,
                  startW: aside.getBoundingClientRect().width,
                  maxW: cardEl.getBoundingClientRect().width - 48 - 42 - 320,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
                setEditDragging(true);
              }}
              onPointerMove={(e) => {
                const d = editDragRef.current;
                if (!d) return;
                setEditWidth(Math.round(Math.min(Math.max(d.startW + (d.startX - e.clientX), 280), Math.max(280, d.maxW))));
              }}
              onPointerUp={(e) => {
                const wasDragging = editDragRef.current !== null;
                editDragRef.current = null;
                setEditDragging(false);
                e.currentTarget.releasePointerCapture(e.pointerId);
                if (wasDragging) {
                  const w = e.currentTarget.parentElement?.getBoundingClientRect().width;
                  if (w) setSrsUiPrefs({ editPaneWidth: Math.round(w) });
                }
              }}
              onPointerCancel={(e) => {
                editDragRef.current = null;
                setEditDragging(false);
                e.currentTarget.releasePointerCapture(e.pointerId);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                e.preventDefault();
                const aside = e.currentTarget.parentElement;
                const cardEl = aside?.closest(`.${styles.card}`) ?? aside?.parentElement?.parentElement;
                if (!aside || !cardEl) return;
                const cur = editWidth ?? aside.getBoundingClientRect().width;
                const maxW = cardEl.getBoundingClientRect().width - 48 - 42 - 320;
                const next = Math.round(Math.min(Math.max(cur + (e.key === 'ArrowLeft' ? 16 : -16), 280), Math.max(280, maxW)));
                setEditWidth(next);
                setSrsUiPrefs({ editPaneWidth: next });
              }}
            />
            <SrsEditCardPanel
              onClose={() => { setEditing(false); }}
              masked={!showAnswer}
              onReveal={handleFlip}
              embedded
            />
          </aside>
        )}
        </div>
      </Box>
      </Box>

      {narrowEdit && (
        <BottomSheet
          open={editing}
          onOpenChange={(open) => { if (!open) setEditing(false); }}
          title={t('srs.edit.title')}
          hideHeader
        >
          <SrsEditCardPanel
            onClose={() => { setEditing(false); }}
            masked={!showAnswer}
            onReveal={handleFlip}
            embedded
          />
        </BottomSheet>
      )}

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
