import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
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
    <div
      className={styles.overlay}
      data-tihoka-id="drop-overlay"
      role="region"
      aria-label={t('player.drop.aria')}
    >
      <div className={styles.badge}>
        <Icon name="fileVideo" size="lg" />
      </div>
      <p className={styles.hint} role="status">{t('player.drop.hint')}</p>
    </div>
  );
}
