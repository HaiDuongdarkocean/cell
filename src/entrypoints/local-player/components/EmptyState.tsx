import { Icon } from '@/shared/icons/Icon';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  /** Called when the user clicks "Open file". */
  onOpenFile: () => void;
  /** Called when the user clicks "Open folder" (scan folder for videos + subtitles). */
  onOpenFolder: () => void;
}

/**
 * EmptyState — placeholder UI shown in the video stage when no video is loaded.
 *
 * Drag-and-drop is handled by the parent video stage (useDropzone + DropOverlay)
 * so it works whether the stage shows this EmptyState or an active video.
 * This component is pure presentation: icon badge, hint text, and two buttons.
 */
export function EmptyState({ onOpenFile, onOpenFolder }: EmptyStateProps): React.JSX.Element {
  return (
    <div className={styles.dropzone} data-cell-id="empty-state-content">
      <div className={styles.iconBadge}>
        <Icon name="video" size={40} />
      </div>
      <p className={styles.primaryHint}>Drop your video and subtitles here</p>
      <p className={styles.noteHint}>You can add multiple subtitle files, but only one video</p>
      <div className={styles.buttonRow}>
        <button
          type="button"
          className={styles.addFilesBtn}
          onClick={onOpenFile}
          aria-label="Add files"
        >
          <Icon name="plus" size={18} />
          <span>Add files</span>
        </button>
        <button
          type="button"
          className={styles.addFolderBtn}
          onClick={onOpenFolder}
          aria-label="Add folder"
        >
          <Icon name="folderOpen" size={18} />
          <span>Add folder</span>
        </button>
      </div>
    </div>
  );
}
