// regionSelector — visual region selector overlay on video.
// Modes: view (blue dashed rectangle, not interactive), select (drag to draw), edit (drag handles to resize).
// Emits region changes via callback. Apply/Cancel/Reset controlled by caller.
//
// DOM contract (verified by browser tests):
// - .cell-ocr-region-selector  container (pointer-events none)
// - .cell-ocr-region-rect      rectangle; data-mode=view|select|edit; % position inline
// - .cell-ocr-region-label     dimension readout (rounded %)
// - [data-handle]              8 resize handles in edit mode (created once, listener bound at creation)
// - .cell-ocr-region-btn       Apply / Cancel toolbar buttons
// - .cell-ocr-split-half       split stream halves, data-label (view mode only, pointer-events none)
// - .cell-ocr-split-divider    draggable split divider (view mode only, listener bound at creation)

import { STATIC_TOKENS } from '@/shared/lib/tokens';
import { checkIcon, xIcon, cropIcon, moveVerticalIcon, rotateCcwIcon, chevronLeftIcon } from '@/shared/icons';
import type { CustomRegion } from '@/features/ocr/persistence/ocrStateTypes';
import type { SplitHalf } from '@/features/ocr/pipeline/splitRegion';
import { computeSplitHalves } from '@/features/ocr/pipeline/splitRegion';
import { findVideoContainer } from '@/features/subtitle/logic/findPlayerContainer';
import { mapShellToIntrinsic, mapIntrinsicToShell, readVideoGeometry, computeContentRect } from '@/features/ocr/pipeline/regionMapping';

export type RegionSelectorMode = 'view' | 'select' | 'edit';

export interface RegionSelectorCallbacks {
  /** Called when user drags/resizes the rectangle (real-time, in INTRINSIC-space %).
   *  Intrinsic-space = % of video.videoWidth/Height, so the value maps 1:1 to the
   *  crop region regardless of letterbox/control-bar offset. */
  onRegionChange: (region: CustomRegion) => void;
  /** Called when user clicks Apply. */
  onApply: () => void;
  /** Called when user clicks Cancel or presses Esc. */
  onCancel: () => void;
  /** Called when the user finishes dragging the split divider (mouseup) — ratio clamped 0.1-0.9. Real-time drag only updates UI. */
  onSplitRatioChange?: (ratio: number) => void;
  /** Called when user clicks Split toggle in the action bar (view mode only). */
  onToggleSplit?: () => void;
  /** Called when user clicks Select Region in the action bar (view mode only). */
  onSelectRegion?: () => void;
  /** Called when user clicks Reset Region in the action bar (view mode only). */
  onResetRegion?: () => void;
}

/** Compute default bottom region as CustomRegion (centered x, bottom y). */
export function defaultBottomRegion(regionPct: number, regionWidthPct = 100): CustomRegion {
  return { xPct: (100 - regionWidthPct) / 2, yPct: 100 - regionPct, widthPct: regionWidthPct, heightPct: regionPct };
}

/** Round a percentage for display (drawn regions carry long decimals like 29.722222%). */
export function formatPct(pct: number): number {
  return Math.round(pct);
}

const FONT = STATIC_TOKENS['--font-family'] ?? 'sans-serif';
const ACCENT = STATIC_TOKENS['--overlay-ocr-region-accent'] ?? '#0066ff';
const FILL = STATIC_TOKENS['--overlay-ocr-region-fill'] ?? 'rgba(0, 102, 255, 0.05)';
const FILL_ACTIVE = STATIC_TOKENS['--overlay-ocr-region-fill-active'] ?? 'rgba(0, 102, 255, 0.12)';
const RADIUS_PILL = STATIC_TOKENS['--radius-pill'] ?? '9999px';

/** CSS injected once: class-based styling (hover/transition need a stylesheet, not inline styles).
 *  Also hides the universal panel during selection (was a separate style tag). */
let overlayCssInjected = false;
function injectOverlayCss(): void {
  if (overlayCssInjected) return;
  overlayCssInjected = true;
  const style = document.createElement('style');
  style.id = 'cell-ocr-region-style';
  style.textContent = `
body[data-ocr-region-selecting="true"] #cell-universal-panel-host { display: none !important; }
.cell-ocr-region-selector, .cell-ocr-region-selector * { box-sizing: border-box; }
.cell-ocr-region-rect {
  position: absolute; border: 2px dashed ${ACCENT}; background: ${FILL};
  pointer-events: none; z-index: 99998; transition: background 120ms ease;
}
.cell-ocr-region-rect[data-mode="select"] { background: ${FILL_ACTIVE}; pointer-events: auto; cursor: move; }
.cell-ocr-region-rect[data-mode="edit"] { background: ${FILL_ACTIVE}; pointer-events: auto; cursor: move; }
.cell-ocr-region-selector { pointer-events: none; }
.cell-ocr-region-selector[data-mode="select"] { pointer-events: auto; cursor: crosshair; }
.cell-ocr-region-label {
  position: absolute; top: -22px; left: -2px; padding: 2px 8px;
  font-family: ${FONT}; font-size: 11px; font-weight: 500; line-height: 1.4; letter-spacing: 0.2px;
  color: ${ACCENT}; background: rgba(0, 0, 0, 0.75); border-radius: 5px;
  white-space: nowrap; pointer-events: none;
}
.cell-ocr-region-handle {
  position: absolute; width: 10px; height: 10px;
  background: ${ACCENT}; border: 1px solid rgba(0, 0, 0, 0.55); border-radius: 3px;
  pointer-events: auto;
}
.cell-ocr-region-handle:hover { box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35); }
.cell-ocr-region-handle[data-handle="nw"] { left: -5px; top: -5px; cursor: nwse-resize; }
.cell-ocr-region-handle[data-handle="n"]  { left: 50%; top: -5px; transform: translateX(-50%); cursor: ns-resize; }
.cell-ocr-region-handle[data-handle="ne"] { right: -5px; top: -5px; cursor: nesw-resize; }
.cell-ocr-region-handle[data-handle="e"]  { right: -5px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }
.cell-ocr-region-handle[data-handle="se"] { right: -5px; bottom: -5px; cursor: nwse-resize; }
.cell-ocr-region-handle[data-handle="s"]  { left: 50%; bottom: -5px; transform: translateX(-50%); cursor: ns-resize; }
.cell-ocr-region-handle[data-handle="sw"] { left: -5px; bottom: -5px; cursor: nesw-resize; }
.cell-ocr-region-handle[data-handle="w"]  { left: -5px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }
.cell-ocr-region-btn {
  appearance: none; -webkit-appearance: none; display: inline-flex; align-items: center; gap: 5px;
  padding: 0 12px; height: 28px; margin: 0; border: none; border-radius: ${RADIUS_PILL};
  font-family: ${FONT}; font-size: 12px; font-weight: 600; line-height: 1; letter-spacing: 0.2px;
  cursor: pointer; pointer-events: auto; transition: filter 120ms ease, background 120ms ease;
}
.cell-ocr-region-btn svg { width: 13px; height: 13px; display: block; }
.cell-ocr-region-btn--apply { background: ${ACCENT}; color: #fff; }
.cell-ocr-region-btn--apply:hover { filter: brightness(1.15); }
.cell-ocr-region-btn--cancel { background: rgba(0, 0, 0, 0.6); color: #fff; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35); }
.cell-ocr-region-btn--cancel:hover { background: rgba(170, 0, 0, 0.85); box-shadow: none; }
.cell-ocr-split-half { position: absolute; background: rgba(255, 255, 255, 0.08); pointer-events: none; }
.cell-ocr-split-half[data-label]::after { content: attr(data-label); position: absolute; left: 4px; top: 2px; font-size: 10px; color: rgba(255, 255, 255, 0.85); font-family: ${FONT}; }
.cell-ocr-split-divider { position: absolute; left: 0; width: 100%; height: 14px; transform: translateY(-50%); cursor: ns-resize; pointer-events: auto; }
.cell-ocr-split-divider::after { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 2px; background: rgba(255, 255, 255, 0.9); border-radius: 1px; }
.cell-ocr-action-bar { position: absolute; bottom: 4px; right: 4px; display: flex; align-items: center; gap: 4px; pointer-events: auto; z-index: 99999; }
.cell-ocr-action-bar-inner { display: flex; align-items: center; gap: 4px; overflow: hidden; transition: max-width 200ms ease, opacity 150ms ease; }
.cell-ocr-action-bar-inner[data-collapsed="true"] { max-width: 0; opacity: 0; }
.cell-ocr-action-bar-inner[data-collapsed="false"] { max-width: 200px; opacity: 1; }
.cell-ocr-action-btn {
  appearance: none; -webkit-appearance: none; display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; margin: 0; border: none; border-radius: ${RADIUS_PILL};
  background: rgba(0, 0, 0, 0.6); color: #fff; cursor: pointer; pointer-events: auto;
  transition: filter 120ms ease, background 120ms ease; flex-shrink: 0;
}
.cell-ocr-action-btn svg { width: 14px; height: 14px; display: block; }
.cell-ocr-action-btn:hover { filter: brightness(1.3); }
.cell-ocr-action-btn[data-active="true"] { background: ${ACCENT}; }
.cell-ocr-action-toggle { width: 26px; height: 26px; flex-shrink: 0; }
.cell-ocr-action-toggle svg { transition: transform 200ms ease; }
.cell-ocr-action-toggle[data-collapsed="true"] svg { transform: rotate(180deg); }
`;
  document.head.appendChild(style);
}

/** Region selector overlay — manages rectangle + handles + buttons on video. */
export class RegionSelector {
  private container: HTMLDivElement | null = null;
  private rect: HTMLDivElement | null = null;
  private toolbar: HTMLDivElement | null = null;
  private handles: HTMLDivElement[] = [];
  private mode: RegionSelectorMode = 'view';
  private currentRegion: CustomRegion;
  private pendingRegion: CustomRegion | null = null;
  /** Intrinsic-space region (stable across browser resize — shell-space shifts
   *  with letterbox but intrinsic-space is % of video content, invariant). */
  private intrinsicRegion: CustomRegion;
  private video: HTMLVideoElement | null = null;
  private readonly callbacks: RegionSelectorCallbacks;
  private dragState: { type: 'move' | 'resize' | 'draw'; handle: string; startX: number; startY: number; startRegion: CustomRegion } | null = null;
  private boundOnKeyDown: ((e: KeyboardEvent) => void) | null = null;
  /** Resize observer on video element + window resize listener — re-converts
   *  intrinsicRegion → shell-space when the player geometry changes (browser
   *  resize, fullscreen toggle, control bar show/hide). Without this the rect
   *  sits at stale shell-space coordinates until a manual action triggers render. */
  private resizeObserver: ResizeObserver | null = null;
  private boundOnWindowResize: (() => void) | null = null;

  // ─── Split dual-stream (spec ocr-split-dual-stream) ───
  private splitEnabled = false;
  private splitRatio = 0.5;
  private splitTop: HTMLDivElement | null = null;
  private splitBottom: HTMLDivElement | null = null;
  private divider: HTMLDivElement | null = null;
  private splitDrag: { startY: number; startRatio: number } | null = null;

  // ─── Action bar (view mode only: Split/Select/Reset, collapsible) ───
  private actionBar: HTMLDivElement | null = null;
  private actionBarInner: HTMLDivElement | null = null;
  private actionBarCollapsed = false;

  constructor(callbacks: RegionSelectorCallbacks) {
    this.callbacks = callbacks;
    const defaultReg = defaultBottomRegion(15);
    this.currentRegion = defaultReg;
    this.intrinsicRegion = defaultReg;
  }

  /** Attach selector to a video element's parent.
   *  @param region Initial region in INTRINSIC-space (% of videoWidth/Height). */
  attach(video: HTMLVideoElement, region: CustomRegion, mode: RegionSelectorMode = 'view'): void {
    this.detach();
    injectOverlayCss();
    this.video = video;
    this.mode = mode;
    // SSOT: use the same container-finding algorithm as the subtitle overlay
    // (findVideoContainer — ADR-008 D2). Both OCR region selector + subtitle
    // block must attach to the SAME container so the region rect aligns with
    // the subtitle block's coordinate space.
    const parent = findVideoContainer(video);
    if (!parent) return;
    parent.style.position = 'relative';

    this.container = document.createElement('div');
    this.container.className = 'cell-ocr-region-selector';
    this.container.style.cssText = 'position:absolute;inset:0;z-index:99998;';
    parent.appendChild(this.container);

    this.rect = document.createElement('div');
    this.rect.className = 'cell-ocr-region-rect';
    this.container.appendChild(this.rect);

    this.toolbar = document.createElement('div');
    // Initial CSS — positionToolbar() will reposition to video content on render.
    this.toolbar.style.cssText = 'position:absolute;top:10px;right:10px;display:flex;gap:8px;pointer-events:auto;z-index:99999;';
    this.container.appendChild(this.toolbar);

    // Action bar: inside rect at bottom-right (view mode only, collapsible).
    this.actionBar = document.createElement('div');
    this.actionBar.className = 'cell-ocr-action-bar';
    this.rect.appendChild(this.actionBar);

    // Collapse/expand toggle button (always visible when action bar is shown).
    const toggleBtn = this.makeActionButton(chevronLeftIcon, 'Toggle action bar', () => {
      this.actionBarCollapsed = !this.actionBarCollapsed;
      this.renderActionBar();
    });
    toggleBtn.classList.add('cell-ocr-action-toggle');
    toggleBtn.dataset.collapsed = 'false';
    this.actionBar.appendChild(toggleBtn);

    // Inner container for the 3 action buttons (collapsible).
    this.actionBarInner = document.createElement('div');
    this.actionBarInner.className = 'cell-ocr-action-bar-inner';
    this.actionBarInner.dataset.collapsed = 'false';
    this.actionBar.appendChild(this.actionBarInner);

    // Split toggle button.
    const splitBtn = this.makeActionButton(moveVerticalIcon, 'Toggle split dual subtitles', () => {
      this.callbacks.onToggleSplit?.();
    });
    splitBtn.dataset.cellId = 'ocr-action-split';
    this.actionBarInner.appendChild(splitBtn);

    // Select Region button.
    const selectBtn = this.makeActionButton(cropIcon, 'Select OCR region', () => {
      this.callbacks.onSelectRegion?.();
    });
    selectBtn.dataset.cellId = 'ocr-action-select';
    this.actionBarInner.appendChild(selectBtn);

    // Reset Region button.
    const resetBtn = this.makeActionButton(rotateCcwIcon, 'Reset OCR region', () => {
      this.callbacks.onResetRegion?.();
    });
    resetBtn.dataset.cellId = 'ocr-action-reset';
    this.actionBarInner.appendChild(resetBtn);

    // Convert intrinsic-space → shell-space AFTER container + video are set, so
    // toShellRegion can read live geometry. (Attach-order bug: converting before
    // container creation returned identity → rectangle sat at naive 85% under
    // letterbox instead of the content bottom.)
    this.intrinsicRegion = region;
    this.currentRegion = this.toShellRegion(region);

    this.render();
    this.attachListeners();
    this.syncBodyFlag();
    this.attachResizeObservers();

    if (mode !== 'view') {
      this.boundOnKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') this.handleCancel();
      };
      window.addEventListener('keydown', this.boundOnKeyDown);
    }
  }

  /** Update mode (view/select/edit). */
  setMode(mode: RegionSelectorMode): void {
    this.mode = mode;
    this.pendingRegion = null;
    this.render();
    this.attachListeners();
    this.syncBodyFlag();
    if (mode !== 'view') {
      if (!this.boundOnKeyDown) {
        this.boundOnKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') this.handleCancel();
        };
        window.addEventListener('keydown', this.boundOnKeyDown);
      }
    } else if (this.boundOnKeyDown) {
      window.removeEventListener('keydown', this.boundOnKeyDown);
      this.boundOnKeyDown = null;
    }
  }

  /** Update region from external source (e.g. slider). Intrinsic-space input. */
  updateRegion(region: CustomRegion): void {
    this.intrinsicRegion = region;
    this.currentRegion = this.toShellRegion(region);
    // In interactive modes, sync pendingRegion too so slider updates are visible
    // (render uses pendingRegion when set, falling back to currentRegion).
    if (this.mode !== 'view') {
      this.pendingRegion = this.toShellRegion(region);
    } else {
      this.pendingRegion = null;
    }
    this.render();
  }

  /** Get current region in INTRINSIC-space (% of videoWidth/Height). */
  getRegion(): CustomRegion {
    return this.toIntrinsicRegion(this.pendingRegion ?? this.currentRegion);
  }

  /** Enable/disable split view: two tinted halves + a draggable divider (view mode only).
   *  Nodes are created once — the divider mousedown listener is bound at creation (ADR-081). */
  setSplit(enabled: boolean, ratio: number, topLabel = '', bottomLabel = ''): void {
    this.splitEnabled = enabled;
    this.splitRatio = Math.max(0.1, Math.min(0.9, ratio));
    if (!enabled) {
      this.splitTop?.remove();
      this.splitBottom?.remove();
      this.divider?.remove();
      this.splitTop = this.splitBottom = this.divider = null;
      this.render();
      return;
    }
    if (!this.splitTop && this.rect) {
      this.splitTop = document.createElement('div');
      this.splitTop.className = 'cell-ocr-split-half';
      this.splitBottom = document.createElement('div');
      this.splitBottom.className = 'cell-ocr-split-half';
      this.divider = document.createElement('div');
      this.divider.className = 'cell-ocr-split-divider';
      this.divider.addEventListener('mousedown', this.onSplitDragStart);
      this.container?.append(this.splitTop, this.splitBottom, this.divider);
    }
    if (this.splitTop) this.splitTop.dataset.label = topLabel;
    if (this.splitBottom) this.splitBottom.dataset.label = bottomLabel;
    this.render();
  }

  /** Update divider + halves position from an external ratio change (e.g. settings slider). */
  updateSplitRatio(ratio: number): void {
    this.splitRatio = Math.max(0.1, Math.min(0.9, ratio));
    this.render();
  }

  /** Detach overlay from DOM. */
  detach(): void {
    if (this.boundOnKeyDown) {
      window.removeEventListener('keydown', this.boundOnKeyDown);
      this.boundOnKeyDown = null;
    }
    this.detachResizeObservers();
    this.removeListeners();
    this.handles = [];
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    // Safety: remove any orphaned selectors (e.g. from re-attach race).
    document.querySelectorAll('.cell-ocr-region-selector').forEach(el => {
      if (el !== this.container) el.remove();
    });
    this.rect = null;
    this.toolbar = null;
    this.video = null;
    this.dragState = null;
    this.actionBar = null;
    this.actionBarInner = null;
    // Split nodes are children of the container (removed with it above) — drop references.
    this.splitTop = this.splitBottom = this.divider = null;
    this.splitDrag = null;
    this.syncBodyFlag();
  }

  /** Set body[data-ocr-region-selecting] so CSS can hide the universal panel during selection. */
  private syncBodyFlag(): void {
    const selecting = this.mode !== 'view' && this.container != null;
    document.body.dataset.ocrRegionSelecting = selecting ? 'true' : '';
    if (!selecting) delete document.body.dataset.ocrRegionSelecting;
  }

  // ─── Responsive resize ───
  // Watch video + container geometry changes (browser resize, fullscreen,
  // control bar show/hide). On change, re-convert intrinsicRegion → shell-space
  // and re-render so the rect tracks the video content. Without this the rect
  // sits at stale shell-space coords until a manual action triggers render.

  /** Attach ResizeObserver on video + window resize listener. */
  private attachResizeObservers(): void {
    this.detachResizeObservers();
    if (!this.video) return;
    // ResizeObserver fires when the video element's border-box changes (player
    // resize, fullscreen, control bar). Debounce via rAF to coalesce bursts.
    let rafId = 0;
    const schedule = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => { rafId = 0; this.handleResize(); });
    };
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(schedule);
      this.resizeObserver.observe(this.video);
      // Also observe the container (parent) — catches layout shifts that don't
      // change the video element's box but shift the container (e.g. sidebar).
      if (this.container) this.resizeObserver.observe(this.container);
    }
    // Window resize: catches cases ResizeObserver misses (e.g. CSS media queries
    // changing player layout without resizing the video element itself).
    this.boundOnWindowResize = schedule;
    window.addEventListener('resize', this.boundOnWindowResize);
  }

  /** Detach resize observers + window resize listener. */
  private detachResizeObservers(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.boundOnWindowResize) {
      window.removeEventListener('resize', this.boundOnWindowResize);
      this.boundOnWindowResize = null;
    }
  }

  /** Re-convert intrinsicRegion → shell-space + re-render on geometry change. */
  private handleResize(): void {
    if (!this.video || !this.container) return;
    // Skip during active drag — the user is in control; re-converting mid-drag
    // would fight their mouse movement (shell-space shifts under them).
    if (this.dragState || this.splitDrag) return;
    // Re-convert from stable intrinsic-space to new shell-space.
    this.currentRegion = this.toShellRegion(this.intrinsicRegion);
    if (this.pendingRegion && this.mode !== 'view') {
      this.pendingRegion = this.toShellRegion(this.intrinsicRegion);
    }
    this.render();
  }

  // ─── Coordinate-space conversion (regionMapping) ───
  // The overlay lives in SHELL space (the player container); drag math and CSS
  // positioning are shell-space. The PUBLIC contract (attach/updateRegion/
  // getRegion/onRegionChange) is INTRINSIC space (% of videoWidth/Height) so the
  // stored region maps 1:1 to the crop regardless of letterbox/control-bar.
  // When video geometry is unavailable (jsdom, pre-metadata), conversion is
  // identity — shell-space == intrinsic-space, preserving prior behavior.

  /** Intrinsic-space region → shell-space for internal storage + CSS rendering. */
  private toShellRegion(intrinsic: CustomRegion): CustomRegion {
    if (!this.video || !this.container) return intrinsic;
    const geo = readVideoGeometry(this.video, this.container);
    if (!geo) return intrinsic;
    return mapIntrinsicToShell(intrinsic, geo.shellRect, geo.videoRect, geo.intrinsic, geo.objectFit, geo.objectPosition);
  }

  /** Shell-space region (internal) → intrinsic-space for the public contract. */
  private toIntrinsicRegion(shell: CustomRegion): CustomRegion {
    if (!this.video || !this.container) return shell;
    const geo = readVideoGeometry(this.video, this.container);
    if (!geo) return shell;
    return mapShellToIntrinsic(shell, geo.shellRect, geo.videoRect, geo.intrinsic, geo.objectFit, geo.objectPosition);
  }

  // ─── Internal rendering ───
  // render() runs on every drag frame: it must UPDATE existing nodes, never
  // recreate handles/buttons — recreated nodes lose their event listeners
  // (the edit-resize bug: after one move drag, all handles went dead).

  private render(): void {
    if (!this.rect || !this.toolbar) return;
    // render uses the INTERNAL shell-space region (pendingRegion ?? currentRegion)
    // for CSS positioning — the rect is a child of the container, positioned in
    // shell-space. getRegion() returns intrinsic-space (public contract) and must
    // NOT be used here, or the rectangle would be misplaced under letterbox.
    const r = this.pendingRegion ?? this.currentRegion;
    this.rect.dataset.mode = this.mode;
    if (this.container) this.container.dataset.mode = this.mode;
    // Select mode: hide the old rect so user can see the video to pick a new
    // position. Once user starts dragging (pendingRegion set), rect reappears
    // to show the new selection being drawn.
    this.rect.style.display = (this.mode === 'select' && !this.pendingRegion) ? 'none' : '';
    this.rect.style.left = `${r.xPct}%`;
    this.rect.style.top = `${r.yPct}%`;
    this.rect.style.width = `${r.widthPct}%`;
    this.rect.style.height = `${r.heightPct}%`;

    let label = this.rect.querySelector<HTMLElement>('.cell-ocr-region-label');
    if (!label) {
      label = document.createElement('span');
      label.className = 'cell-ocr-region-label';
      this.rect.appendChild(label);
    }
    // Label shows the INTRINSIC-space dims (what the user actually scans), not
    // the shell-space dims (which differ under letterbox and would confuse).
    const intrinsic = this.toIntrinsicRegion(r);
    const dims = `${formatPct(intrinsic.widthPct)}%×${formatPct(intrinsic.heightPct)}%`;
    label.textContent = this.mode === 'view' ? `OCR region (${dims})` : `${this.mode}: ${dims}`;

    // Handles: create once on entering interactive mode; positions are % anchored to
    // the rect so they track every resize without recreation.
    if (this.mode === 'view') {
      this.handles.forEach(h => h.remove());
      this.handles = [];
    } else if (this.handles.length === 0) {
      for (const pos of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
        const h = document.createElement('div');
        h.className = 'cell-ocr-region-handle';
        h.dataset.handle = pos;
        h.addEventListener('mousedown', this.onEditResizeStart);
        this.rect.appendChild(h);
        this.handles.push(h);
      }
    }

    // Toolbar: rebuild only when crossing the view↔interactive boundary.
    const needToolbar = this.mode !== 'view';
    if (needToolbar && this.toolbar.childElementCount === 0) {
      this.toolbar.appendChild(this.makeButton('Apply', 'apply', checkIcon, () => this.handleApply()));
      this.toolbar.appendChild(this.makeButton('Cancel', 'cancel', xIcon, () => this.handleCancel()));
    } else if (!needToolbar && this.toolbar.childElementCount > 0) {
      this.toolbar.innerHTML = '';
    }
    // Position toolbar at top-right of VIDEO CONTENT (not container) — under
    // letterbox the container has black bars; toolbar must sit inside the video.
    this.positionToolbar();

    // Split halves + divider: visible in view + edit mode (user can see
    // target/native split while adjusting the region). Hidden in select mode
    // (user is drawing a brand-new region — split would be meaningless until
    // the new region is applied). Nodes are created once in setSplit();
    // render() only repositions them (ADR-081).
    if (this.splitTop && this.splitBottom && this.divider) {
      const { top, bottom } = computeSplitHalves(r, this.splitRatio);
      this.positionHalf(this.splitTop, top);
      this.positionHalf(this.splitBottom, bottom);
      this.divider.style.left = `${top.xPct}%`;
      this.divider.style.top = `${top.yPct + top.heightPct}%`;
      this.divider.style.width = `${top.widthPct}%`;
      const splitVisible = this.splitEnabled && this.mode !== 'select';
      this.splitTop.style.display = splitVisible ? '' : 'none';
      this.splitBottom.style.display = splitVisible ? '' : 'none';
      this.divider.style.display = splitVisible ? '' : 'none';
    }

    // Action bar: visible only in view mode, hidden in select/edit.
    this.renderActionBar();
  }

  private positionHalf(el: HTMLDivElement, half: SplitHalf): void {
    el.style.left = `${half.xPct}%`;
    el.style.top = `${half.yPct}%`;
    el.style.width = `${half.widthPct}%`;
    el.style.height = `${half.heightPct}%`;
  }

  /** Position toolbar at top-right of video content (inside letterbox). */
  private positionToolbar(): void {
    if (!this.toolbar || !this.video || !this.container) return;
    const geo = readVideoGeometry(this.video, this.container);
    if (!geo) return;
    const content = computeContentRect(
      { left: 0, top: 0, width: geo.videoRect.width, height: geo.videoRect.height },
      geo.intrinsic, geo.objectFit, geo.objectPosition,
    );
    if (content.cw <= 0 || content.ch <= 0) return;
    // Video content offset within shell (px).
    const ox = geo.videoRect.left - geo.shellRect.left + content.cx;
    const oy = geo.videoRect.top - geo.shellRect.top + content.cy;
    // Top-right of video content, 10px inset, in shell-space px.
    const rightPx = ox + content.cw - 10;
    const topPx = oy + 10;
    this.toolbar.style.cssText = `position:absolute;left:${rightPx}px;top:${topPx}px;display:flex;gap:8px;pointer-events:auto;z-index:99999;transform:translateX(-100%);`;
  }

  private makeButton(text: string, variant: 'apply' | 'cancel', iconSvg: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cell-ocr-region-btn cell-ocr-region-btn--${variant}`;
    btn.appendChild(this.iconElement(iconSvg));
    btn.appendChild(document.createTextNode(text));
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return btn;
  }

  /** Create an icon-only action button for the action bar (Split/Select/Reset). */
  private makeActionButton(iconSvg: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cell-ocr-action-btn';
    btn.setAttribute('aria-label', ariaLabel);
    btn.title = ariaLabel;
    btn.appendChild(this.iconElement(iconSvg));
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return btn;
  }

  /** Update action bar visibility + collapsed state. Only visible in view mode. */
  private renderActionBar(): void {
    if (!this.actionBar || !this.actionBarInner) return;
    const visible = this.mode === 'view';
    this.actionBar.style.display = visible ? '' : 'none';
    this.actionBarInner.dataset.collapsed = String(this.actionBarCollapsed);
    const toggleBtn = this.actionBar.querySelector('.cell-ocr-action-toggle');
    if (toggleBtn) (toggleBtn as HTMLButtonElement).dataset.collapsed = String(this.actionBarCollapsed);
    // Update split button active state.
    const splitBtn = this.actionBarInner.querySelector('[data-cell-id="ocr-action-split"]');
    if (splitBtn) (splitBtn as HTMLButtonElement).dataset.active = String(this.splitEnabled);
  }

  private iconElement(svg: string): HTMLElement {
    // ?raw imports carry a license comment + newlines — strip to the pure <svg> tag.
    const start = svg.indexOf('<svg');
    const tag = start >= 0 ? svg.slice(start) : svg;
    const host = document.createElement('span');
    host.style.cssText = 'display:inline-flex;';
    host.innerHTML = tag;
    return host;
  }

  // ─── Drag listeners ───

  private attachListeners(): void {
    this.removeListeners();
    if (!this.rect || this.mode === 'view') return;

    // Both select + edit: drag rect body to move, drag handles to resize.
    this.rect.addEventListener('mousedown', this.onEditMoveStart);
    // Select mode: click outside rect (on container) to draw a new rectangle.
    if (this.mode === 'select' && this.container) {
      this.container.addEventListener('mousedown', this.onSelectStart);
    }
  }

  private removeListeners(): void {
    if (this.rect) {
      this.rect.removeEventListener('mousedown', this.onSelectStart);
      this.rect.removeEventListener('mousedown', this.onEditMoveStart);
    }
    if (this.container) {
      this.container.removeEventListener('mousedown', this.onSelectStart);
    }
    // Handle listeners are bound at handle creation (render) and die with the
    // node on detach — never removed here, or attachListeners() would strip
    // them right after render() bound them.
    document.removeEventListener('mousemove', this.onDragMove);
    document.removeEventListener('mouseup', this.onDragEnd);
    document.removeEventListener('mousemove', this.onSplitDragMove);
    document.removeEventListener('mouseup', this.onSplitDragEnd);
  }

  private onSelectStart = (e: MouseEvent): void => {
    // Only fire for clicks on the container itself (outside the rect + toolbar) —
    // rect body clicks go to onEditMoveStart, handle clicks to onEditResizeStart,
    // toolbar button clicks go to their own click handlers.
    // Action bar clicks (inside rect) also bail — they have their own handlers.
    if (e.target === this.rect || (e.target as HTMLElement)?.dataset?.handle || this.toolbar?.contains(e.target as Node) || this.actionBar?.contains(e.target as Node)) return;
    e.preventDefault();
    const parent = this.rect?.parentElement;
    if (!parent || !this.video) return;
    const rect = parent.getBoundingClientRect();
    const startXPct = ((e.clientX - rect.left) / rect.width) * 100;
    const startYPct = ((e.clientY - rect.top) / rect.height) * 100;
    this.dragState = { type: 'draw', handle: 'se', startX: startXPct, startY: startYPct, startRegion: { xPct: startXPct, yPct: startYPct, widthPct: 0, heightPct: 0 } };
    this.pendingRegion = this.dragState.startRegion;
    this.render();
    document.addEventListener('mousemove', this.onDragMove);
    document.addEventListener('mouseup', this.onDragEnd);
  };

  private onEditMoveStart = (e: MouseEvent): void => {
    if (e.target !== this.rect) return;
    // Action bar clicks (child of rect) have their own handlers — don't drag.
    if (this.actionBar?.contains(e.target as Node)) return;
    e.preventDefault();
    // Use SHELL-space (internal currentRegion/pendingRegion), NOT getRegion()
    // (intrinsic-space public API) — onDragMove applies shell-space deltas, so
    // the start base must match. Mixing spaces causes the region to jump when
    // letterbox makes intrinsic ≠ shell (e.g. 4:3 video in 16:9 container).
    this.dragState = { type: 'move', handle: '', startX: e.clientX, startY: e.clientY, startRegion: this.pendingRegion ?? this.currentRegion };
    document.addEventListener('mousemove', this.onDragMove);
    document.addEventListener('mouseup', this.onDragEnd);
  };

  private onEditResizeStart = (e: MouseEvent): void => {
    const handle = (e.target as HTMLElement).dataset.handle ?? '';
    e.preventDefault();
    e.stopPropagation();
    // Same shell-space fix as onEditMoveStart — see comment there.
    this.dragState = { type: 'resize', handle, startX: e.clientX, startY: e.clientY, startRegion: this.pendingRegion ?? this.currentRegion };
    document.addEventListener('mousemove', this.onDragMove);
    document.addEventListener('mouseup', this.onDragEnd);
  };

  private onDragMove = (e: MouseEvent): void => {
    if (!this.dragState || !this.video || !this.container) return;
    // Use the container's rect (same as onSelectStart) — the rect is positioned
    // relative to the container, so all % coordinates must be relative to it.
    const rect = this.container.getBoundingClientRect();

    if (this.dragState.type === 'move') {
      const dxPct = ((e.clientX - this.dragState.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - this.dragState.startY) / rect.height) * 100;
      const sr = this.dragState.startRegion;
      const xPct = Math.max(0, Math.min(100 - sr.widthPct, sr.xPct + dxPct));
      const yPct = Math.max(0, Math.min(100 - sr.heightPct, sr.yPct + dyPct));
      this.pendingRegion = { ...sr, xPct, yPct };
    } else if (this.dragState.type === 'draw') {
      // Draw new rectangle from start point (startX/startY are percentages)
      const curXPct = ((e.clientX - rect.left) / rect.width) * 100;
      const curYPct = ((e.clientY - rect.top) / rect.height) * 100;
      const xPct = Math.min(this.dragState.startX, curXPct);
      const yPct = Math.min(this.dragState.startY, curYPct);
      const widthPct = Math.min(100 - xPct, Math.abs(curXPct - this.dragState.startX));
      const heightPct = Math.min(100 - yPct, Math.abs(curYPct - this.dragState.startY));
      this.pendingRegion = { xPct, yPct, widthPct: Math.max(1, widthPct), heightPct: Math.max(1, heightPct) };
    } else {
      // Resize from handle (startX/startY are pixels) — works in both select + edit modes
      const dxPct = ((e.clientX - this.dragState.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - this.dragState.startY) / rect.height) * 100;
      const sr = this.dragState.startRegion;
      const handle = this.dragState.handle;
      let { xPct, yPct, widthPct, heightPct } = sr;
      if (handle.includes('e')) widthPct = Math.max(1, Math.min(100 - xPct, sr.widthPct + dxPct));
      if (handle.includes('w')) { const newW = Math.max(1, Math.min(xPct + widthPct - 1, sr.widthPct - dxPct)); xPct = sr.xPct + (sr.widthPct - newW); widthPct = newW; }
      if (handle.includes('s')) heightPct = Math.max(1, Math.min(100 - yPct, sr.heightPct + dyPct));
      if (handle.includes('n')) { const newH = Math.max(1, Math.min(yPct + heightPct - 1, sr.heightPct - dyPct)); yPct = sr.yPct + (sr.heightPct - newH); heightPct = newH; }
      this.pendingRegion = { xPct, yPct, widthPct, heightPct };
    }

    if (this.pendingRegion) {
      this.render();
      this.callbacks.onRegionChange(this.toIntrinsicRegion(this.pendingRegion));
    }
  };

  private onDragEnd = (): void => {
    this.dragState = null;
    document.removeEventListener('mousemove', this.onDragMove);
    document.removeEventListener('mouseup', this.onDragEnd);
    // Sync intrinsicRegion from the final pendingRegion so handleResize()
    // re-converts from the user's last position, not the pre-drag position.
    if (this.pendingRegion) {
      this.intrinsicRegion = this.toIntrinsicRegion(this.pendingRegion);
    }
  };

  private onSplitDragStart = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    this.splitDrag = { startY: e.clientY, startRatio: this.splitRatio };
    document.addEventListener('mousemove', this.onSplitDragMove);
    document.addEventListener('mouseup', this.onSplitDragEnd);
  };

  private onSplitDragMove = (e: MouseEvent): void => {
    if (!this.splitDrag || !this.container) return;
    const parent = this.container.parentElement;
    if (!parent) return;
    const pr = parent.getBoundingClientRect();
    if (pr.height <= 0) return; // jsdom / detached: avoid NaN poisoning the ratio
    // Divider sits at yPct + heightPct*ratio — convert the pixel delta to a
    // ratio delta relative to the REGION height so the bar tracks the cursor.
    const dyPct = ((e.clientY - this.splitDrag.startY) / pr.height) * 100;
    const region = this.getRegion();
    const ratio = (this.splitDrag.startRatio * region.heightPct + dyPct) / region.heightPct;
    this.splitRatio = Math.max(0.1, Math.min(0.9, ratio));
    this.render(); // real-time UI only — persist on mouseup
  };

  private onSplitDragEnd = (): void => {
    this.splitDrag = null;
    document.removeEventListener('mousemove', this.onSplitDragMove);
    document.removeEventListener('mouseup', this.onSplitDragEnd);
    this.callbacks.onSplitRatioChange?.(this.splitRatio);
  };

  private handleApply(): void {
    if (this.pendingRegion) {
      this.currentRegion = this.pendingRegion;
      this.intrinsicRegion = this.toIntrinsicRegion(this.currentRegion);
      this.callbacks.onRegionChange(this.intrinsicRegion);
    }
    this.callbacks.onApply();
  }

  private handleCancel(): void {
    this.pendingRegion = null;
    this.render();
    this.callbacks.onCancel();
  }
}
