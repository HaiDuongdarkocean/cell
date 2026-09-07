import { memo } from 'react';
import type { NavClusterSettings } from '@/entities/media';
import { Icon } from '@/shared/icons/Icon';
import type { ICON_CATALOG } from '@/shared/icons';
import { Button } from '@/shared/ui';
import { buildClusterCssVars } from './subtitleUI';
import styles from './NavCluster.module.css';

interface NavClusterProps {
  /** Whether the cluster is collapsed to a circular drag handle. */
  collapsed: boolean;
  /** Whether the video is playing. */
  isPlaying?: boolean;
  /** Repeat AB-loop mode state. */
  repeatActive?: boolean;
  /** Repeat button icon name (key in ICON_CATALOG). */
  repeatIcon?: keyof typeof ICON_CATALOG;
  /** Repeat button ARIA label. */
  repeatLabel?: string;
  /** Nav cluster settings from extension popup (buttonSize, textOpacity, bgOpacity, enabled). */
  clusterSettings?: NavClusterSettings;
  /** Called when the user toggles collapse/expand. */
  onToggleCollapsed: () => void;
  /** Called when the user requests the previous sentence. */
  onPrev: () => void;
  /** Called when the user requests the next sentence. */
  onNext: () => void;
  /** Called when the user toggles repeat. */
  onRepeat: () => void;
  /** Called when the user seeks backward. */
  onRewind: () => void;
  /** Called when the user seeks forward. */
  onForward: () => void;
  /** Called when the user toggles play/pause. */
  onPlayPause: () => void;
}

function NavClusterInner({
  collapsed,
  isPlaying = false,
  repeatActive = false,
  repeatIcon = 'navRepeat',
  repeatLabel = 'Repeat current sentence',
  clusterSettings,
  onToggleCollapsed,
  onPrev,
  onNext,
  onRepeat,
  onRewind,
  onForward,
  onPlayPause,
}: NavClusterProps): React.JSX.Element {
  const rootClass = [
    styles.cluster,
    collapsed ? styles.collapsed : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Apply cluster settings from extension popup (SSOT: buildClusterCssVars)
  const clusterStyle = buildClusterCssVars(clusterSettings);

  if (collapsed) {
    return (
      <div className={rootClass} style={clusterStyle} data-cell-id="nav-cluster" aria-label="Subtitle navigation">
        <Button shape="circle" variant="secondary"
          className={styles.collapsedBtn}
          aria-label="Expand subtitle navigation"
          data-cell-id="nav-expand"
          onClick={onToggleCollapsed}
        >
          <Icon name="navRepeat"  />
        </Button>
      </div>
    );
  }

  return (
    <div className={rootClass} style={clusterStyle} data-cell-id="nav-cluster" aria-label="Subtitle navigation">
      <div className={styles.main} data-cell-id="nav-main">
        <Button shape="circle" variant="secondary" aria-label="Previous sentence" data-cell-id="nav-prev" onClick={onPrev}>
          <Icon name="navPrev"  />
        </Button>
        <Button shape="circle" variant="secondary"
          aria-label={repeatActive ? 'Cancel repeat' : repeatLabel}
          data-cell-id="nav-repeat"
          onClick={onRepeat}
          active={repeatActive}
        >
          <Icon name={repeatIcon}  />
        </Button>
        <Button shape="circle" variant="secondary" aria-label="Next sentence" data-cell-id="nav-next" onClick={onNext}>
          <Icon name="navNext"  />
        </Button>
      </div>
      <div className={styles.secondary} data-cell-id="nav-secondary">
        <Button shape="circle" variant="secondary" aria-label="Rewind 5 seconds" data-cell-id="nav-rewind" onClick={onRewind}>
          <Icon name="navRewind"  />
        </Button>
        <Button shape="circle" variant="secondary" aria-label={isPlaying ? 'Pause video' : 'Play video'} data-cell-id="nav-play" onClick={onPlayPause}>
          <Icon name={isPlaying ? 'navPause' : 'navPlay'}  />
        </Button>
        <Button shape="circle" variant="secondary" aria-label="Forward 10 seconds" data-cell-id="nav-forward" onClick={onForward}>
          <Icon name="navForward"  />
        </Button>
      </div>
    </div>
  );
}

export const NavCluster = memo(NavClusterInner);
