import { memo } from 'react';
import type { NavClusterSettings } from '@/entities/media';
import { Icon } from '@/shared/icons/Icon';
import { ICON_CATALOG } from '@/shared/icons';
import { IconButton } from '@/shared/ui';
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

  // Apply cluster settings from extension popup
  // buttonSize uses clamp for auto-responsive scaling (22px→34px based on container width)
  const buttonSize = clusterSettings?.buttonSize ?? 34;
  const textOpacity = clusterSettings?.textOpacity ?? 1;
  const bgOpacity = clusterSettings?.bgOpacity ?? 0.2;
  const clusterStyle: React.CSSProperties = {
    '--cluster-btn-size': `clamp(${Math.round(buttonSize * 0.65)}px, ${Math.round(buttonSize * 0.15)}cqw, ${buttonSize}px)`,
    '--cluster-icon-size': `clamp(${Math.round(buttonSize * 0.35)}px, ${Math.round(buttonSize * 0.082)}cqw, 20px)`,
    '--cluster-text-opacity': String(textOpacity),
    '--cluster-bg-opacity': String(bgOpacity),
  } as React.CSSProperties;

  if (collapsed) {
    return (
      <div className={rootClass} style={clusterStyle} data-cell-id="nav-cluster" aria-label="Subtitle navigation">
        <IconButton variant="transparent"
          className={styles.collapsedBtn}
          aria-label="Expand subtitle navigation"
          data-cell-id="nav-expand"
          onClick={onToggleCollapsed}
        >
          <Icon name="navRepeat" size={20} />
        </IconButton>
      </div>
    );
  }

  return (
    <div className={rootClass} style={clusterStyle} data-cell-id="nav-cluster" aria-label="Subtitle navigation">
      <div className={styles.main} data-cell-id="nav-main">
        <IconButton variant="transparent" aria-label="Previous sentence" data-cell-id="nav-prev" onClick={onPrev}>
          <Icon name="navPrev" size={20} />
        </IconButton>
        <IconButton variant="transparent"
          aria-label={repeatActive ? 'Cancel repeat' : repeatLabel}
          data-cell-id="nav-repeat"
          onClick={onRepeat}
          active={repeatActive}
        >
          <Icon name={repeatIcon} size={20} />
        </IconButton>
        <IconButton variant="transparent" aria-label="Next sentence" data-cell-id="nav-next" onClick={onNext}>
          <Icon name="navNext" size={20} />
        </IconButton>
      </div>
      <div className={styles.secondary} data-cell-id="nav-secondary">
        <IconButton variant="transparent" aria-label="Rewind 5 seconds" data-cell-id="nav-rewind" onClick={onRewind}>
          <Icon name="navRewind" size={18} />
        </IconButton>
        <IconButton variant="transparent" aria-label={isPlaying ? 'Pause video' : 'Play video'} data-cell-id="nav-play" onClick={onPlayPause}>
          <Icon name={isPlaying ? 'navPause' : 'navPlay'} size={18} />
        </IconButton>
        <IconButton variant="transparent" aria-label="Forward 10 seconds" data-cell-id="nav-forward" onClick={onForward}>
          <Icon name="navForward" size={18} />
        </IconButton>
      </div>
    </div>
  );
}

export const NavCluster = memo(NavClusterInner);
