// ResourcesPanel — 2 sections (dictionary + frequency) + list + import (ADR-023, spec F11).
//
// Each section has independent import state (importing/progress/error/success/
// duplicate prompt) so dictionary + frequency can import in parallel.
// Duplicate imports are resolved in-React: importFile's onDuplicate callback
// stashes { file, existing, resolve } and the user's choice resolves the
// pending promise — the orchestrator stays clean.

import { useState, useCallback, useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui';
import { Heading } from '@/shared/ui/Heading';
import { Dropzone } from './Dropzone';
import { ResourceCard, ResourceCardSkeleton } from './ResourceCard';
import { ImportProgress } from './ImportProgress';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { FrequencyBandsEditor } from './FrequencyBandsEditor';
// Proxied via background: IndexedDB is origin-isolated — direct repo calls
// from this in-page panel would touch the page's IDB, invisible to lookups.
import {
  listResources,
  importResourceFile as importFile,
  deleteResource as deleteResourceCascade,
  reorderResources,
} from '@/features/dictionary/services/resourceClient';
import { getUserMessage, isImportError } from '@/features/dictionary/logic/importErrors';
import type { ReadableFile } from '@/features/dictionary/logic/fileDetector';
import type {
  DuplicateDecision,
  ImportOptions,
  ResourceInfo,
  ResourceType,
} from '@/entities/dictionary';
import type { FrequencyBandThresholds } from '@/shared/lib/frequencyBand';
import styles from './ResourcesPanel.module.css';

const SUCCESS_DISMISS_MS = 4000;

interface ResourcesPanelProps {
  readonly langCode: string;
  /** Optional allow-list of resource IDs to display for the active language profile. */
  readonly resourceIds?: readonly number[];
  /** Settings.frequencyBands — wired through SettingsDialogContent. */
  readonly frequencyBands?: FrequencyBandThresholds;
  readonly onFrequencyBandsChange?: (bands: FrequencyBandThresholds) => void;
}

/** A pending duplicate-import decision, shown as a warning Alert. */
interface DuplicatePrompt {
  readonly file: ReadableFile;
  readonly existing: ResourceInfo;
  /**
   * Resolves the in-flight importFile onDuplicate promise. Absent when the
   * prompt comes from a `skippedAsDuplicate` result — "Thay thế" then re-runs
   * the import with onDuplicate forced to 'replace'.
   */
  readonly resolve?: (choice: DuplicateDecision) => void;
}

/** Per-section import state — dictionary + frequency are independent. */
interface ImportState {
  readonly importing: boolean;
  readonly progress: number;
  readonly progressTotal: number;
  readonly error: string | null;
  readonly success: string | null;
  readonly duplicate: DuplicatePrompt | null;
}

const IDLE_IMPORT: ImportState = {
  importing: false,
  progress: 0,
  progressTotal: 0,
  error: null,
  success: null,
  duplicate: null,
};

interface SectionCopy {
  readonly title: string;
  readonly subtitle: string;
  readonly dropLabel: string;
  readonly dropHint: string;
  readonly accept: string;
  readonly empty: string;
  /** Noun used in delete-all copy ("Xóa tất cả N <noun>?"). */
  readonly noun: string;
}

const SECTION_COPY: Record<ResourceType, SectionCopy> = {
  DICTIONARY: {
    title: 'Từ điển',
    subtitle: 'Tra nghĩa, phiên âm, phát âm.',
    dropLabel: 'Thêm từ điển',
    dropHint: 'Kéo thả hoặc chọn file · .json, .zip (Yomitan)',
    accept: '.json,.zip',
    empty: 'Chưa có từ điển nào.',
    noun: 'từ điển',
  },
  FREQUENCY: {
    title: 'Độ phổ biến',
    subtitle: 'Đánh dấu từ hay gặp.',
    dropLabel: 'Thêm danh sách',
    dropHint: 'Kéo thả hoặc chọn file · .txt, .json, .zip, .db.gz',
    accept: '.txt,.json,.zip,.db,.gz',
    empty: 'Chưa có danh sách nào.',
    noun: 'danh sách',
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

interface ResourceSectionProps {
  readonly copy: SectionCopy;
  readonly sectionId: 'dictionary' | 'frequency';
  readonly resources: readonly ResourceInfo[];
  readonly state: ImportState;
  readonly loading: boolean;
  readonly onFiles: (files: File[]) => void;
  readonly onResolveDuplicate: (choice: DuplicateDecision) => void;
  readonly onDelete: (resource: ResourceInfo) => void;
  readonly onMove: (index: number, direction: -1 | 1) => void;
  readonly onChanged: () => void;
  readonly onDeleteAll: () => void;
  readonly footer?: ReactNode;
}

function ResourceSection({
  copy,
  sectionId,
  resources,
  state,
  loading,
  onFiles,
  onResolveDuplicate,
  onDelete,
  onMove,
  onChanged,
  onDeleteAll,
  footer,
}: ResourceSectionProps): ReactElement {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <Heading level={2} size={3} className={styles.sectionTitle}>{copy.title}</Heading>
        <p className={styles.sectionSubtitle}>{copy.subtitle}</p>
      </div>

      {state.error && (
        <Alert variant="error" description={state.error} data-cell-id={`import-error-${sectionId}`} />
      )}
      {state.success && (
        <Alert variant="success" description={state.success} role="status" data-cell-id={`import-success-${sectionId}`} />
      )}
      {state.duplicate && (
        <Alert
          variant="warning"
          data-cell-id={`import-duplicate-${sectionId}`}
          description={
            <span className={styles.duplicateBody}>
              <span>Đã có sẵn &quot;{state.duplicate.existing.name}&quot; — chọn thay thế hoặc bỏ qua.</span>
              <span className={styles.duplicateActions}>
                <Button
                  material="solid"
                  variant="outline"
                  size="xs"
                  onClick={() => onResolveDuplicate('replace')}
                  data-cell-id="duplicate-replace"
                >
                  Thay thế
                </Button>
                <Button
                  material="solid"
                  variant="ghost"
                  size="xs"
                  onClick={() => onResolveDuplicate('skip')}
                  data-cell-id="duplicate-skip"
                >
                  Bỏ qua
                </Button>
              </span>
            </span>
          }
        />
      )}
      {state.importing && (
        <ImportProgress processed={state.progress} total={state.progressTotal} error={null} />
      )}
      <Dropzone
        label={copy.dropLabel}
        hint={copy.dropHint}
        accept={copy.accept}
        disabled={state.importing}
        onFiles={onFiles}
      />
      <div className={styles.resourceList} role="list">
        {loading ? (
          <>
            <ResourceCardSkeleton />
            <ResourceCardSkeleton />
          </>
        ) : resources.length === 0 ? (
          <p className={styles.empty}>{copy.empty}</p>
        ) : (
          resources.map((r, i) => (
            <ResourceCard
              key={r.id}
              resource={r}
              index={i}
              sectionSize={resources.length}
              onDelete={() => onDelete(r)}
              onMove={(dir) => onMove(i, dir)}
              onChanged={onChanged}
            />
          ))
        )}
      </div>

      {resources.length > 0 && (
        <div className={styles.sectionFooter}>
          <Button
            material="solid"
            variant="destructive"
            size="sm"
            onClick={onDeleteAll}
            data-cell-id={`delete-all-${sectionId}`}
          >
            Xóa tất cả
          </Button>
          {footer}
        </div>
      )}
      {resources.length === 0 && footer}
    </section>
  );
}

export function ResourcesPanel({ langCode, resourceIds, frequencyBands, onFrequencyBandsChange }: ResourcesPanelProps): ReactElement {
  const [resources, setResources] = useState<ResourceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [importStates, setImportStates] = useState<Record<ResourceType, ImportState>>({
    DICTIONARY: { ...IDLE_IMPORT },
    FREQUENCY: { ...IDLE_IMPORT },
  });
  const [deleteTarget, setDeleteTarget] = useState<ResourceInfo | null>(null);
  const [deleteAllTarget, setDeleteAllTarget] = useState<ResourceType | null>(null);
  const successTimers = useRef<Partial<Record<ResourceType, ReturnType<typeof setTimeout>>>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listResources(langCode);
      const filtered = resourceIds && resourceIds.length > 0
        ? list.filter((r) => r.id != null && resourceIds.includes(r.id))
        : list;
      setResources(filtered);
    } catch (e) {
      setImportStates((prev) => ({
        ...prev,
        DICTIONARY: { ...prev.DICTIONARY, error: `Không thể tải danh sách tài nguyên: ${String(e)}` },
      }));
    } finally {
      setLoading(false);
    }
  }, [langCode, resourceIds]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Clear pending success auto-dismiss timers on unmount.
  useEffect(() => {
    const timers = successTimers.current;
    return () => {
      for (const key of Object.keys(timers) as ResourceType[]) {
        const t = timers[key];
        if (t) clearTimeout(t);
      }
    };
  }, []);

  const patchState = useCallback((type: ResourceType, patch: Partial<ImportState>) => {
    setImportStates((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));
  }, []);

  /** Set a success message that auto-dismisses after ~4s. */
  const showSuccess = useCallback((type: ResourceType, message: string) => {
    const existing = successTimers.current[type];
    if (existing) clearTimeout(existing);
    patchState(type, { success: message });
    successTimers.current[type] = setTimeout(() => {
      patchState(type, { success: null });
      successTimers.current[type] = undefined;
    }, SUCCESS_DISMISS_MS);
  }, [patchState]);

  /** Import one file; when forceReplace, onDuplicate resolves 'replace' immediately. */
  const importOne = useCallback(async (file: ReadableFile, resourceType: ResourceType, forceReplace = false): Promise<void> => {
    // Whether the user was already prompted for this import — distinguishes an
    // onDuplicate-answered 'skip' result (stay quiet) from a result-shaped skip
    // (surface the warning with a replace re-run path).
    let prompted = false;

    const options: ImportOptions = {
      langCode,
      onProgress: (processed) => patchState(resourceType, { progress: processed }),
      onResourceCreated: () => patchState(resourceType, { progressTotal: 100 }),
      onDuplicate: forceReplace
        ? () => 'replace'
        : (existing) => {
            prompted = true;
            return new Promise<DuplicateDecision>((resolve) => {
              patchState(resourceType, { duplicate: { file, existing, resolve } });
            });
          },
    };

    const result = await importFile(file, resourceType, options);

    if (result.skippedAsDuplicate) {
      if (!prompted && result.existingResource) {
        patchState(resourceType, { duplicate: { file, existing: result.existingResource } });
      }
      return;
    }
    showSuccess(resourceType, `Đã thêm "${file.name}" — ${result.wordCount} từ.`);
  }, [langCode, patchState, showSuccess]);

  /** Returns false when the import errored (so multi-file loops can stop). */
  const runImport = useCallback(async (file: ReadableFile, resourceType: ResourceType, forceReplace = false): Promise<boolean> => {
    setImportStates((prev) => ({
      ...prev,
      [resourceType]: { ...IDLE_IMPORT, importing: true },
    }));
    try {
      await importOne(file, resourceType, forceReplace);
      return true;
    } catch (e) {
      const msg = isImportError(e)
        ? getUserMessage(e)
        : `Lỗi import "${file.name}": ${String(e)}`;
      patchState(resourceType, { error: msg });
      return false;
    } finally {
      patchState(resourceType, { importing: false });
    }
  }, [importOne, patchState]);

  const handleFiles = useCallback((files: File[], resourceType: ResourceType) => {
    if (files.length === 0) return;
    void (async () => {
      for (const file of files) {
        // Sequential per section: keep progress + duplicate prompts readable.
        const ok = await runImport(file, resourceType);
        if (!ok) break;
      }
      void refresh();
    })();
  }, [runImport, refresh]);

  const resolveDuplicate = (type: ResourceType, choice: DuplicateDecision): void => {
    const pending = importStates[type].duplicate;
    if (!pending) return;
    patchState(type, { duplicate: null });
    if (pending.resolve) {
      // In-flight import — hand the choice back to the orchestrator.
      pending.resolve(choice);
    } else if (choice === 'replace') {
      // Result-shaped skip — re-run the same file forcing 'replace'.
      void runImport(pending.file, type, true);
    }
  };

  const handleMove = useCallback((type: ResourceType, index: number, direction: -1 | 1) => {
    const list = sortByPriority(resources.filter((r) => r.type === type));
    const target = index + direction;
    if (target < 0 || target >= list.length) return;

    const reordered = [...list];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved!);
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
      .finally(() => void refresh());
  }, [resources, langCode, refresh]);

  const handleDelete = useCallback(async (resource: ResourceInfo) => {
    try {
      await deleteResourceCascade(langCode, resource.id!);
      showSuccess(resource.type, `Đã xóa "${resource.name}".`);
      void refresh();
    } catch (e) {
      patchState(resource.type, { error: `Không thể xóa: ${String(e)}` });
    }
    setDeleteTarget(null);
  }, [langCode, refresh, showSuccess, patchState]);

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
      showSuccess(type, `Đã xóa ${doomed.length} ${SECTION_COPY[type].noun}.`);
      void refresh();
    } catch (e) {
      patchState(type, { error: `Không thể xóa tất cả: ${String(e)}` });
      void refresh();
    }
  }, [resources, langCode, refresh, showSuccess, patchState]);

  const dictionaryResources = sortByPriority(resources.filter((r) => r.type === 'DICTIONARY'));
  const frequencyResources = sortByPriority(resources.filter((r) => r.type === 'FREQUENCY'));

  const bandsFooter = (
    <FrequencyBandsEditor value={frequencyBands} onChange={onFrequencyBandsChange} />
  );

  return (
    <div className={styles.panel} data-cell-id="resources-panel">
      <ResourceSection
        copy={SECTION_COPY.DICTIONARY}
        sectionId="dictionary"
        resources={dictionaryResources}
        state={importStates.DICTIONARY}
        loading={loading}
        onFiles={(files) => handleFiles(files, 'DICTIONARY')}
        onResolveDuplicate={(choice) => resolveDuplicate('DICTIONARY', choice)}
        onDelete={setDeleteTarget}
        onMove={(i, dir) => handleMove('DICTIONARY', i, dir)}
        onChanged={() => void refresh()}
        onDeleteAll={() => setDeleteAllTarget('DICTIONARY')}
      />

      <ResourceSection
        copy={SECTION_COPY.FREQUENCY}
        sectionId="frequency"
        resources={frequencyResources}
        state={importStates.FREQUENCY}
        loading={loading}
        onFiles={(files) => handleFiles(files, 'FREQUENCY')}
        onResolveDuplicate={(choice) => resolveDuplicate('FREQUENCY', choice)}
        onDelete={setDeleteTarget}
        onMove={(i, dir) => handleMove('FREQUENCY', i, dir)}
        onChanged={() => void refresh()}
        onDeleteAll={() => setDeleteAllTarget('FREQUENCY')}
        footer={bandsFooter}
      />

      {deleteTarget && (
        <DeleteConfirmModal
          resource={deleteTarget}
          onConfirm={() => void handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {deleteAllTarget && (
        <DeleteConfirmModal
          title={`Xóa tất cả ${resources.filter((r) => r.type === deleteAllTarget).length} ${SECTION_COPY[deleteAllTarget].noun}?`}
          description={`Xóa vĩnh viễn toàn bộ ${SECTION_COPY[deleteAllTarget].noun} trong mục này và dữ liệu của chúng.`}
          onConfirm={() => void handleDeleteAll(deleteAllTarget)}
          onCancel={() => setDeleteAllTarget(null)}
        />
      )}
    </div>
  );
}
