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
  /** Called when files are dropped onto the media zone. Receives valid files and the count of ignored invalid files. */
  onFilesDrop?: (files: MediaFile[], invalidCount: number) => void;
  /** Called when the user reorders media items. Receives (fromIndex, toIndex). */
  onReorder?: (fromIndex: number, toIndex: number) => void;
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

/** Determine whether a File is an image or an audio file.
 *  Prefer the MIME type; fall back to filename extension for files with an empty type. */
function isAcceptedFile(file: File, kind: 'image' | 'audio'): boolean {
  if (file.type) {
    return kind === 'image' ? file.type.startsWith('image/') : file.type.startsWith('audio/');
  }
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (kind === 'image') {
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext ?? '');
  }
  return ['mp3', 'webm', 'ogg', 'wav', 'flac', 'm4a', 'aac', 'oga', 'opus'].includes(ext ?? '');
}

/** Convert a File dropped into the media zone into a MediaFile. */
async function fileToMediaFile(file: File, kind: 'image' | 'audio'): Promise<MediaFile> {
  const data = await file.arrayBuffer();
  return {
    kind,
    filename: file.name,
    mimeType: file.type || (kind === 'image' ? 'image/png' : 'audio/webm'),
    data,
  };
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
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isDragOver,
  testId,
}: {
  file: MediaFile;
  index: number;
  onRemove: (index: number) => void;
  onPreview: (file: MediaFile) => void;
  draggable?: boolean;
  onDragStart?: React.DragEventHandler<HTMLDivElement>;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
  onDragEnd?: React.DragEventHandler<HTMLDivElement>;
  isDragging?: boolean;
  isDragOver?: boolean;
  testId?: string;
}): ReactElement {
  const url = useBlobUrl(file);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPreview(file);
    }
  };

  const thumbClass = [styles.imageThumb]
    .concat(isDragging ? styles.imageThumbDragging : [])
    .concat(isDragOver ? styles.imageThumbDragOver : [])
    .join(' ');

  return (
    <div
      className={thumbClass}
      role="button"
      tabIndex={0}
      draggable={draggable}
      aria-label={`Preview ${file.filename}`}
      onClick={() => onPreview(file)}
      onKeyDown={handleKeyDown}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      data-index={index}
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
  onReorder,
  addDisabled,
  addLabel,
  testId,
}: {
  files: readonly MediaFile[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onPreview: (file: MediaFile) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  addDisabled?: boolean;
  addLabel: string;
  testId?: string;
}): ReactElement {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => (e: React.DragEvent<HTMLDivElement>): void => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggingIndex(index);
    setDragOverIndex(null);
  };

  const handleDragOver = (index: number) => (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (draggingIndex !== null) {
      e.stopPropagation();
      setDragOverIndex(index);
    }
    // External file drag: let bubble to outer mediaZone so processDrop runs.
  };

  const handleDrop = (index: number) => (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (draggingIndex !== null) {
      e.stopPropagation();
      if (draggingIndex !== index) {
        onReorder?.(draggingIndex, index);
      }
      setDraggingIndex(null);
      setDragOverIndex(null);
    }
    // External file drop: let bubble to outer mediaZone so processDrop runs.
  };

  const handleDragEnd = (): void => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleGalleryDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    if (draggingIndex !== null) {
      e.preventDefault();
      e.stopPropagation();
      setDraggingIndex(null);
      setDragOverIndex(null);
    }
    // External file drop: let bubble to outer mediaZone so processDrop runs.
  };

  const draggable = onReorder !== undefined;

  return (
    <div className={styles.imageGallery} role="list" onDrop={handleGalleryDrop}>
      {files.map((file, index) => (
        <ImageThumb
          key={`${file.filename}-${index}`}
          file={file}
          index={index}
          onRemove={onRemove}
          onPreview={onPreview}
          draggable={draggable}
          onDragStart={handleDragStart(index)}
          onDragOver={handleDragOver(index)}
          onDrop={handleDrop(index)}
          onDragEnd={handleDragEnd}
          isDragging={draggingIndex === index}
          isDragOver={dragOverIndex === index}
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
  onReorder,
  addDisabled,
  addLabel,
  testId,
}: {
  files: readonly MediaFile[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onPlay: (file: MediaFile) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  addDisabled?: boolean;
  addLabel: string;
  testId?: string;
}): ReactElement {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => (e: React.DragEvent<HTMLDivElement>): void => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggingIndex(index);
    setDragOverIndex(null);
  };

  const handleDragOver = (index: number) => (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (draggingIndex !== null) {
      e.stopPropagation();
      setDragOverIndex(index);
    }
    // External file drag: let bubble to outer mediaZone so processDrop runs.
  };

  const handleDrop = (index: number) => (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (draggingIndex !== null) {
      e.stopPropagation();
      if (draggingIndex !== index) {
        onReorder?.(draggingIndex, index);
      }
      setDraggingIndex(null);
      setDragOverIndex(null);
    }
    // External file drop: let bubble to outer mediaZone so processDrop runs.
  };

  const handleDragEnd = (): void => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleListDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    if (draggingIndex !== null) {
      e.preventDefault();
      e.stopPropagation();
      setDraggingIndex(null);
      setDragOverIndex(null);
    }
    // External file drop: let bubble to outer mediaZone so processDrop runs.
  };

  const draggable = onReorder !== undefined;

  return (
    <div className={styles.mediaList} onDrop={handleListDrop}>
      {files.length === 0 && (
        <EmptyDropzone
          kind="audio"
          addLabel={addLabel}
          onAdd={onAdd}
          addDisabled={addDisabled}
          testId={testId}
        />
      )}
      {files.map((file, index) => {
        const rowClass = [styles.mediaRow]
          .concat(draggingIndex === index ? styles.mediaRowDragging : [])
          .concat(dragOverIndex === index ? styles.mediaRowDragOver : [])
          .join(' ');
        return (
          <div
            className={rowClass}
            key={`${file.filename}-${index}`}
            draggable={draggable}
            onDragStart={handleDragStart(index)}
            onDragOver={handleDragOver(index)}
            onDrop={handleDrop(index)}
            onDragEnd={handleDragEnd}
            data-index={index}
          >
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
        );
      })}
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
  onFilesDrop,
  onReorder,
  addDisabled,
  testId,
}: MediaListProps): ReactElement {
  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dragCounterRef = useRef(0);

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

  /** Process dropped files: filter by kind, convert, and call onFilesDrop. */
  const processDrop = async (dt: DataTransfer | null): Promise<void> => {
    if (!onFilesDrop || !dt) return;
    const droppedFiles = Array.from(dt.files);
    const valid: File[] = [];
    const invalid: File[] = [];
    for (const f of droppedFiles) {
      if (isAcceptedFile(f, kind)) {
        valid.push(f);
      } else {
        invalid.push(f);
      }
    }
    const mediaFiles = await Promise.all(valid.map((f) => fileToMediaFile(f, kind)));
    onFilesDrop(mediaFiles, invalid.length);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDragOver(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    void processDrop(e.dataTransfer);
  };

  const zoneClass = isDragOver ? `${styles.mediaZone} ${styles.mediaZoneDragOver}` : styles.mediaZone;

  return (
    <div
      className={zoneClass}
      data-testid={testId}
      data-kind={kind}
      onDragEnter={onFilesDrop ? handleDragEnter : undefined}
      onDragLeave={onFilesDrop ? handleDragLeave : undefined}
      onDragOver={onFilesDrop ? handleDragOver : undefined}
      onDrop={onFilesDrop ? handleDrop : undefined}
    >
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
            onReorder={onReorder}
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
          onReorder={onReorder}
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
