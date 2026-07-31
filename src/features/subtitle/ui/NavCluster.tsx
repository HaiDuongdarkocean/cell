import { memo } from 'react';
import type { NavClusterSettings } from '@/entities/media';
import { Icon } from '@/shared/icons/Icon';
import { ICON_CATALOG } from '@/shared/icons';
import { IconButton } from '@/shared/ui';
import styles from './NavCluster.module.css';

interface NavClusterProps {
  /** Whether the cluster is collapsed to a circular drag handle. */
  collapsed: boolean;
  /** Whether a subtitle is currently loaded. */
  hasSubtitle: boolean;
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
  hasSubtitle,
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
    hasSubtitle ? '' : styles.noSub,
  ]
    .filter(Boolean)
    .join(' ');

  // Apply cluster settings from extension popup
  const buttonSize = clusterSettings?.buttonSize ?? 34;
  const textOpacity = clusterSettings?.textOpacity ?? 1;
  const bgOpacity = clusterSettings?.bgOpacity ?? 0.2;
  const clusterStyle: React.CSSProperties = {
    '--cluster-btn-size': `${buttonSize}px`,
    '--cluster-text-opacity': String(textOpacity),
    '--cluster-bg-opacity': String(bgOpacity),
  } as React.CSSProperties;

  if (collapsed) {
    return (
      <div className={rootClass} style={clusterStyle} data-testid="nav-cluster" aria-label="Subtitle navigation">
        <IconButton
          className={styles.collapsedBtn}
          aria-label="Expand subtitle navigation"
          data-testid="nav-expand"
          onClick={onToggleCollapsed}
        >
          <Icon name="navRepeat" size={20} />
        </IconButton>
      </div>
    );
  }

  return (
    <div className={rootClass} style={clusterStyle} data-testid="nav-cluster" aria-label="Subtitle navigation">
      <div className={styles.main}>
        <IconButton aria-label="Previous sentence" data-testid="nav-prev" onClick={onPrev}>
          <Icon name="navPrev" size={20} />
        </IconButton>
        <IconButton
          aria-label={repeatActive ? 'Cancel repeat' : repeatLabel}
          data-testid="nav-repeat"
          onClick={onRepeat}
          active={repeatActive}
        >
          <Icon name={repeatIcon} size={20} />
        </IconButton>
        <IconButton aria-label="Next sentence" data-testid="nav-next" onClick={onNext}>
          <Icon name="navNext" size={20} />
        </IconButton>
      </div>
      <div className={styles.secondary}>
        <IconButton aria-label="Rewind 5 seconds" data-testid="nav-rewind" onClick={onRewind}>
          <Icon name="navRewind" size={18} />
        </IconButton>
        <IconButton aria-label={isPlaying ? 'Pause video' : 'Play video'} data-testid="nav-play" onClick={onPlayPause}>
          <Icon name={isPlaying ? 'pause' : 'play'} size={18} />
        </IconButton>
        <IconButton aria-label="Forward 10 seconds" data-testid="nav-forward" onClick={onForward}>
          <Icon name="navForward" size={18} />
        </IconButton>
      </div>
      {hasSubtitle ? null : (
        <div className={styles.noSub} data-testid="nav-no-sub">
          <Icon name="flag" size={20} />
        </div>
      )}
    </div>
  );
}

export const NavCluster = memo(NavClusterInner);
