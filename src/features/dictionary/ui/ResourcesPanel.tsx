// ResourcesPanel — 2 sections (dictionary + frequency) + list + import (ADR-023, spec F11).
//
// Each section has independent import state (importing/progress/error/success)
// so dictionary + frequency can import in parallel without blocking each other.

import { useState, useCallback, useEffect, type ReactElement } from 'react';
import { Dropzone } from './Dropzone';
import { ResourceCard } from './ResourceCard';
import { ImportProgress } from './ImportProgress';
import { ResourceCardSkeleton } from './ResourceCard';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { listResources, importFile, deleteResourceCascade } from '@/features/dictionary/logic/importOrchestrator';
import { getUserMessage, isImportError } from '@/features/dictionary/logic/importErrors';
import type { ResourceInfo, ResourceType } from '@/entities/dictionary';
import styles from './ResourcesPanel.module.css';

interface ResourcesPanelProps {
  readonly langCode: string;
}

/** Per-section import state — dictionary + frequency are independent. */
interface ImportState {
  readonly importing: boolean;
  readonly progress: number;
  readonly progressTotal: number;
  readonly error: string | null;
  readonly success: string | null;
}

const IDLE_IMPORT: ImportState = {
  importing: false,
  progress: 0,
  progressTotal: 0,
  error: null,
  success: null,
};

export function ResourcesPanel({ langCode }: ResourcesPanelProps): ReactElement {
  const [resources, setResources] = useState<ResourceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [importStates, setImportStates] = useState<Record<ResourceType, ImportState>>({
    DICTIONARY: { ...IDLE_IMPORT },
    FREQUENCY: { ...IDLE_IMPORT },
  });
  const [deleteTarget, setDeleteTarget] = useState<ResourceInfo | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listResources(langCode);
      setResources(list);
    } catch (e) {
      setImportStates((prev) => ({
        ...prev,
        DICTIONARY: { ...prev.DICTIONARY, error: `Không thể tải danh sách tài nguyên: ${String(e)}` },
      }));
    } finally {
      setLoading(false);
    }
  }, [langCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleFiles = useCallback(async (files: File[], resourceType: ResourceType) => {
    if (files.length === 0) return;
    setImportStates((prev) => ({
      ...prev,
      [resourceType]: { importing: true, progress: 0, progressTotal: 0, error: null, success: null },
    }));

    for (const file of files) {
      try {
        const result = await importFile(file, resourceType, {
          langCode,
          onProgress: (processed) => setImportStates((prev) => ({
            ...prev,
            [resourceType]: { ...prev[resourceType], progress: processed },
          })),
          onResourceCreated: () => setImportStates((prev) => ({
            ...prev,
            [resourceType]: { ...prev[resourceType], progressTotal: 100 },
          })),
        });
        setImportStates((prev) => ({
          ...prev,
          [resourceType]: { ...prev[resourceType], success: `Đã import "${file.name}" — ${result.wordCount} mục.` },
        }));
      } catch (e) {
        const msg = isImportError(e) ? getUserMessage(e) : `Lỗi import "${file.name}": ${String(e)}`;
        setImportStates((prev) => ({
          ...prev,
          [resourceType]: { ...prev[resourceType], error: msg },
        }));
        break;
      }
    }

    setImportStates((prev) => ({
      ...prev,
      [resourceType]: { ...prev[resourceType], importing: false },
    }));
    void refresh();
  }, [langCode, refresh]);

  const handleDelete = useCallback(async (resource: ResourceInfo) => {
    try {
      await deleteResourceCascade(langCode, resource.id!);
      setImportStates((prev) => ({
        ...prev,
        [resource.type]: { ...prev[resource.type], success: `Đã xóa "${resource.name}".` },
      }));
      void refresh();
    } catch (e) {
      setImportStates((prev) => ({
        ...prev,
        [resource.type]: { ...prev[resource.type], error: `Không thể xóa: ${String(e)}` },
      }));
    }
    setDeleteTarget(null);
  }, [langCode, refresh]);

  const dictionaryResources = resources.filter((r) => r.type === 'DICTIONARY');
  const frequencyResources = resources.filter((r) => r.type === 'FREQUENCY');
  const dictState = importStates.DICTIONARY;
  const freqState = importStates.FREQUENCY;

  return (
    <div className={styles.panel} data-cell-id="resources-panel">
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Từ điển</h2>
        {dictState.error && (
          <div className={styles.error} role="alert" data-cell-id="import-error-dictionary">
            {dictState.error}
          </div>
        )}
        {dictState.success && (
          <div className={styles.success} role="status" data-cell-id="import-success-dictionary">
            {dictState.success}
          </div>
        )}
        {dictState.importing && (
          <ImportProgress processed={dictState.progress} total={dictState.progressTotal} error={null} />
        )}
        <Dropzone
          label="Kéo thả file từ điển (.json Cambridge, .zip Yomitan) hoặc click để chọn"
          accept=".json,.zip"
          disabled={dictState.importing}
          onFiles={(files) => void handleFiles(files, 'DICTIONARY')}
        />
        <div className={styles.resourceList} role="list">
          {loading ? (
            <>
              <ResourceCardSkeleton />
              <ResourceCardSkeleton />
            </>
          ) : dictionaryResources.length === 0 ? (
            <p className={styles.empty}>Chưa có từ điển nào — kéo thả file vào dropzone để bắt đầu.</p>
          ) : (
            dictionaryResources.map((r) => (
              <ResourceCard key={r.id} resource={r} onDelete={() => setDeleteTarget(r)} />
            ))
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Danh sách tần suất</h2>
        {freqState.error && (
          <div className={styles.error} role="alert" data-cell-id="import-error-frequency">
            {freqState.error}
          </div>
        )}
        {freqState.success && (
          <div className={styles.success} role="status" data-cell-id="import-success-frequency">
            {freqState.success}
          </div>
        )}
        {freqState.importing && (
          <ImportProgress processed={freqState.progress} total={freqState.progressTotal} error={null} />
        )}
        <Dropzone
          label="Kéo thả file danh sách (.txt, .json, .zip Yomitan, .db.gz Migaku) hoặc click để chọn"
          accept=".txt,.json,.zip,.db,.gz"
          disabled={freqState.importing}
          onFiles={(files) => void handleFiles(files, 'FREQUENCY')}
        />
        <div className={styles.resourceList} role="list">
          {loading ? (
            <>
              <ResourceCardSkeleton />
              <ResourceCardSkeleton />
            </>
          ) : frequencyResources.length === 0 ? (
            <p className={styles.empty}>Chưa có danh sách nào — kéo thả .txt/.json để bắt đầu.</p>
          ) : (
            frequencyResources.map((r) => (
              <ResourceCard key={r.id} resource={r} onDelete={() => setDeleteTarget(r)} />
            ))
          )}
        </div>
      </section>

      {deleteTarget && (
        <DeleteConfirmModal
          resource={deleteTarget}
          onConfirm={() => void handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
