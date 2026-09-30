import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Heading, Label, Select, Separator, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { useSrsStudy } from '@/features/srs/ui/SrsStudyProvider';
import { ensureFirstRun } from '@/features/srs/services/firstRunService';
import { getDecksByCollection } from '@/features/srs/repositories/deckRepository';
import { getReviewEventsByCard } from '@/features/srs/repositories/reviewEventRepository';
import { putAudioAsset } from '@/features/srs/repositories/audioAssetRepository';
import { putImageAsset } from '@/features/srs/repositories/imageAssetRepository';
import { audioAssetId, imageAssetId } from '@/features/srs/lib/helpers';
import { FieldRow, FieldAutoGrowInput } from '@/features/cardCreator/ui/FieldRow';
import { MediaList } from '@/features/cardCreator/ui/MediaList';
import type { MediaFile } from '@/features/cardCreator/media/mediaFile';
import type { SrsAudioAsset, SrsDeck, SrsField, SrsFieldValue, SrsImageAsset, SrsNote, SrsReviewRecord } from '@/entities/srs/types';
import { componentLabel } from './srsLabels';
import { HighlightedSentence } from './srsCardShared';
import styles from './SrsEditCardPanel.module.css';

function toEditText(value: SrsFieldValue | undefined): string {
  if (!value) return '';
  if (value.kind === 'list') return value.value.join('\n');
  if (value.kind === 'audio' || value.kind === 'image') return '';
  return value.value;
}

function toFieldValue(field: SrsField, text: string): SrsFieldValue | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (field.type === 'list') {
    return { kind: 'list', value: trimmed.split('\n').map((l) => l.trim()).filter(Boolean) };
  }
  if (field.type === 'translation') return { kind: 'translation', value: trimmed };
  if (field.type === 'context') return { kind: 'context', value: trimmed };
  return { kind: 'text', value: trimmed };
}

function formatEventMeta(events: readonly SrsReviewRecord[], judgment: 'forget' | 'remember'): string {
  const last = [...events].reverse().find((e) => e.judgment === judgment);
  if (!last) return t('srs.edit.never');
  return `${componentLabel(last.componentType)} ${new Date(last.answeredAt).toLocaleDateString()}`;
}

function storedMedia(
  field: SrsField,
  note: SrsNote,
  audioCache: ReadonlyMap<string, SrsAudioAsset>,
  imageCache: ReadonlyMap<string, SrsImageAsset>,
): MediaFile[] {
  const value = note.fields[field.id];
  if (!value) return [];
  if (field.type === 'audio' && value.kind === 'audio') {
    const asset = audioCache.get(audioAssetId(note.id, field.id, value.source));
    if (asset) {
      return [{ kind: 'audio', filename: value.value, mimeType: asset.mimeType, data: asset.bytes }];
    }
  }
  if (field.type === 'image' && value.kind === 'image') {
    const asset = imageCache.get(imageAssetId(note.id, field.id));
    if (asset) {
      return [{ kind: 'image', filename: value.value, mimeType: asset.mimeType, data: asset.bytes }];
    }
  }
  return [];
}

async function fileToMedia(file: File, field: SrsField): Promise<MediaFile> {
  return {
    kind: field.type === 'image' ? 'image' : 'audio',
    filename: file.name,
    mimeType: file.type || (field.type === 'image' ? 'image/png' : 'audio/mpeg'),
    data: await file.arrayBuffer(),
  };
}

interface MediaFieldProps {
  readonly field: SrsField;
  readonly files: readonly MediaFile[];
  readonly onChange: (files: MediaFile[]) => void;
}

function MediaField({ field, files, onChange }: MediaFieldProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <MediaList
        files={files}
        kind={field.type === 'image' ? 'image' : 'audio'}
        addLabel={`${t('srs.edit.add')} ${field.name}`}
        onAdd={() => inputRef.current?.click()}
        onRemove={() => { onChange([]); }}
        onFilesDrop={(dropped) => {
          const first = dropped[0];
          if (first) onChange([first]);
        }}
        dataId={`srs-edit-${field.id}`}
      />
      <input
        ref={inputRef}
        type="file"
        accept={field.type === 'image' ? 'image/*' : 'audio/*'}
        className={styles.fileInput}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void fileToMedia(file, field).then((mf) => { onChange([mf]); });
          e.target.value = '';
        }}
      />
    </>
  );
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
  const [events, setEvents] = useState<readonly SrsReviewRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const note = session?.note;
  const notetype = session?.notetype;
  const card = session?.card;

  useEffect(() => {
    if (!note) return;
    const initialTexts: Record<string, string> = {};
    const initialMedia: Record<string, MediaFile[]> = {};
    for (const field of notetype?.fields ?? []) {
      if (field.type === 'audio' || field.type === 'image') {
        initialMedia[field.id] = storedMedia(field, note, audioCache, imageCache);
      } else {
        initialTexts[field.id] = toEditText(note.fields[field.id]);
      }
    }
    setTexts(initialTexts);
    setMedia(initialMedia);
    setDeckId(note.deckId);
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
      const fields: Record<string, SrsFieldValue> = {};
      for (const field of notetype.fields) {
        if (field.type === 'audio' || field.type === 'image') {
          const file = media[field.id]?.[0];
          if (!file) continue;
          if (field.type === 'audio') {
            await putAudioAsset({
              id: audioAssetId(note.id, field.id, 'local'),
              noteId: note.id,
              fieldId: field.id,
              source: 'local',
              mimeType: file.mimeType,
              bytes: file.data,
              size: file.data.byteLength,
              lastAccessed: Date.now(),
              createdAt: Date.now(),
            });
            fields[field.id] = { kind: 'audio', value: file.filename, source: 'local' };
          } else {
            await putImageAsset({
              id: imageAssetId(note.id, field.id),
              noteId: note.id,
              fieldId: field.id,
              mimeType: file.mimeType,
              bytes: file.data,
              size: file.data.byteLength,
              lastAccessed: Date.now(),
              createdAt: Date.now(),
            });
            fields[field.id] = { kind: 'image', value: file.filename };
          }
          continue;
        }
        const value = toFieldValue(field, texts[field.id] ?? '');
        if (value) fields[field.id] = value;
      }
      const targetWord = (texts[notetype.targetFieldId] ?? note.targetWord).trim() || note.targetWord;
      await updateCurrentNote({ ...note, targetWord, fields }, deckId);
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
            <MediaField
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
