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
import { Button } from '@/shared/ui/Button';
import { pushEscapeLayer } from '@/shared/ui/escapeLayerStack';

import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
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
function ThumbIcon({ kind, size = 'sm' }: { kind: 'image' | 'audio'; size?: 'xs' | 'sm' | 'md' | 'lg' }): ReactElement {
  return kind === 'image' ? (
    <Icon name="image" size={size} className={styles['cc-media__icon--image']} />
  ) : (
    <Icon name="audioWave" size={size} className={styles['cc-media__icon--audio']} />
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
    // Shared Escape stack: the preview consumes the key so the surrounding
    // card-creator sheet/dialog doesn't close on the same keypress.
    return pushEscapeLayer(() => onClose());
  }, [onClose]);
  return (
    <div
      className={styles['cc-media__preview']}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('cardCreator.media.preview')}
      data-cell-id="media-image-preview"
    >
      <Button
        size="sm"
        shape="circle"
        variant="secondary"
        className={styles['cc-media__preview-close']}
        onClick={onClose}
        aria-label={t('cardCreator.media.closePreview')}
      >
        <Icon name="x" size="sm" />
      </Button>
      {url && <img className={styles['cc-media__preview-img']} src={url} alt={file.filename} />}
    </div>
  );
}

/** Empty dropzone with icon + label. */
function EmptyDropzone({
  kind,
  onAdd,
  addDisabled,
  dataId,
}: {
  kind: 'image' | 'audio';
  onAdd: () => void;
  addDisabled?: boolean;
  dataId?: string;
}): ReactElement {
  const text = kind === 'image' ? t('cardCreator.empty.image') : t('cardCreator.empty.audio');
  const modifier = kind === 'image' ? styles['cc-media__empty--image'] : styles['cc-media__empty--audio'];
  return (
    <button
      type="button"
      className={`${styles['cc-media__empty']} ${modifier}`}
      onClick={onAdd}
      disabled={addDisabled}
      data-cell-id={dataId ? `${dataId}-empty` : undefined}
    >
      <ThumbIcon kind={kind} size="sm" />
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
      aria-label={t('cardCreator.media.previewItem', [file.filename])}
      onClick={() => onPreview(file)}
      onKeyDown={handleKeyDown}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      data-index={index}
      data-cell-id={dataId ? `${dataId}-thumb-${index}` : undefined}
    >
      {url && <img className={styles['cc-media__img']} src={url} alt={file.filename} />}
      <Button
        size="sm"
        shape="circle"
        variant="ghost"
        className={styles['cc-media__thumb-remove']}
        aria-label={t('cardCreator.media.remove', [file.filename])}
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        data-cell-id={dataId ? `${dataId}-remove-${index}` : undefined}
      >
        <Icon name="x" size="sm" />
      </Button>
    </div>
  );
}

/** Horizontal image gallery (reorderable thumbnails). */
function ImageGallery({
  files,
  onRemove,
  onPreview,
  onReorder,
  dataId,
}: {
  files: readonly MediaFile[];
  onRemove: (index: number) => void;
  onPreview: (file: MediaFile) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const focusable = Array.from(e.currentTarget.querySelectorAll('button, [tabindex="0"]'));
    const active = document.activeElement;
    const currentIndex = active ? focusable.indexOf(active) : -1;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = focusable[currentIndex + 1] as HTMLElement | undefined;
      next?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = focusable[currentIndex - 1] as HTMLElement | undefined;
      prev?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      (focusable[0] as HTMLElement | undefined)?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      (focusable[focusable.length - 1] as HTMLElement | undefined)?.focus();
    }
  };

  return (
    <div className={styles['cc-media__gallery']}>
      <div
        className={styles['cc-media__strip']}
        role="list"
        aria-label={t('cardCreator.media.imageGallery')}
        onKeyDown={handleKeyDown}
        onDrop={handleGalleryDrop}
      >
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
      </div>
    </div>
  );
}

/** Vertical audio list. */
function AudioList({
  files,
  onRemove,
  onPlay,
  onReorder,
  dataId,
}: {
  files: readonly MediaFile[];
  onRemove: (index: number) => void;
  onPlay: (file: MediaFile) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const focusable = Array.from(e.currentTarget.querySelectorAll('button, [tabindex="0"]'));
    const active = document.activeElement;
    const currentIndex = active ? focusable.indexOf(active) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = focusable[currentIndex + 1] as HTMLElement | undefined;
      next?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = focusable[currentIndex - 1] as HTMLElement | undefined;
      prev?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      (focusable[0] as HTMLElement | undefined)?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      (focusable[focusable.length - 1] as HTMLElement | undefined)?.focus();
    }
  };

  return (
    <div
      className={styles['cc-media__list']}
      role="list"
      aria-label={t('cardCreator.media.audioList')}
      onKeyDown={handleKeyDown}
      onDrop={handleListDrop}
    >
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
            <Button shape="circle" size="sm" variant="primary"
              className={styles['cc-media__play']}
              onClick={() => onPlay(file)}
              aria-label={t('cardCreator.media.play', [file.filename])}
              data-cell-id={dataId ? `${dataId}-view-${index}` : undefined}
            >
              <Icon name="audioWave" size="xs" />
            </Button>
            <span className={styles['cc-media__name']}>{file.filename}</span>
            <Button
              size="sm"
              shape="circle"
              variant="ghost"
              className={styles['cc-media__row-remove']}
              onClick={() => onRemove(index)}
              aria-label={t('cardCreator.media.remove', [file.filename])}
              data-cell-id={dataId ? `${dataId}-remove-${index}` : undefined}
            >
              <Icon name="x" size="sm" />
            </Button>
          </div>
        );
      })}
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

  const isEmpty = files.length === 0;
  const dropzoneBase = styles['cc-media__dropzone'];
  const dropzoneModifier = [
    isDragOver ? styles['cc-media__dropzone--over'] : '',
    isEmpty ? styles['cc-media__dropzone--empty'] : '',
  ].filter(Boolean).join(' ');
  const dropzoneClass = dropzoneModifier
    ? `${dropzoneBase} ${dropzoneModifier}`
    : dropzoneBase;
  return (
    <div
      className={styles['cc-media']}
      data-kind={kind}
    >
      <div
        className={dropzoneClass}
        data-cell-id={dataId}
        onDragEnter={onFilesDrop ? handleDragEnter : undefined}
        onDragLeave={onFilesDrop ? handleDragLeave : undefined}
        onDragOver={onFilesDrop ? handleDragOver : undefined}
        onDrop={onFilesDrop ? handleDrop : undefined}
      >
        {isEmpty ? (
          <EmptyDropzone
            kind={kind}
            onAdd={onAdd}
            addDisabled={addDisabled}
            dataId={dataId}
          />
        ) : kind === 'image' ? (
          <ImageGallery
            files={files}
            onRemove={onRemove}
            onPreview={setPreviewFile}
            onReorder={onReorder}
            dataId={dataId}
          />
        ) : (
          <AudioList
            files={files}
            onRemove={onRemove}
            onPlay={playAudio}
            onReorder={onReorder}
            dataId={dataId}
          />
        )}
      </div>
      {!isEmpty && (
        <Button
          variant="outline"
          size="sm"
          fullWidth
          onClick={onAdd}
          disabled={addDisabled}
          leadingIcon={<Icon name="plus" size="sm" />}
          data-cell-id={dataId ? `${dataId}-add` : undefined}
        >
          {addLabel}
        </Button>
      )}
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} />
      {/* Image preview overlay */}
      {previewFile && <ImagePreview file={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  );
}
