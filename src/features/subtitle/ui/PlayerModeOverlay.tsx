// Player Mode overlay — fixed full-viewport layout that moves SubtitleBlock + NavCluster
// into a bottom Player Action Dock while keeping the host video visible above.
// See tasks/plan.md for the layout contract.

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { NavClusterSettings, SubtitleBlockSettings } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { IconCatalogKey } from '@/shared/icons';
import { SubtitleBlock } from './SubtitleBlock';
import { NavCluster } from './NavCluster';
import { resolvePlayerModeLayout, DOCK_MIN_HEIGHT_PX } from '../logic/playerModeGeometry';
import styles from './PlayerModeOverlay.module.css';

export interface PlayerModeOverlayProps {
  /** Subtitle overlay styles from extension popup. */
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;
  /** Whether a subtitle is currently loaded. */
  hasSubtitle: boolean;
  /** Whether the video is playing. */
  isPlaying: boolean;
  /** Repeat AB-loop mode state. */
  repeatActive: boolean;
  /** Repeat button icon name. */
  repeatIcon?: IconCatalogKey;
  /** Repeat button ARIA label. */
  repeatLabel?: string;
  /** Nav cluster settings. */
  clusterSettings?: NavClusterSettings;
  /** Subtitle block settings. */
  blockSettings?: SubtitleBlockSettings;
  /** Called when user requests previous sentence. */
  onPrev: () => void;
  /** Called when user requests next sentence. */
  onNext: () => void;
  /** Called when user toggles repeat. */
  onRepeat: () => void;
  /** Called when user seeks backward. */
  onRewind: () => void;
  /** Called when user seeks forward. */
  onForward: () => void;
  /** Called when user toggles play/pause. */
  onPlayPause: () => void;
  /** Called when user toggles collapse/expand (no-op in player mode but kept for API compat). */
  onToggleCollapsed: () => void;
  /** Exit Player Mode. */
  onExit: () => void;
}

function PlayerModeOverlayInner({
  targetStyle,
  nativeStyle,
  hasSubtitle,
  isPlaying,
  repeatActive,
  repeatIcon,
  repeatLabel,
  clusterSettings,
  blockSettings,
  onPrev,
  onNext,
  onRepeat,
  onRewind,
  onForward,
  onPlayPause,
  onToggleCollapsed,
  onExit,
}: PlayerModeOverlayProps): React.JSX.Element {
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const onResize = (): void => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setViewport({ w: window.innerWidth, h: window.innerHeight });
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const layout = resolvePlayerModeLayout(viewport.w, viewport.h, 16 / 9, DOCK_MIN_HEIGHT_PX);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onExit();
      }
    },
    [onExit],
  );

  return (
    <div
      className={styles.overlay}
      data-cell-id="player-mode-overlay"
      onKeyDown={handleKeyDown}
      role="application"
      aria-label="Player mode"
    >
      {/* Video stage — transparent, lets host video show through */}
      <div
        className={styles.videoStage}
        style={{ height: `${layout.videoStageHeight}px` }}
        data-cell-id="player-mode-video-stage"
        aria-hidden="true"
      />

      {/* Content other — empty V1, expansion area for dictionary sheet */}
      <div
        className={styles.contentOther}
        style={{ height: `${layout.contentOtherHeight}px` }}
        data-cell-id="content-khac"
      />

      {/* Player Action Dock — fixed at bottom, always visible */}
      <div
        className={styles.dock}
        style={{ height: `${layout.dockHeight}px` }}
        data-cell-id="overlay-player-action"
      >
        <div className={styles.subtitleArea}>
          <SubtitleBlock
            targetStyle={targetStyle}
            nativeStyle={nativeStyle}
            blockSettings={blockSettings}
          />
        </div>
        <div className={styles.navArea}>
          <NavCluster
            collapsed={false}
            hasSubtitle={hasSubtitle}
            isPlaying={isPlaying}
            repeatActive={repeatActive}
            repeatIcon={repeatIcon}
            repeatLabel={repeatLabel}
            clusterSettings={clusterSettings}
            onToggleCollapsed={onToggleCollapsed}
            onPrev={onPrev}
            onNext={onNext}
            onRepeat={onRepeat}
            onRewind={onRewind}
            onForward={onForward}
            onPlayPause={onPlayPause}
          />
        </div>
      </div>
    </div>
  );
}

export const PlayerModeOverlay = memo(PlayerModeOverlayInner);
