import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Heading, Label, Select, Separator, Text, Textarea } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import { useSrsStudy } from '@/features/srs/ui/SrsStudyProvider';
import { ensureFirstRun } from '@/features/srs/services/firstRunService';
import { getDecksByCollection } from '@/features/srs/repositories/deckRepository';
import { getReviewEventsByCard } from '@/features/srs/repositories/reviewEventRepository';
import { putAudioAsset } from '@/features/srs/repositories/audioAssetRepository';
import { putImageAsset } from '@/features/srs/repositories/imageAssetRepository';
import { audioAssetId, imageAssetId } from '@/features/srs/lib/helpers';
import type { SrsDeck, SrsField, SrsFieldValue, SrsReviewRecord } from '@/entities/srs/types';
import { componentLabel } from './srsLabels';
import { HighlightedSentence, playAudio, useImageBlobUrl } from './srsCardShared';
import styles from './SrsEditCardPanel.module.css';
import cardStyles from './SrsReviewCard.module.css';

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

interface AssetRowProps {
  readonly field: SrsField;
  readonly value: SrsFieldValue | undefined;
  readonly previewUrl?: string;
  readonly onPlay?: () => void;
  readonly onPick: (file: File) => void;
  readonly onRemove: () => void;
}

function AssetRow({ field, value, previewUrl, onPlay, onPick, onRemove }: AssetRowProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const accept = field.type === 'image' ? 'image/*' : 'audio/*';
  return (
    <Box className={styles.assetRow}>
      {field.type === 'image' && previewUrl && (
        <img src={previewUrl} alt={field.name} className={styles.assetImage} />
      )}
      {field.type === 'audio' && value && (
        <Button shape="circle" size="sm" variant="ghost" onClick={onPlay} aria-label={t('srs.edit.playAudio')} className={cardStyles.audioButton}>
          <Icon name="play" />
        </Button>
      )}
      {value && <Text className={styles.assetName}>{value.value}</Text>}
      <Box className={styles.assetActions}>
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          <Icon name="plus" /> {t('srs.edit.add')}
        </Button>
        {value && (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            {t('srs.edit.remove')}
          </Button>
        )}
      </Box>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className={styles.fileInput}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = '';
        }}
      />
    </Box>
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
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, SrsFieldValue | undefined>>({});
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [events, setEvents] = useState<readonly SrsReviewRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const note = session?.note;
  const notetype = session?.notetype;
  const card = session?.card;

  useEffect(() => {
    if (!note) return;
    const initialTexts: Record<string, string> = {};
    for (const field of notetype?.fields ?? []) {
      initialTexts[field.id] = toEditText(note.fields[field.id]);
    }
    setTexts(initialTexts);
    setFieldDrafts({ ...note.fields });
    setDeckId(note.deckId);
  }, [note, notetype]);

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

  useEffect(() => {
    return () => {
      for (const url of Object.values(previewUrls)) URL.revokeObjectURL(url);
    };
  }, [previewUrls]);

  const sentenceValue = fieldDrafts.sentence;
  const imageField = notetype?.fields.find((f) => f.type === 'image');
  const storedImage = imageField ? imageCache.get(imageAssetId(note?.id ?? '', imageField.id)) : undefined;
  const storedImageUrl = useImageBlobUrl(storedImage);

  const deckOptions = useMemo(
    () => decks.map((d) => ({ value: d.id, label: d.name })),
    [decks],
  );

  if (!session || !note || !notetype || !card) return null;

  function previewFor(field: SrsField): string | undefined {
    const pending = pendingFiles[field.id];
    if (pending) {
      if (!previewUrls[field.id]) {
        const url = URL.createObjectURL(pending);
        setPreviewUrls((prev) => ({ ...prev, [field.id]: url }));
        return url;
      }
      return previewUrls[field.id];
    }
    if (field.type === 'image') return storedImageUrl;
    return undefined;
  }

  function playField(field: SrsField): void {
    const pending = pendingFiles[field.id];
    if (pending) {
      const url = previewFor(field);
      if (url) void new Audio(url).play().catch(() => {});
      return;
    }
    const value = fieldDrafts[field.id];
    if (value?.kind !== 'audio' || !note) return;
    const asset = audioCache.get(audioAssetId(note.id, field.id, value.source));
    if (asset) playAudio(asset);
  }

  function pickFile(field: SrsField, file: File): void {
    setPendingFiles((prev) => ({ ...prev, [field.id]: file }));
    const draft: SrsFieldValue = field.type === 'image'
      ? { kind: 'image', value: file.name }
      : { kind: 'audio', value: file.name, source: 'local' };
    setFieldDrafts((prev) => ({ ...prev, [field.id]: draft }));
  }

  function removeAsset(field: SrsField): void {
    setPendingFiles((prev) => {
      const next = { ...prev };
      delete next[field.id];
      return next;
    });
    setFieldDrafts((prev) => {
      const next = { ...prev };
      delete next[field.id];
      return next;
    });
  }

  async function handleSave(): Promise<void> {
    if (!note || !notetype) return;
    setSaving(true);
    setError(null);
    try {
      const fields: Record<string, SrsFieldValue> = {};
      for (const field of notetype.fields) {
        if (field.type === 'audio' || field.type === 'image') {
          const draft = fieldDrafts[field.id];
          if (draft) fields[field.id] = draft;
          const file = pendingFiles[field.id];
          if (file && note) {
            const bytes = await file.arrayBuffer();
            if (field.type === 'audio') {
              await putAudioAsset({
                id: audioAssetId(note.id, field.id, 'local'),
                noteId: note.id,
                fieldId: field.id,
                source: 'local',
                mimeType: file.type || 'audio/mpeg',
                bytes,
                size: bytes.byteLength,
                lastAccessed: Date.now(),
                createdAt: Date.now(),
              });
            } else {
              await putImageAsset({
                id: imageAssetId(note.id, field.id),
                noteId: note.id,
                fieldId: field.id,
                mimeType: file.type || 'image/png',
                bytes,
                size: bytes.byteLength,
                lastAccessed: Date.now(),
                createdAt: Date.now(),
              });
            }
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
        <Icon name="settings" className={styles.headerIcon} />
        <Heading level={2} className={styles.title}>{t('srs.edit.title')}</Heading>
        <Icon name="wrench" className={styles.headerIcon} />
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
        {sentenceValue?.kind === 'text' && (
          <HighlightedSentence sentence={sentenceValue.value} target={note.targetWord} />
        )}
      </Box>

      {notetype.fields.map((field) => (
        <Box key={field.id} className={styles.fieldRow}>
          <Label className={styles.fieldLabel}>{field.name}</Label>
          {field.type === 'audio' || field.type === 'image' ? (
            <AssetRow
              field={field}
              value={fieldDrafts[field.id]}
              previewUrl={previewFor(field)}
              onPlay={() => { playField(field); }}
              onPick={(file) => { pickFile(field, file); }}
              onRemove={() => { removeAsset(field); }}
            />
          ) : (
            <Textarea
              value={texts[field.id] ?? ''}
              onChange={(e) => { setTexts((prev) => ({ ...prev, [field.id]: e.target.value })); }}
              rows={field.type === 'list' ? 3 : 2}
            />
          )}
        </Box>
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
