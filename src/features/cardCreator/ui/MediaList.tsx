/**
 * MediaList — media files attached to a Card Creator field.
 *
 * Branches by `kind`:
 *  - `image`  → horizontal scrollable gallery with 120px thumbnails, top-right
 *               remove button, add button at end, empty dropzone.
 *  - `audio`  → vertical list with waveform icon, filename, and remove button.
 *
 * ADR-026: image click opens full-size preview; audio waveform plays in-place.
 * Blob URLs are created from MediaFile ArrayBuffers and revoked on unmount.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { MediaFile } from '../media/mediaFile';
import styles from './MediaList.module.css';

interface MediaListProps {
  /** Media files currently attached. */
  files: readonly MediaFile[];
  /** Kind of media — controls gallery vs list layout. */
  kind: 'image' | 'audio';
  /** Label for the add button / aria-label. */
  addLabel: string;
  /** Called when the user clicks the add button. */
  onAdd: () => void;
  /** Called when the user clicks remove on a file. Receives the index. */
  onRemove: (index: number) => void;
  /** Whether the add button is disabled (e.g. while capturing). */
  addDisabled?: boolean;
  /** Optional test id prefix. */
  testId?: string;
}

/** Image icon for empty dropzone and audio waveform icon. */
function ThumbIcon({ kind, size = 20 }: { kind: 'image' | 'audio'; size?: number }): ReactElement {
  if (kind === 'image') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        width={size}
        height={size}
        className={styles.imageThumbIcon}
      >
        <rect x="3" y="3" width="18" height="18" rx="2" fill="none" />
        <circle cx="9" cy="9" r="2" fill="none" />
        <path d="M21 15l-5-5L5 21" fill="none" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width={size}
      height={size}
    >
      <path d="M3 10v4" />
      <path d="M7 6v12" />
      <path d="M11 3v18" />
      <path d="M15 8v8" />
      <path d="M19 11v2" />
    </svg>
  );
}

/** Plus icon used in the dashed image add button. */
function PlusIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width="24"
      height="24"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

/** Build a Blob URL from a MediaFile (for image preview + audio playback). */
function useBlobUrl(file: MediaFile | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const blob = new Blob([file.data], { type: file.mimeType });
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

/** Image preview overlay — click thumbnail to open, click overlay/X to close. */
function ImagePreview({ file, onClose }: { file: MediaFile; onClose: () => void }): ReactElement {
  const url = useBlobUrl(file);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className={styles.previewOverlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      data-testid="media-image-preview"
    >
      <button
        type="button"
        className={styles.previewClose}
        onClick={onClose}
        aria-label="Close preview"
      >
        ×
      </button>
      {url && <img className={styles.previewImg} src={url} alt={file.filename} />}
    </div>
  );
}

/** Empty dropzone with icon + label. */
function EmptyDropzone({
  kind,
  addLabel,
  onAdd,
  addDisabled,
  testId,
}: {
  kind: 'image' | 'audio';
  addLabel: string;
  onAdd: () => void;
  addDisabled?: boolean;
  testId?: string;
}): ReactElement {
  const text = kind === 'image' ? 'Drop image here or click to add' : 'Drop audio here or click to add';
  return (
    <button
      type="button"
      className={styles.emptyDropzone}
      onClick={onAdd}
      disabled={addDisabled}
      aria-label={addLabel}
      data-testid={testId ? `${testId}-empty` : undefined}
    >
      <ThumbIcon kind={kind} size={24} />
      <span>{text}</span>
    </button>
  );
}

/** Single image thumbnail in the gallery. */
function ImageThumb({
  file,
  index,
  onRemove,
  onPreview,
  testId,
}: {
  file: MediaFile;
  index: number;
  onRemove: (index: number) => void;
  onPreview: (file: MediaFile) => void;
  testId?: string;
}): ReactElement {
  const url = useBlobUrl(file);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPreview(file);
    }
  };

  return (
    <div
      className={styles.imageThumb}
      role="button"
      tabIndex={0}
      aria-label={`Preview ${file.filename}`}
      onClick={() => onPreview(file)}
      onKeyDown={handleKeyDown}
      data-testid={testId ? `${testId}-thumb-${index}` : undefined}
    >
      {url && <img className={styles.imageImg} src={url} alt={file.filename} />}
      <button
        type="button"
        className={styles.imageRemoveButton}
        aria-label={`Remove ${file.filename}`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        data-testid={testId ? `${testId}-remove-${index}` : undefined}
      >
        ×
      </button>
    </div>
  );
}

/** Horizontal image gallery + add button. */
function ImageGallery({
  files,
  onAdd,
  onRemove,
  onPreview,
  addDisabled,
  addLabel,
  testId,
}: {
  files: readonly MediaFile[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onPreview: (file: MediaFile) => void;
  addDisabled?: boolean;
  addLabel: string;
  testId?: string;
}): ReactElement {
  return (
    <div className={styles.imageGallery} role="list">
      {files.map((file, index) => (
        <ImageThumb
          key={`${file.filename}-${index}`}
          file={file}
          index={index}
          onRemove={onRemove}
          onPreview={onPreview}
          testId={testId}
        />
      ))}
      <button
        type="button"
        className={styles.imageAddButton}
        onClick={onAdd}
        disabled={addDisabled}
        aria-label={addLabel}
        data-testid={testId ? `${testId}-add` : undefined}
      >
        <PlusIcon />
      </button>
    </div>
  );
}

/** Vertical audio list. */
function AudioList({
  files,
  onAdd,
  onRemove,
  onPlay,
  addDisabled,
  addLabel,
  testId,
}: {
  files: readonly MediaFile[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onPlay: (file: MediaFile) => void;
  addDisabled?: boolean;
  addLabel: string;
  testId?: string;
}): ReactElement {
  return (
    <div className={styles.mediaList}>
      {files.length === 0 && (
        <EmptyDropzone
          kind="audio"
          addLabel={addLabel}
          onAdd={onAdd}
          addDisabled={addDisabled}
          testId={testId}
        />
      )}
      {files.map((file, index) => (
        <div className={styles.mediaRow} key={`${file.filename}-${index}`}>
          <button
            type="button"
            className={styles.mediaThumb}
            onClick={() => onPlay(file)}
            aria-label={`Play ${file.filename}`}
            data-testid={testId ? `${testId}-view-${index}` : undefined}
          >
            <ThumbIcon kind="audio" size={16} />
          </button>
          <span className={styles.mediaName}>{file.filename}</span>
          <button
            type="button"
            className={styles.removeButton}
            onClick={() => onRemove(index)}
            aria-label={`Remove ${file.filename}`}
            data-testid={testId ? `${testId}-remove-${index}` : undefined}
          >
            ×
          </button>
        </div>
      ))}
      {files.length > 0 && (
        <button
          type="button"
          className={styles.addButton}
          onClick={onAdd}
          disabled={addDisabled}
          data-testid={testId ? `${testId}-add` : undefined}
        >
          + {addLabel}
        </button>
      )}
    </div>
  );
}

export function MediaList({
  files,
  kind,
  addLabel,
  onAdd,
  onRemove,
  addDisabled,
  testId,
}: MediaListProps): ReactElement {
  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /** Play an audio file via Blob URL. */
  const playAudio = (file: MediaFile): void => {
    const blob = new Blob([file.data], { type: file.mimeType });
    const url = URL.createObjectURL(blob);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = url;
      audioRef.current.onended = () => URL.revokeObjectURL(url);
      void audioRef.current.play().catch((err) => {
        console.error('[MediaList] audio play failed', {
          err,
          blobSize: blob.size,
          mimeType: file.mimeType,
          dataType: typeof file.data,
          dataByteLength: file.data?.byteLength,
        });
        URL.revokeObjectURL(url);
      });
    }
  };

  return (
    <div className={styles.mediaZone} data-testid={testId} data-kind={kind}>
      {kind === 'image' ? (
        files.length === 0 ? (
          <EmptyDropzone
            kind="image"
            addLabel={addLabel}
            onAdd={onAdd}
            addDisabled={addDisabled}
            testId={testId}
          />
        ) : (
          <ImageGallery
            files={files}
            onAdd={onAdd}
            onRemove={onRemove}
            onPreview={setPreviewFile}
            addDisabled={addDisabled}
            addLabel={addLabel}
            testId={testId}
          />
        )
      ) : (
        <AudioList
          files={files}
          onAdd={onAdd}
          onRemove={onRemove}
          onPlay={playAudio}
          addDisabled={addDisabled}
          addLabel={addLabel}
          testId={testId}
        />
      )}
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} />
      {/* Image preview overlay */}
      {previewFile && <ImagePreview file={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  );
}
