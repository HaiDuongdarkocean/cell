// ResourcesPanel — one unified resource list + in-place import progress
// (ADR-023, spec F11; unified-resource-import).
//
// Every dropped/picked file becomes one pending entry inside the
// list at the slot its resource card will land in. Once the orchestrator has
// created the resource row (installationFinished=false) the card itself shows
// the fill + spinner in place and the pending entry is suppressed — one entry
// per file, never a queue stacked above the list. A single global FIFO queue
// runs uploads under dual bounds
// (≤MAX_CONCURRENT_IMPORTS running AND <MAX_INFLIGHT_BYTES in-flight bytes —
// the byte bound protects SW memory on low-RAM devices). The panel never
// blocks: dropzones stay enabled, and each job resolves to its own outcome.
// Duplicate prompts park their job until the user answers; a soft refresh
// (no skeleton flash) runs per completion.
//
// Once a file's bytes are handed off, the background JobRegistry owns the
// job — its rows render from JOB_LIST/JOB_EVENT, survive panel close, and
// terminal rows persist until dismissed.

import { useState, useCallback, useEffect, useMemo, useRef, type ReactElement, type ReactNode } from 'react';
import { t, type MessageKey } from '@/shared/i18n';
import { Alert } from '@/shared/ui/Alert';
import { Button, Checkbox, EmptyState } from '@/shared/ui';
import { SectionHeader } from '@/shared/ui/SectionHeader';
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden';
import { Dropzone } from './Dropzone';
import { ResourceCard, ResourceCardSkeleton } from './ResourceCard';
import { ImportProgress } from './ImportProgress';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { FrequencyBandsEditor } from './FrequencyBandsEditor';
// Proxied via background: IndexedDB is origin-isolated — direct repo calls
// from this in-page panel would touch the page's IDB, invisible to lookups.
import { Icon } from '@/shared/ui/Icon';
import {
  listResources,
  importResourceFile as importFile,
  deleteResource,
  reorderResources,
  setResourceEnabled,
} from '@/features/dictionary/services/resourceClient';
import { isActiveJob, isTerminalJob, type Job } from '@/entities/job/types';
import { getUserMessage, isImportError } from '@/features/dictionary/logic/importErrors';
import { useSectionDrag } from '@/shared/lib/useSectionDrag';
import { computeSignature } from '@/features/dictionary/logic/signatureGenerator';
import { getExtension, MAX_FILE_SIZE } from '@/features/dictionary/logic/fileDetector';
import type { ReadableFile } from '@/features/dictionary/logic/fileDetector';
import { formatBytes } from '@/shared/lib/formatBytes';
import type { DictionaryComponent, DuplicateDecision, ResourceInfo } from '@/entities/dictionary';
import { detectComponents } from '@/features/dictionary/logic/formatDetector';
import { readFileHead } from '@/features/dictionary/logic/fileDetector';
import type { FrequencyBandThresholds } from '@/shared/lib/frequencyBand';

import { JobRow, useJobs, useJobTerminalWatcher, dismissJob, retryJob, jobErrorText } from '@/features/jobs';
import { buildPendingImports, isRunningJob, makeJobId, signatureOf, type ImportJob } from './importJobTypes';
import styles from './ResourcesPanel.module.css';

const SUCCESS_DISMISS_MS = 4000;

/** Scheduler bounds — see spec REQ-3/NFR-1 memory rationale. */
const MAX_CONCURRENT_IMPORTS = 2;
const MAX_INFLIGHT_BYTES = 256 * 1024 * 1024;

interface ResourcesPanelProps {
  readonly langCode: string;
  /** Settings.frequencyBands — wired through SettingsDialogContent. */
  readonly frequencyBands?: FrequencyBandThresholds;
  readonly onFrequencyBandsChange?: (bands: FrequencyBandThresholds) => void;
  /** Right-column lookup surface (DictionaryPanelView, composed by the
   *  settings layer — this panel only owns the slot, not the dependency). */
  readonly lookupPanel?: ReactNode;
}

interface SectionCopy {
  readonly title: MessageKey;
  readonly subtitle: MessageKey;
  readonly dropLabel: MessageKey;
  readonly dropHint: MessageKey;
  readonly accept: string;
  readonly empty: MessageKey;
  /** Noun used in delete-all copy ("Xóa tất cả N <noun>?"). */
  readonly noun: MessageKey;
}

const UNIFIED_COPY: SectionCopy = {
  title: 'resources.unified.title',
  subtitle: 'resources.unified.subtitle',
  dropLabel: 'resources.unified.dropLabel',
  dropHint: 'resources.unified.dropHint',
  accept: '.txt,.json,.zip,.db,.gz',
  empty: 'resources.unified.empty',
  noun: 'resources.unified.noun',
};

/** Order a section list by priority — mirrors getAllResources' repo sort
 *  (priority asc, absent = last, id desc tiebreak) so the optimistic order
 *  matches what refresh() returns. */
function sortByPriority(list: readonly ResourceInfo[]): ResourceInfo[] {
  return [...list].sort((a, b) => {
    const aPriority = a.priority ?? Number.POSITIVE_INFINITY;
    const bPriority = b.priority ?? Number.POSITIVE_INFINITY;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}

function allowedExtensions(accept: string): Set<string> {
  return new Set(accept.split(',').map((ext) => ext.trim().replace(/^\./, '').toLowerCase()).filter(Boolean));
}

interface ResourceSectionProps {
  readonly copy: SectionCopy;
  readonly sectionId: string;
  readonly resources: readonly ResourceInfo[];
  readonly jobs: readonly ImportJob[];
  readonly registryJobs: readonly Job[];
  readonly loading: boolean;
  readonly busy: boolean;
  readonly onFiles: (files: File[]) => void;
  readonly onToggleComponent: (jobId: string, component: DictionaryComponent) => void;
  readonly onResolveDuplicate: (jobId: string, choice: DuplicateDecision) => void;
  readonly onRerunReplace: (jobId: string) => void;
  readonly onRetryLocal: (jobId: string) => void;
  readonly onDismissLocal: (jobId: string) => void;
  readonly onRetryJob: (jobId: string) => void;
  readonly onDismissJob: (jobId: string) => void;
  readonly onDelete: (resource: ResourceInfo) => void;
  readonly onDeleteMany: (ids: readonly number[]) => void;
  readonly onMove: (index: number, direction: -1 | 1) => void;
  readonly onReorder: (fromIndex: number, toIndex: number) => void;
  readonly onChanged: () => void;
  readonly onDeleteAll: () => void;
  readonly onSetEnabledMany: (ids: readonly number[], enabled: boolean) => void;
  readonly footer?: ReactNode;
}

function ResourceSection({
  copy,
  sectionId,
  resources,
  jobs,
  registryJobs,
  loading,
  busy,
  onFiles,
  onToggleComponent,
  onResolveDuplicate,
  onRerunReplace,
  onRetryLocal,
  onDismissLocal,
  onRetryJob,
  onDismissJob,
  onDelete,
  onDeleteMany,
  onMove,
  onReorder,
  onChanged,
  onDeleteAll,
  onSetEnabledMany,
  footer,
}: ResourceSectionProps): ReactElement {
  const [editing, setEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set());
  const manageable = resources.filter((r) => r.installationFinished !== false);
  const isEditing = editing && manageable.length > 0;
  const { listRef, drag, beginDrag } = useSectionDrag((draggedId, toIndex) => {
    const from = resources.findIndex((r) => r.id === draggedId);
    if (from >= 0) onReorder(from, toIndex);
  });
  const selectedCount = manageable.reduce(
    (n, r) => (r.id != null && selectedIds.has(r.id) ? n + 1 : n),
    0,
  );
  const pending = buildPendingImports(resources, jobs, registryJobs);
  // A fresh import lands first among the priority-less rows — pending entries
  // sit exactly there so the row and the card that replaces it share a slot.
  const priorityEnd = resources.findIndex((r) => r.priority == null);
  const pendingAt = priorityEnd < 0 ? resources.length : priorityEnd;

  const toggleEditing = (): void => {
    setEditing((v) => !v);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: number): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = (): void => {
    setSelectedIds(new Set(manageable.map((r) => r.id).filter((id): id is number => id != null)));
  };

  const bulkSetEnabled = (enabled: boolean): void => {
    if (busy) return;
    const ids = manageable
      .filter((r) => r.id != null && selectedIds.has(r.id))
      .map((r) => r.id as number);
    if (ids.length > 0) onSetEnabledMany(ids, enabled);
  };

  const handleContextualDelete = (): void => {
    if (busy) return;
    const ids = manageable
      .filter((r) => r.id != null && selectedIds.has(r.id))
      .map((r) => r.id as number);
    if (ids.length > 0) onDeleteMany(ids);
    else onDeleteAll();
  };

  const renderCard = (r: ResourceInfo, i: number): ReactElement => {
    const dragged = drag != null && r.id === drag.draggedId;
    const dragFrom = drag ? resources.findIndex((x) => x.id === drag.draggedId) : -1;
    const collapsedPos = drag && dragFrom >= 0 && i > dragFrom ? i - 1 : i;
    const shiftY = drag && !dragged && collapsedPos >= drag.toIndex
      ? drag.cardHeight + drag.gap
      : 0;
    return (
      <div
        key={r.id}
        data-cell-id={`slot-${r.id}`}
        data-dragging={dragged || undefined}
        className={`${styles.slot} ${dragged ? styles.slotDragging : ''} ${drag?.settling ? styles.slotSettling : ''}`}
        style={drag
          ? dragged
            ? { top: drag.fromTop, transform: `translateY(${drag.offsetY}px)` }
            : { transform: `translateY(${shiftY}px)` }
          : undefined}
      >
        <ResourceCard
          resource={r}
          sectionSize={manageable.length}
          editing={isEditing}
          selected={r.id != null && selectedIds.has(r.id)}
          onSelect={() => { if (r.id != null) toggleSelect(r.id); }}
          onDelete={() => { if (!busy) onDelete(r); }}
          onMove={(dir) => { if (!busy) onMove(i, dir); }}
          onGripPointerDown={(e) => { if (!busy && r.id != null) beginDrag(i, r.id, e); }}
          dragging={dragged}
          onChanged={onChanged}
          importProgress={r.id != null ? pending.progressByResourceId.get(r.id) ?? null : null}
        />
      </div>
    );
  };

  return (
    <section className={styles.section}>
      <SectionHeader
        level={2}
        title={t(copy.title)}
        subtitle={t(copy.subtitle)}
        action={
          manageable.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              active={isEditing}
              aria-pressed={isEditing}
              aria-label={t(isEditing ? 'resources.edit.done' : 'resources.edit.start', [t(copy.title)])}
              title={t(isEditing ? 'resources.edit.titleDone' : 'resources.edit.titleStart')}
              onClick={toggleEditing}
              data-cell-id={`edit-${sectionId}`}
            >
              <Icon name={isEditing ? 'check' : 'pencil'} size="xs" />
            </Button>
          ) : undefined
        }
      />

      {isEditing && (
        <div className={styles.editBar} data-cell-id={`edit-bar-${sectionId}`}>
          <Checkbox
            checked={selectedCount === manageable.length}
            indeterminate={selectedCount > 0 && selectedCount < manageable.length}
            onChange={selectedCount === manageable.length ? () => setSelectedIds(new Set()) : selectAll}
            label={t('resources.edit.selectAll')}
            className={styles.selectAll}
            data-cell-id={`select-all-${sectionId}`}
          />
          <span className={styles.selectionCount}>
            {t('resources.edit.selectedCount', [selectedCount, manageable.length])}
          </span>
          <div className={styles.editActions}>
            <Button
              variant="link"
              size="sm"
              disabled={busy || selectedCount === 0}
              onClick={() => bulkSetEnabled(true)}
              data-cell-id={`enable-selected-${sectionId}`}
            >
              {t('resources.edit.enable')}
            </Button>
            <Button
              variant="link"
              size="sm"
              disabled={busy || selectedCount === 0}
              onClick={() => bulkSetEnabled(false)}
              data-cell-id={`disable-selected-${sectionId}`}
            >
              {t('resources.edit.disable')}
            </Button>
            <Button
              variant="link"
              size="sm"
              className={styles.dangerAction}
              disabled={busy}
              onClick={handleContextualDelete}
              data-cell-id={`delete-selected-${sectionId}`}
            >
              {selectedCount > 0 ? t('resources.delete.selected', [selectedCount]) : t('resources.delete.all')}
            </Button>
          </div>
        </div>
      )}

      <Dropzone
        label={t(copy.dropLabel)}
        hint={t(copy.dropHint)}
        accept={copy.accept}
        disabled={busy}
        onFiles={(files) => { if (!busy) onFiles(files); }}
      />
      <div className={styles.resourceList} role="list" ref={listRef}>
        {loading ? (
          <>
            <ResourceCardSkeleton />
            <ResourceCardSkeleton />
          </>
        ) : resources.length === 0 && pending.rows.length === 0 ? (
          <EmptyState bordered size="sm" description={t(copy.empty)} />
        ) : (
          <>
            {resources.slice(0, pendingAt).map((r, i) => renderCard(r, i))}
            {pending.rows.map((row) => row.local != null ? (
              <ImportProgress
                key={row.key}
                job={row.local}
                onToggleComponent={onToggleComponent}
                onResolveDuplicate={onResolveDuplicate}
                onRerunReplace={onRerunReplace}
                onRetry={onRetryLocal}
                onDismiss={onDismissLocal}
              />
            ) : (
              <JobRow
                key={row.key}
                job={row.job}
                onDismiss={onDismissJob}
                onRetry={onRetryJob}
              />
            ))}
            {resources.slice(pendingAt).map((r, i) => renderCard(r, pendingAt + i))}
            {drag && (
              <div
                className={styles.dropPlaceholder}
                style={{ top: drag.slotTop, height: drag.cardHeight }}
                data-cell-id="drag-placeholder"
                aria-hidden="true"
              />
            )}
          </>
        )}
      </div>

      {resources.length > 0 && footer && <div className={styles.sectionFooter}>{footer}</div>}
      {resources.length === 0 && footer}
    </section>
  );
}

export function ResourcesPanel({ langCode, frequencyBands, onFrequencyBandsChange, lookupPanel }: ResourcesPanelProps): ReactElement {
  const [resources, setResources] = useState<ResourceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobsState] = useState<ImportJob[]>([]);
  const [panelAlert, setPanelAlert] = useState<{ variant: 'success' | 'error'; text: string } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ResourceInfo | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteManyTarget, setDeleteManyTarget] = useState<readonly number[] | null>(null);
  const jobsRef = useRef<ImportJob[]>([]);
  const alertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // jobsRef is the SSOT — updated synchronously so pump()/runJob() read the
  // freshest queue inside the same event tick (a setState updater would only
  // run during React's next render).
  const setJobs = useCallback((updater: (prev: ImportJob[]) => ImportJob[]) => {
    const next = updater(jobsRef.current);
    jobsRef.current = next;
    setJobsState(next);
  }, []);

  const patchJob = useCallback((jobId: string, patch: Partial<ImportJob>) => {
    setJobs((prev) => prev.map((j) => (j.jobId === jobId ? { ...j, ...patch } : j)));
  }, [setJobs]);

  const announce = useCallback((text: string) => {
    setAnnouncement('');
    // Re-set on the next tick so identical consecutive messages re-announce.
    setTimeout(() => setAnnouncement(text), 50);
  }, []);

  const showPanelAlert = useCallback((variant: 'success' | 'error', text: string) => {
    if (alertTimer.current) clearTimeout(alertTimer.current);
    setPanelAlert({ variant, text });
    alertTimer.current = setTimeout(() => setPanelAlert(null), SUCCESS_DISMISS_MS);
  }, []);

  const refresh = useCallback(async (soft = false) => {
    if (!soft) setLoading(true);
    try {
      const list = await listResources(langCode);
      setResources(list);
    } catch (e) {
      showPanelAlert('error', t('resources.alert.loadFailed', [String(e)]));
    } finally {
      if (!soft) setLoading(false);
    }
  }, [langCode, showPanelAlert]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Registry-owned jobs for this language — imports the panel handed off and
  // deletes it queued, plus anything started by another surface.
  const allJobs = useJobs();
  const registryJobs = useMemo(
    () => allJobs.filter(
      (j) => (j.kind === 'resource-import' || j.kind === 'resource-delete') && j.params.langCode === langCode,
    ),
    [allJobs, langCode],
  );
  const deleteBusy = useMemo(
    () => registryJobs.some((j) => j.kind === 'resource-delete' && isActiveJob(j)),
    [registryJobs],
  );

  // The orchestrator creates the resource row mid-import (installationFinished
  // = false) and only then stamps resourceId onto the registry job — refresh
  // once per new id so the importing card appears in the list while it fills.
  const seenImportResourceIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const fresh = registryJobs.filter(
      (j) => j.kind === 'resource-import' && j.resourceId != null
        && !seenImportResourceIds.current.has(`${langCode}:${j.resourceId}`)
        && !resources.some((r) => r.id === j.resourceId),
    );
    if (fresh.length === 0) return;
    for (const j of fresh) seenImportResourceIds.current.add(`${langCode}:${j.resourceId!}`);
    void refresh(true);
  }, [langCode, registryJobs, resources, refresh]);

  useJobTerminalWatcher(registryJobs, useCallback((job: Job) => {
    void refresh(true);
    // The visible Alert is itself role=status — announcing again would
    // duplicate the utterance for screen readers.
    if (job.kind === 'resource-import') {
      if (job.status === 'done') {
        showPanelAlert('success', t('resources.announce.added', [job.label, job.result?.wordCount ?? 0]));
      } else {
        showPanelAlert('error', t('resources.announce.failed', [job.label, jobErrorText(job.error ?? job.status)]));
      }
    } else if (job.kind === 'resource-delete') {
      if (job.status === 'done') {
        showPanelAlert('success', t('resources.delete.one', [job.label]));
      } else {
        showPanelAlert('error', t('resources.delete.failed', [jobErrorText(job.error ?? job.status)]));
      }
    }
  }, [refresh, showPanelAlert]));

  const handleDismissJob = useCallback((jobId: string) => {
    void dismissJob(jobId).catch(() => undefined);
  }, []);

  const handleRetryJob = useCallback((jobId: string) => {
    void retryJob(jobId).catch(() => undefined);
  }, []);

  // Clear pending auto-dismiss timers on unmount.
  useEffect(() => {
    return () => {
      if (alertTimer.current) clearTimeout(alertTimer.current);
    };
  }, []);

  const runJobRef = useRef<(jobId: string) => Promise<void>>(async () => {});

  /** Start queued jobs while the dual bound allows. A parked duplicate holds
   *  no in-flight bytes; a lone oversized file still gets to run. */
  const pump = useCallback(() => {
    const jobs = jobsRef.current;
    const running = jobs.filter(isRunningJob);
    if (running.length >= MAX_CONCURRENT_IMPORTS) return;
    let inflightBytes = running.reduce(
      (sum, j) => (j.status === 'duplicate' ? sum : sum + j.file.size),
      0,
    );
    for (const job of jobs) {
      if (running.length >= MAX_CONCURRENT_IMPORTS) break;
      if (job.status !== 'queued') continue;
      if (running.length > 0 && inflightBytes + job.file.size > MAX_INFLIGHT_BYTES) continue;
      running.push(job);
      inflightBytes += job.file.size;
      void runJobRef.current(job.jobId);
    }
  }, []);

  const handleRetryLocal = useCallback((jobId: string) => {
    setJobs((prev) => prev.map((j) => j.jobId === jobId
      ? { ...j, jobId: makeJobId(), status: 'queued', error: null, uploadSent: 0, processed: 0, total: 0 }
      : j));
    pump();
  }, [setJobs, pump]);

  const handleDismissLocal = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.jobId !== jobId));
    // A post-handoff failure shares this id in the registry — dismiss its
    // twin too so it doesn't resurface as an interrupted JobRow.
    void dismissJob(jobId).catch(() => undefined);
  }, [setJobs]);

  /** Upload one job's bytes; the background owns everything after handoff —
   *  the registry row (same jobId) takes over rendering. */
  const runJob = useCallback(async (jobId: string): Promise<void> => {
    const job = jobsRef.current.find((j) => j.jobId === jobId);
    if (!job) return;

    patchJob(jobId, { status: 'uploading', error: null });
    try {
      const outcome = await importFile(job.file as ReadableFile, {
        langCode: job.langCode,
        jobId,
        getComponents: () => {
          const current = jobsRef.current.find((j) => j.jobId === jobId);
          if (!current) return undefined;
          return current.selectedComponents.length !== current.detectedComponents.length
            ? [...current.selectedComponents]
            : undefined;
        },
        onUploadProgress: (sent, total) => patchJob(jobId, { uploadSent: sent, uploadTotal: total }),
        onDuplicate: job.forceReplace
          ? () => 'replace'
          : (existing) => new Promise<DuplicateDecision>((resolve) => {
              patchJob(jobId, { status: 'duplicate', duplicate: { existing, resolve } });
            }),
      });

      if ('skipped' in outcome) {
        patchJob(jobId, {
          status: 'skipped',
          duplicate: { existing: outcome.existingResource },
        });
        announce(t('resources.announce.skipped', [job.fileName]));
        void refresh(true);
      } else {
        setJobs((prev) => prev.filter((j) => j.jobId !== jobId));
      }
    } catch (e) {
      const msg = isImportError(e)
        ? getUserMessage(e)
        : t('resources.error.import', [job.fileName, String(e)]);
      patchJob(jobId, { status: 'error', error: msg });
      announce(t('resources.announce.failed', [job.fileName, msg]));
      void refresh(true);
    } finally {
      pump();
    }
  }, [patchJob, announce, refresh, pump, setJobs]);

  // Keep the scheduler's lazy reference fresh every render.
  runJobRef.current = runJob;

  /** Drop/pick handler — a row lands per file immediately, then
   *  validate/detect/sign patches it in place so feedback is instant even
   *  with many files or a slow device. */
  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const allowed = allowedExtensions(UNIFIED_COPY.accept);
    // A new drop clears persisted error rows.
    setJobs((prev) => prev.filter((j) => j.status !== 'error'));
    const seen = new Set<string>();

    for (const file of files) {
      const jobId = makeJobId();
      const base: ImportJob = {
        jobId,
        langCode,
        file,
        fileName: file.name,
        signature: '',
        detectedComponents: [],
        selectedComponents: [],
        forceReplace: false,
        status: 'queued',
        processed: 0,
        total: 0,
        uploadSent: 0,
        uploadTotal: 0,
        error: null,
        wordCount: null,
        resourceId: null,
        duplicate: null,
      };

      const syncError = !allowed.has(getExtension(file.name))
        ? t('resources.error.format', [file.name])
        : file.size > MAX_FILE_SIZE
          ? t('resources.error.tooLarge', [file.name, formatBytes(file.size)])
          : null;
      setJobs((prev) => [...prev, syncError != null ? { ...base, status: 'error', error: syncError } : base]);
      if (syncError != null) continue;

      try {
        const detected = await detectComponents(file.name, await readFileHead(file));
        patchJob(jobId, { detectedComponents: detected, selectedComponents: detected });

        const signature = await computeSignature(file);
        const duplicateInFlight = jobsRef.current.some(
          (j) => j.jobId !== jobId && j.signature !== '' && j.signature === signature
            && (j.status === 'queued' || isRunningJob(j)),
        );
        const duplicateRegistered = registryJobs.some(
          (j) => j.kind === 'resource-import' && !isTerminalJob(j) && signatureOf(j) === signature,
        );
        if (duplicateInFlight || duplicateRegistered || seen.has(signature)) {
          patchJob(jobId, { signature, status: 'skipped' });
          continue;
        }
        seen.add(signature);
        patchJob(jobId, { signature });
        pump();
      } catch (e) {
        patchJob(jobId, { status: 'error', error: t('resources.error.detect', [file.name, String(e)]) });
      }
    }
  }, [langCode, registryJobs, patchJob, pump, setJobs]);

  const resolveDuplicate = useCallback((jobId: string, choice: DuplicateDecision): void => {
    const job = jobsRef.current.find((j) => j.jobId === jobId);
    const pending = job?.duplicate;
    if (!job || !pending) return;
    patchJob(jobId, {
      duplicate: null,
      status: choice === 'replace' ? 'uploading' : 'skipped',
    });
    if (pending.resolve) {
      pending.resolve(choice);
    }
    if (choice === 'skip') pump();
  }, [patchJob, pump]);

  /** Skipped row "Thay thế" — re-run the same file forcing 'replace' on its row. */
  const rerunReplace = useCallback((jobId: string): void => {
    const job = jobsRef.current.find((j) => j.jobId === jobId);
    if (!job) return;
    patchJob(jobId, {
      status: 'queued',
      forceReplace: true,
      duplicate: null,
      error: null,
      processed: 0,
      total: 0,
      uploadSent: 0,
      uploadTotal: 0,
    });
    pump();
  }, [patchJob, pump]);

  /** Multi-component files can be narrowed while queued/uploading — the last
   *  remaining component can't be deselected. */
  const handleToggleComponent = useCallback((jobId: string, component: DictionaryComponent): void => {
    setJobs((prev) => prev.map((j) => {
      if (j.jobId !== jobId) return j;
      const selected = new Set(j.selectedComponents);
      if (selected.has(component)) {
        if (selected.size === 1) return j;
        selected.delete(component);
      } else {
        selected.add(component);
      }
      return { ...j, selectedComponents: [...selected] };
    }));
  }, [setJobs]);

  const applyReorder = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const list = sortByPriority(resources);
    if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) return;

    const reordered = [...list];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved!);
    const orderedIds = reordered
      .map((r) => r.id)
      .filter((id): id is number => id != null);
    if (orderedIds.length === 0) return;

    // Optimistic local order — stamp priority so the section re-sorts now
    // (repo's reorderResources writes the same 0-based indices).
    const priorityById = new Map(reordered.map((r, i) => [r.id, i]));
    setResources((prev) =>
      prev.map((r) => (priorityById.has(r.id) ? { ...r, priority: priorityById.get(r.id) } : r)),
    );
    void reorderResources(langCode, orderedIds)
      .catch(() => { /* refresh restores persisted order */ })
      .finally(() => void refresh(true));
  }, [resources, langCode, refresh]);

  const handleMove = useCallback((index: number, direction: -1 | 1) => {
    applyReorder(index, index + direction);
  }, [applyReorder]);

  const runDelete = useCallback(async (doomed: readonly ResourceInfo[]) => {
    if (deleteBusy || doomed.length === 0) return;
    let firstError: string | null = null;
    for (const r of doomed) {
      try {
        await deleteResource(langCode, r.id!);
        setResources((prev) => prev.filter((x) => x.id !== r.id));
      } catch (e) {
        firstError = firstError ?? String(e);
      }
    }
    if (firstError != null) {
      showPanelAlert('error', t('resources.delete.failed', [firstError]));
      announce(t('resources.delete.failed', [firstError]));
      void refresh(true);
    }
    // Success announcements + refresh come from the job terminal watcher.
  }, [langCode, deleteBusy, announce, refresh, showPanelAlert]);

  const handleDelete = useCallback(async (resource: ResourceInfo) => {
    setDeleteTarget(null);
    if (deleteBusy) return;
    await runDelete([resource]);
  }, [runDelete, deleteBusy]);

  const handleDeleteMany = useCallback(async (ids: readonly number[]) => {
    setDeleteManyTarget(null);
    if (deleteBusy) return;
    const wanted = new Set(ids);
    const doomed = resources.filter((r) => r.id != null && wanted.has(r.id));
    await runDelete(doomed);
  }, [resources, runDelete, deleteBusy]);

  const handleSetEnabledMany = useCallback(async (ids: readonly number[], enabled: boolean) => {
    const wanted = new Set(ids);
    const targets = resources.filter((r) => r.id != null && wanted.has(r.id));
    if (targets.length === 0) return;
    try {
      for (const r of targets) {
        await setResourceEnabled(langCode, r.id!, enabled);
      }
      showPanelAlert('success', t('resources.edit.toggledMany', [targets.length]));
      void refresh(true);
    } catch (e) {
      showPanelAlert('error', t('resources.edit.toggleFailed', [String(e)]));
      void refresh(true);
    }
  }, [resources, langCode, refresh, showPanelAlert]);

  const handleDeleteAll = useCallback(async () => {
    setDeleteAllOpen(false);
    if (deleteBusy) return;
    // Per-resource cascade — deleteAllResources(langCode) leaves orphaned
    // entries, so delete each resource through the cascading path instead.
    await runDelete(resources.filter(
      (r) => r.id != null && r.installationFinished !== false,
    ));
  }, [resources, runDelete, deleteBusy]);

  const sortedResources = sortByPriority(resources);

  const bandsFooter = (
    <FrequencyBandsEditor value={frequencyBands} onChange={onFrequencyBandsChange} />
  );

  return (
    <div className={styles.panel} data-cell-id="resources-panel">
      <VisuallyHidden>
        <span role="status" aria-live="polite">{announcement}</span>
      </VisuallyHidden>

      {panelAlert && (
        <Alert
          variant={panelAlert.variant}
          description={panelAlert.text}
          role="status"
          data-cell-id="panel-alert"
        />
      )}

      <div className={styles.columns}>
        <div className={styles.sections}>
          <ResourceSection
            copy={UNIFIED_COPY}
            sectionId="resources"
            resources={sortedResources}
            jobs={jobs.filter((j) => j.langCode === langCode)}
            registryJobs={registryJobs}
            loading={loading}
            busy={deleteBusy}
            onFiles={(files) => void handleFiles(files)}
            onToggleComponent={handleToggleComponent}
            onResolveDuplicate={resolveDuplicate}
            onRerunReplace={rerunReplace}
            onDismissJob={handleDismissJob}
            onRetryJob={handleRetryJob}
            onRetryLocal={handleRetryLocal}
            onDismissLocal={handleDismissLocal}
            onDelete={(r) => { if (!deleteBusy) setDeleteTarget(r); }}
            onDeleteMany={(ids) => { if (!deleteBusy) setDeleteManyTarget(ids); }}
            onMove={(i, dir) => handleMove(i, dir)}
            onReorder={(from, to) => applyReorder(from, to)}
            onChanged={() => void refresh(true)}
            onDeleteAll={() => { if (!deleteBusy) setDeleteAllOpen(true); }}
            onSetEnabledMany={(ids, enabled) => void handleSetEnabledMany(ids, enabled)}
            footer={bandsFooter}
          />
        </div>

        {lookupPanel && (
          <aside className={styles.lookupColumn} data-cell-id="resources-lookup-column">
            {lookupPanel}
          </aside>
        )}
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          resource={deleteTarget}
          onConfirm={() => void handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {deleteAllOpen && (
        <DeleteConfirmModal
          title={t('resources.deleteAll.title', [
            resources.filter((r) => r.installationFinished !== false).length,
            t(UNIFIED_COPY.noun),
          ])}
          description={t('resources.deleteAll.desc', [t(UNIFIED_COPY.noun)])}
          onConfirm={() => void handleDeleteAll()}
          onCancel={() => setDeleteAllOpen(false)}
        />
      )}
      {deleteManyTarget && (
        <DeleteConfirmModal
          title={t('resources.deleteMany.title', [deleteManyTarget.length, t(UNIFIED_COPY.noun)])}
          description={t('resources.deleteMany.desc', [t(UNIFIED_COPY.noun)])}
          onConfirm={() => void handleDeleteMany(deleteManyTarget)}
          onCancel={() => setDeleteManyTarget(null)}
        />
      )}
    </div>
  );
}
