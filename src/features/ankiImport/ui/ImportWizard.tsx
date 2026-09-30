import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Badge, Button, Card, Checkbox, Dialog, FlagIcon, Icon, IconButton,
  Progress, SectionHeader, Select, SelectableCard, Separator, Spinner, Text,
  HStack, VStack,
} from '@/shared/ui';
import { t } from '@/shared/i18n';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import type { LanguageProfile } from '@/entities/settings';
import { buildDeckPickerRows, resolveHomeDeckId } from '../logic/deckFlatten';
import { guessFieldMapping, htmlToText, mediaRefsIn } from '../logic/fieldMapping';
import { importNormalized, ImportError, type ImportReport } from '../logic/importWriter';
import type {
  FieldMapping, FieldRole, ImportSelection, NormalizedAnkiData, NormalizedAnkiNote, NormalizedAnkiNotetype,
} from '../model/normalized';
import { loadMappingPreset, saveMappingPreset } from '../services/mappingPresets';
import { checkAnkiConnect, readFromApkg, readFromConnect } from '../services/importController';
import styles from './ImportWizard.module.css';

type Step = 'source' | 'scope' | 'language' | 'mapping' | 'running' | 'report';

const STEPS: readonly Step[] = ['source', 'scope', 'language', 'mapping', 'running', 'report'];
const STEP_INDEX: Record<Step, number> = { source: 1, scope: 2, language: 3, mapping: 4, running: 5, report: 6 };

const ROLE_KEYS: readonly FieldRole[] = [
  'target', 'definition', 'sentence', 'translation', 'context', 'audio', 'sentenceAudio', 'image', 'notes', 'skip',
];

export interface ImportWizardProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onStudyNow: () => void;
  readonly onImported: () => void;
}

export function ImportWizard({ open, onClose, onStudyNow, onImported }: ImportWizardProps): React.JSX.Element {
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
  const [profiles, setProfiles] = useState<readonly LanguageProfile[]>([]);
  const [targetLanguage, setTargetLanguage] = useState('');
  const [mappings, setMappings] = useState<Record<string, FieldMapping>>({});
  const [activeNtIdx, setActiveNtIdx] = useState(0);
  const [sampleIdx, setSampleIdx] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [report, setReport] = useState<ImportReport | null>(null);
  const [reportPartial, setReportPartial] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
    setProgress({ done: 0, total: 0 });
    setReport(null);
    setReportPartial(false);
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    void loadSettings().then((s) => {
      setProfiles(s.languageProfiles);
      const active = s.languageProfiles.find((p) => p.id === s.activeProfileId) ?? s.languageProfiles[0];
      if (active) setTargetLanguage(active.target);
    }).catch(() => {});
  }, [open]);

  const acceptData = useCallback((d: NormalizedAnkiData) => {
    setData(d);
    setNoScheduling(!d.hasScheduling);
    setDeckIds(new Set(d.decks.filter((x) => !x.filtered).map((x) => x.id)));
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
      const d = await readFromConnect({
        onStage: (_s, done, total) => setProgress({ done, total }),
      });
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

  const runImport = useCallback(async () => {
    if (!data) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStep('running');
    setProgress({ done: 0, total: data.cards.length });
    try {
      for (const nt of selectedNt) {
        if (mappings[nt.id]) void saveMappingPreset(nt.name, mappings[nt.id]!);
      }
      const rep = await importNormalized({
        data,
        selection: { deckIds, notetypeIds: ntIds } satisfies ImportSelection,
        mappings,
        targetLanguage,
        now: new Date(),
        signal: controller.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setReport(rep);
      setReportPartial(false);
      setStep('report');
      onImported();
    } catch (err) {
      if (err instanceof ImportError && err.code === 'ABORTED') {
        setReport(null);
        setReportPartial(true);
        setStep('report');
        onImported();
      } else {
        setErrorSource('run');
        setError(err instanceof Error ? err.message : String(err));
        setStep('report');
      }
    }
  }, [data, deckIds, ntIds, mappings, targetLanguage, selectedNt, onImported]);

  const cancelRun = useCallback(() => abortRef.current?.abort(), []);

  const canContinue = useMemo(() => {
    switch (step) {
      case 'scope': return deckIds.size > 0;
      case 'language': return targetLanguage !== '';
      case 'mapping': return selectedNt.length === 0 || selectedNt.every((n) => mappings[n.id]);
      default: return false;
    }
  }, [step, deckIds, targetLanguage, selectedNt, mappings]);

  const goNext = useCallback(() => {
    if (step === 'scope') setStep('language');
    else if (step === 'language') { setActiveNtIdx(0); setSampleIdx(0); setStep('mapping'); }
    else if (step === 'mapping') void runImport();
  }, [step, runImport]);

  const goBack = useCallback(() => {
    if (step === 'scope') { setStep('source'); setData(null); }
    else if (step === 'language') setStep('scope');
    else if (step === 'mapping') setStep('language');
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
      {step === 'language' && (
        <LanguageStep profiles={profiles} value={targetLanguage} onChange={setTargetLanguage} />
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
      {step === 'running' && <RunningStep progress={progress} onCancel={cancelRun} />}
      {step === 'report' && <ReportStep report={report} partial={reportPartial} error={error} fidelity={data?.fidelity ?? null} />}
    </>
  );

  const footer = step === 'running' ? undefined
    : step === 'report' ? (
      <>
        <Button variant="ghost" onClick={onClose}>{t('ankiImport.action.close')}</Button>
        {report && report.importedCards > 0 && (
          <Button variant="primary" onClick={() => { onClose(); onStudyNow(); }}>{t('ankiImport.action.studyNow')}</Button>
        )}
      </>
    ) : (
      <>
        {step !== 'source' && (
          <Button variant="ghost" onClick={goBack}>{t('ankiImport.action.back')}</Button>
        )}
        {step !== 'source' && (
          <Button variant="primary" onClick={goNext} disabled={!canContinue}>
            {step === 'mapping' ? t('ankiImport.action.start') : t('ankiImport.action.continue')}
          </Button>
        )}
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
        footer={footer}
      >
        {body}
      </Dialog>
    </>
  );
}

function StepRail({ step }: { step: Step }): React.JSX.Element {
  const labels = [
    t('ankiImport.rail.source'), t('ankiImport.rail.scope'), t('ankiImport.rail.language'),
    t('ankiImport.rail.fields'), t('ankiImport.rail.run'), t('ankiImport.rail.result'),
  ];
  return (
    <HStack gap="2" className={styles.stepRail}>
      <Badge>{`${STEP_INDEX[step]}/${STEPS.length}`}</Badge>
      {labels.map((l, i) => (
        <Text key={l} variant="label" color={i + 1 <= STEP_INDEX[step] ? 'primary' : 'disabled'}>
          {l}
        </Text>
      ))}
    </HStack>
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
            <HStack gap="2"><Icon name="import" /><Text variant="label">{t('ankiImport.source.liveTitle')}</Text></HStack>
            <span className={styles.hint}>{t('ankiImport.source.liveHint')}</span>
          </div>
        </SelectableCard>
        <SelectableCard role="button" aria-label={t('ankiImport.source.fileTitle')} onSelect={() => { if (!connecting && !parsing) onPickFile(); }}>
          <div className={styles.sourceCard}>
            <HStack gap="2"><Icon name="folderOpen" /><Text variant="label">{t('ankiImport.source.fileTitle')}</Text></HStack>
            <span className={styles.hint}>{t('ankiImport.source.fileHint')}</span>
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
              {r.counts.new > 0 && <Badge size="sm">{t('ankiImport.scope.countNew', [r.counts.new])}</Badge>}
              {r.counts.learning > 0 && <Badge size="sm">{t('ankiImport.scope.countLearning', [r.counts.learning])}</Badge>}
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

function LanguageStep({
  profiles, value, onChange,
}: {
  readonly profiles: readonly LanguageProfile[];
  readonly value: string;
  readonly onChange: (v: string) => void;
}): React.JSX.Element {
  const options = profiles.length > 0
    ? profiles.map((p) => ({ value: p.target, label: p.name || p.target }))
    : [{ value, label: value }];
  return (
    <VStack gap="3">
      <Text>{t('ankiImport.language.prompt')}</Text>
      <Select value={value} onChange={onChange} options={options} aria-label={t('ankiImport.language.label')} />
      <HStack gap="2">
        <FlagIcon lang={value} size={18} />
        <Text variant="supporting" color="secondary">{t('ankiImport.language.mergeHint')}</Text>
      </HStack>
    </VStack>
  );
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
  const nt = notetypes[Math.min(activeIdx, notetypes.length - 1)];
  const noteModel = useMemo(() => new Map(data.notes.map((n) => [n.id, n.modelId])), [data.notes]);
  if (!nt) {
    return <Text variant="supporting">{t('ankiImport.mapping.noneSelected')}</Text>;
  }
  const mapping = mappings[nt.id] ?? {};
  const excluded = !ntIds.has(nt.id);
  const toggleNt = (): void => {
    const next = new Set(ntIds);
    if (next.has(nt.id)) next.delete(nt.id); else next.add(nt.id);
    onNtIds(next);
  };
  const samples = data.notes.filter((n) => n.modelId === nt.id).slice(0, 5);
  const sample: NormalizedAnkiNote | undefined = samples[sampleIdx % Math.max(1, samples.length)];

  const roleOf = (ord: number): FieldRole => mapping[nt.fields.find((f) => f.ord === ord)?.name ?? ''] ?? 'skip';
  const textAt = (role: FieldRole): string => {
    if (!sample) return '';
    const f = nt.fields.find((x) => mapping[x.name] === role);
    return f ? htmlToText(sample.fields[f.ord] ?? '') : '';
  };
  const targetText = textAt('target');
  const sentenceText = textAt('sentence');
  const maskedSentence = targetText && sentenceText
    ? sentenceText.split(targetText).join('░'.repeat(Math.max(2, targetText.length)))
    : sentenceText;
  const definitionText = [textAt('definition'), textAt('translation'), textAt('context'), textAt('notes')]
    .filter(Boolean).join('\n');
  const hasAudio = sample ? nt.fields.some((f) => roleOf(f.ord) === 'audio' || roleOf(f.ord) === 'sentenceAudio' || mediaRefsIn(sample.fields[f.ord] ?? '').sounds.length > 0) : false;
  const hasImage = sample ? nt.fields.some((f) => roleOf(f.ord) === 'image' || mediaRefsIn(sample.fields[f.ord] ?? '').images.length > 0) : false;

  const cardCount = data.cards.filter((c) => noteModel.get(c.noteId) === nt.id && c.queue !== -1).length;

  return (
    <VStack gap="3">
      <HStack gap="2" className={styles.ntTabs}>
        {notetypes.map((n, i) => (
          <Button key={n.id} variant={i === activeIdx ? 'secondary' : 'ghost'} size="sm" className={ntIds.has(n.id) ? undefined : styles.ntTabExcluded} onClick={() => onNtIdx(i)}>
            {n.name}
          </Button>
        ))}
      </HStack>
      {excluded && (
        <Alert variant="default" icon={<Icon name="info" />} description={t('ankiImport.mapping.excludedNt')} />
      )}
      {!excluded && <div className={styles.mapLayout}>
        <div>
          {nt.fields.map((f) => (
            <div key={f.name} className={styles.fieldRow}>
              <span className={styles.fieldName} title={f.name}>{f.name}</span>
              <Select
                size="sm"
                value={mapping[f.name] ?? 'skip'}
                options={ROLE_KEYS.map((r) => ({ value: r, label: t(`ankiImport.role.${r}`) }))}
                onChange={(v) => onMapping(nt.id, { ...mapping, [f.name]: v as FieldRole })}
                aria-label={t('ankiImport.mapping.roleOf', [f.name])}
              />
            </div>
          ))}
        </div>
        <Card className={styles.previewCard}>
          <span className={styles.previewLabel}>{t('ankiImport.mapping.frontPreview')}</span>
          <div className={styles.previewFront} aria-label={t('ankiImport.mapping.frontPreview')}>
            <Text>{maskedSentence || targetText || '—'}</Text>
            {hasAudio && <Badge size="sm"><Icon name="audioWave" /> audio</Badge>}
            {hasImage && <Badge size="sm"><Icon name="image" /> img</Badge>}
          </div>
          <div className={styles.previewBack}>
            <span className={styles.previewLabel}>{t('ankiImport.mapping.backPreview')}</span>
            <span><b>{targetText}</b></span>
            <span>{definitionText}</span>
            {sentenceText && <span className={styles.previewLabel}>{sentenceText}</span>}
          </div>
        </Card>
      </div>}
      <div className={styles.sampleNav} style={excluded ? { display: 'none' } : undefined}>
        <IconButton size="sm" variant="ghost" disabled={sampleIdx === 0} aria-label={t('ankiImport.mapping.prev')} onClick={() => onSampleIdx(Math.max(0, sampleIdx - 1))}>
          <Icon name="chevronLeft" />
        </IconButton>
        <Text variant="supporting">{t('ankiImport.mapping.sample', [samples.length ? (sampleIdx % samples.length) + 1 : 0, samples.length])}</Text>
        <IconButton size="sm" variant="ghost" disabled={samples.length <= 1} aria-label={t('ankiImport.mapping.next')} onClick={() => onSampleIdx(sampleIdx + 1)}>
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

function RunningStep({ progress, onCancel }: { readonly progress: { done: number; total: number }; readonly onCancel: () => void }): React.JSX.Element {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className={styles.centerCol}>
      <Spinner />
      <Progress value={pct} style={{ width: '100%' }} />
      <Text variant="supporting">{t('ankiImport.run.progress', [progress.done, progress.total])}</Text>
      <Button variant="ghost" size="sm" onClick={onCancel}>{t('ankiImport.run.cancel')}</Button>
    </div>
  );
}

function ReportStep({
  report, partial, error, fidelity,
}: {
  readonly report: ImportReport | null;
  readonly partial: boolean;
  readonly error: string | null;
  readonly fidelity: 'full' | 'estimated' | null;
}): React.JSX.Element {
  if (error) {
    return <Alert variant="error" icon={<Icon name="info" />} title={t('ankiImport.report.failed')} description={error} />;
  }
  type IconName = React.ComponentProps<typeof Icon>['name'];
  const rows: { icon: IconName; label: string; value: string }[] = report
    ? [
      { icon: 'check', label: t('ankiImport.report.imported'), value: String(report.importedCards) },
      { icon: 'x', label: t('ankiImport.report.suspended'), value: String(report.skippedSuspended) },
      { icon: 'x', label: t('ankiImport.report.cloze'), value: String(report.skippedCloze) },
      { icon: 'rotateCcw', label: t('ankiImport.report.duplicates'), value: String(report.duplicates) },
      { icon: 'info', label: t('ankiImport.report.failedCards'), value: String(report.failedCards) },
      { icon: 'image', label: t('ankiImport.report.media'), value: `${report.mediaHits} ✓ · ${report.mediaMisses} ✗` },
      { icon: 'checkDouble', label: t('ankiImport.report.reviews'), value: String(report.reviewRecords) },
      { icon: 'folderOpen', label: t('ankiImport.report.decks'), value: String(report.decksCreated) },
    ]
    : [];
  return (
    <VStack gap="3">
      {partial && <Alert variant="warning" icon={<Icon name="info" />} description={t('ankiImport.report.cancelled')} />}
      <div className={styles.reportList}>
        {rows.map((r) => (
          <div key={r.label} className={styles.reportRow}>
            <HStack gap="2"><Icon name={r.icon} /><Text>{r.label}</Text></HStack>
            <Badge size="sm">{r.value}</Badge>
          </div>
        ))}
      </div>
      {fidelity === 'estimated' && (
        <Alert variant="default" icon={<Icon name="info" />} description={t('ankiImport.report.fidelityEstimated')} />
      )}
    </VStack>
  );
}
