/**
 * CardCreatorDialogContent — shared body for desktop Dialog + mobile BottomSheet.
 *
 * Renders all sections per the mockup:
 *  - Alert (no recent card / error / success)
 *  - Card destination (Note type + Deck selects)
 *  - Fields (10 rows: text fields + media lists + tags)
 *  - Footer (Update mode + Cancel/Add/Update buttons)
 *
 * Receives state from `useCardCreatorState` + a `variant` ('desktop' | 'mobile')
 * to adjust layout (mobile stacks pairRow + footer vertically).
 *
 * BEM block: .cc-dialog
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { Heading } from '@/shared/ui/Heading';
import { Label } from '@/shared/ui/Label';
import { Select } from '@/shared/ui/Select';
import { Dialog } from '@/shared/ui/Dialog';
import { FieldRow, FieldAutoGrowInput, TagInput } from './FieldRow';
import { MediaList } from './MediaList';
import { PreviewBlock } from './PreviewBlock';
import { QueueSidebar } from './QueueSidebar';
import { CardCreatorSettingsSidePanel } from './CardCreatorSettingsSidePanel';
import { t } from '@/shared/i18n';
import type { CardDraft } from '../state/cardDraft';
import type { useCardCreatorState } from './useCardCreatorState';
import type { Settings } from '@/entities/media';
import styles from './CardCreatorDialog.module.css';

interface CardCreatorDialogContentProps {
  state: ReturnType<typeof useCardCreatorState>;
  variant: 'desktop' | 'mobile';
  className?: string;
  /** Render in the integrated universal panel instead of a standalone dialog. */
  layout?: 'dialog' | 'panel';
  /** App settings for the integrated settings panel. */
  appSettings?: Settings;
  /** Called when settings change in the integrated settings panel. */
  onSettingsChange?: (settings: Settings) => void;
}

export function CardCreatorDialogContent({
  state,
  variant,
  className,
  layout = 'dialog',
  appSettings,
  onSettingsChange,
}: CardCreatorDialogContentProps): ReactElement {
  const {
    draft,
    decks,
    noteTypes,
    recentNoteId,
    loadStatus,
    loadError,
    submitting,
    capturingMedia,
    queueItems,
    queueActiveIndex,
    queueSidebarOpen,
    toggleQueueSidebar,
    selectQueueItem,
    deleteQueueItem,
    undoDeleteQueueItem,
    toasts,
    dismissToast,
    updateField,
    changeNoteType,
    changeDeck,
    updateDraft,
    addFileFromDisk,
    addFiles,
    removeMedia,
    reorderMedia,
    generateField,
    generateAll,
    submit,
    clear,
  } = state;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Resolve the portal target so the confirmation dialog renders outside the
  // Card Creator dialog (escaping overflow/focus) but inside the same
  // document/shadow root so its CSS and event delegation remain intact.
  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    const root = node.getRootNode();
    let container: HTMLElement | null = null;
    if (root instanceof ShadowRoot) {
      let el: Node = node;
      while (el.parentNode && el.parentNode !== root) {
        el = el.parentNode;
      }
      container = el instanceof Element ? (el as HTMLElement) : null;
    } else {
      container = (root as Document).body ?? null;
    }
    setPortalContainer(container);
  }, []);

  const handleClear = (): void => {
    setConfirmOpen(false);
    clear();
  };

  const hasQueue = queueItems.length >= 2;

  const isPanel = layout === 'panel';

  const fieldGenerateButton = (
    key: keyof CardDraft['fields'],
    dataId: string,
    label: string,
  ): ReactElement => (
    <Button
      key={`generate-${key}`}
      variant="ghost"
      size="sm"
      shape="circle"
      onClick={() => void generateField(key)}
      disabled={capturingMedia || submitting}
      aria-label={t('cardCreator.action.generateFor', [label])}
      title={t('cardCreator.action.generateFor', [label])}
      data-cell-id={`${dataId}-generate`}
    >
      <Icon name="zap" size="sm" />
    </Button>
  );

  const containerClass = [
    isPanel ? styles['cc-dialog__body--panel'] : styles['cc-dialog__body'],
    !isPanel && variant === 'mobile' && styles['cc-dialog--mobile'],
    className,
  ].filter(Boolean).join(' ');

  // Dropdowns (Note type, Deck) are always enabled — no disable/opacity
  // flash. Options populate instantly when the prefetched AnkiConnect data
  // resolves (typically before the dialog even opens, since media capture
  // takes longer than the prefetch). If the user opens a dropdown before
  // options arrive, the menu is empty until they arrive — no visual
  // "loading" state on the trigger.
  const showNoRecentAlert = loadStatus === 'ready' && recentNoteId === null;

  const headerSettings = isPanel ? (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setSettingsOpen(true)}
      aria-label={t('settings.title')}
      title={t('settings.title')}
      data-cell-id="cc-settings"
    >
      <Icon name="settings" />
    </Button>
  ) : undefined;

  const headerQueue = isPanel ? (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleQueueSidebar}
      disabled={!hasQueue}
      aria-label={hasQueue ? (queueSidebarOpen ? t('cardCreator.queue.hide') : t('cardCreator.queue.show')) : t('cardCreator.queue.empty')}
      title={hasQueue ? (queueSidebarOpen ? t('cardCreator.queue.hide') : t('cardCreator.queue.show')) : t('cardCreator.queue.empty')}
      data-cell-id="cc-queue-toggle"
    >
      <Icon name="panelRight" />
    </Button>
  ) : undefined;

  const body = (
    <div className={containerClass}>
      {/* Alert: no recent card */}
      {showNoRecentAlert && (
        <div className={styles['cc-dialog__alert']} role="status" data-cell-id="cc-alert-no-recent">
          <Icon name="info" className={styles['cc-dialog__alert-icon']} />
          <span>{t('cardCreator.alert.noRecent')}</span>
        </div>
      )}
      {/* Alert: load error */}
      {loadStatus === 'error' && (
        <div
          className={`${styles['cc-dialog__alert']} ${styles['cc-dialog__alert--error']}`}
          role="alert"
          data-cell-id="cc-alert-error"
        >
          <Icon name="alertCircle" className={styles['cc-dialog__alert-icon']} />
          <span>{t('cardCreator.alert.error', [loadError])}</span>
        </div>
      )}

      {/* Section: Card destination */}
      <div className={styles['cc-dialog__section']}>
        <div className={styles['cc-dialog__section-header']}>
          <Heading level={3} size={4} className={styles["cc-dialog__section-title"]}>{t('cardCreator.section.destination')}</Heading>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void generateAll()}
            disabled={!draft.fields.targetWord.trim()}
            trailingIcon={<Icon name="zap" size="sm" />}
            data-cell-id="cc-generate-all"
          >
            {t('cardCreator.action.generateAll')}
          </Button>
        </div>
        <div className={styles['cc-dialog__pair-row']}>
          <div className={styles['cc-dialog__field']}>
            <Label className={styles['cc-dialog__field-label']}>{t('cardCreator.destination.noteType')}</Label>
            <Select
              value={draft.noteType}
              options={noteTypes.map((n) => ({ value: n, label: n }))}
              onChange={changeNoteType}
              aria-label={t('cardCreator.destination.noteType')}
              className={styles['cc-dialog__select']}
              data-cell-id="cc-note-type"
            />
          </div>
          <div className={styles['cc-dialog__field']}>
            <Label className={styles['cc-dialog__field-label']}>{t('cardCreator.destination.deck')}</Label>
            <Select
              value={draft.deck}
              options={decks.map((d) => ({ value: d, label: d }))}
              onChange={(d) => void changeDeck(d)}
              aria-label={t('cardCreator.destination.deck')}
              className={styles['cc-dialog__select']}
              data-cell-id="cc-deck"
            />
          </div>
        </div>
      </div>

      {/* Preview block — above Fields section so user sees the card
       * composition before filling in field values. */}
      <PreviewBlock
        targetWord={draft.fields.targetWord}
        sentence={draft.fields.sentence}
        dataId="cc-preview"
      />

      {/* Section: Fields */}
      <div className={styles['cc-dialog__section']}>
        <Heading level={3} size={4} className={styles["cc-dialog__section-title"]}>{t('cardCreator.section.fields')}</Heading>

        <FieldRow
          label={t('cardCreator.field.targetWord')}
          trailing={fieldGenerateButton('targetWord', 'cc-target-word', t('cardCreator.field.targetWord'))}
          dataId="cc-target-word"
        >
          <FieldAutoGrowInput
            value={draft.fields.targetWord}
            onChange={(v) => updateField('targetWord', v)}
            placeholder={t('cardCreator.placeholder.targetWord')}
            aria-label={t('cardCreator.field.targetWord')}
            dataId="cc-target-word"
          />
        </FieldRow>

        <FieldRow
          label={t('cardCreator.field.sentence')}
          trailing={fieldGenerateButton('sentence', 'cc-sentence', t('cardCreator.field.sentence'))}
          dataId="cc-sentence"
        >
          <FieldAutoGrowInput
            value={draft.fields.sentence}
            onChange={(v) => updateField('sentence', v)}
            aria-label={t('cardCreator.field.sentence')}
            dataId="cc-sentence"
          />
        </FieldRow>

        <FieldRow
          label={t('cardCreator.field.sentenceTranslation')}
          trailing={fieldGenerateButton('sentenceTranslation', 'cc-sentence-translation', t('cardCreator.field.sentenceTranslation'))}
          dataId="cc-sentence-translation"
        >
          <FieldAutoGrowInput
            value={draft.fields.sentenceTranslation}
            onChange={(v) => updateField('sentenceTranslation', v)}
            aria-label={t('cardCreator.field.sentenceTranslation')}
            dataId="cc-sentence-translation"
          />
        </FieldRow>

        <FieldRow
          label={t('cardCreator.field.definitions')}
          trailing={fieldGenerateButton('definitions', 'cc-definitions', t('cardCreator.field.definitions'))}
          dataId="cc-definitions"
        >
          <FieldAutoGrowInput
            value={draft.fields.definitions}
            onChange={(v) => updateField('definitions', v)}
            placeholder={t('cardCreator.placeholder.definitions')}
            aria-label={t('cardCreator.field.definitions')}
            dataId="cc-definitions"
          />
        </FieldRow>

        <FieldRow
          label={t('cardCreator.field.image')}
          trailing={fieldGenerateButton('images', 'cc-images', t('cardCreator.field.image'))}
          dataId="cc-images"
        >
          <MediaList
            files={draft.fields.images}
            kind="image"
            addLabel={t('cardCreator.add.image')}
            onAdd={() => void addFileFromDisk('images')}
            onRemove={(i) => removeMedia('images', i)}
            onFilesDrop={(files, invalidCount) => addFiles('images', files, invalidCount)}
            onReorder={(from, to) => reorderMedia('images', from, to)}
            addDisabled={capturingMedia}
            dataId="cc-images-list"
          />
        </FieldRow>

        <FieldRow
          label={t('cardCreator.field.sentenceAudio')}
          trailing={fieldGenerateButton('sentenceAudios', 'cc-sentence-audios', t('cardCreator.field.sentenceAudio'))}
          dataId="cc-sentence-audios"
        >
          <MediaList
            files={draft.fields.sentenceAudios}
            kind="audio"
            addLabel={t('cardCreator.add.sentenceAudio')}
            onAdd={() => void addFileFromDisk('sentenceAudios')}
            onRemove={(i) => removeMedia('sentenceAudios', i)}
            onFilesDrop={(files, invalidCount) => addFiles('sentenceAudios', files, invalidCount)}
            onReorder={(from, to) => reorderMedia('sentenceAudios', from, to)}
            addDisabled={capturingMedia}
            dataId="cc-sentence-audios-list"
          />
        </FieldRow>

        <FieldRow
          label={t('cardCreator.field.wordAudio')}
          trailing={fieldGenerateButton('wordAudios', 'cc-word-audios', t('cardCreator.field.wordAudio'))}
          dataId="cc-word-audios"
        >
          <MediaList
            files={draft.fields.wordAudios}
            kind="audio"
            addLabel={t('cardCreator.add.wordAudio')}
            onAdd={() => void addFileFromDisk('wordAudios')}
            onRemove={(i) => removeMedia('wordAudios', i)}
            onFilesDrop={(files, invalidCount) => addFiles('wordAudios', files, invalidCount)}
            onReorder={(from, to) => reorderMedia('wordAudios', from, to)}
            addDisabled={capturingMedia}
            dataId="cc-word-audios-list"
          />
        </FieldRow>

        <FieldRow
          label={t('cardCreator.field.note')}
          trailing={fieldGenerateButton('note', 'cc-note', t('cardCreator.field.note'))}
          dataId="cc-note"
        >
          <FieldAutoGrowInput
            value={draft.fields.note}
            onChange={(v) => updateField('note', v)}
            placeholder={t('cardCreator.placeholder.note')}
            aria-label={t('cardCreator.field.note')}
            dataId="cc-note"
          />
        </FieldRow>

        <FieldRow
          label={t('cardCreator.field.moreExample')}
          trailing={fieldGenerateButton('moreExample', 'cc-more-example', t('cardCreator.field.moreExample'))}
          dataId="cc-more-example"
        >
          <FieldAutoGrowInput
            value={draft.fields.moreExample}
            onChange={(v) => updateField('moreExample', v)}
            placeholder={t('cardCreator.placeholder.moreExample')}
            aria-label={t('cardCreator.field.moreExample')}
            dataId="cc-more-example"
          />
        </FieldRow>

        <FieldRow
          label={t('cardCreator.field.tags')}
          dataId="cc-tags"
        >
          <TagInput
            value={draft.tags}
            onChange={(v) => updateDraft({ tags: v })}
            placeholder={t('cardCreator.placeholder.tags')}
            ariaLabel={t('cardCreator.field.tags')}
            dataId="cc-tags"
          />
        </FieldRow>
      </div>

      {/* Footer */}
      <div className={styles['cc-dialog__footer']}>
        <div className={styles['cc-dialog__footer-mode']}>
          <Select
            value={draft.mediaUpdateMode}
            options={[
              { value: 'overwrite', label: t('cardCreator.updateMode.overwrite') },
              { value: 'append', label: t('cardCreator.updateMode.append') },
              { value: 'skip', label: t('cardCreator.updateMode.skip') },
            ]}
            onChange={(m) => updateDraft({ mediaUpdateMode: m as 'overwrite' | 'append' | 'skip' })}
            aria-label={t('cardCreator.updateMode.label')}
            menuAlign="auto"
            className={styles['cc-dialog__select']}
            data-cell-id="cc-update-mode"
          />
        </div>
        <div className={styles['cc-dialog__footer-actions']}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={submitting}
            data-cell-id="cc-clear"
          >
            {t('cardCreator.action.clear')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => submit('add')}
            disabled={submitting}
            data-cell-id="cc-add"
          >
            {t('cardCreator.action.add')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => submit('update')}
            disabled={submitting || recentNoteId === null}
            data-cell-id="cc-update"
          >
            {t('cardCreator.action.update')}
          </Button>
        </div>
      </div>
    </div>
  );

  const confirmDialog = confirmOpen && portalContainer ?
    createPortal(
      <Dialog
        open
        onOpenChange={setConfirmOpen}
        title={t('cardCreator.clearConfirm.title')}
        description={t('cardCreator.clearConfirm.description')}
        showCloseButton
        data-cell-id="cc-clear-confirm-dialog"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirmOpen(false)}
              data-cell-id="cc-clear-confirm-cancel"
            >
              {t('cardCreator.clearConfirm.cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClear}
              data-cell-id="cc-clear-confirm-confirm"
            >
              {t('cardCreator.clearConfirm.confirm')}
            </Button>
          </>
        }
      />,
      portalContainer,
    ) : null;

  const settingsPanel = isPanel && appSettings ? (
    <CardCreatorSettingsSidePanel
      open={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      settings={appSettings}
      onChange={onSettingsChange ?? (() => {})}
    />
  ) : null;

  if (isPanel) {
    return (
      <>
        <div
          ref={contentRef}
          className={styles['cc-dialog--panel']}
          data-cell-id="card-creator-content"
        >
          <div className={styles['cc-dialog__panel-header']}>
            {headerSettings}
            <span className={styles['cc-dialog__panel-title']}>{t('cardCreator.title')}</span>
            {headerQueue}
          </div>
          <div className={styles['cc-dialog__panel-content']}>
            {body}
            {hasQueue && queueSidebarOpen && (
              <QueueSidebar
                queueItems={queueItems}
                queueActiveIndex={queueActiveIndex}
                onSelectQueueItem={selectQueueItem}
                onDeleteQueueItem={deleteQueueItem}
                onUndoDeleteQueueItem={undoDeleteQueueItem}
                toasts={toasts}
                onDismissToast={dismissToast}
              />
            )}
          </div>
          {settingsPanel}
        </div>
        {confirmDialog}
      </>
    );
  }

  const withQueueClass = [
    styles['cc-dialog__with-queue'],
    variant === 'mobile' && styles['cc-dialog--mobile'],
  ].filter(Boolean).join(' ');

  return (
    <>
      <div
        ref={contentRef}
        className={hasQueue ? withQueueClass : undefined}
        data-cell-id="card-creator-content"
      >
        {body}
        {hasQueue && queueSidebarOpen && (
          <QueueSidebar
            mobile={variant === 'mobile'}
            queueItems={queueItems}
            queueActiveIndex={queueActiveIndex}
            onSelectQueueItem={selectQueueItem}
            onDeleteQueueItem={deleteQueueItem}
            onUndoDeleteQueueItem={undoDeleteQueueItem}
            toasts={toasts}
            onDismissToast={dismissToast}
          />
        )}
      </div>
      {confirmDialog}
    </>
  );
}
