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
import type { SrsAudioAsset, SrsDeck, SrsImageAsset, SrsReviewRecord } from '@/entities/srs/types';
import { audioAssetId, imageAssetId } from '@/features/srs/lib/helpers';
import { componentLabelById, variantLabel } from '@/features/srs/ui/srsLabels';
import { persistNoteFields, storedMedia, toEditText, toFieldValue, NoteMediaField, orderedEditFields } from './srsNoteEditorShared';
import { lookupDictionaryResources } from '@/features/cardCreator/service/dictionaryGenerate';
import { translateSentence } from '@/features/cardCreator/media/translation';
import { fetchMediaList } from '@/features/cardCreator/state/prefillMerge';
import { mediaUrlKeyMap, type MediaListKind } from '@/features/cardCreator/state/mediaListKinds';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { getActiveProfileSettings } from '@/entities/settings/lib/profileResolution';
import type { CardCreatorPrefill } from '@/features/cardCreator/types';
import type { SrsField } from '@/entities/srs/types';
import styles from './SrsEditCardPanel.module.css';

type GenerateKind = 'definitions' | 'note' | 'moreExample' | 'translation' | MediaListKind;

function generateKind(field: SrsField): GenerateKind | null {
  if (field.type === 'audio') return field.id === 'sentAudio' ? 'sentenceAudios' : 'wordAudios';
  if (field.type === 'image') return 'images';
  if (field.type === 'translation') return 'translation';
  if (field.id === 'def') return 'definitions';
  if (field.id === 'notes') return 'note';
  if (field.id === 'examples') return 'moreExample';
  return null;
}

function formatEventMeta(events: readonly SrsReviewRecord[], judgment: 'forget' | 'remember'): string {
  const last = [...events].reverse().find((e) => e.judgment === judgment);
  if (!last) return t('srs.edit.never');
  return `${componentLabelById(last.componentType)} ${new Date(last.answeredAt).toLocaleDateString()}`;
}

export function SrsEditCardPanel({ onClose, masked = false, onReveal, embedded = false }: {
  readonly onClose: () => void;
  readonly masked?: boolean;
  readonly onReveal?: () => void;
  readonly embedded?: boolean;
}): React.JSX.Element | null {
  const {
    session,
    audioCache,
    imageCache,
    updateCurrentNote,
    previewCurrentNote,
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
  const [generating, setGenerating] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const note = session?.note;
  const notetype = session?.notetype;
  const card = session?.card;
  const initializedNoteId = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const langsRef = useRef<{ target: string; native: string } | null>(null);
  const dictSourceRef = useRef<{ key: string; source: CardCreatorPrefill | null } | null>(null);
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
      dictSourceRef.current = null;
      setNotice(null);
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

  useEffect(() => () => {
    if (dirtyRef.current) void persist();
  }, [persist]);

  useEffect(() => {
    if (!note || !notetype || initializedNoteId.current !== note.id) return;
    const fields = { ...note.fields };
    const audioAssets: SrsAudioAsset[] = [];
    const imageAssets: SrsImageAsset[] = [];
    for (const field of notetype.fields) {
      if (field.id === 'ipa') { delete fields[field.id]; continue; }
      if (field.type === 'audio' || field.type === 'image') {
        const files = media[field.id] ?? [];
        if (files.length === 0) {
          if (removedMedia.has(field.id)) delete fields[field.id];
          continue;
        }
        const existing = note.fields[field.id];
        const source = field.type === 'audio' && existing?.kind === 'audio' ? existing.source : 'local';
        const items: string[] = [];
        files.forEach((f, i) => {
          items.push(f.filename);
          const base = {
            noteId: note.id,
            fieldId: field.id,
            index: i || undefined,
            mimeType: f.mimeType,
            bytes: f.data,
            size: f.data.byteLength,
            lastAccessed: Date.now(),
            createdAt: Date.now(),
          };
          if (field.type === 'audio') {
            audioAssets.push({ ...base, id: audioAssetId(note.id, field.id, source, i), source });
          } else {
            imageAssets.push({ ...base, id: imageAssetId(note.id, field.id, i) });
          }
        });
        fields[field.id] = field.type === 'audio'
          ? { kind: 'audio', value: items, source }
          : { kind: 'image', value: items };
        continue;
      }
      const value = toFieldValue(field, texts[field.id] ?? '');
      if (value) fields[field.id] = value;
      else delete fields[field.id];
    }
    const targetWord = (texts[notetype.targetFieldId] ?? note.targetWord).trim() || note.targetWord;
    if (targetWord === note.targetWord && JSON.stringify(fields) === JSON.stringify(note.fields)) return;
    previewCurrentNote({ ...note, targetWord, fields }, { audio: audioAssets, image: imageAssets });
  }, [texts, media, removedMedia, note, notetype, previewCurrentNote]);

  function markDirty(): void {
    dirtyRef.current = true;
  }

  async function resolveLangs(): Promise<{ target: string; native: string }> {
    if (!langsRef.current) {
      const profile = getActiveProfileSettings(await loadSettings());
      langsRef.current = {
        target: profile?.resourceLangCode ?? 'en',
        native: profile?.native ?? 'en',
      };
    }
    return langsRef.current;
  }

  async function resolveSource(): Promise<CardCreatorPrefill | null> {
    const s = stateRef.current;
    const term = (s.texts[notetype?.targetFieldId ?? ''] ?? note?.targetWord ?? '').trim();
    if (!term) return null;
    const sentence = (s.texts.sentence ?? '').trim();
    const key = `${note?.id}|${term}|${sentence}`;
    if (dictSourceRef.current?.key === key) return dictSourceRef.current.source;
    const { target } = await resolveLangs();
    const source = await lookupDictionaryResources(term, target, sentence);
    dictSourceRef.current = { key, source };
    return source;
  }

  async function runGenerate(field: SrsField, kind: GenerateKind): Promise<void> {
    const label = field.name;
    const s = stateRef.current;
    if (kind === 'translation') {
      if ((s.texts[field.id] ?? '').trim()) { setNotice(t('cardCreator.toast.generateField.alreadyFilled', [label])); return; }
      const sentence = (s.texts.sentence ?? '').trim();
      if (!sentence) { setNotice(t('cardCreator.toast.generateField.noSource', [label])); return; }
      const { target, native } = await resolveLangs();
      const translated = await translateSentence(sentence, target, native);
      if (translated) {
        markDirty();
        setTexts((prev) => ({ ...prev, [field.id]: translated }));
        setNotice(t('cardCreator.toast.generateField.success', [label]));
      } else {
        setNotice(t('cardCreator.toast.generateField.failed', [label]));
      }
      return;
    }
    if (kind === 'wordAudios' || kind === 'sentenceAudios' || kind === 'images') {
      if ((s.media[field.id] ?? []).length > 0) { setNotice(t('cardCreator.toast.generateField.alreadyFilled', [label])); return; }
      const source = await resolveSource();
      const urls = source?.[mediaUrlKeyMap[kind]] ?? [];
      if (urls.length === 0) { setNotice(t('cardCreator.toast.generateField.noSource', [label])); return; }
      const fetched = await fetchMediaList(urls, kind, setNotice);
      if (fetched.length > 0) {
        markDirty();
        setMedia((prev) => ({ ...prev, [field.id]: [...(prev[field.id] ?? []), ...fetched] }));
        setNotice(t('cardCreator.toast.generateField.success', [label]));
      } else {
        setNotice(t('cardCreator.toast.generateField.failed', [label]));
      }
      return;
    }
    if ((s.texts[field.id] ?? '').trim()) { setNotice(t('cardCreator.toast.generateField.alreadyFilled', [label])); return; }
    const source = await resolveSource();
    const value = source?.[kind]?.trim() ?? '';
    if (value) {
      markDirty();
      setTexts((prev) => ({ ...prev, [field.id]: value }));
      setNotice(t('cardCreator.toast.generateField.success', [label]));
    } else {
      setNotice(t('cardCreator.toast.generateField.noSource', [label]));
    }
  }

  async function generateField(field: SrsField): Promise<void> {
    const kind = generateKind(field);
    if (!kind || generating) return;
    setGenerating(field.id);
    setNotice(null);
    try {
      await runGenerate(field, kind);
    } finally {
      setGenerating(null);
    }
  }

  async function generateAll(): Promise<void> {
    if (generating || !notetype) return;
    setGenerating('all');
    setNotice(null);
    try {
      const s = stateRef.current;
      const term = (s.texts[notetype.targetFieldId] ?? note?.targetWord ?? '').trim();
      if (!term) { setNotice(t('cardCreator.toast.generate.noTarget')); return; }
      let filled = false;
      for (const field of orderedEditFields(notetype.fields)) {
        const kind = generateKind(field);
        if (!kind) continue;
        if (kind === 'translation' || kind === 'definitions' || kind === 'note' || kind === 'moreExample') {
          if ((stateRef.current.texts[field.id] ?? '').trim()) continue;
        } else if ((stateRef.current.media[field.id] ?? []).length > 0) continue;
        await runGenerate(field, kind);
        if ((stateRef.current.texts[field.id] ?? '').trim() || (stateRef.current.media[field.id] ?? []).length > 0) filled = true;
      }
      setNotice(t(filled ? 'cardCreator.toast.generate.success' : 'cardCreator.toast.generate.empty'));
    } finally {
      setGenerating(null);
    }
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
    <Box className={embedded ? `${styles.panel} ${styles.embedded}` : styles.panel}>
      <Box className={styles.header}>
        <Button
          variant="ghost"
          size="sm"
          shape="circle"
          onClick={handleClose}
          aria-label={t('ui.back')}
          className={styles.closeButton}
        >
          <Icon name="chevronLeft" size="sm" />
        </Button>
        <Heading level={2} className={styles.title}>{t('srs.edit.title')}</Heading>
        {!masked && (
          <Button
            variant="ghost"
            size="sm"
            shape="circle"
            onClick={() => { void generateAll(); }}
            disabled={generating !== null}
            aria-label={t('cardCreator.action.generateAll')}
            title={t('cardCreator.action.generateAll')}
            className={styles.generateAll}
            data-cell-id="srs-edit-generate-all"
          >
            <Icon name="zap" size="sm" color="primary" />
          </Button>
        )}
      </Box>

      {masked ? (
        <Box className={styles.masked}>
          <Icon name="eyeOff" size="lg" color="secondary" />
          <Text className={styles.maskedTitle}>{t('srs.edit.maskedTitle')}</Text>
          <Text className={styles.maskedHint}>{t('srs.edit.maskedHint')}</Text>
          {onReveal && (
            <Button variant="primarySubtle" size="sm" onClick={onReveal}>
              {t('srs.edit.reveal')}
            </Button>
          )}
        </Box>
      ) : (
      <>

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

      {orderedEditFields(notetype.fields).map((field) => (
        <FieldRow
          key={field.id}
          label={field.name}
          dataId={`srs-edit-${field.id}`}
          trailing={generateKind(field) ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => { void generateField(field); }}
              disabled={generating !== null}
              aria-label={t('cardCreator.action.generateFor', [field.name])}
              title={t('cardCreator.action.generateFor', [field.name])}
              className={styles.generateBtn}
              data-cell-id={`srs-edit-${field.id}-generate`}
            >
              <Icon name="zap" size="xs" color="primary" />
            </Button>
          ) : undefined}
        >
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
            if (session && window.confirm(t('srs.review.confirmResetComponent', [variantLabel(session.variant)]))) {
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

      {notice && <Text className={styles.notice}>{notice}</Text>}
      {error && <Text className={styles.error}>{error}</Text>}

      </>
      )}

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
