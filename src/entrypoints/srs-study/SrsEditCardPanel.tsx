import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Heading, Label, Select, Separator, Text } from '@/shared/ui';
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
import { componentLabel } from './srsLabels';
import { HighlightedSentence } from './srsCardShared';
import { persistNoteFields, storedMedia, toEditText, NoteMediaField } from './srsNoteEditorShared';
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const note = session?.note;
  const notetype = session?.notetype;
  const card = session?.card;

  useEffect(() => {
    if (!note) return;
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

  if (!session || !note || !notetype || !card) return null;

  async function handleSave(): Promise<void> {
    if (!note || !notetype) return;
    setSaving(true);
    setError(null);
    try {
      const { targetWord, fields } = await persistNoteFields(notetype, note, texts, media, removedMedia);
      await updateCurrentNote({ ...note, targetWord, fields, tags: splitTags(tags) }, deckId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteCard(): void {
    if (window.confirm(t('srs.manage.confirmDeleteCard'))) {
      void deleteCurrentCard().then(onClose);
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
              onChange={(files) => {
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
              onChange={(v) => { setTexts((prev) => ({ ...prev, [field.id]: v })); }}
              aria-label={field.name}
              dataId={`srs-edit-${field.id}`}
            />
          )}
        </FieldRow>
      ))}

      <FieldRow label={t('cardCreator.field.tags')} dataId="srs-edit-tags">
        <TagInput
          value={tags}
          onChange={setTags}
          placeholder={t('cardCreator.placeholder.tags')}
          ariaLabel={t('cardCreator.field.tags')}
          dataId="srs-edit-tags"
        />
      </FieldRow>

      <Button variant="destructive" fullWidth onClick={handleDeleteCard} className={styles.deleteButton}>
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
