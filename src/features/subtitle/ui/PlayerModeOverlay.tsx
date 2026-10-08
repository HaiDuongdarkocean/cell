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
import { resolvePlayerModeLayout, PM_MOBILE_BAR_HEIGHT_PX } from '../logic/playerModeGeometry';
import { findPlayerContainer } from '@/shared/lib/dom/findPlayerContainer';
import { getStorage, setStorage, onStorageChanged, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { Button } from '@/shared/ui/Button';
import { MenuItem, MenuSeparator } from '@/shared/ui/Menu';
import { useSubtitleBlockDrag } from './subtitleDrag';
import { Sheet } from '@/shared/ui/Sheet';
import { hasEscapeLayers } from '@/shared/ui/escapeLayerStack';
import { StepperSection, StepperValue } from '@/shared/ui/StepperSection';
import { PLAYBACK_SPEEDS } from '@/entities/studyMode/types';
import { Icon } from '@/shared/icons/Icon';
import { PRESETS } from '@/entities/studyMode/constants';
import { t } from '@/shared/i18n';
import { STORAGE_KEYS } from '@/shared/config/config';
import { buildClusterCssVars } from './subtitleUI';
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
  /** Cue-list panel visibility — shared split-view state, synced with normal mode. */
  cueListOpen: boolean;
  onCueListOpenChange: (open: boolean) => void;
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
const PM_MENU_SPEEDS: readonly PlaybackSpeed[] = PLAYBACK_SPEEDS;
const PM_SHEET_HEIGHT_RATIO = 0.62;
const ORBITAL_POSITION_KEY = 'orbitalBadgePosition';
const ORBITAL_BADGE_DEFAULT_SIZE = 36;
const PM_FAB_GAP_PX = 8;
type StoredOrbitalPosition = { edge?: 'left' | 'right' | 'top' | 'bottom'; y?: number };

function formatPlaybackSpeed(speed: PlaybackSpeed | undefined): string {
  return `${speed ?? 1}×`;
}

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
}: PlayerModeOverlayProps): React.JSX.Element {
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [cueDisplayMode, setCueDisplayMode] = useState<'list' | 'active'>('list');
  const [showAllCues, setShowAllCues] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [fabSlot, setFabSlot] = useState<HTMLDivElement | null>(null);
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

  const bottomBarRef = useRef<HTMLElement>(null);
  const anchorRowRef = useRef<HTMLDivElement>(null);
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
    let desc: HTMLElement | null = player.firstElementChild as HTMLElement | null;
    while (desc) {
      const props: Record<string, string> = {};
      for (const p of ['width', 'height', 'max-width', 'max-height', 'aspect-ratio', 'flex']) {
        props[p] = desc.style.getPropertyValue(p);
      }
      savedDescendantStyles.push({ el: desc, props });
      desc = desc.firstElementChild as HTMLElement | null;
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
    let child: HTMLElement | null = player.firstElementChild as HTMLElement | null;
    while (child) {
      child.style.setProperty('width', `${stageW}px`, 'important');
      child.style.setProperty('height', `${stageH}px`, 'important');
      child.style.setProperty('max-width', 'none', 'important');
      child.style.setProperty('max-height', 'none', 'important');
      child.style.setProperty('aspect-ratio', 'auto', 'important');
      child.style.setProperty('flex', '1 1 0', 'important');
      child = child.firstElementChild as HTMLElement | null;
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

  // PM mobile: cue display mode (list | active) persisted in storage and
  // live-updated via chrome.storage.onChanged (scoped to this key).
  useEffect(() => {
    let cancelled = false;
    const key = STORAGE_KEYS.PLAYER_MODE_CUE_DISPLAY;
    getStorage<Record<string, unknown>>(key)
      .then((data) => {
        const v = data[key];
        if (!cancelled && (v === 'list' || v === 'active')) setCueDisplayMode(v);
      })
      .catch(() => undefined);
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ): void => {
      if (area !== 'local') return;
      const v = changes[key]?.newValue;
      if (v === 'list' || v === 'active') setCueDisplayMode(v);
    };
    onStorageChanged(onChanged);
    return () => {
      cancelled = true;
      removeOnStorageChangedListener(onChanged);
    };
  }, []);

  // Session override reset: switching display mode (or leaving/re-entering a
  // mode via storage) drops "show all cues" so 'active' returns to 1 card.
  useEffect(() => {
    setShowAllCues(false);
  }, [cueDisplayMode]);

  // REQ-8: when the orbital badge is snapped to the right edge and its
  // vertical span overlaps the rail, lift the fab above the badge — keeps
  // the rail's right edge flush with the bottom bar (AC-18). Default badge
  // preset is right/center, which sits clear of the rail → lift = 0.
  const [orbitalLiftPx, setOrbitalLiftPx] = useState(0);
  useEffect(() => {
    if (!isMobilePm) {
      setOrbitalLiftPx(0);
      return;
    }
    let cancelled = false;
    const sync = (): void => {
      Promise.all([
        getStorage<Record<string, StoredOrbitalPosition | undefined>>(ORBITAL_POSITION_KEY),
        getStorage<Record<string, { dictionaryPopup?: { badgePointerTrigger?: { size?: number } } }>>(
          STORAGE_KEYS.SETTINGS,
        ),
      ])
        .then(([posData, settingsData]) => {
          if (cancelled) return;
          const pos = posData[ORBITAL_POSITION_KEY];
          const edge = pos?.edge ?? 'right';
          if (edge !== 'right') {
            setOrbitalLiftPx(0);
            return;
          }
          const sizeValue = settingsData[STORAGE_KEYS.SETTINGS]?.dictionaryPopup?.badgePointerTrigger?.size;
          const size = typeof sizeValue === 'number' ? sizeValue : ORBITAL_BADGE_DEFAULT_SIZE;
          const badgeCy = typeof pos?.y === 'number' ? pos.y : window.innerHeight / 2;
          const badgeTop = badgeCy - size / 2;
          const badgeBottom = badgeCy + size / 2;
          const railRect = anchorRowRef.current
            ?.querySelector<HTMLElement>('[data-cell-id="player-mode-actions"]')
            ?.getBoundingClientRect();
          const railTop = railRect?.top ?? 0;
          const fabZoneTop = railTop - (railRect?.height ?? 0) - PM_FAB_GAP_PX;
          const overlapsFab = badgeBottom > fabZoneTop && badgeTop < railTop;
          setOrbitalLiftPx(railTop > 0 && overlapsFab ? railTop - badgeTop : 0);
        })
        .catch(() => undefined);
    };
    sync();
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ): void => {
      if (area !== 'local') return;
      if (ORBITAL_POSITION_KEY in changes || STORAGE_KEYS.SETTINGS in changes) sync();
    };
    onStorageChanged(onChanged);
    return () => {
      cancelled = true;
      removeOnStorageChangedListener(onChanged);
    };
  }, [isMobilePm]);

  // PM mobile: flag + anchor offset on <html> — the comprehension pill's
  // :host-context rule re-docks it centered above the bottom bar. Pure CSS
  // mechanism: remount-safe and self-restoring when the attribute is removed.
  useEffect(() => {
    const root = document.documentElement;
    if (!isMobilePm) {
      root.removeAttribute('data-cell-player-mode-mobile');
      root.style.removeProperty('--pm-anchor-bottom');
      return;
    }
    root.setAttribute('data-cell-player-mode-mobile', 'true');
    const bar = bottomBarRef.current?.offsetHeight ?? 0;
    const row = anchorRowRef.current?.offsetHeight ?? 0;
    root.style.setProperty('--pm-anchor-bottom', `${Math.round(bar + row / 2)}px`);
    return () => {
      root.removeAttribute('data-cell-player-mode-mobile');
      root.style.removeProperty('--pm-anchor-bottom');
    };
  }, [isMobilePm, viewport, cueListOpen, cues]);

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

  const hasCues = (cues ?? []).length > 0;
  const closeMoreMenu = (): void => setMoreMenuOpen(false);
  const speedIndex = Math.max(PM_MENU_SPEEDS.indexOf(playbackSpeed ?? 1), 0);
  const stepPlaybackSpeed = (delta: number): void => {
    const next = PM_MENU_SPEEDS[speedIndex + delta];
    if (!onPlaybackSpeedChange || next === undefined) return;
    onPlaybackSpeedChange(next);
  };

  const pmCardActions =
    onQuickAdd || onEditCard ? (
      <>
        {onQuickAdd && (
          <Button
            variant="primarySubtle"
            size="xs"
            elevation="low"
            aria-label={t('subtitle.toolbar.quickAdd')}
            title={t('subtitle.toolbar.quickAddTitle')}
            data-cell-id="quick-add-btn"
            onClick={onQuickAdd}
          >
            <Icon name="zap" />
          </Button>
        )}
        {onEditCard && (
          <Button
            variant="errorSubtle"
            size="xs"
            elevation="low"
            aria-label={t('subtitle.toolbar.editCard')}
            title={t('subtitle.toolbar.editCardTitle')}
            data-cell-id="edit-card-btn"
            onClick={onEditCard}
          >
            <Icon name="pencil" />
          </Button>
        )}
      </>
    ) : undefined;

  const pmStudyModes = [...PRESETS, ...(customModes ?? [])];

  if (isMobilePm) {
    return (
      <div
        className={`${styles.overlay} ${styles.overlayMobile}`}
        data-cell-id="player-mode-overlay"
        data-practice-active={practiceMode && practiceMode !== 'off' ? 'true' : 'false'}
        style={orbitalLiftPx > 0 ? ({ '--pm-orbital-lift': `${orbitalLiftPx}px` } as React.CSSProperties) : undefined}
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
          </div>
          <div
            className={`${styles.pmCueWrap} ${!cueListOpen || !onSeek ? styles.pmCueWrapCollapsed : ''}`}
            data-cell-split-view="panel"
          >
            {cueListOpen && onSeek && (
              <div className={styles.pmCueRegion} data-cell-id="pm-cue-region">
                <SubtitlePanel
                  cues={cues ?? []}
                  currentTimeMs={currentTimeMs ?? 0}
                  offsetMs={offsetMs}
                  onSeek={onSeek}
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
                  pmMobile
                  cueDisplayMode={cueDisplayMode}
                  showAllCues={showAllCues}
                  cardActions={pmCardActions}
                  fabPortalTarget={fabSlot}
                  onSaveCue={onSaveCue}
                />
              </div>
            )}
            <div className={styles.anchorBand} data-cell-id="pm-anchor-band">
              <div className={styles.anchorRow} ref={anchorRowRef} data-cell-id="pm-anchor-row">
                {onToggleManager && (
                  <Button
                    variant="neutralSubtle"
                    size="md"
                    aria-label={t('subtitle.toolbar.openManager')}
                    title={t('subtitle.toolbar.openManager')}
                    data-cell-id="manager-toggle-btn"
                    onClick={onToggleManager}
                  >
                    <Icon name="captions" />
                  </Button>
                )}
                <div className={styles.pmRail} data-cell-id="player-mode-actions">
                  <div ref={setFabSlot} data-cell-id="pm-fab-slot" />
                  {onGenerateNative && (
                    <Button
                      variant="neutralSubtle"
                      size="md"
                      elevation="low"
                      aria-label={t('subtitle.toolbar.generateNative')}
                      title={t('subtitle.toolbar.generateNativeTitle')}
                      data-cell-id="generate-native-btn"
                      onClick={onGenerateNative}
                      disabled={!generateNativeEnabled}
                    >
                      <Icon name="generateNative" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <nav
          className={styles.bottomBar}
          ref={bottomBarRef}
          data-cell-id="pm-bottom-bar"
          aria-label={t('subtitle.playerMode.menuLabel')}
        >
          <div className={styles.barEdge}>
            <Button
              variant="ghost"
              size="md"
              aria-label={t('subtitle.toolbar.exitPlayerMode')}
              title={t('subtitle.toolbar.exitPlayerModeTitle')}
              data-cell-id="player-mode-exit-btn"
              onClick={onExit}
            >
              <Icon name="x" />
            </Button>
          </div>
          <div className={styles.transport} data-cell-id="nav-cluster">
            {hasCues
              ? onPrev && (
                  <Button
                    variant="primarySubtle"
                    size="md"
                    aria-label={t('settings.shortcuts.action.prevCue')}
                    data-cell-id="nav-prev"
                    onClick={onPrev}
                  >
                    <Icon name="chevronLeft" />
                  </Button>
                )
              : onRewind && (
                  <Button
                    variant="primarySubtle"
                    size="md"
                    aria-label={t('subtitle.nav.rewind')}
                    data-cell-id="nav-rewind"
                    onClick={onRewind}
                  >
                    <Icon name="navRewind" />
                  </Button>
                )}
            {onRepeat && (
              <Button
                variant="primarySubtle"
                size="md"
                aria-label={repeatActive ? t('subtitle.nav.repeatCancel') : repeatLabel ?? t('player.nav.repeat')}
                data-cell-id="nav-repeat"
                active={repeatActive}
                onClick={onRepeat}
              >
                <Icon name="rotateCcw" />
              </Button>
            )}
            {onPlayPause && (
              <Button
                variant="primarySubtle"
                size="md"
                aria-label={isPlaying ? t('subtitle.nav.pause') : t('subtitle.nav.play')}
                data-cell-id="nav-play"
                onClick={onPlayPause}
              >
                <Icon name={isPlaying ? 'pause' : 'play'} />
              </Button>
            )}
            {hasCues
              ? onNext && (
                  <Button
                    variant="primarySubtle"
                    size="md"
                    aria-label={t('settings.shortcuts.action.nextCue')}
                    data-cell-id="nav-next"
                    onClick={onNext}
                  >
                    <Icon name="chevronRight" />
                  </Button>
                )
              : onForward && (
                  <Button
                    variant="primarySubtle"
                    size="md"
                    aria-label={t('subtitle.nav.forward')}
                    data-cell-id="nav-forward"
                    onClick={onForward}
                  >
                    <Icon name="navForward" />
                  </Button>
                )}
          </div>
          <div className={styles.barEdge}>
            <Button
              variant="ghost"
              size="md"
              aria-label={t('subtitle.playerMode.more')}
              aria-haspopup="dialog"
              aria-expanded={moreMenuOpen}
              data-cell-id="pm-more-btn"
              onClick={() => setMoreMenuOpen((v) => !v)}
            >
              <Icon name="ellipsis" />
            </Button>
          </div>
        </nav>

        <Sheet
          open={moreMenuOpen}
          onClose={closeMoreMenu}
          aria-label={t('subtitle.playerMode.menuLabel')}
          initialHeight={Math.round(viewport.h * PM_SHEET_HEIGHT_RATIO)}
          data-cell-id="pm-more-menu"
          footer={
            <StepperSection
              label={t('studyModes.speed.aria')}
              dataCellId="pm-speed-stepper"
              decreaseLabel={<Icon name="minus" />}
              increaseLabel={<Icon name="plus" />}
              decreaseAriaLabel={t('subtitle.playerMode.speedSlower')}
              increaseAriaLabel={t('subtitle.playerMode.speedFaster')}
              decreaseDisabled={speedIndex <= 0}
              increaseDisabled={speedIndex >= PM_MENU_SPEEDS.length - 1}
              decreaseDataCellId="pm-speed-dec"
              increaseDataCellId="pm-speed-inc"
              onDecrease={() => stepPlaybackSpeed(-1)}
              onIncrease={() => stepPlaybackSpeed(1)}
            >
              <StepperValue dataCellId="pm-speed-value">
                {formatPlaybackSpeed(playbackSpeed)}
              </StepperValue>
            </StepperSection>
          }
        >
          <div className={styles.pmSheetList} role="menu" aria-label={t('subtitle.playerMode.menuLabel')}>
            <MenuItem
              icon={<Icon name="sidePanel" />}
              data-cell-id="panel-toggle-btn"
              onSelect={() => { onCueListOpenChange(!cueListOpen); closeMoreMenu(); }}
            >
              {cueListOpen ? t('subtitle.playerMode.hideCueList') : t('subtitle.playerMode.showCueList')}
            </MenuItem>
            {onToggleOcr && (
              <MenuItem
                icon={<Icon name="scanText" />}
                selected={ocrEnabled}
                data-cell-id="ocr-toggle-btn"
                onSelect={() => { onToggleOcr(); closeMoreMenu(); }}
              >
                {ocrEnabled ? t('subtitle.toolbar.disableOcr') : t('subtitle.toolbar.enableOcr')}
              </MenuItem>
            )}
            {cueDisplayMode === 'active' && !showAllCues && (
              <MenuItem
                icon={<Icon name="captions" />}
                data-cell-id="pm-show-all-cues"
                onSelect={() => { setShowAllCues(true); closeMoreMenu(); }}
              >
                {t('subtitle.playerMode.showAllCues')}
              </MenuItem>
            )}
            {onStudyModeChange && pmStudyModes.length > 0 && (
              <>
                <MenuSeparator />
                {pmStudyModes.map((mode) => (
                  <MenuItem
                    key={mode.id}
                    radio
                    icon={<Icon name={mode.icon} />}
                    selected={activeModeId === mode.id || (!activeModeId && mode.id === 'normal')}
                    data-cell-id={`study-mode-${mode.id}`}
                    onSelect={() => { onStudyModeChange(mode.id); closeMoreMenu(); }}
                  >
                    {mode.titleKey ? t(mode.titleKey) : mode.title}
                  </MenuItem>
                ))}
              </>
            )}
          </div>
        </Sheet>
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
            onExit={onExit}
          />
        </div>
      </div>
    </div>
  );
}

export const PlayerModeOverlay = memo(PlayerModeOverlayInner);
