import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Badge, Button, Card, Checkbox, Dialog, Icon, IconButton,
  SectionHeader, Select, SelectableCard, Separator, Spinner, Text,
  HStack, VStack,
} from '@/shared/ui';
import { t } from '@/shared/i18n';
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
  const [activeNtIdx, setActiveNtIdx] = useState(0);
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
    setActiveNtIdx(0);
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
      acceptData(await readFromConnect());
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
      acceptData(await readFromApkg(file));
    } catch (err) {
      setErrorSource('file');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [acceptData]);

  const selectedNt = useMemo(() => {
    const withNotes = new Set((data?.notes ?? []).map((n) => n.modelId));
    return (data?.notetypes ?? []).filter((n) => !n.isCloze && withNotes.has(n.id));
  }, [data]);

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
    if (step === 'scope') { setActiveNtIdx(0); setSampleIdx(0); setStep('mapping'); }
    else if (step === 'mapping') startImport();
  }, [step, startImport]);

  const goBack = useCallback(() => {
    if (step === 'scope') { setStep('source'); setData(null); }
    else if (step === 'mapping') setStep('scope');
  }, [step]);

  const body = (
    <>
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
          mappings={mappings}
          activeIdx={activeNtIdx}
          sampleIdx={sampleIdx}
          onNtIdx={(i) => { setActiveNtIdx(i); setSampleIdx(0); }}
          onSampleIdx={setSampleIdx}
          onMapping={(id, m) => setMappings((prev) => ({ ...prev, [id]: m }))}
          ntIds={ntIds}
          onNtIds={setNtIds}
        />
      )}
    </>
  );

  const footer = step === 'source' ? undefined : (
    <>
      <Button variant="ghost" onClick={goBack}>{t('ankiImport.action.back')}</Button>
      <Button variant="primary" onClick={goNext} disabled={!canContinue}>
        {step === 'mapping' ? t('ankiImport.action.start') : t('ankiImport.action.continue')}
      </Button>
    </>
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
        showCloseButton
        size={step === 'mapping' ? 'lg' : 'md'}
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
          <label key={r.deck.id} className={styles.pickRow}>
            <Checkbox checked={deckIds.has(r.deck.id)} onChange={() => {
              const next = new Set(deckIds);
              if (next.has(r.deck.id)) next.delete(r.deck.id); else next.add(r.deck.id);
              onDeckIds(next);
            }} />
            <span className={styles.pickName}>{r.flatName}</span>
            <span className={styles.pickCounts}>
              {r.counts.new > 0 && <Badge variant="success" size="sm">{t('ankiImport.scope.countNew', [r.counts.new])}</Badge>}
              {r.counts.learning > 0 && <Badge variant="muted" size="sm">{t('ankiImport.scope.countLearning', [r.counts.learning])}</Badge>}
              {r.counts.review > 0 && <Badge size="sm">{t('ankiImport.scope.countReview', [r.counts.review])}</Badge>}
              {r.counts.suspended > 0 && <Badge variant="warning" size="sm">{t('ankiImport.scope.countSuspended', [r.counts.suspended])}</Badge>}
            </span>
          </label>
        ))}
      </div>
      <Text variant="supporting" color="secondary">
        {t('ankiImport.scope.summary', [summary.importable])}
        {summary.cloze > 0 ? ` · ${t('ankiImport.scope.clozeSkipped', [summary.cloze])}` : ''}
      </Text>
    </VStack>
  );
}

const SYSTEM_SLOTS: readonly { role: Exclude<FieldRole, 'skip'>; fieldId: string }[] = [
  { role: 'target', fieldId: 'target' },
  { role: 'sentence', fieldId: 'sentence' },
  { role: 'definition', fieldId: 'def' },
  { role: 'translation', fieldId: 'translation' },
  { role: 'context', fieldId: 'context' },
  { role: 'notes', fieldId: 'notes' },
  { role: 'audio', fieldId: 'wordAudio' },
  { role: 'sentenceAudio', fieldId: 'sentAudio' },
  { role: 'image', fieldId: 'image' },
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
  data, notetypes, mappings, activeIdx, sampleIdx, onNtIdx, onSampleIdx, onMapping, ntIds, onNtIds,
}: {
  readonly data: NormalizedAnkiData;
  readonly notetypes: readonly NormalizedAnkiNotetype[];
  readonly mappings: Readonly<Record<string, FieldMapping>>;
  readonly activeIdx: number;
  readonly sampleIdx: number;
  readonly onNtIdx: (i: number) => void;
  readonly onSampleIdx: (i: number) => void;
  readonly onMapping: (ntId: string, m: FieldMapping) => void;
  readonly ntIds: ReadonlySet<string>;
  readonly onNtIds: (s: ReadonlySet<string>) => void;
}): React.JSX.Element {
  const [flipped, setFlipped] = useState(false);
  const nt = notetypes[Math.min(activeIdx, notetypes.length - 1)];
  const noteModel = useMemo(() => new Map(data.notes.map((n) => [n.id, n.modelId])), [data.notes]);
  const defaultNt = useMemo(() => createDefaultNotetype(PREVIEW_NOTE_ID), []);
  const mapping: FieldMapping = useMemo(() => (nt && mappings[nt.id]) ?? {}, [nt, mappings]);
  const samples = nt ? data.notes.filter((n) => n.modelId === nt.id).slice(0, 5) : [];
  const sample: NormalizedAnkiNote | undefined = samples[sampleIdx % Math.max(1, samples.length)];

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
    return { note, stimulus, audioCache, imageCache };
  }, [nt, sample, mapping, defaultNt]);

  if (!nt) {
    return <Text variant="supporting">{t('ankiImport.mapping.noneSelected')}</Text>;
  }
  const excluded = !ntIds.has(nt.id);
  const toggleNt = (): void => {
    const next = new Set(ntIds);
    if (next.has(nt.id)) next.delete(nt.id); else next.add(nt.id);
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

  const cardCount = data.cards.filter((c) => noteModel.get(c.noteId) === nt.id && c.queue !== -1).length;

  return (
    <VStack gap="3">
      <HStack gap="2" className={styles.ntTabs}>
        {notetypes.map((n, i) => (
          <Button key={n.id} variant={i === activeIdx ? 'secondary' : 'ghost'} size="sm" className={ntIds.has(n.id) ? undefined : styles.ntTabExcluded} onClick={() => { onNtIdx(i); setFlipped(false); }}>
            {n.name}
          </Button>
        ))}
      </HStack>
      {excluded && (
        <Alert variant="default" icon={<Icon name="info" />} description={t('ankiImport.mapping.excludedNt')} />
      )}
      {!excluded && <div className={styles.mapLayout}>
        <div>
          {SYSTEM_SLOTS.map(({ role, fieldId }) => {
            const sources = fieldsForRole(role);
            return (
              <div key={fieldId} className={styles.fieldRow}>
                <span className={styles.fieldName}>{t(`ankiImport.role.${role}`)}</span>
                <Select
                  size="sm"
                  value={sources[0] ?? ''}
                  options={[
                    { value: '', label: t('ankiImport.role.skip') },
                    ...nt.fields.map((f) => ({ value: f.name, label: f.name })),
                  ]}
                  onChange={(v) => assignRole(role, v)}
                  aria-label={t('ankiImport.mapping.sourceFor', [t(`ankiImport.role.${role}`)])}
                />
                {sources.length > 1 && (
                  <span className={styles.fieldMore} title={t('ankiImport.mapping.moreFields', [sources.length - 1])}>+{sources.length - 1}</span>
                )}
              </div>
            );
          })}
        </div>
        <div>
          {preview && (
            <Card className={styles.previewCardWrap} data-cell-id="anki-preview-card">
              {flipped ? (
                <SrsReviewCardBack
                  note={preview.note}
                  audioCache={preview.audioCache}
                  imageCache={preview.imageCache}
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
                  audioCache={preview.audioCache}
                  imageCache={preview.imageCache}
                />
              )}
            </Card>
          )}
          <Text variant="supporting" color="secondary" className={styles.previewHint}>
            {t(flipped ? 'ankiImport.mapping.backPreview' : 'ankiImport.mapping.previewHint')}
          </Text>
        </div>
      </div>}
      <div className={styles.sampleNav} style={excluded ? { display: 'none' } : undefined}>
        <IconButton size="sm" variant="ghost" disabled={sampleIdx === 0} aria-label={t('ankiImport.mapping.prev')} onClick={() => { onSampleIdx(Math.max(0, sampleIdx - 1)); setFlipped(false); }}>
          <Icon name="chevronLeft" />
        </IconButton>
        <Text variant="supporting">{t('ankiImport.mapping.sample', [samples.length ? (sampleIdx % samples.length) + 1 : 0, samples.length])}</Text>
        <IconButton size="sm" variant="ghost" disabled={samples.length <= 1} aria-label={t('ankiImport.mapping.next')} onClick={() => { onSampleIdx(sampleIdx + 1); setFlipped(false); }}>
          <Icon name="chevronRight" />
        </IconButton>
      </div>
      <Separator />
      <HStack justify="between">
        <Text variant="supporting" color="secondary">
          {t('ankiImport.mapping.summary', [nt.name, cardCount, nt.fields.find((f) => mapping[f.name] === 'target')?.name ?? '—'])}
        </Text>
        <Button variant="ghost" size="sm" onClick={toggleNt}>
          {excluded ? t('ankiImport.mapping.includeNt') : t('ankiImport.mapping.excludeNt')}
        </Button>
      </HStack>
    </VStack>
  );
}


