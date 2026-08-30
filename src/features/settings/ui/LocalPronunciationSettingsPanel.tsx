import { useState } from 'react';
import { parseLingvoDsl } from '@/features/pronunciation/services/lingvoDslParser';
import { saveLingvoDslIndex } from '@/features/pronunciation/repositories/lingvoDslIndexRepository';
import { getFileHandle, saveFileHandle, verifyPermission } from '@/shared/lib/storage/localFileHandleStorage';
import type { LocalFileAudioSettings, PronunciationSettings } from '@/entities/settings/types';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/Select';
import { Input } from '@/shared/ui/Input';

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
    <div>
      <div className="field">
        <label>Package type</label>
        <Select
          value={local.packageType}
          options={[
            { value: 'single', label: 'Single .dsl.files.zip' },
            { value: 'split', label: 'Split zips (per first letter)' },
          ]}
          onChange={(value) => updateLocal({ packageType: value as 'single' | 'split' })}
        />
      </div>

      <div className="field">
        <Button onClick={pickDsl}>Choose .dsl file</Button>
        {local.dslFileHandleId && <span> DSL handle: {local.dslFileHandleId.slice(0, 16)}…</span>}
      </div>

      {local.packageType === 'single' ? (
        <div className="field">
          <Button onClick={pickArchive}>Choose .dsl.files.zip</Button>
          {local.audioArchiveHandleId && <span> Archive handle: {local.audioArchiveHandleId.slice(0, 16)}…</span>}
        </div>
      ) : (
        <>
          <div className="field">
            <Button onClick={pickSplitDirectory}>Choose split zip directory</Button>
            {local.splitArchiveDirectoryHandleId && <span> Directory handle: {local.splitArchiveDirectoryHandleId.slice(0, 16)}…</span>}
          </div>
          <div className="field">
            <label htmlFor="split-pattern">Archive name pattern</label>
            <Input
              id="split-pattern"
              value={local.splitArchivePattern}
              onChange={(e) => updateLocal({ splitArchivePattern: e.target.value })}
              placeholder="ForvoEnglish_{firstLetter}.zip"
            />
          </div>
        </>
      )}

      <div className="field">
        <Button onClick={buildIndex} disabled={!local.dslFileHandleId}>
          Build index
        </Button>
      </div>

      {status && <p>{status}</p>}

      {local.lastIndexedAt && (
        <p>Last indexed: {new Date(local.lastIndexedAt).toLocaleString()}</p>
      )}
    </div>
  );
}
