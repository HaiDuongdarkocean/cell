import { Icon } from '@/shared/ui/Icon';
import type { ICON_CATALOG } from '@/shared/icons';
import styles from './PlayPauseOverlay.module.css';

export interface PlayPauseOverlayProps {
  /** Which icon to show ('play' when paused, 'pause' when playing). */
  icon: keyof typeof ICON_CATALOG;
  /** Bumped each toggle to restart the pop+fade animation even on rapid clicks. */
  pulseKey: number;
}

/**
 * Centered play/pause icon flash shown on click/Space toggle.
 * CSS animation handles pop-in + fade-out; `pulseKey` remounts the node
 * so repeated toggles replay the animation from frame 0.
 */
export function PlayPauseOverlay({ icon, pulseKey }: PlayPauseOverlayProps): React.JSX.Element {
  // Transient visual feedback — decorative; the control bar buttons already
  // announce play/pause state, so the flash is hidden from the a11y tree.
  return (
    <div className={styles.overlay} data-cell-id="play-pause-flash" key={pulseKey} aria-hidden="true">
      <div className={styles.iconWrap}>
        <Icon name={icon} size="lg" />
      </div>
    </div>
  );
}
