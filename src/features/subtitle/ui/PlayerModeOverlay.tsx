// Player Mode overlay — fixed full-viewport layout that moves SubtitleBlock + NavCluster
// into a bottom Player Action Dock while keeping the host video visible above.
// See tasks/plan.md for the layout contract.

import { memo, useEffect, useRef, useState } from 'react';
import type { NavClusterSettings, SubtitleBlockSettings } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import { ICON_CATALOG } from '@/shared/icons';
import { Icon } from '@/shared/icons/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { SubtitleBlock } from './SubtitleBlock';
import { NavCluster } from './NavCluster';
import { resolvePlayerModeLayout, DOCK_MIN_HEIGHT_PX } from '../logic/playerModeGeometry';
import styles from './PlayerModeOverlay.module.css';
import panelStyles from './SubtitlePanels.module.css';

type IconCatalogKey = keyof typeof ICON_CATALOG;

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
  /** Intrinsic video width/height ratio. */
  videoAspectRatio: number;
  /** Existing right-side subtitle actions. */
  onQuickAdd?: () => void;
  onEditCard?: () => void;
  onUpdateCurrentCard?: () => void;
  onGenerateNative?: () => void;
  onToggleSidePanel?: () => void;
  onToggleManager?: () => void;
  generateNativeEnabled: boolean;
  /** Called when the tools action group expands/collapses. */
  onToggleTools?: () => void;
  toolsExpanded: boolean;
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
  videoAspectRatio,
  onQuickAdd,
  onEditCard,
  onUpdateCurrentCard,
  onGenerateNative,
  onToggleSidePanel,
  onToggleManager,
  generateNativeEnabled,
  onToggleTools,
  toolsExpanded,
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
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // Canvas capture: draw host video frames onto a canvas in the overlay.
  // Video stays in host container (no DOM move → no HLS.js disruption).
  // Overlay bg black covers host completely; canvas shows video on top.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let rafId = 0;
    const draw = (): void => {
      const video = document.querySelector('video');
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        const stageW = canvas.clientWidth;
        const stageH = canvas.clientHeight;
        if (canvas.width !== stageW || canvas.height !== stageH) {
          canvas.width = stageW;
          canvas.height = stageH;
        }
        const vAspect = video.videoWidth / video.videoHeight;
        const sAspect = stageW / stageH;
        let dw: number, dh: number, dx: number, dy: number;
        if (vAspect > sAspect) {
          dw = stageW;
          dh = stageW / vAspect;
          dx = 0;
          dy = (stageH - dh) / 2;
        } else {
          dh = stageH;
          dw = stageH * vAspect;
          dx = (stageW - dw) / 2;
          dy = 0;
        }
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, stageW, stageH);
        ctx.drawImage(video, dx, dy, dw, dh);
      }
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const layout = resolvePlayerModeLayout(viewport.w, viewport.h, videoAspectRatio, DOCK_MIN_HEIGHT_PX);
  const clusterBtnSize = clusterSettings?.buttonSize ?? 34;
  const clusterRightStyle: React.CSSProperties = {
    '--cluster-btn-size': `clamp(${Math.round(clusterBtnSize * 0.65)}px, ${Math.round(clusterBtnSize * 0.15)}cqw, ${clusterBtnSize}px)`,
    '--cluster-icon-size': `clamp(${Math.round(clusterBtnSize * 0.35)}px, ${Math.round(clusterBtnSize * 0.082)}cqw, 20px)`,
    '--cluster-text-opacity': String(clusterSettings?.textOpacity ?? 1),
    '--cluster-bg-opacity': String(clusterSettings?.bgOpacity ?? 0.2),
  } as React.CSSProperties;

  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onExit();
    };
    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [onExit]);

  return (
    <div
      className={styles.overlay}
      data-cell-id="player-mode-overlay"
      role="application"
      aria-label="Player mode"
    >
      {/* Video stage — canvas draws host video frames. Overlay bg black
          covers host completely; canvas shows video content on top. */}
      <div
        className={styles.videoStage}
        style={{ height: `${layout.videoStageHeight}px` }}
        data-cell-id="player-mode-video-stage"
        aria-hidden="true"
      >
        <canvas ref={canvasRef} className={styles.videoCanvas} />
      </div>

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
        <div className={styles.subtitleArea}>
          <SubtitleBlock
            targetStyle={targetStyle}
            nativeStyle={nativeStyle}
            blockSettings={blockSettings}
          />
        </div>
        <div className={`${panelStyles.clusterRight} ${styles.actionArea}`} style={clusterRightStyle} data-cell-id="player-mode-actions">
          <div className={panelStyles.primaryCol}>
            {onQuickAdd && (
              <IconButton aria-label="Quick add card" title="Quick add (Q)" data-cell-id="quick-add-btn" size="sm" onClick={onQuickAdd}>
                <Icon name="zap" size={18} />
              </IconButton>
            )}
            {onEditCard && (
              <IconButton aria-label="Edit card" title="Edit card (E)" data-cell-id="edit-card-btn" size="sm" onClick={onEditCard}>
                <Icon name="pencil" size={18} />
              </IconButton>
            )}
            <div className={panelStyles.toggleWrap}>
              <div
                className={`${panelStyles.extraCol} ${toolsExpanded ? panelStyles.expanded : ''}`}
                data-cell-id="subtitle-tools-extra"
              >
                {onToggleSidePanel && (
                  <IconButton aria-label="Toggle subtitle side panel" title="Toggle side panel (T)" data-cell-id="panel-toggle-btn" size="sm" onClick={onToggleSidePanel}>
                    <Icon name="sidePanel" size={18} />
                  </IconButton>
                )}
                {onGenerateNative && (
                  <IconButton aria-label="Generate native subtitle" title="Generate native (G)" data-cell-id="generate-native-btn" size="sm" onClick={onGenerateNative} disabled={!generateNativeEnabled}>
                    <Icon name="languages" size={18} />
                  </IconButton>
                )}
              </div>
              <IconButton aria-label={toolsExpanded ? 'Collapse tools' : 'Expand tools'} title={toolsExpanded ? 'Collapse tools' : 'Expand tools'} data-cell-id="tools-toggle-btn" size="sm" onClick={onToggleTools}>
                <Icon name="chevronLeft" size={18} />
              </IconButton>
            </div>
          </div>
          <div className={panelStyles.secondaryCol}>
            {onUpdateCurrentCard && (
              <IconButton aria-label="Update current card" title="Update current card (U)" data-cell-id="update-current-card-btn" size="sm" onClick={onUpdateCurrentCard}>
                <Icon name="rotateCcw" size={18} />
              </IconButton>
            )}
            {onToggleManager && (
              <IconButton aria-label="Open subtitle manager" title="Open subtitle manager" data-cell-id="manager-toggle-btn" size="sm" onClick={onToggleManager}>
                <Icon name="subtitleManager" size={18} />
              </IconButton>
            )}
            <IconButton aria-label="Exit player mode" title="Exit player mode" data-cell-id="player-mode-exit-btn" size="sm" onClick={onExit}>
              <Icon name="minimize" size={18} />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export const PlayerModeOverlay = memo(PlayerModeOverlayInner);
