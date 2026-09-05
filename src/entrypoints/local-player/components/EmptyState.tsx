import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui';
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
        <Icon name="video" size="lg" />
      </div>
      <p className={styles.primaryHint}>Drop your video and subtitles here</p>
      <p className={styles.noteHint}>You can add multiple subtitle files, but only one video</p>
      <div className={styles.buttonRow}>
        <Button material="solid"
          variant="primary"
          size="md"
          onClick={onOpenFile}
          leadingIcon={<Icon name="plus" size="sm" />}
          data-cell-id="empty-open-file"
        >
          Add files
        </Button>
        <Button material="solid"
          variant="secondary"
          size="md"
          onClick={onOpenFolder}
          leadingIcon={<Icon name="folderOpen" size="sm" />}
          data-cell-id="empty-open-folder"
        >
          Add folder
        </Button>
      </div>
    </div>
  );
}
