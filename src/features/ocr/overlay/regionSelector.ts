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

import { STATIC_TOKENS } from '@/shared/lib/tokens';
import { checkIcon, xIcon } from '@/shared/icons';
import type { CustomRegion } from '@/features/ocr/persistence/ocrStateTypes';

export type RegionSelectorMode = 'view' | 'select' | 'edit';

export interface RegionSelectorCallbacks {
  /** Called when user drags/resizes the rectangle (real-time, in %). */
  onRegionChange: (region: CustomRegion) => void;
  /** Called when user clicks Apply. */
  onApply: () => void;
  /** Called when user clicks Cancel or presses Esc. */
  onCancel: () => void;
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
.cell-ocr-region-rect[data-mode="select"] { background: ${FILL_ACTIVE}; pointer-events: auto; cursor: crosshair; }
.cell-ocr-region-rect[data-mode="edit"] { background: ${FILL_ACTIVE}; pointer-events: auto; cursor: move; }
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
  private video: HTMLVideoElement | null = null;
  private readonly callbacks: RegionSelectorCallbacks;
  private dragState: { type: 'move' | 'resize'; handle: string; startX: number; startY: number; startRegion: CustomRegion } | null = null;
  private boundOnKeyDown: ((e: KeyboardEvent) => void) | null = null;

  constructor(callbacks: RegionSelectorCallbacks) {
    this.callbacks = callbacks;
    this.currentRegion = defaultBottomRegion(15);
  }

  /** Attach selector to a video element's parent. */
  attach(video: HTMLVideoElement, region: CustomRegion, mode: RegionSelectorMode = 'view'): void {
    this.detach();
    injectOverlayCss();
    this.video = video;
    this.currentRegion = region;
    this.mode = mode;
    const parent = video.parentElement;
    if (!parent) return;
    parent.style.position = 'relative';

    this.container = document.createElement('div');
    this.container.className = 'cell-ocr-region-selector';
    this.container.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:99998;';
    parent.appendChild(this.container);

    this.rect = document.createElement('div');
    this.rect.className = 'cell-ocr-region-rect';
    this.container.appendChild(this.rect);

    this.toolbar = document.createElement('div');
    this.toolbar.style.cssText = 'position:absolute;top:10px;right:10px;display:flex;gap:8px;pointer-events:auto;z-index:99999;';
    this.container.appendChild(this.toolbar);

    this.render();
    this.attachListeners();
    this.syncBodyFlag();

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

  /** Update region from external source (e.g. slider). */
  updateRegion(region: CustomRegion): void {
    this.currentRegion = region;
    if (this.mode === 'view') {
      this.pendingRegion = null;
    }
    this.render();
  }

  /** Get current region. */
  getRegion(): CustomRegion {
    return this.pendingRegion ?? this.currentRegion;
  }

  /** Detach overlay from DOM. */
  detach(): void {
    if (this.boundOnKeyDown) {
      window.removeEventListener('keydown', this.boundOnKeyDown);
      this.boundOnKeyDown = null;
    }
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
    this.syncBodyFlag();
  }

  /** Set body[data-ocr-region-selecting] so CSS can hide the universal panel during selection. */
  private syncBodyFlag(): void {
    const selecting = this.mode !== 'view' && this.container != null;
    document.body.dataset.ocrRegionSelecting = selecting ? 'true' : '';
    if (!selecting) delete document.body.dataset.ocrRegionSelecting;
  }

  // ─── Internal rendering ───
  // render() runs on every drag frame: it must UPDATE existing nodes, never
  // recreate handles/buttons — recreated nodes lose their event listeners
  // (the edit-resize bug: after one move drag, all handles went dead).

  private render(): void {
    if (!this.rect || !this.toolbar) return;
    const r = this.getRegion();
    this.rect.dataset.mode = this.mode;
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
    const dims = `${formatPct(r.widthPct)}%×${formatPct(r.heightPct)}%`;
    label.textContent = this.mode === 'view' ? `OCR region (${dims})` : `${this.mode}: ${dims}`;

    // Handles: create once on entering edit mode; positions are % anchored to
    // the rect so they track every resize without recreation.
    if (this.mode !== 'edit') {
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

    if (this.mode === 'select') {
      // Click-drag on container to draw new rectangle
      this.rect.addEventListener('mousedown', this.onSelectStart);
    } else if (this.mode === 'edit') {
      // Drag rect to move; handles bound at creation in render()
      this.rect.addEventListener('mousedown', this.onEditMoveStart);
    }
  }

  private removeListeners(): void {
    if (this.rect) {
      this.rect.removeEventListener('mousedown', this.onSelectStart);
      this.rect.removeEventListener('mousedown', this.onEditMoveStart);
    }
    // Handle listeners are bound at handle creation (render) and die with the
    // node on detach — never removed here, or attachListeners() would strip
    // them right after render() bound them.
    document.removeEventListener('mousemove', this.onDragMove);
    document.removeEventListener('mouseup', this.onDragEnd);
  }

  private onSelectStart = (e: MouseEvent): void => {
    if (e.target !== this.rect) return;
    e.preventDefault();
    const parent = this.rect?.parentElement;
    if (!parent || !this.video) return;
    const rect = parent.getBoundingClientRect();
    const startXPct = ((e.clientX - rect.left) / rect.width) * 100;
    const startYPct = ((e.clientY - rect.top) / rect.height) * 100;
    this.dragState = { type: 'resize', handle: 'se', startX: startXPct, startY: startYPct, startRegion: { xPct: startXPct, yPct: startYPct, widthPct: 0, heightPct: 0 } };
    this.pendingRegion = this.dragState.startRegion;
    this.render();
    document.addEventListener('mousemove', this.onDragMove);
    document.addEventListener('mouseup', this.onDragEnd);
  };

  private onEditMoveStart = (e: MouseEvent): void => {
    if (e.target !== this.rect) return;
    e.preventDefault();
    this.dragState = { type: 'move', handle: '', startX: e.clientX, startY: e.clientY, startRegion: this.getRegion() };
    document.addEventListener('mousemove', this.onDragMove);
    document.addEventListener('mouseup', this.onDragEnd);
  };

  private onEditResizeStart = (e: MouseEvent): void => {
    const handle = (e.target as HTMLElement).dataset.handle ?? '';
    e.preventDefault();
    e.stopPropagation();
    this.dragState = { type: 'resize', handle, startX: e.clientX, startY: e.clientY, startRegion: this.getRegion() };
    document.addEventListener('mousemove', this.onDragMove);
    document.addEventListener('mouseup', this.onDragEnd);
  };

  private onDragMove = (e: MouseEvent): void => {
    if (!this.dragState || !this.video || !this.container) return;
    const parent = this.container.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();

    if (this.dragState.type === 'move') {
      const dxPct = ((e.clientX - this.dragState.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - this.dragState.startY) / rect.height) * 100;
      const sr = this.dragState.startRegion;
      const xPct = Math.max(0, Math.min(100 - sr.widthPct, sr.xPct + dxPct));
      const yPct = Math.max(0, Math.min(100 - sr.heightPct, sr.yPct + dyPct));
      this.pendingRegion = { ...sr, xPct, yPct };
    } else if (this.dragState.type === 'resize') {
      if (this.mode === 'select') {
        // Draw rectangle from start point
        const curXPct = ((e.clientX - rect.left) / rect.width) * 100;
        const curYPct = ((e.clientY - rect.top) / rect.height) * 100;
        const xPct = Math.min(this.dragState.startX, curXPct);
        const yPct = Math.min(this.dragState.startY, curYPct);
        const widthPct = Math.min(100 - xPct, Math.abs(curXPct - this.dragState.startX));
        const heightPct = Math.min(100 - yPct, Math.abs(curYPct - this.dragState.startY));
        this.pendingRegion = { xPct, yPct, widthPct: Math.max(1, widthPct), heightPct: Math.max(1, heightPct) };
      } else {
        // Edit mode — resize from handle
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
    }

    if (this.pendingRegion) {
      this.render();
      this.callbacks.onRegionChange(this.pendingRegion);
    }
  };

  private onDragEnd = (): void => {
    this.dragState = null;
    document.removeEventListener('mousemove', this.onDragMove);
    document.removeEventListener('mouseup', this.onDragEnd);
  };

  private handleApply(): void {
    if (this.pendingRegion) {
      this.currentRegion = this.pendingRegion;
      this.callbacks.onRegionChange(this.currentRegion);
    }
    this.callbacks.onApply();
  }

  private handleCancel(): void {
    this.pendingRegion = null;
    this.render();
    this.callbacks.onCancel();
  }
}
