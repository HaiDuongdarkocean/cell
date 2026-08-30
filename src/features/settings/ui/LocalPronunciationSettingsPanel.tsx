import { useState } from 'react';
import { parseLingvoDsl } from '@/features/pronunciation/services/lingvoDslParser';
import { saveLingvoDslIndex } from '@/features/pronunciation/repositories/lingvoDslIndexRepository';
import { getFileHandle, saveFileHandle, verifyPermission } from '@/shared/lib/storage/localFileHandleStorage';
import type { LocalFileAudioSettings, PronunciationSettings } from '@/entities/settings/types';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/Select';
import { Input } from '@/shared/ui/Input';
import { SettingsRow } from '@/shared/ui/SettingsRow';
import { VStack } from '@/shared/ui/Stack';
import styles from './SettingsDialog.module.css';

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
      updateLocal({ dslFileHandleId: id });
      setStatus(`Selected DSL: ${handle.name}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to select DSL file');
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
      setStatus(`Selected archive: ${handle.name}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to select archive');
    }
  };

  const pickSplitDirectory = async (): Promise<void> => {
    try {
      const handle = await window.showDirectoryPicker();
      const id = generateId();
      await saveFileHandle(id, handle);
      updateLocal({ splitArchiveDirectoryHandleId: id, packageType: 'split' });
      setStatus(`Selected split directory: ${handle.name}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to select split directory');
    }
  };

  const buildIndex = async (): Promise<void> => {
    if (!local.dslFileHandleId) {
      setStatus('Select a .dsl file first');
      return;
    }
    setStatus('Reading .dsl...');
    try {
      const handle = await getFileHandle(local.dslFileHandleId);
      if (!handle || handle.kind !== 'file') {
        setStatus('Stored DSL handle is missing or not a file.');
        return;
      }
      if (!(await verifyPermission(handle, 'read'))) {
        setStatus('Permission denied for DSL file.');
        return;
      }
      const file = await (handle as FileSystemFileHandle).getFile();
      const text = await file.text();
      const entries = parseLingvoDsl(text, local.dslFileHandleId);
      await saveLingvoDslIndex(local.dslFileHandleId, entries);
      updateLocal({ lastIndexedAt: Date.now() });
      setStatus(`Indexed ${entries.length} entries.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to build index');
    }
  };

  return (
    <VStack gap="0">
      <SettingsRow dense stacked>
        <label className={styles.rowLabel} htmlFor="local-package-type">Package type</label>
        <Select
          id="local-package-type"
          value={local.packageType}
          options={[
            { value: 'single', label: 'Single .dsl.files.zip' },
            { value: 'split', label: 'Split zips (per first letter)' },
          ]}
          onChange={(value) => updateLocal({ packageType: value as 'single' | 'split' })}
        />
      </SettingsRow>

      <SettingsRow dense>
        <span className={styles.rowLabel}>Lingvo DSL index</span>
        <Button onClick={pickDsl}>
          {local.dslFileHandleId ? 'Change .dsl file' : 'Choose .dsl file'}
        </Button>
      </SettingsRow>

      {local.packageType === 'single' ? (
        <SettingsRow dense>
          <span className={styles.rowLabel}>Audio archive</span>
          <Button onClick={pickArchive}>
            {local.audioArchiveHandleId ? 'Change .zip' : 'Choose .dsl.files.zip'}
          </Button>
        </SettingsRow>
      ) : (
        <>
          <SettingsRow dense>
            <span className={styles.rowLabel}>Split zip directory</span>
            <Button onClick={pickSplitDirectory}>
              {local.splitArchiveDirectoryHandleId ? 'Change directory' : 'Choose split zip directory'}
            </Button>
          </SettingsRow>
          <SettingsRow dense stacked>
            <label className={styles.rowLabel} htmlFor="split-pattern">Archive name pattern</label>
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
        <span className={styles.rowLabel}>Index build</span>
        <Button onClick={buildIndex} disabled={!local.dslFileHandleId}>
          Build index
        </Button>
      </SettingsRow>

      {status && (
        <SettingsRow dense>
          <span className={styles.rowLabel}>Status</span>
          <span>{status}</span>
        </SettingsRow>
      )}

      {local.lastIndexedAt && (
        <SettingsRow dense>
          <span className={styles.rowLabel}>Last indexed</span>
          <span>{new Date(local.lastIndexedAt).toLocaleString()}</span>
        </SettingsRow>
      )}
    </VStack>
  );
}
