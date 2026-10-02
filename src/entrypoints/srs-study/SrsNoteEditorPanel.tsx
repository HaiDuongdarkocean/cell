import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Heading, Icon, Label, Select, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { putNote } from '@/features/srs/repositories/noteRepository';
import { getAudioAssetsByNote } from '@/features/srs/repositories/audioAssetRepository';
import { getImageAssetsByNote } from '@/features/srs/repositories/imageAssetRepository';
import { FieldRow, FieldAutoGrowInput, TagInput } from '@/features/cardCreator/ui/FieldRow';
import { splitTags } from '@/features/cardCreator/service/noteUpdate';
import type { MediaFile } from '@/features/cardCreator/media/mediaFile';
import type { SrsAudioAsset, SrsDeck, SrsImageAsset, SrsNote, SrsNotetype } from '@/entities/srs/types';
import { SentenceText } from '@/features/srs/ui/srsCardShared';
import { persistNoteFields, storedMedia, toEditText, NoteMediaField, orderedEditFields } from './srsNoteEditorShared';
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
  const [removedMedia, setRemovedMedia] = useState<ReadonlySet<string>>(new Set());
  const [tags, setTags] = useState('');
  const [error, setError] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const stateRef = useRef({ texts, media, tags, deckId, removedMedia });
  stateRef.current = { texts, media, tags, deckId, removedMedia };

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
          initialMedia[field.id] = await storedMedia(field, note, audioMap, imageMap);
        } else {
          initialTexts[field.id] = toEditText(note.fields[field.id]);
        }
      }
      if (!mounted) return;
      setTexts(initialTexts);
      setMedia(initialMedia);
      setRemovedMedia(new Set());
      setTags((note.tags ?? []).join(' '));
      dirtyRef.current = false;
    })();
    return () => { mounted = false; };
  }, [note, notetype]);

  const sentenceText = texts.sentence ?? toEditText(note.fields.sentence);
  const deckOptions = useMemo(() => decks.map((d) => ({ value: d.id, label: d.name })), [decks]);

  const persist = useCallback(async () => {
    const s = stateRef.current;
    try {
      const { targetWord, fields } = await persistNoteFields(notetype, note, s.texts, s.media, s.removedMedia);
      await putNote({ ...note, targetWord, fields, deckId: s.deckId, tags: splitTags(s.tags) });
      dirtyRef.current = false;
      setError(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [note, notetype, onSaved]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    const timer = setTimeout(() => { void persist(); }, 600);
    return () => clearTimeout(timer);
  }, [texts, media, tags, deckId, removedMedia, persist]);

  function markDirty(): void {
    dirtyRef.current = true;
  }

  function handleClose(): void {
    if (dirtyRef.current) void persist().finally(onClose);
    else onClose();
  }

  return (
    <Box className={styles.panel}>
      <Box className={styles.header}>
        <Button
          variant="ghost"
          size="sm"
          shape="circle"
          onClick={handleClose}
          aria-label={t('ui.close')}
          className={styles.closeButton}
        >
          <Icon name="x" size="sm" />
        </Button>
        <Heading level={2} className={styles.title}>{t('srs.edit.title')}</Heading>
      </Box>

      <Box className={styles.selectRow}>
        <Box className={styles.selectCol}>
          <Label>{t('srs.edit.cardType')}</Label>
          <Select value={notetype.id} options={[{ value: notetype.id, label: notetype.name }]} disabled />
        </Box>
        <Box className={styles.selectCol}>
          <Label>{t('srs.edit.deck')}</Label>
          <Select value={deckId} options={deckOptions} onChange={(v) => { markDirty(); setDeckId(v); }} />
        </Box>
      </Box>

      <Box className={styles.preview}>
        <Text className={styles.previewWord}>{note.targetWord}</Text>
        {sentenceText && (
          <SentenceText sentence={sentenceText} />
        )}
      </Box>

      {orderedEditFields(notetype.fields).map((field) => (
        <FieldRow key={field.id} label={field.name} dataId={`srs-edit-${field.id}`}>
          {field.type === 'audio' || field.type === 'image' ? (
            <NoteMediaField
              field={field}
              files={media[field.id] ?? []}
              onChange={(files) => {
                markDirty();
                setMedia((prev) => ({ ...prev, [field.id]: files }));
                setRemovedMedia((prev) => {
                  const next = new Set(prev);
                  if (files.length === 0) next.add(field.id); else next.delete(field.id);
                  return next;
                });
              }}
            />
          ) : (
            <FieldAutoGrowInput
              value={texts[field.id] ?? ''}
              onChange={(v) => { markDirty(); setTexts((prev) => ({ ...prev, [field.id]: v })); }}
              aria-label={field.name}
              dataId={`srs-edit-${field.id}`}
            />
          )}
        </FieldRow>
      ))}

      <FieldRow label={t('cardCreator.field.tags')} dataId="srs-edit-tags">
        <TagInput
          value={tags}
          onChange={(v) => { markDirty(); setTags(v); }}
          placeholder={t('cardCreator.placeholder.tags')}
          ariaLabel={t('cardCreator.field.tags')}
          dataId="srs-edit-tags"
        />
      </FieldRow>

      {error && <Text className={styles.error}>{error}</Text>}
    </Box>
  );
}
