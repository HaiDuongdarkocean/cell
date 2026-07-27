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
import type { ReactElement } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/Select';
import { FieldRow, FieldAutoGrowInput } from './FieldRow';
import { MediaList } from './MediaList';
import { PreviewBlock } from './PreviewBlock';
import { QueueSidebar } from './QueueSidebar';
import type { useCardCreatorState } from './useCardCreatorState';
import styles from './CardCreatorDialog.module.css';

interface CardCreatorDialogContentProps {
  state: ReturnType<typeof useCardCreatorState>;
  variant: 'desktop' | 'mobile';
  onCancel: () => void;
  className?: string;
}

export function CardCreatorDialogContent({
  state,
  variant,
  onCancel,
  className,
}: CardCreatorDialogContentProps): ReactElement {
  const {
    draft,
    decks,
    noteTypes,
    availableFields,
    recentNoteId,
    loadStatus,
    loadError,
    submitting,
    capturingMedia,
    queueItems,
    queueSidebarOpen,
    updateField,
    updateMapping,
    changeNoteType,
    changeDeck,
    updateDraft,
    addFileFromDisk,
    addFiles,
    removeMedia,
    reorderMedia,
    translateSentenceField,
    submit,
  } = state;

  const hasQueue = queueItems.length >= 2;

  const containerClass = [
    styles['cc-dialog__body'],
    variant === 'mobile' && styles['cc-dialog--mobile'],
    className,
  ].filter(Boolean).join(' ');

  // Dropdowns (Note type, Deck) are always enabled — no disable/opacity
  // flash. Options populate instantly when the prefetched AnkiConnect data
  // resolves (typically before the dialog even opens, since media capture
  // takes longer than the prefetch). If the user opens a dropdown before
  // options arrive, the menu is empty until they arrive — no visual
  // "loading" state on the trigger.
  const showNoRecentAlert = loadStatus === 'ready' && recentNoteId === null;

  return (
    <div className={hasQueue ? styles['cc-dialog__with-queue'] : undefined} data-testid="card-creator-content">
    <div className={containerClass}>
      {/* Alert: no recent card */}
      {showNoRecentAlert && (
        <div className={styles['cc-dialog__alert']} role="status" data-testid="cc-alert-no-recent">
          <Icon name="info" className={styles['cc-dialog__alert-icon']} />
          <span>No existing card found in this deck. Fill in the fields below to create a new card.</span>
        </div>
      )}
      {/* Alert: load error */}
      {loadStatus === 'error' && (
        <div
          className={`${styles['cc-dialog__alert']} ${styles['cc-dialog__alert--error']}`}
          role="alert"
          data-testid="cc-alert-error"
        >
          <Icon name="alertCircle" className={styles['cc-dialog__alert-icon']} />
          <span>Failed to load from AnkiConnect: {loadError}. Check the URL in Settings → Card Creator.</span>
        </div>
      )}

      {/* Section: Card destination */}
      <div className={styles['cc-dialog__section']}>
        <h3 className={styles['cc-dialog__section-title']}>Card destination</h3>
        <div className={styles['cc-dialog__pair-row']}>
          <div className={styles['cc-dialog__field']}>
            <label className={styles['cc-dialog__field-label']}>Note type</label>
            <Select
              value={draft.noteType}
              options={noteTypes.map((n) => ({ value: n, label: n }))}
              onChange={changeNoteType}
              aria-label="Note type"
              data-testid="cc-note-type"
            />
          </div>
          <div className={styles['cc-dialog__field']}>
            <label className={styles['cc-dialog__field-label']}>Deck</label>
            <Select
              value={draft.deck}
              options={decks.map((d) => ({ value: d, label: d }))}
              onChange={(d) => void changeDeck(d)}
              aria-label="Deck"
              data-testid="cc-deck"
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
        <h3 className={styles['cc-dialog__section-title']}>Fields</h3>

        <FieldRow
          label="Target word"
          mappedField={draft.fieldMapping.targetWord ?? ''}
          availableFields={availableFields}
          onMapChange={(f) => updateMapping('targetWord', f)}
          dataId="cc-target-word"
        >
          <FieldAutoGrowInput
            value={draft.fields.targetWord}
            onChange={(v) => updateField('targetWord', v)}
            placeholder="Enter the word or phrase to learn"
            aria-label="Target word"
            dataId="cc-target-word"
          />
        </FieldRow>

        <FieldRow
          label="Sentence"
          mappedField={draft.fieldMapping.sentence ?? ''}
          availableFields={availableFields}
          onMapChange={(f) => updateMapping('sentence', f)}
          dataId="cc-sentence"
        >
          <FieldAutoGrowInput
            value={draft.fields.sentence}
            onChange={(v) => updateField('sentence', v)}
            aria-label="Sentence"
            dataId="cc-sentence"
          />
        </FieldRow>

        <FieldRow
          label="Sentence translation"
          mappedField={draft.fieldMapping.sentenceTranslation ?? ''}
          availableFields={availableFields}
          onMapChange={(f) => updateMapping('sentenceTranslation', f)}
          dataId="cc-sentence-translation"
        >
          <FieldAutoGrowInput
            value={draft.fields.sentenceTranslation}
            onChange={(v) => updateField('sentenceTranslation', v)}
            aria-label="Sentence translation"
            dataId="cc-sentence-translation"
          />
          <Button variant="ghost" size="sm" onClick={translateSentenceField} data-testid="cc-translate">
            Translate
          </Button>
        </FieldRow>

        <FieldRow
          label="Definitions"
          mappedField={draft.fieldMapping.definitions ?? ''}
          availableFields={availableFields}
          onMapChange={(f) => updateMapping('definitions', f)}
          dataId="cc-definitions"
        >
          <FieldAutoGrowInput
            value={draft.fields.definitions}
            onChange={(v) => updateField('definitions', v)}
            placeholder="Definitions will be imported from your dictionary tool"
            aria-label="Definitions"
            dataId="cc-definitions"
          />
        </FieldRow>

        <FieldRow
          label="Image"
          mappedField={draft.fieldMapping.images ?? ''}
          availableFields={availableFields}
          onMapChange={(f) => updateMapping('images', f)}
          dataId="cc-images"
        >
          <MediaList
            files={draft.fields.images}
            kind="image"
            addLabel="Add image"
            onAdd={() => void addFileFromDisk('images')}
            onRemove={(i) => removeMedia('images', i)}
            onFilesDrop={(files, invalidCount) => addFiles('images', files, invalidCount)}
            onReorder={(from, to) => reorderMedia('images', from, to)}
            addDisabled={capturingMedia}
            dataId="cc-images-list"
          />
        </FieldRow>

        <FieldRow
          label="Sentence audio"
          mappedField={draft.fieldMapping.sentenceAudios ?? ''}
          availableFields={availableFields}
          onMapChange={(f) => updateMapping('sentenceAudios', f)}
          dataId="cc-sentence-audios"
        >
          <MediaList
            files={draft.fields.sentenceAudios}
            kind="audio"
            addLabel="Add sentence audio"
            onAdd={() => void addFileFromDisk('sentenceAudios')}
            onRemove={(i) => removeMedia('sentenceAudios', i)}
            onFilesDrop={(files, invalidCount) => addFiles('sentenceAudios', files, invalidCount)}
            onReorder={(from, to) => reorderMedia('sentenceAudios', from, to)}
            addDisabled={capturingMedia}
            dataId="cc-sentence-audios-list"
          />
        </FieldRow>

        <FieldRow
          label="Word audio"
          mappedField={draft.fieldMapping.wordAudios ?? ''}
          availableFields={availableFields}
          onMapChange={(f) => updateMapping('wordAudios', f)}
          dataId="cc-word-audios"
        >
          <MediaList
            files={draft.fields.wordAudios}
            kind="audio"
            addLabel="Add word audio"
            onAdd={() => void addFileFromDisk('wordAudios')}
            onRemove={(i) => removeMedia('wordAudios', i)}
            onFilesDrop={(files, invalidCount) => addFiles('wordAudios', files, invalidCount)}
            onReorder={(from, to) => reorderMedia('wordAudios', from, to)}
            addDisabled={capturingMedia}
            dataId="cc-word-audios-list"
          />
        </FieldRow>

        <FieldRow
          label="Note"
          mappedField={draft.fieldMapping.note ?? ''}
          availableFields={availableFields}
          onMapChange={(f) => updateMapping('note', f)}
          dataId="cc-note"
        >
          <FieldAutoGrowInput
            value={draft.fields.note}
            onChange={(v) => updateField('note', v)}
            placeholder="Add a personal note or context for this card"
            aria-label="Note"
            dataId="cc-note"
          />
        </FieldRow>

        <FieldRow
          label="More example"
          mappedField={draft.fieldMapping.moreExample ?? ''}
          availableFields={availableFields}
          onMapChange={(f) => updateMapping('moreExample', f)}
          dataId="cc-more-example"
        >
          <FieldAutoGrowInput
            value={draft.fields.moreExample}
            onChange={(v) => updateField('moreExample', v)}
            placeholder="Additional example sentences for context"
            aria-label="More example"
            dataId="cc-more-example"
          />
        </FieldRow>

        <FieldRow
          label="Tags"
          dataId="cc-tags"
        >
          <FieldAutoGrowInput
            value={draft.tags}
            onChange={(v) => updateDraft({ tags: v })}
            aria-label="Tags"
            dataId="cc-tags"
          />
        </FieldRow>
      </div>

      {/* Footer */}
      <div className={styles['cc-dialog__footer']}>
        <div className={styles['cc-dialog__footer-mode']}>
          <label className={styles['cc-dialog__field-label']}>Update mode</label>
          <Select
            value={draft.mediaUpdateMode}
            options={[
              { value: 'overwrite', label: 'Overwrite' },
              { value: 'append', label: 'Append' },
              { value: 'skip', label: 'Skip' },
            ]}
            onChange={(m) => updateDraft({ mediaUpdateMode: m as 'overwrite' | 'append' | 'skip' })}
            aria-label="Update mode"
            data-testid="cc-update-mode"
          />
        </div>
        <div className={styles['cc-dialog__footer-actions']}>
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => submit('add')}
            disabled={submitting}
            data-testid="cc-add"
          >
            Add
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => submit('update')}
            disabled={submitting || recentNoteId === null}
            data-testid="cc-update"
          >
            Update
          </Button>
        </div>
      </div>
    </div>
    {hasQueue && queueSidebarOpen && <QueueSidebar state={state} />}
    </div>
  );
}
