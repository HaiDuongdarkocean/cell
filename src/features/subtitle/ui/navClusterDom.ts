// Nav cluster DOM helpers — pure functions (ADR-018 D1, frontend design).
// ponytail: pure, no side effects, fully testable. DOM factory mimics
// existing content-script pattern (createOverlayLayer, createToggleButton).

import type { NavClusterPosition } from '@/entities/settings';

/** Edge the cluster is stuck to when collapsed. */
export type NavClusterEdge = 'left' | 'right';

/** Built cluster DOM elements (references for controller wiring). */
export interface NavClusterDOM {
  readonly cluster: HTMLDivElement;
  readonly mainColumn: HTMLDivElement;
  readonly secondaryColumn: HTMLDivElement;
  readonly dragHandle: HTMLButtonElement;
  readonly prevBtn: HTMLButtonElement;
  readonly repeatBtn: HTMLButtonElement;
  readonly nextBtn: HTMLButtonElement;
  readonly rewindBtn: HTMLButtonElement;
  readonly forwardBtn: HTMLButtonElement;
}

/** Create a single cluster button with ARIA + data-testid. */
function makeButton(testId: string, ariaLabel: string, glyph: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.setAttribute('data-testid', testId);
  btn.setAttribute('aria-label', ariaLabel);
  btn.className = 'nav-cluster-btn';
  btn.textContent = glyph;
  btn.type = 'button';
  return btn;
}

/**
 * Build the cluster DOM tree (6 buttons, 2 columns). Pure — no listeners,
 * no container attachment. Caller wires listeners + appends to container.
 */
export function buildClusterDOM(): NavClusterDOM {
  const cluster = document.createElement('div');
  cluster.setAttribute('data-testid', 'nav-cluster');
  cluster.setAttribute('role', 'toolbar');
  cluster.setAttribute('aria-label', 'Subtitle navigation');
  cluster.setAttribute('aria-orientation', 'horizontal');
  cluster.className = 'nav-cluster';

  const mainColumn = document.createElement('div');
  mainColumn.setAttribute('data-testid', 'nav-cluster-main');
  mainColumn.className = 'nav-cluster-main';

  const secondaryColumn = document.createElement('div');
  secondaryColumn.setAttribute('data-testid', 'nav-cluster-secondary');
  secondaryColumn.className = 'nav-cluster-secondary';

  const dragHandle = makeButton('nav-cluster-drag-handle', 'Drag to move cluster, double-click to reset', '⋯');
  dragHandle.setAttribute('aria-grabbed', 'false');
  dragHandle.classList.add('nav-cluster-drag-handle');

  const prevBtn = makeButton('nav-cluster-prev', 'Previous sentence', '◀');
  const repeatBtn = makeButton('nav-cluster-repeat', 'Repeat current sentence', '🔁');
  repeatBtn.setAttribute('aria-pressed', 'false');

  const nextBtn = makeButton('nav-cluster-next', 'Next sentence', '▶');
  const rewindBtn = makeButton('nav-cluster-rewind', 'Rewind 5 seconds', '⏪');
  const forwardBtn = makeButton('nav-cluster-forward', 'Forward 10 seconds', '⏩');

  mainColumn.append(dragHandle, prevBtn, repeatBtn, nextBtn);
  secondaryColumn.append(rewindBtn, forwardBtn);
  cluster.append(mainColumn, secondaryColumn);

  return { cluster, mainColumn, secondaryColumn, dragHandle, prevBtn, repeatBtn, nextBtn, rewindBtn, forwardBtn };
}

/**
 * Clamp a position (percent 0-100) so the cluster stays within container bounds.
 * Max x = 100 - (clusterWidth / containerWidth) * 100.
 * Max y = 100 - (clusterHeight / containerHeight) * 100.
 */
export function clampPosition(
  pos: NavClusterPosition,
  containerRect: DOMRect,
  clusterRect: DOMRect,
): NavClusterPosition {
  const maxX = Math.max(0, 100 - (clusterRect.width / containerRect.width) * 100);
  const maxY = Math.max(0, 100 - (clusterRect.height / containerRect.height) * 100);
  return {
    x: Math.max(0, Math.min(maxX, pos.x)),
    y: Math.max(0, Math.min(maxY, pos.y)),
  };
}

/**
 * Find the nearest horizontal edge for collapse mirroring.
 * Left half (x < 50) → 'left'; right half (x >= 50) → 'right'.
 * Tie at x=50 → 'left' (default position is x=0).
 */
export function findNearestEdge(pos: NavClusterPosition, _containerRect: DOMRect): NavClusterEdge {
  return pos.x <= 50 ? 'left' : 'right';
}
