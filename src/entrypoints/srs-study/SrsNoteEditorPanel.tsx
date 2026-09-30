import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Heading, Label, Select, Separator, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { putNote } from '@/features/srs/repositories/noteRepository';
import { getAudioAssetsByNote } from '@/features/srs/repositories/audioAssetRepository';
import { getImageAssetsByNote } from '@/features/srs/repositories/imageAssetRepository';
import { FieldRow, FieldAutoGrowInput } from '@/features/cardCreator/ui/FieldRow';
import type { MediaFile } from '@/features/cardCreator/media/mediaFile';
import type { SrsAudioAsset, SrsDeck, SrsImageAsset, SrsNote, SrsNotetype } from '@/entities/srs/types';
import { HighlightedSentence } from './srsCardShared';
import { persistNoteFields, storedMedia, toEditText, NoteMediaField } from './srsNoteEditorShared';
import styles from './SrsEditCardPanel.module.css';

export interface SrsNoteEditorPanelProps {
  readonly note: SrsNote;
  readonly notetype: SrsNotetype;
  readonly decks: readonly SrsDeck[];
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

export function SrsNoteEditorPanel({ note, notetype, decks, onClose, onSaved }: SrsNoteEditorPanelProps): React.JSX.Element {
  const [deckId, setDeckId] = useState(note.deckId);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [media, setMedia] = useState<Record<string, MediaFile[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const audioList = await getAudioAssetsByNote(note.id).catch(() => [] as readonly SrsAudioAsset[]);
      const imageList = await getImageAssetsByNote(note.id).catch(() => [] as readonly SrsImageAsset[]);
      const audioMap = new Map(audioList.map((a) => [a.id, a]));
      const imageMap = new Map(imageList.map((i) => [i.id, i]));
      if (!mounted) return;
      const initialTexts: Record<string, string> = {};
      const initialMedia: Record<string, MediaFile[]> = {};
      for (const field of notetype.fields) {
        if (field.type === 'audio' || field.type === 'image') {
          initialMedia[field.id] = storedMedia(field, note, audioMap, imageMap);
        } else {
          initialTexts[field.id] = toEditText(note.fields[field.id]);
        }
      }
      setTexts(initialTexts);
      setMedia(initialMedia);
    })();
    return () => { mounted = false; };
  }, [note, notetype]);

  const sentenceText = texts.sentence ?? toEditText(note.fields.sentence);
  const deckOptions = useMemo(() => decks.map((d) => ({ value: d.id, label: d.name })), [decks]);

  async function handleSave(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const { targetWord, fields } = await persistNoteFields(notetype, note, texts, media);
      await putNote({ ...note, targetWord, fields, deckId });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box className={styles.panel}>
      <Box className={styles.header}>
        <Heading level={2} className={styles.title}>{t('srs.edit.title')}</Heading>
      </Box>

      <Box className={styles.selectRow}>
        <Box className={styles.selectCol}>
          <Label>{t('srs.edit.cardType')}</Label>
          <Select value={notetype.id} options={[{ value: notetype.id, label: notetype.name }]} disabled />
        </Box>
        <Box className={styles.selectCol}>
          <Label>{t('srs.edit.deck')}</Label>
          <Select value={deckId} options={deckOptions} onChange={setDeckId} />
        </Box>
      </Box>

      <Box className={styles.preview}>
        <Text className={styles.previewWord}>{note.targetWord}</Text>
        {sentenceText && (
          <HighlightedSentence sentence={sentenceText} target={note.targetWord} />
        )}
      </Box>

      <Heading level={3} size={4} className={styles.sectionTitle}>{t('cardCreator.section.fields')}</Heading>

      {notetype.fields.map((field) => (
        <FieldRow key={field.id} label={field.name} dataId={`srs-edit-${field.id}`}>
          {field.type === 'audio' || field.type === 'image' ? (
            <NoteMediaField
              field={field}
              files={media[field.id] ?? []}
              onChange={(files) => { setMedia((prev) => ({ ...prev, [field.id]: files })); }}
            />
          ) : (
            <FieldAutoGrowInput
              value={texts[field.id] ?? ''}
              onChange={(v) => { setTexts((prev) => ({ ...prev, [field.id]: v })); }}
              aria-label={field.name}
              dataId={`srs-edit-${field.id}`}
            />
          )}
        </FieldRow>
      ))}

      {error && <Text className={styles.error}>{error}</Text>}

      <Separator />
      <Box className={styles.saveBar}>
        <Button variant="primary" fullWidth onClick={() => { void handleSave(); }} disabled={saving}>
          {saving ? t('srs.action.loading') : t('srs.edit.save')}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {t('srs.edit.cancel')}
        </Button>
      </Box>
    </Box>
  );
}
