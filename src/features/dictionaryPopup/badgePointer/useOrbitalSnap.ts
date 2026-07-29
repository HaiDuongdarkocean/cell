import { useMemo } from 'react';
import {
  type CollapsedEdge,
  type Point,
  type ViewportRect,
  getNearestEdge,
  getEdgeCenter,
  getCollapsedCenter,
} from './badgeCollapse';

export interface UseOrbitalSnapOptions {
  badgeCenter: Point;
  badgeSize: number;
  viewport: ViewportRect;
}

export interface UseOrbitalSnapResult {
  edge: CollapsedEdge;
  collapsedCenter: Point;
  expandedCenter: Point;
}

export function useOrbitalSnap({
  badgeCenter,
  badgeSize,
  viewport,
}: UseOrbitalSnapOptions): UseOrbitalSnapResult {
  return useMemo(() => {
    const { edge } = getNearestEdge(badgeCenter, viewport);
    const expandedCenter = getEdgeCenter(edge, badgeCenter, badgeSize, viewport);
    const collapsedCenter = getCollapsedCenter(expandedCenter, edge, badgeSize);
    return { edge, collapsedCenter, expandedCenter };
  }, [badgeCenter, badgeSize, viewport]);
}
