import { memo } from 'react';
import type { NavClusterSettings } from '@/entities/media';
import { t } from '@/shared/i18n';
import { Icon } from '@/shared/icons/Icon';
import type { ICON_CATALOG } from '@/shared/icons';
import { Button } from '@/shared/ui';
import { buildClusterCssVars } from './subtitleUI';
import { NAV_CLUSTER_ICONS } from './subtitleCueEngine';
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
  repeatIcon = NAV_CLUSTER_ICONS.repeat,
  repeatLabel = t('player.nav.repeat'),
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
      <div className={rootClass} style={clusterStyle} data-tihoka-id="nav-cluster" aria-label={t('subtitle.nav.aria')}>
        <Button shape="circle" variant="overlay"
          className={styles.collapsedBtn}
          aria-label={t('subtitle.nav.expand')}
          data-tihoka-id="nav-expand"
          onClick={onToggleCollapsed}
        >
          <Icon name={NAV_CLUSTER_ICONS.repeat}  />
        </Button>
      </div>
    );
  }

  return (
    <div className={rootClass} style={clusterStyle} data-tihoka-id="nav-cluster" aria-label={t('subtitle.nav.aria')}>
      <div className={styles.main} data-tihoka-id="nav-main">
        <Button shape="circle" variant="overlay" aria-label={t('settings.shortcuts.action.prevCue')} data-tihoka-id="nav-prev" onClick={onPrev}>
          <Icon name={NAV_CLUSTER_ICONS.prev}  />
        </Button>
        <Button shape="circle" variant="overlay"
          aria-label={repeatActive ? t('subtitle.nav.repeatCancel') : repeatLabel}
          data-tihoka-id="nav-repeat"
          onClick={onRepeat}
          active={repeatActive}
        >
          <Icon name={repeatIcon}  />
        </Button>
        <Button shape="circle" variant="overlay" aria-label={t('settings.shortcuts.action.nextCue')} data-tihoka-id="nav-next" onClick={onNext}>
          <Icon name={NAV_CLUSTER_ICONS.next}  />
        </Button>
      </div>
      <div className={styles.secondary} data-tihoka-id="nav-secondary">
        <Button shape="circle" variant="overlay" aria-label={t('subtitle.nav.rewind')} data-tihoka-id="nav-rewind" onClick={onRewind}>
          <Icon name={NAV_CLUSTER_ICONS.rewind}  />
        </Button>
        <Button shape="circle" variant="overlay" aria-label={isPlaying ? t('subtitle.nav.pause') : t('subtitle.nav.play')} data-tihoka-id="nav-play" onClick={onPlayPause}>
          <Icon name={isPlaying ? NAV_CLUSTER_ICONS.pause : NAV_CLUSTER_ICONS.play}  />
        </Button>
        <Button shape="circle" variant="overlay" aria-label={t('subtitle.nav.forward')} data-tihoka-id="nav-forward" onClick={onForward}>
          <Icon name={NAV_CLUSTER_ICONS.forward}  />
        </Button>
      </div>
    </div>
  );
}

export const NavCluster = memo(NavClusterInner);
