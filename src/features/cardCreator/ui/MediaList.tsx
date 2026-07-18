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
 *
 * BEM block: .cc-media
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Icon } from '@/shared/icons/Icon';
import type { MediaFile } from '../media/mediaFile';
import styles from './MediaList.module.css';

interface MediaListProps {
  /** Media files currently attached. */
  readonly files: readonly MediaFile[];
  /** Kind of media — controls gallery vs list layout. */
  readonly kind: 'image' | 'audio';
  /** Label for the add button / aria-label. */
  readonly addLabel: string;
  /** Called when the user clicks the add button. */
  readonly onAdd: () => void;
  /** Called when the user clicks remove on a file. Receives the index. */
  readonly onRemove: (index: number) => void;
  /** Called when files are dropped onto the media zone. Receives valid files and the count of ignored invalid files. */
  readonly onFilesDrop?: (files: MediaFile[], invalidCount: number) => void;
  /** Called when the user reorders media items. Receives (fromIndex, toIndex). */
  readonly onReorder?: (fromIndex: number, toIndex: number) => void;
  /** Whether the add button is disabled (e.g. while capturing). */
  readonly addDisabled?: boolean;
  /** Optional data id prefix. */
  readonly dataId?: string;
}

/** Image icon for empty dropzone and audio waveform icon. */
function ThumbIcon({ kind, size = 20 }: { kind: 'image' | 'audio'; size?: number }): ReactElement {
  return kind === 'image' ? (
    <Icon name="image" size={size} className={styles['cc-media__icon--image']} />
  ) : (
    <Icon name="audioWave" size={size} className={styles['cc-media__icon--audio']} />
  );
}

/** Plus icon used in the dashed image add button. */
function PlusIcon(): ReactElement {
  return <Icon name="plus" size={24} />;
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
      className={styles['cc-media__preview']}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      data-testid="media-image-preview"
    >
      <button
        type="button"
        className={styles['cc-media__preview-close']}
        onClick={onClose}
        aria-label="Close preview"
      >
        ×
      </button>
      {url && <img className={styles['cc-media__preview-img']} src={url} alt={file.filename} />}
    </div>
  );
}

/** Empty dropzone with icon + label. */
function EmptyDropzone({
  kind,
  addLabel,
  onAdd,
  addDisabled,
  dataId,
}: {
  kind: 'image' | 'audio';
  addLabel: string;
  onAdd: () => void;
  addDisabled?: boolean;
  dataId?: string;
}): ReactElement {
  const text = kind === 'image' ? 'Drop image here or click to add' : 'Drop audio here or click to add';
  return (
    <button
      type="button"
      className={styles['cc-media__empty']}
      onClick={onAdd}
      disabled={addDisabled}
      aria-label={addLabel}
      data-testid={dataId ? `${dataId}-empty` : undefined}
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
  dataId,
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
  dataId?: string;
}): ReactElement {
  const url = useBlobUrl(file);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPreview(file);
    }
  };

  const thumbClass = [styles['cc-media__thumb']]
    .concat(isDragging ? [styles['cc-media__thumb--dragging']] : [])
    .concat(isDragOver ? [styles['cc-media__thumb--drag-over']] : [])
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
      data-testid={dataId ? `${dataId}-thumb-${index}` : undefined}
    >
      {url && <img className={styles['cc-media__img']} src={url} alt={file.filename} />}
      <button
        type="button"
        className={styles['cc-media__thumb-remove']}
        aria-label={`Remove ${file.filename}`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        data-testid={dataId ? `${dataId}-remove-${index}` : undefined}
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
  dataId,
}: {
  files: readonly MediaFile[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onPreview: (file: MediaFile) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  addDisabled?: boolean;
  addLabel: string;
  dataId?: string;
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
    <div className={styles['cc-media__gallery']} role="list" onDrop={handleGalleryDrop}>
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
          dataId={dataId}
        />
      ))}
      <button
        type="button"
        className={styles['cc-media__gallery-add']}
        onClick={onAdd}
        disabled={addDisabled}
        aria-label={addLabel}
        data-testid={dataId ? `${dataId}-add` : undefined}
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
  dataId,
}: {
  files: readonly MediaFile[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onPlay: (file: MediaFile) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  addDisabled?: boolean;
  addLabel: string;
  dataId?: string;
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
    <div className={styles['cc-media__list']} onDrop={handleListDrop}>
      {files.length === 0 && (
        <EmptyDropzone
          kind="audio"
          addLabel={addLabel}
          onAdd={onAdd}
          addDisabled={addDisabled}
          dataId={dataId}
        />
      )}
      {files.map((file, index) => {
        const rowClass = [styles['cc-media__row']]
          .concat(draggingIndex === index ? [styles['cc-media__row--dragging']] : [])
          .concat(dragOverIndex === index ? [styles['cc-media__row--drag-over']] : [])
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
              className={styles['cc-media__play']}
              onClick={() => onPlay(file)}
              aria-label={`Play ${file.filename}`}
              data-testid={dataId ? `${dataId}-view-${index}` : undefined}
            >
              <ThumbIcon kind="audio" size={16} />
            </button>
            <span className={styles['cc-media__name']}>{file.filename}</span>
            <button
              type="button"
              className={styles['cc-media__row-remove']}
              onClick={() => onRemove(index)}
              aria-label={`Remove ${file.filename}`}
              data-testid={dataId ? `${dataId}-remove-${index}` : undefined}
            >
              ×
            </button>
          </div>
        );
      })}
      {files.length > 0 && (
        <button
          type="button"
          className={styles['cc-media__list-add']}
          onClick={onAdd}
          disabled={addDisabled}
          data-testid={dataId ? `${dataId}-add` : undefined}
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
  dataId,
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

  const zoneClass = isDragOver
    ? `${styles['cc-media']} ${styles['cc-media--drag-over']}`
    : styles['cc-media'];

  return (
    <div
      className={zoneClass}
      data-testid={dataId}
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
            dataId={dataId}
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
            dataId={dataId}
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
          dataId={dataId}
        />
      )}
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} />
      {/* Image preview overlay */}
      {previewFile && <ImagePreview file={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  );
}
