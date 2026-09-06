// Dropzone — drag-drop + click file picker (spec F11).

import { useRef, useState, useCallback, type ReactElement, type DragEvent, type KeyboardEvent } from 'react';
import styles from './Dropzone.module.css';

interface DropzoneProps {
  /** Short verb-first action label, e.g. "Thêm từ điển". */
  readonly label: string;
  /** Optional secondary hint line (formats, drag-drop note). */
  readonly hint?: string;
  readonly accept: string;
  readonly disabled: boolean;
  readonly onFiles: (files: File[]) => void;
}

export function Dropzone({ label, hint, accept, disabled, onFiles }: DropzoneProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }, [disabled, onFiles]);

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onFiles(files);
    e.target.value = ''; // reset for re-select
  }, [onFiles]);

  return (
    <div
      className={`${styles.dropzone} ${dragging ? styles.dragging : ''} ${disabled ? styles.disabled : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={label}
      data-cell-id="dropzone"
    >
      <p className={styles.label}>{label}</p>
      {hint && <p className={styles.hint}>{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleChange}
        className={styles.input}
        data-cell-id="dropzone-input"
      />
    </div>
  );
}
