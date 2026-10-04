import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Heading, Icon, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { putNote } from '@/features/srs/repositories/noteRepository';
import { getAudioAssetsByNote } from '@/features/srs/repositories/audioAssetRepository';
import { getImageAssetsByNote } from '@/features/srs/repositories/imageAssetRepository';
import { NoteFieldsEditor, DestinationSelects, type NoteEditorField } from '@/features/cardCreator/ui/NoteFieldsEditor';
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
  const dataVersion = useRef(0);
  const persistedVersion = useRef(0);
  const lastInputs = useRef<{ texts: Record<string, string>; media: Record<string, MediaFile[]>; tags: string; deckId: string; removedMedia: ReadonlySet<string> } | null>(null);
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
      const emptyMedia = new Set<string>();
      const joinedTags = (note.tags ?? []).join(' ');
      setTexts(initialTexts);
      setMedia(initialMedia);
      setRemovedMedia(emptyMedia);
      setTags(joinedTags);
      lastInputs.current = { texts: initialTexts, media: initialMedia, tags: joinedTags, deckId, removedMedia: emptyMedia };
    })();
    return () => { mounted = false; };
  }, [note, notetype]);

  const sentenceText = texts.sentence ?? toEditText(note.fields.sentence);
  const deckOptions = useMemo(() => decks.map((d) => ({ value: d.id, label: d.name })), [decks]);

  const fieldById = useMemo(
    () => new Map(notetype.fields.map((f) => [f.id, f])),
    [notetype.fields],
  );

  const editorFields = useMemo<NoteEditorField[]>(
    () => orderedEditFields(notetype.fields).map((field) => ({
      id: field.id,
      label: field.name,
      kind: field.type === 'audio' ? 'audio' : field.type === 'image' ? 'image' : 'text',
      pastable: field.id === notetype.targetFieldId || field.id === 'sentence',
      generatable: false,
    })),
    [notetype.fields, notetype.targetFieldId],
  );

  const persist = useCallback(async () => {
    const s = stateRef.current;
    const version = dataVersion.current;
    try {
      const { targetWord, fields } = await persistNoteFields(notetype, note, s.texts, s.media, s.removedMedia);
      await putNote({ ...note, targetWord, fields, deckId: s.deckId, tags: splitTags(s.tags) });
      persistedVersion.current = version;
      setError(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [note, notetype, onSaved]);

  useEffect(() => {
    const cur = { texts, media, tags, deckId, removedMedia };
    const last = lastInputs.current;
    if (
      !last ||
      cur.texts !== last.texts ||
      cur.media !== last.media ||
      cur.tags !== last.tags ||
      cur.deckId !== last.deckId ||
      cur.removedMedia !== last.removedMedia
    ) {
      lastInputs.current = cur;
      dataVersion.current += 1;
    }
    if (dataVersion.current === persistedVersion.current) return;
    const timer = setTimeout(() => { void persist(); }, 600);
    return () => clearTimeout(timer);
  }, [texts, media, tags, deckId, removedMedia, persist]);

  function handleClose(): void {
    if (dataVersion.current !== persistedVersion.current) void persist().finally(onClose);
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

      <DestinationSelects
        first={{
          label: t('srs.edit.cardType'),
          value: notetype.id,
          options: [{ value: notetype.id, label: notetype.name }],
          disabled: true,
        }}
        second={{
          label: t('srs.edit.deck'),
          value: deckId,
          options: deckOptions,
          onChange: (v) => { setDeckId(v); },
        }}
      />

      <Box className={styles.preview}>
        <Text className={styles.previewWord}>{note.targetWord}</Text>
        {sentenceText && (
          <SentenceText sentence={sentenceText} />
        )}
      </Box>

      <NoteFieldsEditor
        fields={editorFields}
        getText={(id) => texts[id] ?? ''}
        onTextChange={(id, v) => { setTexts((prev) => ({ ...prev, [id]: v })); }}
        renderMedia={(id) => {
          const field = fieldById.get(id);
          if (!field) return null;
          return (
            <NoteMediaField
              field={field}
              files={media[id] ?? []}
              onChange={(files) => {
                setMedia((prev) => ({ ...prev, [id]: files }));
                setRemovedMedia((prev) => {
                  const next = new Set(prev);
                  if (files.length === 0) next.add(id); else next.delete(id);
                  return next;
                });
              }}
            />
          );
        }}
        dataIdPrefix="srs-edit"
        tagsValue={tags}
        onTagsChange={(v) => { setTags(v); }}
      />

      {error && <Text className={styles.error}>{error}</Text>}
    </Box>
  );
}
