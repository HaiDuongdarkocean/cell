// regionSelector — visual region selector overlay on video.
// Modes: view (green rectangle, not interactive), select (drag to draw), edit (drag handles to resize).
// Emits region changes via callback. Apply/Cancel/Reset controlled by caller.

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

/** CSS injected once to hide universal panel during region selection. */
let panelHideStyleInjected = false;
function injectPanelHideStyle(): void {
  if (panelHideStyleInjected) return;
  panelHideStyleInjected = true;
  const style = document.createElement('style');
  style.id = 'cell-ocr-region-selecting-style';
  style.textContent = 'body[data-ocr-region-selecting="true"] #cell-universal-panel-host { display: none !important; }';
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
    injectPanelHideStyle();
    this.video = video;
    this.currentRegion = region;
    this.mode = mode;
    const parent = video.parentElement;
    if (!parent) return;
    parent.style.position = 'relative';

    this.container = document.createElement('div');
    this.container.className = 'cell-ocr-region-selector';
    this.container.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99998;';
    parent.appendChild(this.container);

    this.rect = document.createElement('div');
    this.rect.className = 'cell-ocr-region-rect';
    this.container.appendChild(this.rect);

    this.toolbar = document.createElement('div');
    this.toolbar.style.cssText = 'position:absolute;top:8px;right:8px;display:flex;gap:6px;pointer-events:auto;z-index:99999;';
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

  private render(): void {
    if (!this.rect || !this.toolbar) return;
    const r = this.getRegion();
    const isInteractive = this.mode !== 'view';
    const borderStyle = '2px dashed #0066ff';
    const bg = isInteractive ? 'rgba(0, 102, 255, 0.1)' : 'rgba(0, 102, 255, 0.05)';
    this.rect.style.cssText = `position:absolute;left:${r.xPct}%;top:${r.yPct}%;width:${r.widthPct}%;height:${r.heightPct}%;border:${borderStyle};background:${bg};box-sizing:border-box;pointer-events:${isInteractive ? 'auto' : 'none'};cursor:${this.mode === 'edit' ? 'move' : 'crosshair'};z-index:99998;`;

    // Label
    const existingLabel = this.rect.querySelector('.cell-ocr-region-label');
    if (existingLabel) existingLabel.remove();
    const label = document.createElement('span');
    label.className = 'cell-ocr-region-label';
    label.textContent = this.mode === 'view' ? `OCR region (${r.widthPct}%×${r.heightPct}%)` : `${this.mode}: ${r.widthPct}%×${r.heightPct}%`;
    label.style.cssText = 'position:absolute;top:-18px;left:0;font-size:11px;color:#0066ff;background:rgba(0,0,0,0.7);padding:1px 4px;font-family:monospace;white-space:nowrap;';
    this.rect.appendChild(label);

    // Handles (edit mode only)
    this.handles.forEach(h => h.remove());
    this.handles = [];
    if (this.mode === 'edit') {
      const handlePositions = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
      const cursors: Record<string, string> = {
        nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize',
        se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize',
      };
      for (const pos of handlePositions) {
        const h = document.createElement('div');
        h.dataset.handle = pos;
        const size = 10;
        const offsets: Record<string, string> = {
          nw: `left:-${size/2}px;top:-${size/2}px`,
          n: `left:50%;top:-${size/2}px;transform:translateX(-50%)`,
          ne: `right:-${size/2}px;top:-${size/2}px`,
          e: `right:-${size/2}px;top:50%;transform:translateY(-50%)`,
          se: `right:-${size/2}px;bottom:-${size/2}px`,
          s: `left:50%;bottom:-${size/2}px;transform:translateX(-50%)`,
          sw: `left:-${size/2}px;bottom:-${size/2}px`,
          w: `left:-${size/2}px;top:50%;transform:translateY(-50%)`,
        };
        h.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:#0066ff;border:1px solid #000;${offsets[pos]};cursor:${cursors[pos]};pointer-events:auto;z-index:99999;`;
        this.rect.appendChild(h);
        this.handles.push(h);
      }
    }

    // Toolbar buttons
    this.toolbar.innerHTML = '';
    if (this.mode === 'select' || this.mode === 'edit') {
      this.toolbar.appendChild(this.makeButton('Apply', '#0066ff', () => this.handleApply()));
      this.toolbar.appendChild(this.makeButton('Cancel', '#aa0000', () => this.handleCancel()));
    }
  }

  private makeButton(text: string, color: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `padding:4px 10px;font-size:12px;color:#fff;background:${color};border:none;border-radius:4px;cursor:pointer;font-family:monospace;`;
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return btn;
  }

  // ─── Drag listeners ───

  private attachListeners(): void {
    this.removeListeners();
    if (!this.rect || this.mode === 'view') return;

    if (this.mode === 'select') {
      // Click-drag on container to draw new rectangle
      this.rect.addEventListener('mousedown', this.onSelectStart);
    } else if (this.mode === 'edit') {
      // Drag rect to move, drag handles to resize
      this.rect.addEventListener('mousedown', this.onEditMoveStart);
      for (const h of this.handles) {
        h.addEventListener('mousedown', this.onEditResizeStart);
      }
    }
  }

  private removeListeners(): void {
    if (this.rect) {
      this.rect.removeEventListener('mousedown', this.onSelectStart);
      this.rect.removeEventListener('mousedown', this.onEditMoveStart);
    }
    for (const h of this.handles) {
      h.removeEventListener('mousedown', this.onEditResizeStart);
    }
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
