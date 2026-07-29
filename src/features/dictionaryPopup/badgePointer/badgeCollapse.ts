/**
 * Shared edge-collapse helpers for floating badges (token FAB + orbital badge).
 *
 * A collapsed badge sits on a viewport edge with its center exactly on the edge,
 * so the viewport clips half of it → visible half-moon. Dragging inward expands
 * it back to a full circle. Releasing near an edge snaps + collapses it there.
 *
 * Shared by the token FAB and the React OrbitalBadge component.
 * (SSOT). The helpers are pure functions over a viewport rect — no DOM reads.
 */

export type CollapsedEdge = 'left' | 'right' | 'top' | 'bottom';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface ViewportRect {
  readonly width: number;
  readonly height: number;
}

/** Find the nearest viewport edge and the perpendicular distance to it. */
export function getNearestEdge(point: Point, vp: ViewportRect): { edge: CollapsedEdge; distance: number } {
  const distances = {
    left: point.x,
    right: vp.width - point.x,
    top: point.y,
    bottom: vp.height - point.y,
  } as const;
  let nearest: CollapsedEdge = 'right';
  let min = distances.right;
  for (const edge of (Object.keys(distances) as CollapsedEdge[])) {
    if (distances[edge] < min) {
      min = distances[edge];
      nearest = edge;
    }
  }
  return { edge: nearest, distance: min };
}

/** Snap a point to a viewport edge while keeping the tangential coordinate visible. */
export function getEdgeCenter(edge: CollapsedEdge, point: Point, badgeSize: number, vp: ViewportRect): Point {
  const half = badgeSize / 2;
  const maxX = vp.width - half;
  const maxY = vp.height - half;
  switch (edge) {
    case 'left': return { x: 0, y: Math.max(half, Math.min(maxY, point.y)) };
    case 'right': return { x: vp.width, y: Math.max(half, Math.min(maxY, point.y)) };
    case 'top': return { x: Math.max(half, Math.min(maxX, point.x)), y: 0 };
    case 'bottom': return { x: Math.max(half, Math.min(maxX, point.x)), y: vp.height };
  }
}

/** Center of the visible half-moon when the badge is collapsed on an edge.
 *  Offset inward by 1/4 of the badge size so the visible half is not clipped. */
export function getCollapsedCenter(badgeCenter: Point, edge: CollapsedEdge, badgeSize: number): Point {
  const inset = badgeSize / 4;
  switch (edge) {
    case 'left': return { x: badgeCenter.x + inset, y: badgeCenter.y };
    case 'right': return { x: badgeCenter.x - inset, y: badgeCenter.y };
    case 'top': return { x: badgeCenter.x, y: badgeCenter.y + inset };
    case 'bottom': return { x: badgeCenter.x, y: badgeCenter.y - inset };
  }
}
