import { useEffect, useState } from 'react';
import { t } from '@/shared/i18n';
import { parseLingvoDsl } from '@/features/pronunciation/services/lingvoDslParser';
import { clearLingvoDslIndex, saveLingvoDslIndex } from '@/features/pronunciation/repositories/lingvoDslIndexRepository';
import { getFileHandle, saveFileHandle, verifyPermission } from '@/shared/lib/storage/localFileHandleStorage';
import type { LocalFileAudioSettings, PronunciationSettings } from '@/entities/settings/types';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/Select';
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

  const pickDsl = async (): Promise<void> => {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Lingvo DSL', accept: { 'text/plain': ['.dsl'] } }],
      });
      const id = generateId();
      await saveFileHandle(id, handle);
      if (local.dslFileHandleId) await clearLingvoDslIndex(local.dslFileHandleId);
      updateLocal({ dslFileHandleId: id, lastIndexedAt: null });
      setStatus(t('pronunciation.local.selectedDsl', [handle.name]));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : t('pronunciation.local.pickFailed'));
    }
  };

  const pickArchive = async (): Promise<void> => {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
      });
      const id = generateId();
      await saveFileHandle(id, handle);
      updateLocal({ audioArchiveHandleId: id, packageType: 'single' });
      setStatus(t('pronunciation.local.selectedArchive', [handle.name]));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : t('pronunciation.local.archiveFailed'));
    }
  };

  const pickSplitDirectory = async (): Promise<void> => {
    try {
      const handle = await window.showDirectoryPicker();
      const id = generateId();
      await saveFileHandle(id, handle);
      updateLocal({ splitArchiveDirectoryHandleId: id, packageType: 'split' });
      setStatus(t('pronunciation.local.selectedDir', [handle.name]));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : t('pronunciation.local.dirFailed'));
    }
  };

  const buildIndex = async (): Promise<void> => {
    if (!local.dslFileHandleId) {
      setStatus(t('pronunciation.local.selectDslFirst'));
      return;
    }
    setStatus(t('pronunciation.local.reading'));
    try {
      const handle = await getFileHandle(local.dslFileHandleId);
      if (!handle || handle.kind !== 'file') {
        setStatus(t('pronunciation.local.handleMissing'));
        return;
      }
      if (!(await verifyPermission(handle, 'read'))) {
        setStatus(t('pronunciation.local.permDenied'));
        return;
      }
      const file = await (handle as FileSystemFileHandle).getFile();
      const text = await file.text();
      const entries = parseLingvoDsl(text, local.dslFileHandleId);
      await saveLingvoDslIndex(local.dslFileHandleId, entries);
      updateLocal({ lastIndexedAt: entries.length > 0 ? Date.now() : null });
      setStatus(t('pronunciation.local.indexed', [entries.length]));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : t('pronunciation.local.indexFailed'));
    }
  };

  return (
    <VStack gap="2">
      <SettingsRow dense stacked>
        <label className={styles.rowLabel} htmlFor="local-package-type">{t('pronunciation.local.packageType')}</label>
        <Select
          id="local-package-type"
          value={local.packageType}
          options={[
            { value: 'single', label: t('pronunciation.local.single') },
            { value: 'split', label: t('pronunciation.local.split') },
          ]}
          onChange={(value) => updateLocal({ packageType: value as 'single' | 'split' })}
        />
      </SettingsRow>

      <SettingsRow dense>
        <span className={styles.rowLabel}>{t('pronunciation.local.dslIndex')}</span>
        <Button onClick={() => { void pickDsl(); }}>
          {local.dslFileHandleId ? t('pronunciation.local.changeDsl') : t('pronunciation.local.chooseDsl')}
        </Button>
      </SettingsRow>

      {local.packageType === 'single' ? (
        <SettingsRow dense>
          <span className={styles.rowLabel}>{t('pronunciation.local.audioArchive')}</span>
          <Button onClick={() => { void pickArchive(); }}>
            {local.audioArchiveHandleId ? t('pronunciation.local.changeZip') : t('pronunciation.local.chooseZip')}
          </Button>
        </SettingsRow>
      ) : (
        <>
          <SettingsRow dense>
            <span className={styles.rowLabel}>{t('pronunciation.local.splitDir')}</span>
            <Button onClick={() => { void pickSplitDirectory(); }}>
              {local.splitArchiveDirectoryHandleId ? t('pronunciation.local.changeDir') : t('pronunciation.local.chooseDir')}
            </Button>
          </SettingsRow>
          <SettingsRow dense stacked>
            <label className={styles.rowLabel} htmlFor="split-pattern">{t('pronunciation.local.namePattern')}</label>
            <Input
              id="split-pattern"
              value={local.splitArchivePattern}
              onChange={(e) => updateLocal({ splitArchivePattern: e.target.value })}
              placeholder="ForvoEnglish_{firstLetter}.zip"
            />
          </SettingsRow>
        </>
      )}

      <SettingsRow dense>
        <span className={styles.rowLabel}>{t('pronunciation.local.buildIndex')}</span>
        <Button onClick={() => { void buildIndex(); }} disabled={!local.dslFileHandleId}>
          {t('pronunciation.local.buildBtn')}
        </Button>
      </SettingsRow>

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
          <span>{status}</span>
        </SettingsRow>
      )}

      {local.lastIndexedAt && (
        <SettingsRow dense>
          <span className={styles.rowLabel}>{t('pronunciation.local.lastIndexed')}</span>
          <span>{new Date(local.lastIndexedAt).toLocaleString()}</span>
        </SettingsRow>
      )}
    </VStack>
  );
}
