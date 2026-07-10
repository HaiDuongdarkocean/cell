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
  readonly grip: HTMLDivElement;
  readonly mainColumn: HTMLDivElement;
  readonly secondaryColumn: HTMLDivElement;
  readonly noSubColumn: HTMLDivElement;
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

  // ADR-018 D5-rev: grip tab — dedicated drag handle for touch + mouse.
  // Visual: 28×4px pill bar; hit-area: 44×24px (HIG minimum). Attached to
  // top edge of cluster, centered. Collapsed state hides it (cluster circle
  // becomes the handle). See ADR-018 supplement D5-rev for rationale.
  const grip = document.createElement('div');
  grip.setAttribute('data-testid', 'nav-cluster-grip');
  grip.setAttribute('role', 'button');
  grip.setAttribute('aria-label', 'Kéo để di chuyển cluster');
  grip.setAttribute('aria-grabbed', 'false');
  grip.setAttribute('tabindex', '0');
  grip.className = 'nav-cluster-grip';

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

  // No-sub mode: single column with rewind, repeat, forward (no prev/next needed).
  // Empty container — controller moves buttons here when no subtitles loaded.
  const noSubColumn = document.createElement('div');
  noSubColumn.setAttribute('data-testid', 'nav-cluster-no-sub');
  noSubColumn.className = 'nav-cluster-no-sub';

  // Gap cover: real DOM element over inter-column gap so cursor shows default
  // (not move) — prevents border-zone drag check from triggering in the gap.
  const gapCover = document.createElement('div');
  gapCover.className = 'nav-cluster-gap-cover';
  gapCover.setAttribute('aria-hidden', 'true');

  cluster.append(grip, mainColumn, secondaryColumn, noSubColumn, gapCover);

  return { cluster, grip, mainColumn, secondaryColumn, noSubColumn, prevBtn, repeatBtn, nextBtn, rewindBtn, forwardBtn };
}

/**
 * Clamp a mixed-unit position so the cluster stays inside the container.
 * - x is the left edge offset in pixels -> clamp to [0, containerWidth - clusterWidth].
 * - y is the vertical center as percent -> clamp so the cluster's center is at
 *   least half the cluster height from the top/bottom edges.
 * With `transform: translate(-50%, -50%)` on the cluster, `left` is the center
 * x and `top` is the center y; the clamped values here are the logical position.
 */
export function clampPosition(
  pos: NavClusterPosition,
  containerRect: DOMRect,
  clusterRect: DOMRect,
): NavClusterPosition {
  if (!containerRect.width || !containerRect.height || !clusterRect.width || !clusterRect.height) {
    return { ...pos };
  }
  const halfHeightPct = (clusterRect.height / containerRect.height) * 50;
  return {
    x: Math.max(0, Math.min(containerRect.width - clusterRect.width, pos.x)),
    y: Math.max(halfHeightPct, Math.min(100 - halfHeightPct, pos.y)),
  };
}

/**
 * Find the nearest horizontal edge for collapse mirroring.
 * Uses the cluster center x: left half of container -> 'left', otherwise 'right'.
 * Tie at exact center -> 'left' (default position is at the left side).
 */
export function findNearestEdge(
  pos: NavClusterPosition,
  containerRect: DOMRect,
  clusterRect: DOMRect,
): NavClusterEdge {
  const centerX = pos.x + clusterRect.width / 2;
  return centerX <= containerRect.width / 2 ? 'left' : 'right';
}
