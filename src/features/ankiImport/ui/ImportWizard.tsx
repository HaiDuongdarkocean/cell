import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Badge, Button, Card, Checkbox, Dialog, Heading, Icon, IconButton,
  LabelGroup, SectionHeader, Select, SelectableCard, SettingsRow, Spinner, Text,
  HStack, VStack,
} from '@/shared/ui';
import { t } from '@/shared/i18n';
import type { IconCatalogKey } from '@/shared/icons';
import type { SrsAudioAsset, SrsImageAsset, SrsNote } from '@/entities/srs/types';
import {
  audioAssetId, createDefaultNotetype, imageAssetId, resolveReviewSurface,
  SrsReviewCardBack, SrsReviewCardFront,
} from '@/features/srs';
import { buildDeckPickerRows, resolveHomeDeckId } from '../logic/deckFlatten';
import { buildNoteFields, guessFieldMapping } from '../logic/fieldMapping';
import type {
  FieldMapping, FieldRole, ImportSelection, NormalizedAnkiData, NormalizedAnkiNote, NormalizedAnkiNotetype,
} from '../model/normalized';
import { loadMappingPreset, saveMappingPreset } from '../services/mappingPresets';
import { checkAnkiConnect, readFromApkg, readFromConnect } from '../services/importController';
import styles from './ImportWizard.module.css';

type Step = 'source' | 'scope' | 'mapping';

const STEPS: readonly Step[] = ['source', 'scope', 'mapping'];
const STEP_INDEX: Record<Step, number> = { source: 1, scope: 2, mapping: 3 };

export interface AnkiImportStartPayload {
  readonly data: NormalizedAnkiData;
  readonly selection: ImportSelection;
  readonly mappings: Readonly<Record<string, FieldMapping>>;
}

export interface ImportWizardProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onStart: (payload: AnkiImportStartPayload) => void;
}

export function ImportWizard({ open, onClose, onStart }: ImportWizardProps): React.JSX.Element {
  const [step, setStep] = useState<Step>('source');
  const [data, setData] = useState<NormalizedAnkiData | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectFailed, setConnectFailed] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorSource, setErrorSource] = useState<'connect' | 'file' | 'run'>('file');
  const [noScheduling, setNoScheduling] = useState(false);
  const [deckIds, setDeckIds] = useState<ReadonlySet<string>>(new Set());
  const [ntIds, setNtIds] = useState<ReadonlySet<string>>(new Set());
  const [mappings, setMappings] = useState<Record<string, FieldMapping>>({});
  const [sampleIdx, setSampleIdx] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const reset = useCallback(() => {
    setStep('source');
    setData(null);
    setConnecting(false);
    setConnectFailed(false);
    setParsing(false);
    setError(null);
    setNoScheduling(false);
    setDeckIds(new Set());
    setNtIds(new Set());
    setMappings({});
    setSampleIdx(0);
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const acceptData = useCallback((d: NormalizedAnkiData) => {
    setData(d);
    setNoScheduling(!d.hasScheduling);
    setNtIds(new Set(d.notetypes.filter((x) => !x.isCloze).map((x) => x.id)));
    setStep('scope');
  }, []);

  const tryConnect = useCallback(async () => {
    setConnecting(true);
    setConnectFailed(false);
    setError(null);
    try {
      const ok = await checkAnkiConnect();
      if (!ok) { setConnectFailed(true); return; }
      const d = await readFromConnect();
      acceptData(d);
    } catch (err) {
      setErrorSource('connect');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  }, [acceptData]);

  const pickFile = useCallback(() => fileRef.current?.click(), []);

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setParsing(true);
    setError(null);
    try {
      const d = await readFromApkg(file);
      acceptData(d);
    } catch (err) {
      setErrorSource('file');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [acceptData]);

  const importableNoteIds = useMemo(() => {
    const decksById = new Map((data?.decks ?? []).map((d) => [d.id, d]));
    const ids = new Set<number>();
    for (const c of data?.cards ?? []) {
      if (c.queue === -1) continue;
      const home = resolveHomeDeckId(c, decksById);
      if (home !== null && deckIds.has(home)) ids.add(c.noteId);
    }
    return ids;
  }, [data, deckIds]);

  const selectedNt = useMemo(() => {
    const modelByNote = new Map((data?.notes ?? []).map((n) => [n.id, n.modelId]));
    const used = new Set<string>();
    for (const id of importableNoteIds) {
      const m = modelByNote.get(id);
      if (m) used.add(m);
    }
    return (data?.notetypes ?? []).filter((n) => !n.isCloze && used.has(n.id));
  }, [data, importableNoteIds]);

  const cardCountByNt = useMemo(() => {
    const noteModel = new Map((data?.notes ?? []).map((n) => [n.id, n.modelId]));
    const m = new Map<string, number>();
    for (const c of data?.cards ?? []) {
      if (c.queue === -1 || !importableNoteIds.has(c.noteId)) continue;
      const nt = noteModel.get(c.noteId);
      if (nt) m.set(nt, (m.get(nt) ?? 0) + 1);
    }
    return m;
  }, [data, importableNoteIds]);

  // Seed mappings when entering the mapping step (preset → heuristic).
  useEffect(() => {
    if (step !== 'mapping' || !data) return;
    void (async () => {
      const next: Record<string, FieldMapping> = { ...mappings };
      for (const nt of selectedNt) {
        if (next[nt.id]) continue;
        const samples = data.notes.filter((n) => n.modelId === nt.id).slice(0, 5);
        next[nt.id] = (await loadMappingPreset(nt.name)) ?? guessFieldMapping(nt, samples);
      }
      setMappings(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, data]);

  const startImport = useCallback(() => {
    if (!data) return;
    for (const nt of selectedNt) {
      if (mappings[nt.id]) void saveMappingPreset(nt.name, mappings[nt.id]!);
    }
    onStart({
      data,
      selection: { deckIds, notetypeIds: ntIds },
      mappings,
    });
    onClose();
  }, [data, selectedNt, mappings, deckIds, ntIds, onStart, onClose]);

  const canContinue = useMemo(() => {
    switch (step) {
      case 'scope': return deckIds.size > 0;
      case 'mapping': return selectedNt.length === 0 || selectedNt.every((n) => mappings[n.id]);
      default: return false;
    }
  }, [step, deckIds, selectedNt, mappings]);

  const goNext = useCallback(() => {
    if (step === 'scope') { setSampleIdx(0); setStep('mapping'); }
    else if (step === 'mapping') startImport();
  }, [step, startImport]);

  const goBack = useCallback(() => {
    if (step === 'scope') { setStep('source'); setData(null); }
    else if (step === 'mapping') setStep('scope');
  }, [step]);

  const body = (
    <div className={styles.bodyCol}>
      <StepRail step={step} />
      {step === 'source' && (
        <SourceStep
          connecting={connecting}
          failed={connectFailed}
          parsing={parsing}
          error={error}
          errorSource={errorSource}
          onConnect={() => { void tryConnect(); }}
          onPickFile={pickFile}
        />
      )}
      {step === 'scope' && data && (
        <ScopeStep
          data={data}
          deckIds={deckIds}
          ntIds={ntIds}
          noScheduling={noScheduling}
          onDeckIds={setDeckIds}
        />
      )}
      {step === 'mapping' && data && (
        <MappingStep
          data={data}
          notetypes={selectedNt}
          importableNoteIds={importableNoteIds}
          mappings={mappings}
          sampleIdx={sampleIdx}
          onSampleIdx={setSampleIdx}
          onMapping={(id, m) => setMappings((prev) => ({ ...prev, [id]: m }))}
          ntIds={ntIds}
          onNtIds={setNtIds}
          cardCountByNt={cardCountByNt}
        />
      )}
    </div>
  );

  const footer = step === 'source' ? undefined : (
    <HStack gap="2">
      <Button variant="ghost" onClick={goBack}>{t('ankiImport.action.back')}</Button>
      {step === 'mapping' && (
        <Button variant="ghost" onClick={onClose}>{t('srs.edit.cancel')}</Button>
      )}
      <Button
        variant="primary"
        onClick={goNext}
        disabled={!canContinue}
        leadingIcon={step === 'mapping' ? <Icon name="import" /> : undefined}
      >
        {step === 'mapping' ? t('ankiImport.action.start') : t('ankiImport.action.continue')}
      </Button>
    </HStack>
  );

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".apkg,application/octet-stream"
        style={{ display: 'none' }}
        aria-hidden="true"
        onChange={(e) => { void onFile(e.target.files?.[0]); }}
      />
      <Dialog
        open={open}
        onOpenChange={(o) => { if (!o) onClose(); }}
        title={t('ankiImport.title')}
        titleIcon={<Icon name="import" />}
        description={t('ankiImport.desc')}
        showCloseButton
        size={step === 'mapping' ? 'xl' : 'md'}
        footer={footer}
      >
        {body}
      </Dialog>
    </>
  );
}

function StepRail({ step }: { step: Step }): React.JSX.Element {
  const labels = [
    t('ankiImport.rail.source'), t('ankiImport.rail.scope'), t('ankiImport.rail.fields'),
  ];
  const idx = STEP_INDEX[step];
  return (
    <div className={styles.stepRail}>
      <Text variant="label">{labels[idx - 1]}</Text>
      <div
        className={styles.stepSegments}
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={idx}
        aria-label={`${idx}/${STEPS.length}`}
      >
        {STEPS.map((s, i) => (
          <span key={s} className={i < idx ? styles.segDone : styles.seg} />
        ))}
      </div>
      <Text variant="supporting" color="secondary">{`${idx}/${STEPS.length}`}</Text>
    </div>
  );
}

function SourceStep({
  connecting, failed, parsing, error, errorSource, onConnect, onPickFile,
}: {
  readonly connecting: boolean;
  readonly failed: boolean;
  readonly parsing: boolean;
  readonly error: string | null;
  readonly errorSource: 'connect' | 'file' | 'run';
  readonly onConnect: () => void;
  readonly onPickFile: () => void;
}): React.JSX.Element {
  return (
    <VStack gap="3">
      <div className={styles.sourceGrid}>
        <SelectableCard role="button" aria-label={t('ankiImport.source.liveTitle')} onSelect={() => { if (!connecting && !parsing) onConnect(); }}>
          <div className={styles.sourceCard}>
            <span className={styles.sourceIcon}><Icon name="import" /></span>
            <VStack gap="1">
              <Text variant="label">{t('ankiImport.source.liveTitle')}</Text>
              <Text variant="supporting" color="secondary">{t('ankiImport.source.liveHint')}</Text>
            </VStack>
          </div>
        </SelectableCard>
        <SelectableCard role="button" aria-label={t('ankiImport.source.fileTitle')} onSelect={() => { if (!connecting && !parsing) onPickFile(); }}>
          <div className={styles.sourceCard}>
            <span className={styles.sourceIcon}><Icon name="folderOpen" /></span>
            <VStack gap="1">
              <Text variant="label">{t('ankiImport.source.fileTitle')}</Text>
              <Text variant="supporting" color="secondary">{t('ankiImport.source.fileHint')}</Text>
            </VStack>
          </div>
        </SelectableCard>
      </div>
      {connecting && (
        <HStack gap="2"><Spinner size="sm" /><Text variant="label">{t('ankiImport.source.connecting')}</Text></HStack>
      )}
      {parsing && (
        <HStack gap="2"><Spinner size="sm" /><Text variant="label">{t('ankiImport.source.parsing')}</Text></HStack>
      )}
      {error && <Alert variant="error" icon={<Icon name="info" />} title={t(errorSource === 'connect' ? 'ankiImport.source.readError' : 'ankiImport.source.parseError')} description={error} />}
      {failed && (
        <>
          <Alert
            variant="warning"
            icon={<Icon name="info" />}
            title={t('ankiImport.source.failTitle')}
            description={t('ankiImport.source.failDesc')}
          />
          <div className={styles.checklistBox}>
            <div className={styles.checklistRow}><Badge>1</Badge><Text>{t('ankiImport.source.step1')}</Text></div>
            <div className={styles.checklistRow}><Badge>2</Badge><Text>{t('ankiImport.source.step2')}</Text></div>
            <div className={styles.checklistRow}><Badge>3</Badge><Text>http://localhost:8765</Text></div>
            <Button variant="secondary" size="sm" onClick={onConnect}>{t('ankiImport.source.retry')}</Button>
          </div>
        </>
      )}
    </VStack>
  );
}

function ScopeStep({
  data, deckIds, ntIds, noScheduling, onDeckIds,
}: {
  readonly data: NormalizedAnkiData;
  readonly deckIds: ReadonlySet<string>;
  readonly ntIds: ReadonlySet<string>;
  readonly noScheduling: boolean;
  readonly onDeckIds: (s: ReadonlySet<string>) => void;
}): React.JSX.Element {
  const rows = useMemo(() => buildDeckPickerRows(data), [data]);
  const summary = useMemo(() => {
    const clozeModels = new Set(data.notetypes.filter((n) => n.isCloze).map((n) => n.id));
    const notesById = new Map(data.notes.map((n) => [n.id, n]));
    const decksById = new Map(data.decks.map((d) => [d.id, d]));
    let importable = 0;
    let cloze = 0;
    for (const c of data.cards) {
      if (c.queue === -1) continue;
      const home = resolveHomeDeckId(c, decksById);
      if (home === null || !deckIds.has(home)) continue;
      const note = notesById.get(c.noteId);
      if (!note) continue;
      if (clozeModels.has(note.modelId)) cloze += 1;
      else if (ntIds.has(note.modelId)) importable += 1;
    }
    return { importable, cloze };
  }, [data, deckIds, ntIds]);

  return (
    <VStack gap="3">
      {noScheduling && (
        <Alert variant="warning" icon={<Icon name="info" />} description={t('ankiImport.scope.noScheduling')} />
      )}
      <HStack justify="between">
        <SectionHeader title={t('ankiImport.scope.decks')} />
        <Button variant="ghost" size="sm" onClick={() => onDeckIds(
          deckIds.size === rows.length ? new Set() : new Set(rows.map((r) => r.deck.id)),
        )}>
          {deckIds.size === rows.length ? t('ankiImport.scope.deselectAll') : t('ankiImport.scope.selectAll')}
        </Button>
      </HStack>
      <div className={styles.pickList}>
        {rows.length === 0 && (
          <Text variant="supporting" color="secondary">{t('ankiImport.scope.noDecks')}</Text>
        )}
        {rows.map((r) => (
          <div key={r.deck.id} className={styles.pickRow}>
            <Checkbox
              className={styles.pickControl}
              checked={deckIds.has(r.deck.id)}
              onChange={() => {
                const next = new Set(deckIds);
                if (next.has(r.deck.id)) next.delete(r.deck.id); else next.add(r.deck.id);
                onDeckIds(next);
              }}
              label={(
                <>
                  <span className={styles.pickName}>{r.flatName}</span>
                  <span className={styles.pickCounts}>
                    {r.counts.new > 0 && <Badge variant="success" size="sm">{t('ankiImport.scope.countNew', [r.counts.new])}</Badge>}
                    {r.counts.learning > 0 && <Badge variant="muted" size="sm">{t('ankiImport.scope.countLearning', [r.counts.learning])}</Badge>}
                    {r.counts.review > 0 && <Badge size="sm">{t('ankiImport.scope.countReview', [r.counts.review])}</Badge>}
                    {r.counts.suspended > 0 && <Badge variant="warning" size="sm">{t('ankiImport.scope.countSuspended', [r.counts.suspended])}</Badge>}
                  </span>
                </>
              )}
            />
          </div>
        ))}
      </div>
      <Text variant="supporting" color="secondary">
        {t('ankiImport.scope.summary', [summary.importable])}
        {summary.cloze > 0 ? ` · ${t('ankiImport.scope.clozeSkipped', [summary.cloze])}` : ''}
      </Text>
    </VStack>
  );
}

const SYSTEM_SLOTS: readonly { role: Exclude<FieldRole, 'skip'>; fieldId: string; icon: IconCatalogKey }[] = [
  { role: 'target', fieldId: 'target', icon: 'crosshair' },
  { role: 'sentence', fieldId: 'sentence', icon: 'messageSquare' },
  { role: 'definition', fieldId: 'def', icon: 'bookOpen' },
  { role: 'translation', fieldId: 'translation', icon: 'languages' },
  { role: 'context', fieldId: 'context', icon: 'layoutGrid' },
  { role: 'notes', fieldId: 'notes', icon: 'captions' },
  { role: 'audio', fieldId: 'wordAudio', icon: 'volumeHigh' },
  { role: 'sentenceAudio', fieldId: 'sentAudio', icon: 'audioWave' },
  { role: 'image', fieldId: 'image', icon: 'image' },
];

const PREVIEW_NOTE_ID = 'anki-import-preview';

function previewImageAsset(noteId: string, fieldId: string): SrsImageAsset {
  const bytes = new TextEncoder().encode(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="100%" height="100%" fill="#2a2a2e"/><text x="50%" y="50%" fill="#8a8a90" font-family="sans-serif" font-size="18" text-anchor="middle" dominant-baseline="middle">${t('srs.stimulus.image')}</text></svg>`,
  ).buffer;
  return { id: imageAssetId(noteId, fieldId), noteId, fieldId, mimeType: 'image/svg+xml', bytes, size: bytes.byteLength, lastAccessed: 0, createdAt: 0 };
}

function previewAudioAsset(noteId: string, fieldId: string): SrsAudioAsset {
  return { id: audioAssetId(noteId, fieldId, 'local'), noteId, fieldId, source: 'local', mimeType: 'audio/mpeg', bytes: new ArrayBuffer(0), size: 0, lastAccessed: 0, createdAt: 0 };
}

function MappingStep({
  data, notetypes, importableNoteIds, mappings, sampleIdx, onSampleIdx, onMapping, ntIds, onNtIds, cardCountByNt,
}: {
  readonly data: NormalizedAnkiData;
  readonly notetypes: readonly NormalizedAnkiNotetype[];
  readonly importableNoteIds: ReadonlySet<number>;
  readonly mappings: Readonly<Record<string, FieldMapping>>;
  readonly sampleIdx: number;
  readonly onSampleIdx: (i: number) => void;
  readonly onMapping: (ntId: string, m: FieldMapping) => void;
  readonly ntIds: ReadonlySet<string>;
  readonly onNtIds: (s: ReadonlySet<string>) => void;
  readonly cardCountByNt: ReadonlyMap<string, number>;
}): React.JSX.Element {
  const [flipped, setFlipped] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const defaultNt = useMemo(() => createDefaultNotetype(PREVIEW_NOTE_ID), []);
  const ntById = useMemo(() => new Map(notetypes.map((n) => [n.id, n])), [notetypes]);
  const samples = useMemo(() => {
    const list: NormalizedAnkiNote[] = [];
    for (const n of notetypes) {
      if (!ntIds.has(n.id)) continue;
      for (const note of data.notes.filter((x) => x.modelId === n.id && importableNoteIds.has(x.id)).slice(0, 4)) list.push(note);
    }
    return list;
  }, [notetypes, ntIds, data.notes, importableNoteIds]);
  const sample: NormalizedAnkiNote | undefined = samples[sampleIdx % Math.max(1, samples.length)];
  const nt = sample ? ntById.get(sample.modelId) : undefined;
  const mapping: FieldMapping = useMemo(() => (nt && mappings[nt.id]) ?? {}, [nt, mappings]);

  const preview = useMemo(() => {
    if (!nt || !sample) return null;
    const { fields, mediaRequests } = buildNoteFields(sample, nt, mapping);
    const audioCache = new Map<string, SrsAudioAsset>();
    const imageCache = new Map<string, SrsImageAsset>();
    for (const req of mediaRequests) {
      if (req.kind === 'audio') audioCache.set(audioAssetId(PREVIEW_NOTE_ID, req.fieldId, 'local'), previewAudioAsset(PREVIEW_NOTE_ID, req.fieldId));
      else imageCache.set(imageAssetId(PREVIEW_NOTE_ID, req.fieldId), previewImageAsset(PREVIEW_NOTE_ID, req.fieldId));
    }
    const target = fields.target;
    const note: SrsNote = {
      id: PREVIEW_NOTE_ID,
      notetypeId: defaultNt.id,
      deckId: '',
      targetWord: target?.kind === 'text' && target.value ? target.value : '…',
      fields,
      createdAt: 0,
    };
    const stimulus = resolveReviewSurface(note, defaultNt, 'meaning', audioCache, imageCache)?.stimulus
      ?? { type: 'sentence' as const, payload: {} };
    return { note, stimulus, audioCache, imageCache, mediaRequests };
  }, [nt, sample, mapping, defaultNt]);

  const [liveMedia, setLiveMedia] = useState<{
    audio: Map<string, SrsAudioAsset>;
    image: Map<string, SrsImageAsset>;
  } | null>(null);

  useEffect(() => {
    setLiveMedia(null);
    if (!preview || preview.mediaRequests.length === 0) return;
    let cancelled = false;
    void (async () => {
      const audio = new Map(preview.audioCache);
      const image = new Map(preview.imageCache);
      for (const req of preview.mediaRequests) {
        const r = await data.media.resolve(req.filename).catch(() => null);
        if (!r || cancelled) continue;
        if (req.kind === 'audio') {
          const id = audioAssetId(PREVIEW_NOTE_ID, req.fieldId, 'local');
          audio.set(id, { id, noteId: PREVIEW_NOTE_ID, fieldId: req.fieldId, source: 'local', mimeType: r.mimeType, bytes: r.bytes, size: r.bytes.byteLength, lastAccessed: 0, createdAt: 0 });
        } else {
          const id = imageAssetId(PREVIEW_NOTE_ID, req.fieldId);
          image.set(id, { id, noteId: PREVIEW_NOTE_ID, fieldId: req.fieldId, mimeType: r.mimeType, bytes: r.bytes, size: r.bytes.byteLength, lastAccessed: 0, createdAt: 0 });
        }
      }
      if (!cancelled) setLiveMedia({ audio, image });
    })();
    return () => { cancelled = true; };
  }, [preview, data.media]);

  const audioCache = liveMedia?.audio ?? preview?.audioCache;
  const imageCache = liveMedia?.image ?? preview?.imageCache;

  if (!nt) {
    return <Text variant="supporting">{t('ankiImport.mapping.noneSelected')}</Text>;
  }
  const toggleNtById = (id: string): void => {
    const next = new Set(ntIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onNtIds(next);
  };

  const fieldsForRole = (role: FieldRole): readonly string[] =>
    nt.fields.filter((f) => mapping[f.name] === role).map((f) => f.name);

  const assignRole = (role: FieldRole, fieldName: string): void => {
    const next: FieldMapping = { ...mapping };
    for (const f of nt.fields) if (next[f.name] === role) next[f.name] = 'skip';
    if (fieldName) next[fieldName] = role;
    onMapping(nt.id, next);
  };

  const activeSample = samples.length ? sampleIdx % samples.length : 0;

  return (
    <div className={styles.mapLayout}>
      <section className={styles.settingsCol}>
        <div className={styles.fieldRows}>
          {SYSTEM_SLOTS.map(({ role, fieldId, icon }) => {
            const sources = fieldsForRole(role);
            return (
              <SettingsRow key={fieldId} flush className={styles.fieldRow}>
                <LabelGroup
                  icon={<Icon name={icon} />}
                  label={t(`ankiImport.role.${role}`)}
                  className={styles.fieldLabel}
                />
                <Select
                  size="sm"
                  className={styles.fieldSelect}
                  value={sources[0] ?? ''}
                  options={[
                    { value: '', label: t('ankiImport.role.skip') },
                    ...nt.fields.map((f) => ({ value: f.name, label: f.name })),
                  ]}
                  onChange={(v) => assignRole(role, v)}
                  aria-label={t('ankiImport.mapping.sourceFor', [t(`ankiImport.role.${role}`)])}
                />
              </SettingsRow>
            );
          })}
        </div>
        <button
          type="button"
          className={styles.advRow}
          onClick={() => { setAdvOpen((v) => !v); }}
          aria-expanded={advOpen}
        >
          <Icon name="slidersHorizontal" className={styles.fieldIcon} />
          <span className={styles.advText}>
            <Text variant="label">{t('ankiImport.advanced.title')}</Text>
            <Text variant="supporting" color="secondary">{t('ankiImport.advanced.desc')}</Text>
          </span>
          <Icon name="chevronRight" className={advOpen ? styles.advChevronOpen : styles.advChevron} />
        </button>
        {advOpen && (
          <div className={styles.pickList}>
            {notetypes.map((n) => (
              <div key={n.id} className={styles.pickRow}>
                <Checkbox
                  className={styles.pickControl}
                  checked={ntIds.has(n.id)}
                  onChange={() => toggleNtById(n.id)}
                  label={(
                    <>
                      <span className={styles.pickName}>{n.name}</span>
                      <Text variant="supporting" color="secondary">{t('ankiImport.mapping.cardCount', [cardCountByNt.get(n.id) ?? 0])}</Text>
                    </>
                  )}
                />
              </div>
            ))}
          </div>
        )}
      </section>
      <section className={styles.previewPanel}>
        <Heading level={3} className={styles.sectionTitle}>{t('ankiImport.preview.title')}</Heading>
        <Text variant="supporting" color="secondary">{t('ankiImport.preview.desc')}</Text>
        <div className={styles.previewNav}>
          <div className={styles.dots}>
            {samples.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={i === activeSample ? styles.dotActive : styles.dot}
                aria-label={t('ankiImport.mapping.sample', [i + 1, samples.length])}
                onClick={() => { onSampleIdx(i); setFlipped(false); }}
              />
            ))}
          </div>
          <HStack gap="1">
            <IconButton size="sm" variant="ghost" disabled={sampleIdx === 0} aria-label={t('ankiImport.mapping.prev')} onClick={() => { onSampleIdx(sampleIdx - 1); setFlipped(false); }}>
              <Icon name="chevronLeft" />
            </IconButton>
            <IconButton size="sm" variant="ghost" disabled={activeSample >= samples.length - 1} aria-label={t('ankiImport.mapping.next')} onClick={() => { onSampleIdx(sampleIdx + 1); setFlipped(false); }}>
              <Icon name="chevronRight" />
            </IconButton>
          </HStack>
        </div>
        {preview && audioCache && imageCache && (
          <Card className={styles.previewCardWrap} data-cell-id="anki-preview-card">
            {flipped ? (
              <SrsReviewCardBack
                note={preview.note}
                audioCache={audioCache}
                imageCache={imageCache}
                onFlipBack={() => setFlipped(false)}
              />
            ) : (
              <SrsReviewCardFront
                note={preview.note}
                stimulus={preview.stimulus}
                isSpelling={false}
                typedInput=""
                onTypedInputChange={() => {}}
                inputId="anki-import-preview-input"
                onFlip={() => setFlipped(true)}
                audioCache={audioCache}
                imageCache={imageCache}
              />
            )}
          </Card>
        )}
      </section>
    </div>
  );
}


