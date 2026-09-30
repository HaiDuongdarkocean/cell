import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, ConfirmDialog, Heading, Icon, Label, Select, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { useSrsStudy } from '@/features/srs/ui/SrsStudyProvider';
import { ensureFirstRun } from '@/features/srs/services/firstRunService';
import { getDecksByCollection } from '@/features/srs/repositories/deckRepository';
import { getAudioAssetsByNote } from '@/features/srs/repositories/audioAssetRepository';
import { getImageAssetsByNote } from '@/features/srs/repositories/imageAssetRepository';
import { getReviewEventsByCard } from '@/features/srs/repositories/reviewEventRepository';
import { FieldRow, FieldAutoGrowInput, TagInput } from '@/features/cardCreator/ui/FieldRow';
import { splitTags } from '@/features/cardCreator/service/noteUpdate';
import type { MediaFile } from '@/features/cardCreator/media/mediaFile';
import type { SrsDeck, SrsReviewRecord } from '@/entities/srs/types';
import { componentLabel } from '@/features/srs/ui/srsLabels';
import { HighlightedSentence } from '@/features/srs/ui/srsCardShared';
import { persistNoteFields, storedMedia, toEditText, NoteMediaField, orderedEditFields } from './srsNoteEditorShared';
import styles from './SrsEditCardPanel.module.css';

function formatEventMeta(events: readonly SrsReviewRecord[], judgment: 'forget' | 'remember'): string {
  const last = [...events].reverse().find((e) => e.judgment === judgment);
  if (!last) return t('srs.edit.never');
  return `${componentLabel(last.componentType)} ${new Date(last.answeredAt).toLocaleDateString()}`;
}

export function SrsEditCardPanel({ onClose }: { readonly onClose: () => void }): React.JSX.Element | null {
  const {
    session,
    audioCache,
    imageCache,
    updateCurrentNote,
    deleteCurrentCard,
    resetCurrentComponent,
    resetCurrentCard,
  } = useSrsStudy();

  const [decks, setDecks] = useState<readonly SrsDeck[]>([]);
  const [deckId, setDeckId] = useState(session?.note.deckId ?? '');
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [media, setMedia] = useState<Record<string, MediaFile[]>>({});
  const [removedMedia, setRemovedMedia] = useState<ReadonlySet<string>>(new Set());
  const [tags, setTags] = useState('');
  const [events, setEvents] = useState<readonly SrsReviewRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const note = session?.note;
  const notetype = session?.notetype;
  const card = session?.card;
  const initializedNoteId = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const stateRef = useRef({ texts, media, tags, deckId, removedMedia });
  stateRef.current = { texts, media, tags, deckId, removedMedia };

  useEffect(() => {
    if (!note || initializedNoteId.current === note.id) return;
    let mounted = true;
    void (async () => {
      const audioMap = new Map(audioCache);
      const imageMap = new Map(imageCache);
      for (const asset of await getAudioAssetsByNote(note.id).catch(() => [])) audioMap.set(asset.id, asset);
      for (const asset of await getImageAssetsByNote(note.id).catch(() => [])) imageMap.set(asset.id, asset);
      const initialTexts: Record<string, string> = {};
      const initialMedia: Record<string, MediaFile[]> = {};
      for (const field of notetype?.fields ?? []) {
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
      setDeckId(note.deckId);
      initializedNoteId.current = note.id;
      dirtyRef.current = false;
    })();
    return () => { mounted = false; };
  }, [note, notetype, audioCache, imageCache]);

  useEffect(() => {
    let mounted = true;
    ensureFirstRun()
      .then((r) => getDecksByCollection(r.collectionId))
      .then((list) => { if (mounted) setDecks(list); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!card) return;
    let mounted = true;
    getReviewEventsByCard(card.id)
      .then((list) => { if (mounted) setEvents(list); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [card]);

  const sentenceText = texts.sentence ?? toEditText(note?.fields.sentence);

  const deckOptions = useMemo(
    () => decks.map((d) => ({ value: d.id, label: d.name })),
    [decks],
  );

  const persist = useCallback(async () => {
    if (!note || !notetype || initializedNoteId.current !== note.id) return;
    const s = stateRef.current;
    try {
      const { targetWord, fields } = await persistNoteFields(notetype, note, s.texts, s.media, s.removedMedia);
      await updateCurrentNote({ ...note, targetWord, fields, tags: splitTags(s.tags) }, s.deckId);
      dirtyRef.current = false;
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [note, notetype, updateCurrentNote]);

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

  if (!session || !note || !notetype || !card) return null;

  function handleDeleteCard(): void {
    setConfirmDelete(false);
    void deleteCurrentCard().then(onClose);
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
          <HighlightedSentence sentence={sentenceText} target={note.targetWord} />
        )}
      </Box>

      <Heading level={3} size={4} className={styles.sectionTitle}>{t('cardCreator.section.fields')}</Heading>

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

      <Button variant="destructive" fullWidth onClick={() => { setConfirmDelete(true); }} className={styles.deleteButton}>
        {t('srs.edit.deleteCard')}
      </Button>

      <Box className={styles.resetRow}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (session && window.confirm(t('srs.review.confirmResetComponent', [componentLabel(session.componentType)]))) {
              void resetCurrentComponent();
            }
          }}
        >
          {t('srs.review.resetComponent')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.confirm(t('srs.review.confirmResetCard'))) {
              void resetCurrentCard();
            }
          }}
        >
          {t('srs.review.resetCard')}
        </Button>
      </Box>

      <Box className={styles.meta}>
        <Text className={styles.metaLine}>{t('srs.edit.metaCreated', [new Date(card.createdAt).toLocaleDateString()])}</Text>
        <Text className={styles.metaLine}>{t('srs.edit.metaLastPos', [formatEventMeta(events, 'remember')])}</Text>
        <Text className={styles.metaLine}>{t('srs.edit.metaLastFail', [formatEventMeta(events, 'forget')])}</Text>
      </Box>

      {error && <Text className={styles.error}>{error}</Text>}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('srs.review.deleteCard')}
        description={t('srs.manage.confirmDeleteCard')}
        cancelLabel={t('srs.edit.cancel')}
        confirmLabel={t('srs.manage.delete')}
        onConfirm={handleDeleteCard}
      />
    </Box>
  );
}
