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
import { Select } from '@/shared/ui/Select';
import { Dialog } from '@/shared/ui/Dialog';
import { MediaList } from './MediaList';
import { NoteFieldsEditor, GenerateAllButton, DestinationSelects, type NoteEditorField } from './NoteFieldsEditor';
import { PreviewBlock } from './PreviewBlock';
import { QueueSidebar } from './QueueSidebar';
import { QueueSidePanel } from './QueueSidePanel';
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
    isSrs,
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
    reload,
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
    let container: HTMLElement | null;
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

  const editorFields: NoteEditorField[] = [
    { id: 'targetWord', label: t('cardCreator.field.targetWord'), kind: 'text', placeholder: t('cardCreator.placeholder.targetWord'), pastable: true, dataId: 'cc-target-word' },
    { id: 'sentence', label: t('cardCreator.field.sentence'), kind: 'text', pastable: true, dataId: 'cc-sentence' },
    { id: 'sentenceTranslation', label: t('cardCreator.field.sentenceTranslation'), kind: 'text', dataId: 'cc-sentence-translation' },
    { id: 'definitions', label: t('cardCreator.field.definitions'), kind: 'text', placeholder: t('cardCreator.placeholder.definitions'), dataId: 'cc-definitions' },
    { id: 'images', label: t('cardCreator.field.image'), kind: 'image', dataId: 'cc-images' },
    { id: 'sentenceAudios', label: t('cardCreator.field.sentenceAudio'), kind: 'audio', dataId: 'cc-sentence-audios' },
    { id: 'wordAudios', label: t('cardCreator.field.wordAudio'), kind: 'audio', dataId: 'cc-word-audios' },
    { id: 'note', label: t('cardCreator.field.note'), kind: 'text', placeholder: t('cardCreator.placeholder.note'), dataId: 'cc-note' },
    { id: 'moreExample', label: t('cardCreator.field.moreExample'), kind: 'text', placeholder: t('cardCreator.placeholder.moreExample'), dataId: 'cc-more-example' },
  ];

  const mediaAddLabels: Record<string, string> = {
    images: t('cardCreator.add.image'),
    sentenceAudios: t('cardCreator.add.sentenceAudio'),
    wordAudios: t('cardCreator.add.wordAudio'),
  };

  const renderDraftMedia = (id: string): ReactElement => {
    const key = id as 'images' | 'sentenceAudios' | 'wordAudios';
    return (
      <MediaList
        files={draft.fields[key]}
        kind={key === 'images' ? 'image' : 'audio'}
        addLabel={mediaAddLabels[key]}
        onAdd={() => void addFileFromDisk(key)}
        onRemove={(i) => removeMedia(key, i)}
        onFilesDrop={(files, invalidCount) => addFiles(key, files, invalidCount)}
        onReorder={(from, to) => reorderMedia(key, from, to)}
        addDisabled={capturingMedia}
        dataId={`${editorFields.find((f) => f.id === id)?.dataId ?? id}-list`}
      />
    );
  };

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
  const showNoRecentAlert = !isSrs && loadStatus === 'ready' && recentNoteId === null;

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
          <GenerateAllButton
            onClick={() => void generateAll()}
            disabled={!draft.fields.targetWord.trim() || capturingMedia || submitting}
            dataId="cc-generate-all"
          />
        </div>
        <DestinationSelects
          first={{
            label: t('cardCreator.destination.noteType'),
            value: draft.noteType,
            options: noteTypes.map((n) => ({ value: n, label: n })),
            onChange: changeNoteType,
          }}
          second={{
            label: t('cardCreator.destination.deck'),
            value: draft.deck,
            options: decks.map((d) => ({ value: d, label: d })),
            onChange: (d) => void changeDeck(d),
          }}
        />
      </div>

      {/* Preview block — above Fields section so user sees the card
       * composition before filling in field values. */}
      <PreviewBlock
        targetWord={draft.fields.targetWord}
        sentence={draft.fields.sentence}
        langCode={state.sourceLang}
        onTokenClick={state.lookupTerm}
        dataId="cc-preview"
      />

      {/* Section: Fields */}
      <div className={styles['cc-dialog__section']}>
        <Heading level={3} size={4} className={styles["cc-dialog__section-title"]}>{t('cardCreator.section.fields')}</Heading>

        <NoteFieldsEditor
          fields={editorFields}
          getText={(id) => draft.fields[id as keyof CardDraft['fields']] as string}
          onTextChange={(id, v) => updateField(id as Parameters<typeof updateField>[0], v)}
          renderMedia={renderDraftMedia}
          onGenerate={(id) => void generateField(id as keyof CardDraft['fields'])}
          generateDisabled={capturingMedia || submitting}
          dataIdPrefix="cc"
          tagsValue={draft.tags}
          onTagsChange={(v) => updateDraft({ tags: v })}
        />
      </div>

      {/* Footer */}
      <div className={styles['cc-dialog__footer']}>
        {!isSrs && (
          <div className={`${styles['cc-dialog__footer-mode']} ${styles['cc-dialog__select--pill']}`}>
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
        )}
        <div className={styles['cc-dialog__footer-actions']}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={submitting}
            data-cell-id="cc-clear"
          >
            {t('cardCreator.action.clear')}
          </Button>
          <Button
            variant="primarySubtle"
            size="sm"
            onClick={() => { void submit('add'); }}
            disabled={submitting}
            data-cell-id="cc-add"
          >
            {t('cardCreator.action.add')}
          </Button>
          {!isSrs && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => { void submit('update'); }}
              disabled={submitting || recentNoteId === null}
              data-cell-id="cc-update"
            >
              {t('cardCreator.action.update')}
            </Button>
          )}
        </div>
      </div>

      {/* Transient action feedback. Undoable toasts are queue-domain — their
          undo button lives inside the queue panel, so they are filtered out
          here to avoid a dead-end duplicate message. */}
      {toasts.some((toast) => !toast.undoable) && (
        <div className={styles['cc-toast-stack']} role="status" data-cell-id="cc-toast-stack">
          {toasts.filter((toast) => !toast.undoable).map((toast) => (
            <div
              key={toast.id}
              className={`${styles['cc-toast']} ${styles[`cc-toast--${toast.kind}`]}`}
              data-cell-id={`cc-toast-${toast.id}`}
              data-toast-kind={toast.kind}
            >
              <Icon
                name={toast.kind === 'success' ? 'check' : toast.kind === 'error' ? 'alertCircle' : 'info'}
                size="sm"
                className={styles['cc-toast-icon']}
              />
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      )}
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

  const handleSettingsClose = (): void => {
    setSettingsOpen(false);
    reload();
  };

  const settingsPanel = isPanel && appSettings ? (
    <CardCreatorSettingsSidePanel
      open={settingsOpen}
      onClose={handleSettingsClose}
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
          </div>
          {settingsPanel}
          {/* Keep the panel mounted while open even when the queue drains
              below 2 items — unmounting it would also delete the undo
              affordance for the last removal. */}
          {(queueItems.length > 0 || queueSidebarOpen) && (
            <QueueSidePanel
              open={queueSidebarOpen}
              onClose={toggleQueueSidebar}
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
        {queueItems.length > 0 && queueSidebarOpen && (
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
