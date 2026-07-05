// Dropzone — drag-drop + click file picker (spec F11).

import { useRef, useState, useCallback, type ReactElement, type DragEvent } from 'react';
import styles from './Dropzone.module.css';

interface DropzoneProps {
  readonly label: string;
  readonly accept: string;
  readonly disabled: boolean;
  readonly onFiles: (files: File[]) => void;
}

export function Dropzone({ label, accept, disabled, onFiles }: DropzoneProps): ReactElement {
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
      role="button"
      tabIndex={0}
      aria-label={label}
      data-testid="dropzone"
    >
      <p className={styles.label}>{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleChange}
        className={styles.input}
        data-testid="dropzone-input"
      />
    </div>
  );
}
