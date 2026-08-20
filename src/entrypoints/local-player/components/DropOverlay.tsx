import { Icon } from '@/shared/icons/Icon';
import styles from './DropOverlay.module.css';

/**
 * DropOverlay — visual feedback layer shown while the user drags files over
 * the video stage. Pointer-events:none so it never blocks the drop target
 * (the stage itself handles onDrop). Follows the PlayPauseOverlay pattern:
 * absolute inset:0, flex-centered, token-driven, no layout side effects.
 *
 * Decoupled from drop logic (useDropzone) so it renders identically whether
 * the stage is showing EmptyState or an active video — drag-and-drop works
 * in both states.
 */
export function DropOverlay(): React.JSX.Element {
  return (
    <div className={styles.overlay} data-cell-id="drop-overlay" aria-hidden="true">
      <div className={styles.badge}>
        <Icon name="fileVideo" size={40} />
      </div>
      <p className={styles.hint}>Drop to add video &amp; subtitles</p>
    </div>
  );
}
