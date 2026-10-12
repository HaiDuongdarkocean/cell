import { useEffect, useState } from 'react';
import { t } from '@/shared/i18n';
import { detectPackage } from '@/features/pronunciation/services/detectPackage';
import { clearLingvoDslIndex } from '@/features/pronunciation/repositories/lingvoDslIndexRepository';
import { getFileHandle, saveFileHandle, verifyPermission } from '@/shared/lib/storage/localFileHandleStorage';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MessageResponse } from '@/entities/message';
import type { LocalAudioBuildIndexResponse } from '@/entities/dictionary';
import type { LocalFileAudioSettings, PronunciationSettings } from '@/entities/settings/types';


import { JobRow, useJobs, useJobTerminalWatcher, dismissJob, retryJob, jobErrorText } from '@/features/jobs';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { SettingsRow } from '@/shared/ui/SettingsRow';
import { VStack } from '@/shared/ui/Stack';
import styles from './LocalPronunciationSettingsPanel.module.css';

interface LocalPronunciationSettingsPanelProps {
  settings: PronunciationSettings;
  onChange: (settings: PronunciationSettings) => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function LocalPronunciationSettingsPanel({
  settings,
  onChange,
}: LocalPronunciationSettingsPanelProps): React.JSX.Element {
  const local = settings.localFile;
  const [status, setStatus] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [busy, setBusy] = useState(false);

  // The background owns indexing — rows live in the registry, and it stamps
  // lastIndexedAt itself. The panel only observes jobs for this DSL file.
  const indexJobs = useJobs('local-audio-index').filter(
    (j) => j.params.dslFileHandleId === local.dslFileHandleId,
  );
  useJobTerminalWatcher(indexJobs, (job) => {
    if (job.status === 'done') {
      setStatus(t('pronunciation.local.indexed', [job.result?.count ?? 0]));
    } else {
      setStatus(job.error !== undefined ? jobErrorText(job.error) : t('pronunciation.local.indexFailed'));
    }
  });

  const archiveHandleId = local.packageType === 'single'
    ? local.audioArchiveHandleId
    : local.splitArchiveDirectoryHandleId;

  useEffect(() => {
    let alive = true;
    setNeedsReconnect(false);
    if (!archiveHandleId) return;
    void (async (): Promise<void> => {
      const handle = await getFileHandle(archiveHandleId);
      if (!handle || !alive) return;
      const perm = await handle.queryPermission({ mode: 'read' });
      if (alive) setNeedsReconnect(perm !== 'granted');
    })().catch(() => undefined);
    return () => { alive = false; };
  }, [archiveHandleId]);

  const reconnect = async (): Promise<void> => {
    if (!archiveHandleId) return;
    const handle = await getFileHandle(archiveHandleId);
    if (!handle) return;
    const ok = await verifyPermission(handle, 'read');
    setNeedsReconnect(!ok);
    setStatus(ok ? t('pronunciation.local.reconnected') : t('pronunciation.local.permDenied'));
  };

  const updateLocal = (partial: Partial<LocalFileAudioSettings>): void => {
    onChange({ ...settings, localFile: { ...local, ...partial } });
  };

  const pickPackage = async (): Promise<void> => {
    setBusy(true);
    try {
      const dir = await window.showDirectoryPicker();
      const files = new Map<string, FileSystemFileHandle>();
      for await (const entry of dir.values()) {
        if (entry.kind === 'file') files.set(entry.name, entry);
      }
      const detected = detectPackage([...files.keys()]);
      if (!detected.ok) {
        setStatus(t(`pronunciation.local.${detected.reason === 'no-dsl' ? 'noDsl' : 'noArchive'}`));
        return;
      }
      const { dslName, kind, zipName, pattern } = detected.pkg;
      const dslHandle = files.get(dslName);
      if (!dslHandle) {
        setStatus(t('pronunciation.local.noDsl'));
        return;
      }
      let archivePatch: Partial<LocalFileAudioSettings>;
      if (kind === 'single') {
        const zipHandle = zipName ? files.get(zipName) : undefined;
        if (!zipHandle) {
          setStatus(t('pronunciation.local.noArchive'));
          return;
        }
        const archiveId = generateId();
        await saveFileHandle(archiveId, zipHandle);
        archivePatch = { audioArchiveHandleId: archiveId };
      } else {
        const dirId = generateId();
        await saveFileHandle(dirId, dir);
        archivePatch = { splitArchiveDirectoryHandleId: dirId, splitArchivePattern: pattern ?? '' };
      }
      const dslId = generateId();
      await saveFileHandle(dslId, dslHandle);
      if (local.dslFileHandleId) await clearLingvoDslIndex(local.dslFileHandleId);
      const next: PronunciationSettings = {
        ...settings,
        localFile: {
          ...local,
          dslFileHandleId: dslId,
          packageType: kind,
          ...archivePatch,
          lastIndexedAt: null,
        },
      };
      onChange(next);
      setStatus(t('pronunciation.local.indexing'));
      const res = await sendMessage<MessageResponse<LocalAudioBuildIndexResponse>>({
        type: MESSAGE_TYPES.LOCAL_AUDIO_BUILD_INDEX,
        payload: { dslFileHandleId: dslId },
      });
      if (!res?.success || !res.data) {
        throw new Error(res?.error ?? t('pronunciation.local.indexFailed'));
      }
    } catch (err) {
      setStatus(err instanceof Error && err.message === t('pronunciation.local.indexFailed')
        ? err.message
        : t('pronunciation.local.pickFailed'));
    } finally {
      setBusy(false);
    }
  };

  const configuredName = local.packageType === 'single'
    ? local.audioArchiveHandleId
    : local.splitArchiveDirectoryHandleId;

  return (
    <VStack gap="2">
      <SettingsRow dense>
        <span className={styles.rowLabel}>{t('pronunciation.local.package')}</span>
        <Button onClick={() => { void pickPackage(); }} disabled={busy}>
          {busy
            ? t('pronunciation.local.scanning')
            : configuredName
              ? t('pronunciation.local.changeFolder')
              : t('pronunciation.local.chooseFolder')}
        </Button>
      </SettingsRow>

      {local.packageType === 'split' && (
        <SettingsRow dense stacked>
          <label className={styles.rowLabel} htmlFor="split-pattern">{t('pronunciation.local.namePattern')}</label>
          <Input
            id="split-pattern"
            value={local.splitArchivePattern}
            onChange={(e) => updateLocal({ splitArchivePattern: e.target.value })}
            placeholder="ForvoEnglish_{firstLetter}.zip"
          />
        </SettingsRow>
      )}

      {needsReconnect && (
        <SettingsRow dense>
          <span className={styles.rowLabel}>{t('pronunciation.local.fileAccess')}</span>
          <Button onClick={() => { void reconnect(); }}>
            {t('pronunciation.local.reconnect')}
          </Button>
        </SettingsRow>
      )}

      {status && (
        <SettingsRow dense>
          <span className={styles.rowLabel}>{t('pronunciation.local.status')}</span>
          <span role="status">{status}</span>
        </SettingsRow>
      )}

      {indexJobs.map((job) => (
        <JobRow
          key={job.id}
          job={job}
          onDismiss={(jobId) => { void dismissJob(jobId).catch(() => undefined); }}
          onRetry={(jobId) => { void retryJob(jobId).catch(() => undefined); }}
        />
      ))}

      {local.lastIndexedAt && (
        <SettingsRow dense>
          <span className={styles.rowLabel}>{t('pronunciation.local.lastIndexed')}</span>
          <span>{new Date(local.lastIndexedAt).toLocaleString()}</span>
        </SettingsRow>
      )}
    </VStack>
  );
}
