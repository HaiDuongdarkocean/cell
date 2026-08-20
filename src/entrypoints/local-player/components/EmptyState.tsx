import { useCallback, useState, type DragEvent } from 'react';
import { Button } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import { isVideoFile, isSubtitleFile } from '@/features/local-player/logic/folderScan';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  /** Called when the user clicks "Open file". */
  onOpenFile: () => void;
  /** Called when the user clicks "Open folder" (scan folder for videos + subtitles). */
  onOpenFolder: () => void;
  /** Called with all dropped files (video + subtitle). Caller splits + matches.
   *  Non-video/non-subtitle files are filtered out here. */
  onFilesDrop: (files: File[]) => void;
}

/**
 * EmptyState — dropzone + "Open file" button shown when no video is loaded.
 *
 * Accepts drag-and-drop of video AND subtitle files (detected by extension,
 * not MIME — drag-drop MIME is unreliable). Caller handles matching + queue.
 */
export function EmptyState({ onOpenFile, onOpenFolder, onFilesDrop }: EmptyStateProps): React.JSX.Element {
  const [dragging, setDragging] = useState(false);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>): void => {
      e.preventDefault();
      setDragging(false);
      const dropped = Array.from(e.dataTransfer.files ?? []);
      const accepted = dropped.filter((f) => isVideoFile(f.name) || isSubtitleFile(f.name));
      if (accepted.length > 0) onFilesDrop(accepted);
    },
    [onFilesDrop],
  );

  return (
    <div
      data-cell-id="empty-dropzone"
      data-dragging={dragging}
      className={styles.dropzone}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      aria-label="Drop a video file here or click to browse"
    >
      <Icon name="video" size={48} className={styles.icon} />
      <p className={styles.hint}>Drop a video file here or click to browse</p>
      <div className={styles.buttonRow}>
        <Button
          variant="primary"
          size="lg"
          leadingIcon={<Icon name="video" size={18} />}
          onClick={onOpenFile}
        >
          Open file
        </Button>
        <Button
          variant="secondary"
          size="lg"
          leadingIcon={<Icon name="folderOpen" size={18} />}
          onClick={onOpenFolder}
        >
          Open folder
        </Button>
      </div>
    </div>
  );
}
