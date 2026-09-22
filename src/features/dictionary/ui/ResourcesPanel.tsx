// ResourcesPanel — 2 sections (dictionary + frequency) + per-file job rows + import (ADR-023, spec F11).
//
// Every dropped/picked file becomes one ImportJob row inside its section's
// list area. A single global FIFO queue runs jobs under dual bounds
// (≤MAX_CONCURRENT_IMPORTS running AND <MAX_INFLIGHT_BYTES in-flight bytes —
// the byte bound protects SW memory on low-RAM devices). The panel never
// blocks: dropzones stay enabled, and each job resolves to its own outcome.
// Duplicate prompts park their job until the user answers; a soft refresh
// (no skeleton flash) runs per completion.

import { useState, useCallback, useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { t, type MessageKey } from '@/shared/i18n';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui';
import { Heading } from '@/shared/ui/Heading';
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
  deleteResource as deleteResourceCascade,
  reorderResources,
} from '@/features/dictionary/services/resourceClient';
import { getUserMessage, isImportError } from '@/features/dictionary/logic/importErrors';
import { useSectionDrag } from './useSectionDrag';
import { computeSignature } from '@/features/dictionary/logic/signatureGenerator';
import { getExtension, MAX_FILE_SIZE } from '@/features/dictionary/logic/fileDetector';
import type { ReadableFile } from '@/features/dictionary/logic/fileDetector';
import { formatBytes } from '@/shared/lib/formatBytes';
import type { DuplicateDecision, ResourceInfo, ResourceType } from '@/entities/dictionary';
import type { FrequencyBandThresholds } from '@/shared/lib/frequencyBand';
import { isRunningJob, makeJobId, type ImportJob } from './importJobTypes';
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

const SECTION_COPY: Record<ResourceType, SectionCopy> = {
  DICTIONARY: {
    title: 'resources.dictionary.title',
    subtitle: 'resources.dictionary.subtitle',
    dropLabel: 'resources.dictionary.dropLabel',
    dropHint: 'resources.dictionary.dropHint',
    accept: '.json,.zip,.db,.gz',
    empty: 'resources.dictionary.empty',
    noun: 'resources.dictionary.noun',
  },
  FREQUENCY: {
    title: 'resources.frequency.title',
    subtitle: 'resources.frequency.subtitle',
    dropLabel: 'resources.frequency.dropLabel',
    dropHint: 'resources.frequency.dropHint',
    accept: '.txt,.json,.zip,.db,.gz',
    empty: 'resources.frequency.empty',
    noun: 'resources.frequency.noun',
  },
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
  readonly sectionId: 'dictionary' | 'frequency';
  readonly resources: readonly ResourceInfo[];
  readonly jobs: readonly ImportJob[];
  readonly loading: boolean;
  readonly onFiles: (files: File[]) => void;
  readonly onResolveDuplicate: (jobId: string, choice: DuplicateDecision) => void;
  readonly onRerunReplace: (jobId: string) => void;
  readonly onDelete: (resource: ResourceInfo) => void;
  readonly onDeleteMany: (ids: readonly number[]) => void;
  readonly onMove: (index: number, direction: -1 | 1) => void;
  readonly onReorder: (fromIndex: number, toIndex: number) => void;
  readonly onChanged: () => void;
  readonly onDeleteAll: () => void;
  readonly footer?: ReactNode;
}

function ResourceSection({
  copy,
  sectionId,
  resources,
  jobs,
  loading,
  onFiles,
  onResolveDuplicate,
  onRerunReplace,
  onDelete,
  onDeleteMany,
  onMove,
  onReorder,
  onChanged,
  onDeleteAll,
  footer,
}: ResourceSectionProps): ReactElement {
  const [editing, setEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set());
  const isEditing = editing && resources.length > 0;
  const { listRef, drag, beginDrag } = useSectionDrag((draggedId, toIndex) => {
    const from = resources.findIndex((r) => r.id === draggedId);
    if (from >= 0) onReorder(from, toIndex);
  });
  const selectedCount = resources.reduce(
    (n, r) => (r.id != null && selectedIds.has(r.id) ? n + 1 : n),
    0,
  );

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

  const handleContextualDelete = (): void => {
    const ids = resources
      .filter((r) => r.id != null && selectedIds.has(r.id))
      .map((r) => r.id as number);
    if (ids.length > 0) onDeleteMany(ids);
    else onDeleteAll();
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeaderText}>
          <Heading level={2} size={3} className={styles.sectionTitle}>{t(copy.title)}</Heading>
          <p className={styles.sectionSubtitle}>{t(copy.subtitle)}</p>
        </div>
        {resources.length > 0 && (
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
            <Icon name="pencil" size="xs" />
          </Button>
        )}
      </div>

      <Dropzone
        label={t(copy.dropLabel)}
        hint={t(copy.dropHint)}
        accept={copy.accept}
        disabled={false}
        onFiles={onFiles}
      />
      <div className={styles.resourceList} role="list" ref={listRef}>
        {jobs.map((job) => (
          <ImportProgress
            key={job.jobId}
            job={job}
            onResolveDuplicate={onResolveDuplicate}
            onRerunReplace={onRerunReplace}
          />
        ))}
        {loading ? (
          <>
            <ResourceCardSkeleton />
            <ResourceCardSkeleton />
          </>
        ) : resources.length === 0 && jobs.length === 0 ? (
          <p className={styles.empty}>{t(copy.empty)}</p>
        ) : (
          <>
            {resources.map((r, i) => {
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
                    sectionSize={resources.length}
                    editing={isEditing}
                    selected={r.id != null && selectedIds.has(r.id)}
                    onSelect={() => { if (r.id != null) toggleSelect(r.id); }}
                    onDelete={() => onDelete(r)}
                    onMove={(dir) => onMove(i, dir)}
                    onGripPointerDown={(e) => { if (r.id != null) beginDrag(i, r.id, e); }}
                    dragging={dragged}
                    onChanged={onChanged}
                  />
                </div>
              );
            })}
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

      {resources.length > 0 && (
        <div className={styles.sectionFooter}>
          {isEditing && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleContextualDelete}
              data-cell-id={`delete-selected-${sectionId}`}
            >
              {selectedCount > 0 ? t('resources.delete.selected', [selectedCount]) : t('resources.delete.all')}
            </Button>
          )}
          {footer}
        </div>
      )}
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
  const [deleteAllTarget, setDeleteAllTarget] = useState<ResourceType | null>(null);
  const [deleteManyTarget, setDeleteManyTarget] = useState<{ type: ResourceType; ids: readonly number[] } | null>(null);
  const jobsRef = useRef<ImportJob[]>([]);
  const successTimers = useRef<Partial<Record<string, ReturnType<typeof setTimeout>>>>({});
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

  // Clear pending auto-dismiss timers on unmount.
  useEffect(() => {
    const timers = successTimers.current;
    return () => {
      for (const key of Object.keys(timers)) {
        const t = timers[key];
        if (t) clearTimeout(t);
      }
      if (alertTimer.current) clearTimeout(alertTimer.current);
    };
  }, []);

  const runJobRef = useRef<(jobId: string) => Promise<void>>(async () => {});

  /** Start queued jobs while the dual bound allows. */
  const pump = useCallback(() => {
    const jobs = jobsRef.current;
    const running = jobs.filter(isRunningJob);
    if (running.length >= MAX_CONCURRENT_IMPORTS) return;
    let inflightBytes = running.reduce((sum, j) => sum + j.file.size, 0);
    for (const job of jobs) {
      if (running.length >= MAX_CONCURRENT_IMPORTS) break;
      if (job.status !== 'queued') continue;
      if (inflightBytes + job.file.size > MAX_INFLIGHT_BYTES) continue;
      running.push(job);
      inflightBytes += job.file.size;
      void runJobRef.current(job.jobId);
    }
  }, []);

  /** Import one job end-to-end; every callback patches only its own row. */
  const runJob = useCallback(async (jobId: string): Promise<void> => {
    const job = jobsRef.current.find((j) => j.jobId === jobId);
    if (!job) return;

    patchJob(jobId, { status: 'uploading', error: null });
    try {
      const result = await importFile(job.file as ReadableFile, job.resourceType, {
        langCode,
        jobId,
        onUploadProgress: (sent, total) => patchJob(jobId, { uploadSent: sent, uploadTotal: total }),
        onResourceCreated: (resourceId) => patchJob(jobId, { status: 'importing', resourceId }),
        onProgress: (processed, total) => patchJob(jobId, { status: 'importing', processed, total }),
        onDuplicate: job.forceReplace
          ? () => 'replace'
          : (existing) => new Promise<DuplicateDecision>((resolve) => {
              patchJob(jobId, { status: 'duplicate', duplicate: { existing, resolve } });
            }),
      });

      if (result.skippedAsDuplicate) {
        patchJob(jobId, {
          status: 'skipped',
          duplicate: result.existingResource ? { existing: result.existingResource } : null,
        });
        announce(t('resources.announce.skipped', [job.file.name]));
      } else {
        patchJob(jobId, { status: 'success', wordCount: result.wordCount });
        announce(t('resources.announce.added', [job.file.name, result.wordCount]));
        successTimers.current[jobId] = setTimeout(() => {
          setJobs((prev) => prev.filter((j) => j.jobId !== jobId));
          successTimers.current[jobId] = undefined;
        }, SUCCESS_DISMISS_MS);
      }
      void refresh(true);
    } catch (e) {
      const msg = isImportError(e)
        ? getUserMessage(e)
        : t('resources.error.import', [job.file.name, String(e)]);
      patchJob(jobId, { status: 'error', error: msg });
      announce(t('resources.announce.failed', [job.file.name, msg]));
      void refresh(true);
    } finally {
      pump();
    }
  }, [langCode, patchJob, announce, refresh, pump, setJobs]);

  // Keep the scheduler's lazy reference fresh every render.
  runJobRef.current = runJob;

  /** Drop/pick handler — validate, dedupe, enqueue, then let the scheduler run. */
  const handleFiles = useCallback(async (files: File[], resourceType: ResourceType) => {
    if (files.length === 0) return;

    const allowed = allowedExtensions(SECTION_COPY[resourceType].accept);
    const activeSignatures = new Set(
      jobsRef.current.filter((j) => j.status === 'queued' || isRunningJob(j)).map((j) => j.signature),
    );
    const seen = new Set<string>();
    const newJobs: ImportJob[] = [];

    for (const file of files) {
      const jobId = makeJobId();
      const base: ImportJob = {
        jobId,
        file,
        resourceType,
        signature: '',
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

      if (!allowed.has(getExtension(file.name))) {
        newJobs.push({ ...base, status: 'error', error: t('resources.error.format', [file.name]) });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        newJobs.push({ ...base, status: 'error', error: t('resources.error.tooLarge', [file.name, formatBytes(file.size)]) });
        continue;
      }

      const signature = await computeSignature(file);
      if (activeSignatures.has(signature) || seen.has(signature)) {
        newJobs.push({ ...base, signature, status: 'skipped' });
        continue;
      }
      seen.add(signature);
      newJobs.push({ ...base, signature });
    }

    // A new drop clears persisted error rows.
    setJobs((prev) => [...prev.filter((j) => j.status !== 'error'), ...newJobs]);
    pump();
  }, [pump, setJobs]);

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

  const applyReorder = useCallback((type: ResourceType, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const list = sortByPriority(resources.filter((r) => r.type === type));
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
    void reorderResources(langCode, type, orderedIds)
      .catch(() => { /* refresh restores persisted order */ })
      .finally(() => void refresh(true));
  }, [resources, langCode, refresh]);

  const handleMove = useCallback((type: ResourceType, index: number, direction: -1 | 1) => {
    applyReorder(type, index, index + direction);
  }, [applyReorder]);

  const handleDelete = useCallback(async (resource: ResourceInfo) => {
    try {
      await deleteResourceCascade(langCode, resource.id!);
      showPanelAlert('success', t('resources.delete.one', [resource.name]));
      void refresh(true);
    } catch (e) {
      showPanelAlert('error', t('resources.delete.failed', [String(e)]));
    }
    setDeleteTarget(null);
  }, [langCode, refresh, showPanelAlert]);

  const handleDeleteMany = useCallback(async (type: ResourceType, ids: readonly number[]) => {
    setDeleteManyTarget(null);
    const wanted = new Set(ids);
    const doomed = resources.filter((r) => r.type === type && r.id != null && wanted.has(r.id));
    if (doomed.length === 0) return;
    try {
      for (const r of doomed) {
        await deleteResourceCascade(langCode, r.id!);
      }
      showPanelAlert('success', t('resources.delete.many', [doomed.length, t(SECTION_COPY[type].noun)]));
      void refresh(true);
    } catch (e) {
      showPanelAlert('error', t('resources.delete.failed', [String(e)]));
      void refresh(true);
    }
  }, [resources, langCode, refresh, showPanelAlert]);

  const handleDeleteAll = useCallback(async (type: ResourceType) => {
    setDeleteAllTarget(null);
    const doomed = resources.filter((r) => r.type === type && r.id != null);
    try {
      // Per-section cascade — deleteAllResources(langCode) clears BOTH types
      // and leaves orphaned entries, so delete each resource through the
      // cascading orchestrator path instead.
      for (const r of doomed) {
        await deleteResourceCascade(langCode, r.id!);
      }
      showPanelAlert('success', t('resources.delete.many', [doomed.length, t(SECTION_COPY[type].noun)]));
      void refresh(true);
    } catch (e) {
      showPanelAlert('error', t('resources.delete.allFailed', [String(e)]));
      void refresh(true);
    }
  }, [resources, langCode, refresh, showPanelAlert]);

  const dictionaryResources = sortByPriority(resources.filter((r) => r.type === 'DICTIONARY'));
  const frequencyResources = sortByPriority(resources.filter((r) => r.type === 'FREQUENCY'));
  const dictionaryJobs = jobs.filter((j) => j.resourceType === 'DICTIONARY');
  const frequencyJobs = jobs.filter((j) => j.resourceType === 'FREQUENCY');

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
            copy={SECTION_COPY.DICTIONARY}
            sectionId="dictionary"
            resources={dictionaryResources}
            jobs={dictionaryJobs}
            loading={loading}
            onFiles={(files) => void handleFiles(files, 'DICTIONARY')}
            onResolveDuplicate={resolveDuplicate}
            onRerunReplace={rerunReplace}
            onDelete={setDeleteTarget}
            onDeleteMany={(ids) => setDeleteManyTarget({ type: 'DICTIONARY', ids })}
            onMove={(i, dir) => handleMove('DICTIONARY', i, dir)}
            onReorder={(from, to) => applyReorder('DICTIONARY', from, to)}
            onChanged={() => void refresh(true)}
            onDeleteAll={() => setDeleteAllTarget('DICTIONARY')}
          />

          <ResourceSection
            copy={SECTION_COPY.FREQUENCY}
            sectionId="frequency"
            resources={frequencyResources}
            jobs={frequencyJobs}
            loading={loading}
            onFiles={(files) => void handleFiles(files, 'FREQUENCY')}
            onResolveDuplicate={resolveDuplicate}
            onRerunReplace={rerunReplace}
            onDelete={setDeleteTarget}
            onDeleteMany={(ids) => setDeleteManyTarget({ type: 'FREQUENCY', ids })}
            onMove={(i, dir) => handleMove('FREQUENCY', i, dir)}
            onReorder={(from, to) => applyReorder('FREQUENCY', from, to)}
            onChanged={() => void refresh(true)}
            onDeleteAll={() => setDeleteAllTarget('FREQUENCY')}
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
      {deleteAllTarget && (
        <DeleteConfirmModal
          title={t('resources.deleteAll.title', [resources.filter((r) => r.type === deleteAllTarget).length, t(SECTION_COPY[deleteAllTarget].noun)])}
          description={t('resources.deleteAll.desc', [t(SECTION_COPY[deleteAllTarget].noun)])}
          onConfirm={() => void handleDeleteAll(deleteAllTarget)}
          onCancel={() => setDeleteAllTarget(null)}
        />
      )}
      {deleteManyTarget && (
        <DeleteConfirmModal
          title={t('resources.deleteMany.title', [deleteManyTarget.ids.length, t(SECTION_COPY[deleteManyTarget.type].noun)])}
          description={t('resources.deleteMany.desc', [t(SECTION_COPY[deleteManyTarget.type].noun)])}
          onConfirm={() => void handleDeleteMany(deleteManyTarget.type, deleteManyTarget.ids)}
          onCancel={() => setDeleteManyTarget(null)}
        />
      )}
    </div>
  );
}
