// Player Mode overlay — fixed full-viewport layout that slots the host player
// container into the video stage via the "cell-video" slot. The container stays
// in the document's light DOM (so its CSS and controls keep working) while the
// <slot> projects it into the shadow DOM video stage. The container is restored
// to its original parent on unmount.

import { memo, useEffect, useRef, useState, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { BilingualCue, NavClusterSettings, SubtitleBlockSettings } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import { SubtitlePanel } from './SubtitlePanel';
import type { SubtitlePracticeMode } from '@/features/studyModes';
import type { PlaybackSpeed } from '@/entities/studyMode/types';
import type { CueListTokenize } from './CueList';
import type { StudyMode } from '@/entities/studyMode';
import type { ICON_CATALOG } from '@/shared/icons';
import { SubtitleBlock } from './SubtitleBlock';
import { NavCluster } from './NavCluster';
import { ClusterRightToolbar } from './ClusterRightToolbar';
import { LockShield } from './LockShield';
import { resolvePlayerModeLayout, PM_MOBILE_BAR_HEIGHT_PX } from '../logic/playerModeGeometry';
import { findPlayerContainer } from '@/shared/lib/dom/findPlayerContainer';
import { videoAncestorChain } from '@/shared/lib/dom/videoAncestorChain';
import { startHostOverlayHoist } from '@/shared/lib/dom/hostOverlayHoist';
import { getStorage, setStorage } from '@/shared/lib/chrome-apis';
import { useSubtitleBlockDrag } from './subtitleDrag';
import { hasEscapeLayers } from '@/shared/ui/escapeLayerStack';
import { MobileCueChrome } from './MobileCueChrome';
import { t } from '@/shared/i18n';
import { STORAGE_KEYS } from '@/shared/config/config';
import { buildClusterCssVars } from './subtitleUI';
import styles from './PlayerModeOverlay.module.css';
import panelStyles from './SubtitlePanels.module.css';

const CONTENT_PCT_MIN = 20;
const CONTENT_PCT_MAX = 60;
const CONTENT_PCT_DEFAULT = 30;
const PLAYER_CHAIN_SAVED_PROPS = [
  'width',
  'height',
  'max-width',
  'max-height',
  'aspect-ratio',
  'flex',
  'position',
  'top',
  'right',
  'bottom',
  'left',
] as const;

type IconCatalogKey = keyof typeof ICON_CATALOG;

export interface PlayerModeOverlayProps {
  /** Subtitle overlay styles from extension popup. */
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;
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
  onToggleOcr?: () => void;
  ocrEnabled?: boolean;
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
  /** Shared subtitle block vertical offset (% of video stage) — same state as normal mode. */
  yOffsetPercent?: number;
  setYOffsetPercent?: Dispatch<SetStateAction<number>>;
  onDragReposition?: (yOffsetPercent: number) => void;
  /** Cue-list panel visibility — Player Mode's own state, independent from the normal-mode Split View. */
  cueListOpen: boolean;
  onCueListOpenChange: (open: boolean) => void;
  /** Interaction lock — shield over the video stage blocks host input. */
  interactionLocked?: boolean;
  onToggleInteractionLock?: () => void;
  /** Bilingual cues for CueList display in the split-view panel. */
  cues?: BilingualCue[];
  /** Current video time in milliseconds (for CueList highlight). */
  currentTimeMs?: number;
  /** Subtitle offset in ms (ADR-019 sync — highlight at currentTime + offset). */
  offsetMs?: number;
  /** Seek video to timeMs when user clicks a cue in the list. */
  onSeek?: (timeMs: number) => void;
  activeModeId?: string;
  customModes?: readonly StudyMode[];
  onStudyModeChange?: (modeId: string) => void;
  practiceMode?: SubtitlePracticeMode;
  onPracticeModeChange?: (mode: SubtitlePracticeMode) => void;
  playbackSpeed?: PlaybackSpeed;
  onPlaybackSpeedChange?: (speed: PlaybackSpeed) => void;
  onPreviousCue?: (cue: BilingualCue) => void;
  onReplayCue?: (cue: BilingualCue) => void;
  onContinueCue?: (cue: BilingualCue) => void;
  /** Tokenize cue target text into clickable word tokens. */
  tokenize?: CueListTokenize | null;
  panelBlurred?: boolean;
  /** One-action sentence capture into the mining queue (spec mining-queue). */
  onSaveCue?: (cue: BilingualCue) => void;
}

const PM_MOBILE_BREAKPOINT = 600;

function PlayerModeOverlayInner({
  targetStyle,
  nativeStyle,
  isPlaying,
  repeatActive,
  repeatIcon,
  repeatLabel,
  clusterSettings,
  blockSettings,
  videoAspectRatio,
  onQuickAdd,
  onEditCard,
  onToggleOcr,
  ocrEnabled,
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
  yOffsetPercent,
  setYOffsetPercent,
  onDragReposition,
  cues,
  currentTimeMs,
  offsetMs,
  onSeek,
  activeModeId,
  customModes,
  onStudyModeChange,
  practiceMode,
  onPracticeModeChange,
  playbackSpeed,
  onPlaybackSpeedChange,
  onPreviousCue,
  onReplayCue,
  onContinueCue,
  tokenize,
  panelBlurred,
  onSaveCue,
  cueListOpen,
  onCueListOpenChange,
  interactionLocked,
  onToggleInteractionLock,
}: PlayerModeOverlayProps): React.JSX.Element {
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const floatRowRef = useRef<HTMLDivElement>(null);
  const [floatYLocal, setFloatYLocal] = useState(75);
  const floatY = yOffsetPercent ?? floatYLocal;
  const setFloatY = setYOffsetPercent ?? setFloatYLocal;
  const {
    dragging: floatDragging,
    handlePointerDown: onFloatPointerDown,
    handlePointerMove: onFloatPointerMove,
    handlePointerUp: onFloatPointerUp,
  } = useSubtitleBlockDrag({
    rootRef: floatRowRef,
    yOffsetPercent: floatY,
    setYOffsetPercent: setFloatY,
    onDragReposition,
  });

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
  // Runs ONCE on mount — does NOT re-run on viewport/contentPct changes (a
  // separate bounds effect handles responsive resize without re-parenting).
  useEffect(() => {
    const stage = videoStageRef.current;
    if (!stage) return;
    const root = stage.getRootNode();
    const shadowHost = root instanceof ShadowRoot ? root.host : null;
    if (!(shadowHost instanceof HTMLElement)) return;

    const player = findPlayerContainer();
    if (!player) return;
    if (document.fullscreenElement) return;
    if (player.contains(shadowHost) && shadowHost.parentElement !== document.body) {
      const hostWithProp = shadowHost as HTMLElement & { __cellOriginalParent?: HTMLElement };
      if (!hostWithProp.__cellOriginalParent && shadowHost.parentElement) {
        hostWithProp.__cellOriginalParent = shadowHost.parentElement;
      }
      document.body.appendChild(shadowHost);
    }
    if (shadowHost.contains(player)) return;

    const originalParent = player.parentElement;
    const originalNextSibling = player.nextSibling;
    // If the player still sits inside a split-view stage cell, the split view's
    // deferred teardown (410ms after the playerMode state flip) will detach the
    // wrapper — including this cell — AFTER we snapshot it. Record the
    // wrapper's live parent + sibling so the exit-restore can fall back to a
    // connected anchor instead of inserting the player into a detached subtree
    // (which would remove the video from the page permanently).
    const svStage = player.closest('[data-cell-split-view="stage"]');
    const svWrapper = svStage ? svStage.closest('[data-cell-split-view="wrapper"]') : null;
    const liveAnchorParent = svWrapper ? svWrapper.parentElement : null;
    const liveAnchorSibling = svWrapper ? svWrapper.nextSibling : null;
    const savedStyle = {
      width: player.style.width,
      height: player.style.height,
      position: player.style.position,
      flex: player.style.flex,
      display: player.style.display,
      flexDirection: player.style.flexDirection,
      justifyContent: player.style.justifyContent,
      alignItems: player.style.alignItems,
      maxWidth: player.style.maxWidth,
      maxHeight: player.style.maxHeight,
      minWidth: player.style.minWidth,
      minHeight: player.style.minHeight,
      margin: player.style.margin,
      boxSizing: player.style.boxSizing,
      overflow: player.style.overflow,
      transform: player.style.transform,
      top: player.style.top,
      right: player.style.right,
      bottom: player.style.bottom,
      left: player.style.left,
    };
    const savedHostStyle = {
      width: shadowHost.style.width,
      height: shadowHost.style.height,
      display: shadowHost.style.display,
    };
    // Snapshot intermediate descendants BEFORE bounds effect mutates them.
    // Bounds effect sets width/height/aspect-ratio/flex with !important on
    // every resize; without this snapshot + restore in cleanup, those styles
    // persist after exit and the video stays stretched instead of returning
    // to host layout.
    const savedDescendantStyles: Array<{ el: HTMLElement; props: Record<string, string> }> = [];
    const styledTargets = new Set<HTMLElement>([
      ...Array.from(player.children).filter((c): c is HTMLElement => c instanceof HTMLElement),
      ...videoAncestorChain(player),
    ]);
    for (const desc of styledTargets) {
      const props: Record<string, string> = {};
      for (const p of PLAYER_CHAIN_SAVED_PROPS) {
        props[p] = desc.style.getPropertyValue(p);
      }
      savedDescendantStyles.push({ el: desc, props });
    }

    player.setAttribute('slot', 'cell-video');
    shadowHost.style.width = '100%';
    shadowHost.style.height = '100%';
    shadowHost.style.display = 'block';
    const centerStyle = document.createElement('style');
    centerStyle.setAttribute('data-cell-player-mode', 'center');
    centerStyle.textContent = 'video{position:absolute!important;top:0!important;left:0!important;width:100%!important;height:100%!important;object-fit:contain!important}';
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
      player.style.maxWidth = savedStyle.maxWidth;
      player.style.maxHeight = savedStyle.maxHeight;
      player.style.minWidth = savedStyle.minWidth;
      player.style.minHeight = savedStyle.minHeight;
      player.style.margin = savedStyle.margin;
      player.style.boxSizing = savedStyle.boxSizing;
      player.style.overflow = savedStyle.overflow;
      player.style.transform = savedStyle.transform;
      player.style.top = savedStyle.top;
      player.style.right = savedStyle.right;
      player.style.bottom = savedStyle.bottom;
      player.style.left = savedStyle.left;
      for (const { el, props } of savedDescendantStyles) {
        for (const [p, val] of Object.entries(props)) {
          el.style.removeProperty(p);
          if (val) el.style.setProperty(p, val);
        }
      }
      shadowHost.style.width = savedHostStyle.width;
      shadowHost.style.height = savedHostStyle.height;
      shadowHost.style.display = savedHostStyle.display;
      centerStyle.remove();
      const targetParent = originalParent?.isConnected
        ? originalParent
        : liveAnchorParent?.isConnected
          ? liveAnchorParent
          : null;
      if (targetParent && player.parentElement !== targetParent) {
        const refSibling = targetParent === originalParent
          ? originalNextSibling
          : liveAnchorSibling;
        if (refSibling && refSibling.parentElement === targetParent) {
          targetParent.insertBefore(player, refSibling);
        } else {
          targetParent.appendChild(player);
        }
      }
      const hostWithProp = shadowHost as HTMLElement & { __cellOriginalParent?: HTMLElement };
      const originalHostParent = hostWithProp.__cellOriginalParent;
      hostWithProp.__cellOriginalParent = undefined;
      if (
        originalHostParent?.isConnected
        && shadowHost.parentElement !== originalHostParent
        && !shadowHost.contains(originalHostParent)
      ) {
        originalHostParent.appendChild(shadowHost);
      }
    };
  }, []);

  // Host popups (settings sheets, menus, dialogs) can't render while our
  // host owns native fullscreen — document-level ones are outside the
  // fullscreen subtree, and player-internal ones are clipped/mispositioned
  // by the stage wrap. Hoist overlay roots into the host's "cell-host-popup"
  // slot so they project into the popup stage at viewport level.
  useEffect(() => {
    const stage = videoStageRef.current;
    if (!stage) return;
    const root = stage.getRootNode();
    const shadowHost = root instanceof ShadowRoot ? root.host : null;
    if (!(shadowHost instanceof HTMLElement)) return;
    return startHostOverlayHoist(shadowHost);
  }, []);

  // Responsive bounds: update player + intermediate container pixel sizes to
  // match the video stage. Re-runs on viewport/contentPct changes so the player
  // co/dãn theo stage khi resize window hoặc kéo resize handle. Does NOT
  // re-parent the player (the mount effect above handles that once).
  useEffect(() => {
    const stage = videoStageRef.current;
    if (!stage) return;
    const root = stage.getRootNode();
    const shadowHost = root instanceof ShadowRoot ? root.host : null;
    if (!(shadowHost instanceof HTMLElement)) return;
    const slot = stage.querySelector('slot[name="cell-video"]') as HTMLSlotElement | null;
    const player = slot?.assignedElements()[0] as HTMLElement | undefined;
    if (!player) return;
    const stageRect = stage.getBoundingClientRect();
    const stageW = Math.max(Math.round(stageRect.width), 0);
    const stageH = Math.max(Math.round(stageRect.height), 0);
    if (stageW <= 0 || stageH <= 0) return;
    player.style.boxSizing = 'border-box';
    player.style.width = `${stageW}px`;
    player.style.height = `${stageH}px`;
    player.style.maxWidth = 'none';
    player.style.maxHeight = 'none';
    player.style.minWidth = '0';
    player.style.minHeight = '0';
    player.style.margin = '0';
    player.style.display = 'block';
    player.style.position = 'relative';
    // m.youtube offsets the container for its app bar (top:48px) — the stage
    // has no such chrome; zero all inset so the player fills the stage box.
    // overflow:hidden wraps host chrome that spills past the stage box;
    // transform makes the container the containing block for any nested
    // position:fixed descendant (fixed escapes plain overflow clipping).
    player.style.setProperty('inset', '0', 'important');
    player.style.setProperty('overflow', 'hidden', 'important');
    player.style.setProperty('transform', 'translateZ(0)', 'important');
    // Wrap every direct child layer inside the stage box: viewport-anchored
    // layers (m.youtube #player-control-container is position:fixed at full
    // viewport height — its action menu covered the cue region) re-pin inside;
    // bottom-anchored host chrome lands on the video's bottom edge instead.
    for (const child of Array.from(player.children)) {
      if (!(child instanceof HTMLElement)) continue;
      if (child.matches('[data-cell-id],[data-cell-player-mode]')) continue;
      const pos = getComputedStyle(child).position;
      if (pos === 'fixed' || pos === 'sticky') {
        child.style.setProperty('position', 'absolute', 'important');
      }
      child.style.setProperty('inset', '0', 'important');
    }
    for (const child of videoAncestorChain(player)) {
      child.style.setProperty('width', `${stageW}px`, 'important');
      child.style.setProperty('height', `${stageH}px`, 'important');
      child.style.setProperty('max-width', 'none', 'important');
      child.style.setProperty('max-height', 'none', 'important');
      child.style.setProperty('aspect-ratio', 'auto', 'important');
      child.style.setProperty('flex', '1 1 0', 'important');
      // Hosts may keep player wrappers on fixed/sticky (m.youtube #player) —
      // a fixed wrapper escapes the stage box and overlays the viewport.
      const pos = getComputedStyle(child).position;
      if (pos === 'fixed' || pos === 'sticky') {
        child.style.setProperty('position', 'absolute', 'important');
      }
      child.style.setProperty('inset', '0', 'important');
    }
    // Generic: notify the host page's player JS that the player size changed.
    // Most video players (YouTube, Video.js, JW Player, etc.) listen for
    // window resize to recalculate control bar widths and layout. Without
    // this, controls keep their old pixel widths after reparenting+resize
    // (e.g. YouTube .ytp-chrome-bottom keeps right:470px instead of 12px).
    window.dispatchEvent(new Event('resize'));
  }, [viewport, contentPct]);

  const isMobilePm = viewport.w < PM_MOBILE_BREAKPOINT;
  const layout = resolvePlayerModeLayout(
    viewport.w,
    viewport.h,
    videoAspectRatio,
    isMobilePm ? PM_MOBILE_BAR_HEIGHT_PX : 0,
  );
  const clusterRightStyle = buildClusterCssVars(clusterSettings);

  // Body-level floating chrome (comprehension pill) anchors to the video
  // stage edge via this inset so it never covers the side panel header.
  // Shared contract with subtitleSplitView's --cell-split-panel-w.
  useEffect(() => {
    const root = document.documentElement;
    const measure = () => {
      const panel = splitRef.current?.querySelector<HTMLElement>(
        '[data-cell-split-view="panel"]',
      );
      root.style.setProperty(
        '--cell-split-panel-w',
        panel && !isMobilePm
          ? `${Math.round(panel.getBoundingClientRect().width)}px`
          : '0px',
      );
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      root.style.removeProperty('--cell-split-panel-w');
    };
  }, [contentPct, cueListOpen, isMobilePm]);

  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        // This capture listener runs before the escape-layer stack's document
        // listener; while an inner surface (more-menu Sheet, popup, panel) has
        // a layer the Escape belongs to it — do not consume the key.
        if (hasEscapeLayers()) return;
        // In native fullscreen: explicitly exit fullscreen so Player Mode
        // closes on Esc in both real user and automation contexts. The
        // fullscreenchange listener in SubtitlePanels then sets playerMode false.
        if (document.fullscreenElement) {
          e.preventDefault();
          e.stopPropagation();
          void document.exitFullscreen();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (cueListOpen) {
          onCueListOpenChange(false);
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
        onCueListOpenChange(!cueListOpen);
      }
    };
    window.addEventListener('keydown', onWindowKeyDown, true);
    return () => window.removeEventListener('keydown', onWindowKeyDown, true);
  }, [onExit, cueListOpen, onCueListOpenChange]);

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

  // Keyboard resize (WAI-ARIA window-splitter): ArrowLeft/Right, 5%/step,
  // Home/End → min/max. Left arrow widens content (handle is on content's left edge).
  const onResizeKeyDown = useCallback((e: React.KeyboardEvent): void => {
    const STEP = 5;
    let next: number | null = null;
    if (e.key === 'ArrowLeft') next = contentPct + STEP;
    else if (e.key === 'ArrowRight') next = contentPct - STEP;
    else if (e.key === 'Home') next = CONTENT_PCT_MIN;
    else if (e.key === 'End') next = CONTENT_PCT_MAX;
    if (next === null) return;
    e.preventDefault();
    const clamped = Math.min(Math.max(next, CONTENT_PCT_MIN), CONTENT_PCT_MAX);
    setContentPct(clamped);
    setStorage({ [STORAGE_KEYS.PLAYER_MODE_CONTENT_PCT]: clamped }).catch(() => undefined);
  }, [contentPct]);

  if (isMobilePm) {
    return (
      <div
        className={`${styles.overlay} ${styles.overlayMobile}`}
        data-cell-id="player-mode-overlay"
        data-practice-active={practiceMode && practiceMode !== 'off' ? 'true' : 'false'}
        role="application"
        aria-label={t('subtitle.playerMode.aria')}
      >
        <div className={styles.split} data-cell-split-view="wrapper">
          <div
            className={`${styles.videoStage} ${!cueListOpen || !onSeek ? styles.videoStageFill : ''}`}
            style={cueListOpen && onSeek ? { height: `${layout.videoStageHeight}px` } : undefined}
            data-cell-split-view="stage"
            aria-hidden="true"
            ref={videoStageRef}
          >
            <slot name="cell-video" />
            {interactionLocked && <LockShield className={styles.lockLayer} />}
          </div>
          <MobileCueChrome
            cueListOpen={cueListOpen}
            onToggleCueList={() => onCueListOpenChange(!cueListOpen)}
            onExit={onExit}
            exitLabel={t('subtitle.toolbar.exitPlayerMode')}
            exitTitle={t('subtitle.toolbar.exitPlayerModeTitle')}
            onQuickAdd={onQuickAdd}
            onEditCard={onEditCard}
            onToggleOcr={onToggleOcr}
            ocrEnabled={ocrEnabled}
            onGenerateNative={onGenerateNative}
            onToggleManager={onToggleManager}
            generateNativeEnabled={generateNativeEnabled}
            onPrev={onPrev}
            onNext={onNext}
            onRepeat={onRepeat}
            repeatActive={repeatActive}
            repeatLabel={repeatLabel}
            repeatIcon={repeatIcon}
            onRewind={onRewind}
            onForward={onForward}
            onPlayPause={onPlayPause}
            isPlaying={isPlaying}
            interactionLocked={interactionLocked}
            onToggleInteractionLock={onToggleInteractionLock}
            cues={cues}
            currentTimeMs={currentTimeMs}
            offsetMs={offsetMs}
            onSeek={onSeek}
            activeModeId={activeModeId}
            customModes={customModes}
            onStudyModeChange={onStudyModeChange}
            practiceMode={practiceMode}
            onPracticeModeChange={onPracticeModeChange}
            playbackSpeed={playbackSpeed}
            onPlaybackSpeedChange={onPlaybackSpeedChange}
            onPreviousCue={onPreviousCue}
            onReplayCue={onReplayCue}
            onContinueCue={onContinueCue}
            tokenize={tokenize}
            panelBlurred={panelBlurred}
            onSaveCue={onSaveCue}
          />
        </div>

        <slot name="cell-host-chrome" />

        <div className={styles.popupStage}>
          <slot name="cell-host-popup" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.overlay}
      data-cell-id="player-mode-overlay"
      data-practice-active={practiceMode && practiceMode !== 'off' ? 'true' : 'false'}
      role="application"
      aria-label={t('subtitle.playerMode.aria')}
    >
      {/* Player Mode split — video-stage + content.
          >480px: row (video left, content right, resizable).
          <480px: column (video top, content bottom). */}
      <div className={styles.split} ref={splitRef} data-cell-split-view="wrapper">
        <div
          className={styles.videoStage}
          style={{ height: `${layout.videoStageHeight}px` }}
          data-cell-split-view="stage"
          aria-hidden="true"
          ref={videoStageRef}
        >
          <slot name="cell-video" />
          {interactionLocked && <LockShield className={styles.lockLayer} />}
        </div>

        {cueListOpen && onSeek && (
          <>
            <div
              className={styles.resizeHandle}
              data-cell-split-view="handle"
              onPointerDown={onResizePointerDown}
              onPointerMove={onResizePointerMove}
              onPointerUp={onResizePointerUp}
              onPointerCancel={onResizePointerUp}
              onKeyDown={onResizeKeyDown}
              role="separator"
              aria-orientation="vertical"
              aria-label={t('subtitle.playerMode.resizeList')}
              aria-valuenow={Math.round(contentPct)}
              aria-valuemin={CONTENT_PCT_MIN}
              aria-valuemax={CONTENT_PCT_MAX}
              tabIndex={0}
            />
            <div
              className={styles.contentOther}
              style={{ '--content-pct': `${contentPct}%` } as React.CSSProperties}
              data-cell-split-view="panel"
            >
              <SubtitlePanel
                cues={cues ?? []}
                currentTimeMs={currentTimeMs ?? 0}
                offsetMs={offsetMs}
                onSeek={onSeek}
                onClose={() => onCueListOpenChange(false)}
                activeModeId={activeModeId}
                customModes={customModes}
                onStudyModeChange={onStudyModeChange}
                practiceMode={practiceMode}
                onPracticeModeChange={onPracticeModeChange}
                isPlaying={isPlaying}
                playbackSpeed={playbackSpeed}
                onPlaybackSpeedChange={onPlaybackSpeedChange}
                onPlayPause={onPlayPause}
                onPreviousCue={onPreviousCue}
                onReplayCue={onReplayCue}
                onContinueCue={onContinueCue}
                tokenize={tokenize}
                panelBlurred={panelBlurred}
                onSaveCue={onSaveCue}
              />
            </div>
          </>
        )}
      </div>

      {/* Subtitle overlay — same row composition as normal mode
          (SubtitlePanels .root: NavCluster | SubtitleBlock | toolbar at
          --sb-y%), floated over the video stage. */}
      <div
        className={styles.subtitleOverlay}
        style={{ right: cueListOpen && onSeek ? `calc(${contentPct}% + var(--space-1-5))` : 'var(--space-1-5)' }}
        data-cell-id="pm-subtitle-overlay"
      >
        <div
          ref={floatRowRef}
          className={`${panelStyles.root}${floatDragging ? ` ${panelStyles.dragging}` : ''}`}
          style={{ '--sb-y': floatY } as React.CSSProperties}
          data-cell-id="pm-subtitle-row"
          onPointerDown={onFloatPointerDown}
          onPointerMove={onFloatPointerMove}
          onPointerUp={onFloatPointerUp}
          onPointerCancel={onFloatPointerUp}
        >
          <div className={panelStyles.navLayer}>
            <NavCluster
              collapsed={false}
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
          <div className={panelStyles.blockLayer}>
            <SubtitleBlock
              targetStyle={targetStyle}
              nativeStyle={nativeStyle}
              blockSettings={blockSettings}
            />
          </div>
          <ClusterRightToolbar
            mode="player"
            clusterRightStyle={clusterRightStyle}
            onQuickAdd={onQuickAdd}
            onEditCard={onEditCard}
            onToggleOcr={onToggleOcr}
            ocrEnabled={ocrEnabled}
            onToggleManager={onToggleManager}
            onGenerateNative={onGenerateNative}
            generateNativeEnabled={generateNativeEnabled}
            onToggleSidePanel={onToggleSidePanel ? () => onCueListOpenChange(!cueListOpen) : undefined}
            sidePanelLabel={cueListOpen ? t('subtitle.toolbar.closeList') : t('subtitle.toolbar.openList')}
            toolsExpanded={toolsExpanded}
            onToggleTools={onToggleTools ?? (() => undefined)}
            interactionLocked={interactionLocked}
            onToggleInteractionLock={onToggleInteractionLock}
            onExit={onExit}
          />
        </div>
      </div>

      <slot name="cell-host-chrome" />

      <div className={styles.popupStage}>
        <slot name="cell-host-popup" />
      </div>
    </div>
  );
}

export const PlayerModeOverlay = memo(PlayerModeOverlayInner);
