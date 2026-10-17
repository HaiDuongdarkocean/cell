import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, ConfirmDialog, Heading, Icon, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { useSrsStudy } from '@/features/srs/ui/SrsStudyProvider';
import { ensureFirstRun } from '@/features/srs/services/firstRunService';
import { getDecksByCollection } from '@/features/srs/repositories/deckRepository';
import { getAudioAssetsByNote } from '@/features/srs/repositories/audioAssetRepository';
import { getImageAssetsByNote } from '@/features/srs/repositories/imageAssetRepository';
import { getReviewEventsByCard } from '@/features/srs/repositories/reviewEventRepository';
import { NoteFieldsEditor, GenerateAllButton, DestinationSelects, type NoteEditorField } from '@/features/cardCreator/ui/NoteFieldsEditor';
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
import { getActiveProfileSettings, resolveResourceLangCode } from '@/entities/settings/lib/profileResolution';
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
  const [generating, setGenerating] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const note = session?.note;
  const notetype = session?.notetype;
  const card = session?.card;
  const initializedNoteId = useRef<string | null>(null);
  const dataVersion = useRef(0);
  const persistedVersion = useRef(0);
  const lastInputs = useRef<{ texts: Record<string, string>; media: Record<string, MediaFile[]>; tags: string; deckId: string; removedMedia: ReadonlySet<string> } | null>(null);
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
      const emptyMedia = new Set<string>();
      setTexts(initialTexts);
      setMedia(initialMedia);
      setRemovedMedia(emptyMedia);
      const joinedTags = (note.tags ?? []).join(' ');
      setTags(joinedTags);
      setDeckId(note.deckId);
      lastInputs.current = { texts: initialTexts, media: initialMedia, tags: joinedTags, deckId: note.deckId, removedMedia: emptyMedia };
      initializedNoteId.current = note.id;
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

  const fieldById = useMemo(
    () => new Map((notetype?.fields ?? []).map((f) => [f.id, f])),
    [notetype?.fields],
  );

  const editorFields = useMemo<NoteEditorField[]>(
    () => orderedEditFields(notetype?.fields ?? []).map((field) => ({
      id: field.id,
      label: field.name,
      kind: field.type === 'audio' ? 'audio' : field.type === 'image' ? 'image' : 'text',
      pastable: field.id === notetype?.targetFieldId || field.id === 'sentence',
      generatable: generateKind(field) !== null,
    })),
    [notetype?.fields, notetype?.targetFieldId],
  );

  const persist = useCallback(async () => {
    if (!note || !notetype || initializedNoteId.current !== note.id) return;
    const s = stateRef.current;
    const version = dataVersion.current;
    try {
      const { targetWord, fields } = await persistNoteFields(notetype, note, s.texts, s.media, s.removedMedia);
      await updateCurrentNote({ ...note, targetWord, fields, tags: splitTags(s.tags) }, s.deckId);
      persistedVersion.current = version;
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [note, notetype, updateCurrentNote]);

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

  useEffect(() => () => {
    if (dataVersion.current !== persistedVersion.current) void persist();
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
    const targetWord = (texts[notetype.targetFieldId] ?? note.targetWord).trim();
    if (targetWord === note.targetWord && JSON.stringify(fields) === JSON.stringify(note.fields)) return;
    previewCurrentNote({ ...note, targetWord, fields }, { audio: audioAssets, image: imageAssets });
  }, [texts, media, removedMedia, note, notetype, previewCurrentNote]);


  async function resolveLangs(): Promise<{ target: string; native: string }> {
    if (!langsRef.current) {
      const settings = await loadSettings();
      const profile = getActiveProfileSettings(settings);
      langsRef.current = {
        target: resolveResourceLangCode(settings, 'en'),
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
      setTexts((prev) => ({ ...prev, [field.id]: value }));
      setNotice(t('cardCreator.toast.generateField.success', [label]));
    } else {
      setNotice(t('cardCreator.toast.generateField.noSource', [label]));
    }
  }

  async function generateField(field: SrsField): Promise<void> {
    const kind = generateKind(field);
    if (!kind || generating.has('all') || generating.has(field.id)) return;
    setGenerating((prev) => new Set(prev).add(field.id));
    setNotice(null);
    try {
      await runGenerate(field, kind);
    } finally {
      setGenerating((prev) => {
        const next = new Set(prev);
        next.delete(field.id);
        return next;
      });
    }
  }

  async function generateAll(): Promise<void> {
    if (generating.size > 0 || !notetype) return;
    setGenerating(new Set(['all']));
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
      setGenerating(new Set());
    }
  }

  function handleClose(): void {
    if (dataVersion.current !== persistedVersion.current) void persist().finally(onClose);
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
          <GenerateAllButton
            onClick={() => { void generateAll(); }}
            disabled={generating.size > 0}
            className={styles.generateAll}
            dataId="srs-edit-generate-all"
          />
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
        onGenerate={(id) => {
          const field = fieldById.get(id);
          if (field) void generateField(field);
        }}
        generateDisabled={generating.has('all')}
        generatingIds={generating}
        dataIdPrefix="srs-edit"
        tagsValue={tags}
        onTagsChange={(v) => { setTags(v); }}
      />

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
