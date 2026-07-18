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
 */
import type { ReactElement } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/Select';
import { FieldRow, FieldAutoGrowInput } from './FieldRow';
import { MediaList } from './MediaList';
import { PreviewBlock } from './PreviewBlock';
import type { useCardCreatorState } from './useCardCreatorState';
import styles from './CardCreatorDialog.module.css';

interface CardCreatorDialogContentProps {
  state: ReturnType<typeof useCardCreatorState>;
  variant: 'desktop' | 'mobile';
  onCancel: () => void;
}

export function CardCreatorDialogContent({
  state,
  variant,
  onCancel,
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

  const containerClass = variant === 'mobile' ? `${styles.body} ${styles.mobile}` : styles.body;

  // Dropdowns (Note type, Deck) are always enabled — no disable/opacity
  // flash. Options populate instantly when the prefetched AnkiConnect data
  // resolves (typically before the dialog even opens, since media capture
  // takes longer than the prefetch). If the user opens a dropdown before
  // options arrive, the menu is empty until they arrive — no visual
  // "loading" state on the trigger.
  const showNoRecentAlert = loadStatus === 'ready' && recentNoteId === null;

  return (
    <div className={containerClass} data-dataId="card-creator-content">
      {/* Alert: no recent card */}
      {showNoRecentAlert && (
        <div className={styles.alert} role="status" data-dataId="cc-alert-no-recent">
          <Icon name="info" className={styles.alertIcon} />
          <span>No existing card found in this deck. Fill in the fields below to create a new card.</span>
        </div>
      )}
      {/* Alert: load error */}
      {loadStatus === 'error' && (
        <div className={`${styles.alert} ${styles.alertError}`} role="alert" data-dataId="cc-alert-error">
          <Icon name="alertCircle" className={styles.alertIcon} />
          <span>Failed to load from AnkiConnect: {loadError}. Check the URL in Settings → Card Creator.</span>
        </div>
      )}

      {/* Section: Card destination */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Card destination</h3>
        <div className={styles.pairRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Note type</label>
            <Select
              value={draft.noteType}
              options={noteTypes.map((n) => ({ value: n, label: n }))}
              onChange={changeNoteType}
              aria-label="Note type"
              data-dataId="cc-note-type"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Deck</label>
            <Select
              value={draft.deck}
              options={decks.map((d) => ({ value: d, label: d }))}
              onChange={(d) => void changeDeck(d)}
              aria-label="Deck"
              data-dataId="cc-deck"
            />
          </div>
        </div>
      </div>

      {/* Preview block — above Fields section so user sees the card
       * composition before filling in field values. */}
      <PreviewBlock
        targetWord={draft.fields.targetWord}
        sentence={draft.fields.sentence}
        testId="cc-preview"
      />

      {/* Section: Fields */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Fields</h3>

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
          <Button variant="ghost" size="sm" onClick={translateSentenceField} data-dataId="cc-translate">
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
            testId="cc-images-list"
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
            testId="cc-sentence-audios-list"
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
            testId="cc-word-audios-list"
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
      <div className={styles.footer}>
        <div className={styles.footerMode}>
          <label className={styles.fieldLabel}>Update mode</label>
          <Select
            value={draft.mediaUpdateMode}
            options={[
              { value: 'overwrite', label: 'Overwrite' },
              { value: 'append', label: 'Append' },
              { value: 'skip', label: 'Skip' },
            ]}
            onChange={(m) => updateDraft({ mediaUpdateMode: m as 'overwrite' | 'append' | 'skip' })}
            aria-label="Update mode"
            data-dataId="cc-update-mode"
          />
        </div>
        <div className={styles.footerActions}>
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => submit('add')}
            disabled={submitting}
            data-dataId="cc-add"
          >
            Add
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => submit('update')}
            disabled={submitting || recentNoteId === null}
            data-dataId="cc-update"
          >
            Update
          </Button>
        </div>
      </div>
    </div>
  );
}
