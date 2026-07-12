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
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/Select';
import { FieldRow, FieldInput, FieldTextarea } from './FieldRow';
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
    <div className={containerClass} data-testid="card-creator-content">
      {/* Alert: no recent card */}
      {showNoRecentAlert && (
        <div className={styles.alert} role="status" data-testid="cc-alert-no-recent">
          <svg
            className={styles.alertIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <span>No existing card found in this deck. Fill in the fields below to create a new card.</span>
        </div>
      )}
      {/* Alert: load error */}
      {loadStatus === 'error' && (
        <div className={`${styles.alert} ${styles.alertError}`} role="alert" data-testid="cc-alert-error">
          <svg
            className={styles.alertIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
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
              data-testid="cc-note-type"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Deck</label>
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
          testId="cc-target-word"
        >
          <FieldInput
            value={draft.fields.targetWord}
            onChange={(e) => updateField('targetWord', e.target.value)}
            placeholder="Enter the word or phrase to learn"
            aria-label="Target word"
          />
        </FieldRow>

        <FieldRow
          label="Sentence"
          mappedField={draft.fieldMapping.sentence ?? ''}
          availableFields={availableFields}
          onMapChange={(f) => updateMapping('sentence', f)}
          testId="cc-sentence"
        >
          <FieldTextarea
            value={draft.fields.sentence}
            onChange={(e) => updateField('sentence', e.target.value)}
            aria-label="Sentence"
          />
        </FieldRow>

        <FieldRow
          label="Sentence translation"
          mappedField={draft.fieldMapping.sentenceTranslation ?? ''}
          availableFields={availableFields}
          onMapChange={(f) => updateMapping('sentenceTranslation', f)}
          testId="cc-sentence-translation"
        >
          <FieldTextarea
            value={draft.fields.sentenceTranslation}
            onChange={(e) => updateField('sentenceTranslation', e.target.value)}
            aria-label="Sentence translation"
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
          testId="cc-definitions"
        >
          <FieldTextarea
            value={draft.fields.definitions}
            onChange={(e) => updateField('definitions', e.target.value)}
            placeholder="Definitions will be imported from your dictionary tool"
            aria-label="Definitions"
          />
        </FieldRow>

        <FieldRow
          label="Image"
          mappedField={draft.fieldMapping.images ?? ''}
          availableFields={availableFields}
          onMapChange={(f) => updateMapping('images', f)}
          testId="cc-images"
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
          testId="cc-sentence-audios"
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
          testId="cc-word-audios"
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
          testId="cc-note"
        >
          <FieldTextarea
            value={draft.fields.note}
            onChange={(e) => updateField('note', e.target.value)}
            placeholder="Add a personal note or context for this card"
            aria-label="Note"
          />
        </FieldRow>

        <FieldRow
          label="More example"
          mappedField={draft.fieldMapping.moreExample ?? ''}
          availableFields={availableFields}
          onMapChange={(f) => updateMapping('moreExample', f)}
          testId="cc-more-example"
        >
          <FieldTextarea
            value={draft.fields.moreExample}
            onChange={(e) => updateField('moreExample', e.target.value)}
            placeholder="Additional example sentences for context"
            aria-label="More example"
          />
        </FieldRow>

        <FieldRow
          label="Tags"
          testId="cc-tags"
        >
          <FieldInput
            value={draft.tags}
            onChange={(e) => updateDraft({ tags: e.target.value })}
            aria-label="Tags"
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
            data-testid="cc-update-mode"
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
  );
}
