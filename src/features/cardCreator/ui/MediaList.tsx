/**
 * MediaList — list of media files (image/audio) attached to a Card Creator
 * field, with a remove button per item and an "Add" button to capture new
 * media (screenshot or sentence audio).
 *
 * Per the mockup, each media field (Image, Sentence audio, Word audio)
 * shows a list of attached files with a thumbnail icon, filename, and
 * remove (×) button, plus an "+ Add ..." button at the bottom.
 *
 * ADR-026: clicking an image thumbnail opens a full-size preview overlay;
 * clicking an audio waveform plays the audio in-place. Both use Blob URLs
 * created from the MediaFile's ArrayBuffer (revoked on unmount).
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { MediaFile } from '../media/mediaFile';
import styles from './MediaList.module.css';

interface MediaListProps {
  /** Media files currently attached. */
  files: readonly MediaFile[];
  /** Kind of media — determines the thumbnail icon + add button label. */
  kind: 'image' | 'audio';
  /** Label for the add button (e.g. "Add image", "Add sentence audio"). */
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

function ThumbIcon({ kind }: { kind: 'image' | 'audio' }): ReactElement {
  if (kind === 'image') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="20" height="20" className={styles.imageThumbIcon}>
        <rect x="3" y="3" width="18" height="18" rx="2" fill="none" />
        <circle cx="9" cy="9" r="2" fill="none" />
        <path d="M21 15l-5-5L5 21" fill="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="20" height="20">
      <path d="M3 10v4" />
      <path d="M7 6v12" />
      <path d="M11 3v18" />
      <path d="M15 8v8" />
      <path d="M19 11v2" />
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
        console.error('[MediaList] audio play failed', { err, blobSize: blob.size, mimeType: file.mimeType, dataType: typeof file.data, dataByteLength: file.data?.byteLength });
        URL.revokeObjectURL(url);
      });
    }
  };

  return (
    <div className={styles.mediaList} data-testid={testId}>
      {files.length === 0 && <div className={styles.empty}>No {kind} attached yet.</div>}
      {files.map((file, index) => (
        <div className={styles.mediaRow} key={`${file.filename}-${index}`}>
          <button
            type="button"
            className={styles.mediaThumb}
            onClick={() => (file.kind === 'image' ? setPreviewFile(file) : playAudio(file))}
            aria-label={file.kind === 'image' ? `Preview ${file.filename}` : `Play ${file.filename}`}
            data-testid={testId ? `${testId}-view-${index}` : undefined}
          >
            <ThumbIcon kind={file.kind} />
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
      <button
        type="button"
        className={styles.addButton}
        onClick={onAdd}
        disabled={addDisabled}
        data-testid={testId ? `${testId}-add` : undefined}
      >
        + {addLabel}
      </button>
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} />
      {/* Image preview overlay */}
      {previewFile && <ImagePreview file={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  );
}
