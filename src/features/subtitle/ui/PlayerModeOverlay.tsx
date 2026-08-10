// Player Mode overlay — fixed full-viewport layout that slots the host player
// container into the video stage via the "cell-video" slot. The container stays
// in the document's light DOM (so its CSS and controls keep working) while the
// <slot> projects it into the shadow DOM video stage. The container is restored
// to its original parent on unmount.

import { memo, useEffect, useRef, useState, useCallback } from 'react';
import type { BilingualCue, NavClusterSettings, SubtitleBlockSettings } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import { CueList } from '@/entrypoints/sidepanel/components/CueList';
import type { ICON_CATALOG } from '@/shared/icons';
import { Icon } from '@/shared/icons/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { SubtitleBlock } from './SubtitleBlock';
import { NavCluster } from './NavCluster';
import { resolvePlayerModeLayout, DOCK_MIN_HEIGHT_PX } from '../logic/playerModeGeometry';
import { findPlayerContainer } from '@/features/subtitle/logic/findPlayerContainer';
import { getStorage, setStorage } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import styles from './PlayerModeOverlay.module.css';
import panelStyles from './SubtitlePanels.module.css';

const CONTENT_PCT_MIN = 20;
const CONTENT_PCT_MAX = 60;
const CONTENT_PCT_DEFAULT = 30;

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
  /** Bilingual cues for CueList display in player-mode-content. */
  cues?: BilingualCue[];
  /** Current video time in milliseconds (for CueList highlight). */
  currentTimeMs?: number;
  /** Subtitle offset in ms (ADR-019 sync — highlight at currentTime + offset). */
  offsetMs?: number;
  /** Seek video to timeMs when user clicks a cue in the list. */
  onSeek?: (timeMs: number) => void;
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
  cues,
  currentTimeMs,
  offsetMs,
  onSeek,
}: PlayerModeOverlayProps): React.JSX.Element {
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [cueListOpen, setCueListOpen] = useState(true);
  // Content panel width % in split layout (>480px). Default 30%. Clamp 20-60%.
  // Persisted to chrome.storage.local — survives reload + re-enter Player Mode.
  const [contentPct, setContentPct] = useState(CONTENT_PCT_DEFAULT);
  const contentPctLoadedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const videoStageRef = useRef<HTMLDivElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startPct: number; splitWidth: number } | null>(null);

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

  // Move the host player container into the shadow host's light DOM and assign
  // it to the "cell-video" slot. The container stays in the document's CSS scope
  // (so controls + their CSS keep working) while the <slot> projects it into the
  // shadow DOM video stage. Saved state (parent, nextSibling, inline styles) is
  // restored on cleanup so exiting Player Mode puts the player back exactly.
  useEffect(() => {
    const stage = videoStageRef.current;
    if (!stage) return;
    const root = stage.getRootNode();
    const shadowHost = root instanceof ShadowRoot ? root.host : null;
    if (!(shadowHost instanceof HTMLElement)) return;

    const player = findPlayerContainer();
    if (!player) return;
    // React runs child effects before parent effects, so SubtitlePanels' effect
    // (which moves #cell-subtitle-root to body) hasn't fired yet. If the host
    // is still inside the player container, appendChild(player) would create a
    // DOM cycle. Move the host to body first to break the cycle.
    if (player.contains(shadowHost) && shadowHost.parentElement !== document.body) {
      document.body.appendChild(shadowHost);
    }
    if (shadowHost.contains(player)) return;

    const originalParent = player.parentElement;
    const originalNextSibling = player.nextSibling;
    const savedStyle = {
      width: player.style.width,
      height: player.style.height,
      position: player.style.position,
      flex: player.style.flex,
      display: player.style.display,
      flexDirection: player.style.flexDirection,
      justifyContent: player.style.justifyContent,
      alignItems: player.style.alignItems,
    };

    player.setAttribute('slot', 'cell-video');
    player.style.width = '100%';
    // height:100% doesn't reliably fill the slot's stage (display:contents
    // on the slot can break the containing block). Use the stage's pixel
    // height so flex centering has a definite container to center within.
    const stageHeight = stage.getBoundingClientRect().height;
    player.style.height = `${stageHeight}px`;
    player.style.display = 'flex';
    player.style.flexDirection = 'column';
    player.style.justifyContent = 'center';
    player.style.alignItems = 'center';
    player.style.position = 'relative';
    player.style.flex = '0 0 auto';
    // object-fit:contain on the video ensures letterboxing within the
    // art-video-player (which keeps its natural aspect-ratio height).
    const centerStyle = document.createElement('style');
    centerStyle.setAttribute('data-cell-player-mode', 'center');
    centerStyle.textContent = 'video{object-fit:contain!important}';
    player.appendChild(centerStyle);
    shadowHost.appendChild(player);

    return () => {
      player.removeAttribute('slot');
      player.style.width = savedStyle.width;
      player.style.height = savedStyle.height;
      player.style.position = savedStyle.position;
      player.style.flex = savedStyle.flex;
      player.style.display = savedStyle.display;
      player.style.flexDirection = savedStyle.flexDirection;
      player.style.justifyContent = savedStyle.justifyContent;
      player.style.alignItems = savedStyle.alignItems;
      centerStyle.remove();
      if (originalParent && player.parentElement !== originalParent) {
        if (originalNextSibling && originalNextSibling.parentElement === originalParent) {
          originalParent.insertBefore(player, originalNextSibling);
        } else {
          originalParent.appendChild(player);
        }
      }
    };
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
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (cueListOpen) {
          setCueListOpen(false);
        } else {
          onExit();
        }
      }
      // Context-aware T: in Player Mode, toggle CueList instead of Chrome side panel.
      if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
        e.preventDefault();
        e.stopPropagation();
        setCueListOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [onExit, cueListOpen]);

  // Load persisted contentPct on mount (survives reload + re-enter Player Mode).
  useEffect(() => {
    let cancelled = false;
    getStorage<Record<string, number>>(STORAGE_KEYS.PLAYER_MODE_CONTENT_PCT)
      .then((data) => {
        const stored = data[STORAGE_KEYS.PLAYER_MODE_CONTENT_PCT];
        if (cancelled || typeof stored !== 'number' || !Number.isFinite(stored)) return;
        const clamped = Math.min(Math.max(stored, CONTENT_PCT_MIN), CONTENT_PCT_MAX);
        contentPctLoadedRef.current = true;
        setContentPct(clamped);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  // Resize drag: content panel width % in split layout (>480px).
  // Drag handle is on the left border of content (between video and content).
  // K kéo phải → content rộng hơn; kéo trái → content hẹp hơn.
  const onResizePointerDown = useCallback((e: React.PointerEvent): void => {
    e.preventDefault();
    const split = splitRef.current;
    if (!split) return;
    dragState.current = {
      startX: e.clientX,
      startPct: contentPct,
      splitWidth: split.getBoundingClientRect().width,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [contentPct]);

  const onResizePointerMove = useCallback((e: React.PointerEvent): void => {
    const ds = dragState.current;
    if (!ds || ds.splitWidth <= 0) return;
    // Content is on the right. Dragging left (negative delta) → content wider.
    // deltaPct = -(deltaX / splitWidth) * 100
    const deltaPx = e.clientX - ds.startX;
    const deltaPct = -(deltaPx / ds.splitWidth) * 100;
    const next = Math.min(Math.max(ds.startPct + deltaPct, CONTENT_PCT_MIN), CONTENT_PCT_MAX);
    setContentPct(next);
  }, []);

  const onResizePointerUp = useCallback((e: React.PointerEvent): void => {
    dragState.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    // Persist contentPct so it survives reload + re-enter Player Mode.
    setContentPct((pct) => {
      setStorage({ [STORAGE_KEYS.PLAYER_MODE_CONTENT_PCT]: pct }).catch(() => undefined);
      return pct;
    });
  }, []);

  return (
    <div
      className={styles.overlay}
      data-cell-id="player-mode-overlay"
      role="application"
      aria-label="Player mode"
    >
      {/* Player Mode split — video-stage + content.
          >480px: row (video left, content right, resizable).
          <480px: column (video top, content bottom). */}
      <div className={styles.split} ref={splitRef} data-cell-id="player-mode-split">
        <div
          className={styles.videoStage}
          style={{ height: `${layout.videoStageHeight}px` }}
          data-cell-id="player-mode-video-stage"
          aria-hidden="true"
          ref={videoStageRef}
        >
          <slot name="cell-video" />
        </div>

        {/* Resize handle — only visible >480px (CSS controls display). */}
        <div
          className={styles.resizeHandle}
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize subtitle list"
          tabIndex={0}
        />

        <div
          className={styles.contentOther}
          style={{ '--content-pct': `${contentPct}%` } as React.CSSProperties}
          data-cell-id="player-mode-content"
        >
          {cueListOpen && cues && cues.length > 0 && onSeek && (
            <div className={styles.cueListWrap}>
              <CueList
                cues={cues}
                currentTimeMs={currentTimeMs ?? 0}
                offsetMs={offsetMs}
                onSeek={onSeek}
              />
            </div>
          )}
        </div>
      </div>

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
                  <IconButton aria-label="Toggle subtitle list" title="Toggle subtitle list (T)" data-cell-id="panel-toggle-btn" size="sm" onClick={() => setCueListOpen((v) => !v)}>
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
