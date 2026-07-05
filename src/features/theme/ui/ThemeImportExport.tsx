// ThemeImportExport — export/import theme JSON (spec F4).
//
// Export: download .json + copy to clipboard. Import: file picker + paste
// textarea → validate shape → onApply(config) hoặc error surface.

import { useState, useRef } from 'react';
import type { ThemeConfig } from '@/entities/theme';
import styles from './ThemeImportExport.module.css';

interface ThemeImportExportProps {
  /** Current config (for export). */
  config: ThemeConfig;
  /** Called when user applies an imported config. */
  onApply: (config: ThemeConfig) => void;
}

/** Validate parsed JSON has ThemeConfig shape (customColors.light + dark with 9 tokens). */
export function isValidThemeConfig(value: unknown): value is ThemeConfig {
  if (typeof value !== 'object' || value === null) return false;
  const cfg = value as Record<string, unknown>;
  const cc = cfg.customColors;
  if (typeof cc !== 'object' || cc === null) return false;
  const colors = cc as Record<string, unknown>;
  for (const mode of ['light', 'dark'] as const) {
    const m = colors[mode];
    if (typeof m !== 'object' || m === null) return false;
    const tokens = m as Record<string, unknown>;
    for (const key of ['primary', 'background', 'surface', 'text', 'textSecondary', 'border', 'success', 'warning', 'error']) {
      if (typeof tokens[key] !== 'string') return false;
    }
  }
  return true;
}

export function ThemeImportExport({ config, onApply }: ThemeImportExportProps): React.JSX.Element {
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearMsg = (): void => { setError(null); setSuccess(null); };

  const handleExport = (): void => {
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cell-theme.json';
    a.click();
    URL.revokeObjectURL(url);
    clearMsg();
    setSuccess('Exported cell-theme.json');
  };

  const handleCopy = async (): Promise<void> => {
    clearMsg();
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setSuccess('Copied to clipboard');
    } catch {
      setError('Copy failed — clipboard not available');
    }
  };

  const applyConfig = (raw: string): void => {
    clearMsg();
    try {
      const parsed = JSON.parse(raw);
      if (!isValidThemeConfig(parsed)) {
        setError('Invalid theme config — missing customColors.light/dark with 9 tokens');
        return;
      }
      onApply(parsed);
      setSuccess('Theme applied');
    } catch {
      setError('Invalid JSON — parse error');
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      setPasteText(text);
      applyConfig(text);
    }).catch(() => setError('Failed to read file'));
  };

  const handlePasteApply = (): void => {
    if (!pasteText.trim()) {
      setError('Paste JSON first');
      return;
    }
    applyConfig(pasteText);
  };

  return (
    <div className={styles.wrapper} data-testid="theme-import-export">
      <div className={styles.label}>Export / Import</div>
      <div className={styles.row}>
        <button className={styles.btn} onClick={handleExport} data-testid="theme-export">⬇ Export JSON</button>
        <button className={styles.btn} onClick={() => void handleCopy()} data-testid="theme-copy">📋 Copy</button>
        <button className={styles.btn} onClick={() => fileInputRef.current?.click()} data-testid="theme-import-file">⬆ Import file</button>
        <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFile} style={{ display: 'none' }} data-testid="theme-file-input" />
      </div>
      <div className={styles.label}>Or paste JSON:</div>
      <textarea
        className={styles.textarea}
        value={pasteText}
        onChange={(e) => { setPasteText(e.target.value); clearMsg(); }}
        placeholder='{"customColors":{"light":{...},"dark":{...}}}'
        data-testid="theme-paste-textarea"
      />
      <div className={styles.row} style={{ marginTop: 'var(--spacing-sm, 8px)' }}>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handlePasteApply} data-testid="theme-apply-paste">Apply</button>
      </div>
      {error && <div className={styles.error} data-testid="theme-import-error">{error}</div>}
      {success && <div className={styles.success} data-testid="theme-import-success">{success}</div>}
    </div>
  );
}
