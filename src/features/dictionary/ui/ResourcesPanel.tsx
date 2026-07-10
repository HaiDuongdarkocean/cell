// ResourcesPanel — 2 sections (dictionary + frequency) + list + import (ADR-023, spec F11).

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

export function ResourcesPanel({ langCode }: ResourcesPanelProps): ReactElement {
  const [resources, setResources] = useState<ResourceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ResourceInfo | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listResources(langCode);
      setResources(list);
    } catch (e) {
      setError(`Không thể tải danh sách tài nguyên: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [langCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleFiles = useCallback(async (files: File[], resourceType: ResourceType) => {
    if (files.length === 0) return;
    setImporting(true);
    setError(null);
    setSuccess(null);
    setProgress(0);

    for (const file of files) {
      try {
        const result = await importFile(file, resourceType, {
          langCode,
          onProgress: (processed) => setProgress(processed),
          onResourceCreated: () => setProgressTotal(100),
        });
        setSuccess(`Đã import "${file.name}" — ${result.wordCount} mục.`);
      } catch (e) {
        if (isImportError(e)) {
          setError(getUserMessage(e));
        } else {
          setError(`Lỗi import "${file.name}": ${String(e)}`);
        }
        break;
      }
    }

    setImporting(false);
    void refresh();
  }, [langCode, refresh]);

  const handleDelete = useCallback(async (resource: ResourceInfo) => {
    try {
      await deleteResourceCascade(langCode, resource.id!);
      setSuccess(`Đã xóa "${resource.name}".`);
      void refresh();
    } catch (e) {
      setError(`Không thể xóa: ${String(e)}`);
    }
    setDeleteTarget(null);
  }, [langCode, refresh]);

  const dictionaryResources = resources.filter((r) => r.type === 'DICTIONARY');
  const frequencyResources = resources.filter((r) => r.type === 'FREQUENCY');

  return (
    <div className={styles.panel} data-testid="resources-panel">
      {error && (
        <div className={styles.error} role="alert" data-testid="import-error">
          {error}
        </div>
      )}
      {success && (
        <div className={styles.success} role="status" data-testid="import-success">
          {success}
        </div>
      )}

      {importing && (
        <ImportProgress processed={progress} total={progressTotal} error={error} />
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Từ điển</h2>
        <Dropzone
          label="Kéo thả file từ điển (.json Cambridge, .zip Yomitan) hoặc click để chọn"
          accept=".json,.zip"
          disabled={importing}
          onFiles={(files) => void handleFiles(files, 'DICTIONARY')}
        />
        <div className={styles.resourceList}>
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
        <Dropzone
          label="Kéo thả file danh sách (.txt, .json, .zip Yomitan, .db.gz Migaku) hoặc click để chọn"
          accept=".txt,.json,.zip,.db,.gz"
          disabled={importing}
          onFiles={(files) => void handleFiles(files, 'FREQUENCY')}
        />
        <div className={styles.resourceList}>
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
