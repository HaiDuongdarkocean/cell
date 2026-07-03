// Nav cluster DOM helpers — pure functions (ADR-018 D1, frontend design).
// ponytail: pure, no side effects, fully testable. DOM factory mimics
// existing content-script pattern (createOverlayLayer, createToggleButton).

import type { NavClusterPosition } from '@/entities/settings';
import { NAV_CLUSTER_ICONS } from './navClusterIcons';

/** Edge the cluster is stuck to when collapsed. */
export type NavClusterEdge = 'left' | 'right';

/** Built cluster DOM elements (references for controller wiring). */
export interface NavClusterDOM {
  readonly cluster: HTMLDivElement;
  readonly mainColumn: HTMLDivElement;
  readonly secondaryColumn: HTMLDivElement;
  readonly prevBtn: HTMLButtonElement;
  readonly repeatBtn: HTMLButtonElement;
  readonly nextBtn: HTMLButtonElement;
  readonly rewindBtn: HTMLButtonElement;
  readonly forwardBtn: HTMLButtonElement;
}

/**
 * Create a single cluster button with ARIA + data-testid.
 * @param iconHtml - inline SVG markup.
 */
function makeButton(testId: string, ariaLabel: string, iconHtml: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.setAttribute('data-testid', testId);
  btn.setAttribute('aria-label', ariaLabel);
  btn.className = 'nav-cluster-btn';
  btn.innerHTML = iconHtml;
  btn.type = 'button';
  return btn;
}

/**
 * Build the cluster DOM tree (5 buttons, 2 columns). Pure — no listeners,
 * no container attachment. Caller wires listeners + appends to container.
 * Drag is handled on cluster background (ADR-015 pattern) — no drag handle button.
 */
export function buildClusterDOM(): NavClusterDOM {
  const cluster = document.createElement('div');
  cluster.setAttribute('data-testid', 'nav-cluster');
  cluster.setAttribute('role', 'toolbar');
  cluster.setAttribute('aria-label', 'Subtitle navigation');
  cluster.setAttribute('aria-orientation', 'horizontal');
  cluster.setAttribute('aria-grabbed', 'false');
  cluster.className = 'nav-cluster';

  const mainColumn = document.createElement('div');
  mainColumn.setAttribute('data-testid', 'nav-cluster-main');
  mainColumn.className = 'nav-cluster-main';

  const secondaryColumn = document.createElement('div');
  secondaryColumn.setAttribute('data-testid', 'nav-cluster-secondary');
  secondaryColumn.className = 'nav-cluster-secondary';

  const prevBtn = makeButton('nav-cluster-prev', 'Previous sentence', NAV_CLUSTER_ICONS.prev);
  const repeatBtn = makeButton('nav-cluster-repeat', 'Repeat current sentence', NAV_CLUSTER_ICONS.repeat);
  repeatBtn.setAttribute('aria-pressed', 'false');

  const nextBtn = makeButton('nav-cluster-next', 'Next sentence', NAV_CLUSTER_ICONS.next);
  const rewindBtn = makeButton('nav-cluster-rewind', 'Rewind 5 seconds', NAV_CLUSTER_ICONS.rewind);
  const forwardBtn = makeButton('nav-cluster-forward', 'Forward 10 seconds', NAV_CLUSTER_ICONS.forward);

  mainColumn.append(prevBtn, repeatBtn, nextBtn);
  secondaryColumn.append(rewindBtn, forwardBtn);

  // Gap cover: real DOM element over inter-column gap so cursor shows default
  // (not move) — prevents border-zone drag check from triggering in the gap.
  const gapCover = document.createElement('div');
  gapCover.className = 'nav-cluster-gap-cover';
  gapCover.setAttribute('aria-hidden', 'true');

  cluster.append(mainColumn, secondaryColumn, gapCover);

  return { cluster, mainColumn, secondaryColumn, prevBtn, repeatBtn, nextBtn, rewindBtn, forwardBtn };
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
