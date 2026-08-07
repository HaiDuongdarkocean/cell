import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { IconButton } from '@/shared/ui/IconButton';
import { useOrbitalPointer } from '@/features/dictionaryPopup/badgePointer/useOrbitalPointer';
import { useOrbitalSnap } from '@/features/dictionaryPopup/badgePointer/useOrbitalSnap';
import { getNearestEdge, getEdgeCenter, type ViewportRect, type CollapsedEdge } from '@/features/dictionaryPopup/badgePointer/badgeCollapse';
import { useOrbitalGesture } from '@/features/dictionaryPopup/badgePointer/useOrbitalGesture';
import { loadOrbitalBadgePosition, saveOrbitalBadgePosition, type OrbitalBadgePosition } from '@/stores/orbitalBadgeStore';
import type { PointerPreset, Point } from '@/features/dictionaryPopup/badgePointer/pointerPosition';
import styles from './OrbitalBadge.module.css';

export interface OrbitalBadgeState {
  expanded: boolean;
  preset: PointerPreset;
  center: Point;
}

export interface OrbitalBadgeHandle {
  /** Programmatically update the pointer preset. */
  setPreset: (preset: PointerPreset) => void;
  /** Programmatically expand or collapse the badge. */
  setExpanded: (expanded: boolean) => void;
  /** Read the current badge state. */
  getState: () => OrbitalBadgeState;
}

export interface OrbitalBadgeProps {
  /** Initial badge center. Defaults to right edge center. */
  initialCenter?: Point;
  /** Badge diameter in px. */
  badgeSize?: number;
  /** Pointer diameter in px. */
  pointerSize?: number;
  /** Initial pointer preset. */
  initialPreset?: PointerPreset;
  /** Optional viewport rect. Defaults to the current browser viewport. */
  viewport?: ViewportRect;
  /** Persist the collapsed position and preset to chrome.storage. Defaults to true. */
  persistPosition?: boolean;
  /** Called when the pointer preset changes. */
  onPresetChange?: (preset: PointerPreset) => void;
  /** Called when the pointer tip settles after drag/expand. */
  onTipReady?: (tip: Point, preset: PointerPreset, badgeCenter: Point) => void;
  /** Called while the pointer tip changes (hover/drag settle). */
  onTipHover?: (tip: Point, preset: PointerPreset, badgeCenter: Point) => void;
  /** Called on every pointer move while the badge is expanded. */
  onTipMoving?: (tip: Point, preset: PointerPreset, badgeCenter: Point) => void;
  /** Called when the badge is single-clicked/tapped. */
  onClick?: () => void;
}

function getClientWidth(): number {
  return document.documentElement?.clientWidth || window.innerWidth;
}

function getClientHeight(): number {
  return document.documentElement?.clientHeight || window.innerHeight;
}

function resolveViewport(viewport?: ViewportRect): ViewportRect {
  if (viewport) return viewport;
  // In fullscreen mode, the fullscreen element covers the entire screen with
  // no scrollbar. window.innerWidth/innerHeight matches the fullscreen
  // element's dimensions, and position:fixed is relative to the fullscreen
  // viewport — so use innerWidth/innerHeight (not clientWidth which may be
  // stale or zeroed when the document is hidden behind the fullscreen layer).
  if (document.fullscreenElement) {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  // clientWidth already excludes classic scrollbars. For overlay scrollbars
  // (clientWidth === innerWidth), the badge center sits at the actual edge —
  // the right half is clipped by the viewport (half-moon), the visible left
  // half is inside the content area. Overlay scrollbars are semi-transparent
  // and auto-hiding, so they never fully hide the badge.
  return { width: getClientWidth(), height: getClientHeight() };
}

function inwardPreset(edge: CollapsedEdge): PointerPreset {
  switch (edge) {
    case 'left': return 'right';
    case 'right': return 'left';
    case 'top': return 'bottom';
    case 'bottom': return 'top';
  }
}

export const OrbitalBadge = forwardRef<OrbitalBadgeHandle, OrbitalBadgeProps>(function OrbitalBadge({
  initialCenter,
  badgeSize = 44,
  pointerSize = 12,
  initialPreset = 'top',
  viewport,
  persistPosition = true,
  onPresetChange,
  onTipReady,
  onClick,
}, ref): React.JSX.Element {
  const resolvedViewport = resolveViewport(viewport);
  const defaultCenter = { x: resolvedViewport.width - badgeSize / 2, y: resolvedViewport.height / 2 };

  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [userPreset, setUserPreset] = useState<PointerPreset>(initialPreset);
  const [center, setCenter] = useState<Point>(initialCenter ?? defaultCenter);
  const [dragCenter, setDragCenter] = useState<Point>(center);
  const dragStartCenterRef = useRef<Point>(center);
  const centerRef = useRef<Point>(center);
  const dragCenterRef = useRef<Point>(dragCenter);
  const expandedCenterRef = useRef<Point>(center);
  const collapsedCenterRef = useRef<Point>(center);
  const edgeRef = useRef<CollapsedEdge | null>(null);
  const dragEdgeRef = useRef<CollapsedEdge | null>(null);
  const prevViewportRef = useRef<ViewportRect>(resolvedViewport);
  const expandedRef = useRef(expanded);
  const onPresetChangeRef = useRef(onPresetChange);

  centerRef.current = center;
  dragCenterRef.current = dragCenter;
  expandedRef.current = expanded;
  onPresetChangeRef.current = onPresetChange;

  // Load the persisted position and clamp it to the current viewport. This
  // prevents the badge from being restored off-screen after a window resize.
  useEffect(() => {
    if (!persistPosition) return;
    let mounted = true;
    loadOrbitalBadgePosition()
      .then((pos) => {
        if (!mounted || !pos) return;
        const vp = resolveViewport(viewport);
        const start = { x: pos.x, y: pos.y };
        const { edge: nearestEdge } = getNearestEdge(start, vp);
        const snapped = getEdgeCenter(nearestEdge, start, badgeSize, vp);
        const inward = inwardPreset(nearestEdge);
        setCenter(snapped);
        setDragCenter(snapped);
        setUserPreset(inward);
        onPresetChangeRef.current?.(inward);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [persistPosition, badgeSize, viewport, setCenter, setDragCenter, setUserPreset]);

  const activeViewport = resolveViewport(viewport);
  const activeCenter = expanded ? dragCenter : center;

  const { edge, collapsedCenter, expandedCenter } = useOrbitalSnap({
    badgeCenter: activeCenter,
    badgeSize,
    viewport: activeViewport,
  });

  // Check if badge is actually near an edge (not just which edge is nearest).
  // getNearestEdge always returns an edge — we need the distance to decide
  // whether to snap (half-moon) or float (full circle) when collapsed.
  const { distance: edgeDistance } = getNearestEdge(activeCenter, activeViewport);
  const isAtEdge = edgeDistance <= badgeSize / 2;

  // Track the edge the badge is currently snapped to (null when floating).
  // reposition() uses this to keep the badge on the SAME edge when the viewport
  // changes (e.g. fullscreen enter: position was at right edge of a 1891px
  // viewport, new viewport is 2560px — without this, the badge snaps to the
  // nearest edge of the NEW viewport, which may be a different edge).
  edgeRef.current = isAtEdge ? edge : null;
  dragEdgeRef.current = isAtEdge ? edge : null;

  // Collapsed at edge → half-moon (collapsedCenter). Floating → stay at center.
  const displayedCenter = expanded ? dragCenter : (isAtEdge ? collapsedCenter : center);

  // Collapsed at edge → pointer inside the visible half-moon, pointing inward.
  // Floating or expanded → pointer outside the badge at user's preset.
  const collapsedAtEdge = isAtEdge && !expanded;
  const activePreset: PointerPreset = collapsedAtEdge ? inwardPreset(edge) : userPreset;

  // Compute pointer from displayedCenter (not activeCenter) so the pointer
  // position matches the actual rendered badge position. When collapsed at
  // edge, activeCenter (unsapped) and displayedCenter (edge-snapped) differ by
  // badgeSize/2 — using activeCenter would push the pointer outside the badge.
  const { pointerCenter, pointerTip } = useOrbitalPointer({
    badgeCenter: displayedCenter,
    badgeSize,
    pointerSize,
    preset: activePreset,
    inside: collapsedAtEdge,
  });

  expandedCenterRef.current = expandedCenter;
  collapsedCenterRef.current = collapsedCenter;

  useImperativeHandle(ref, () => ({
    setPreset: (next) => setUserPreset(next),
    setExpanded: (next) => setExpanded(next),
    getState: () => ({ expanded, preset: userPreset, center: activeCenter }),
  }), [expanded, userPreset, activeCenter]);

  useEffect(() => {
    if (expanded) {
      onTipReady?.(pointerTip, userPreset, activeCenter);
    }
  }, [expanded, pointerTip, userPreset, activeCenter, onTipReady]);

  const persist = useCallback((position: OrbitalBadgePosition): void => {
    if (!persistPosition) return;
    // saveOrbitalBadgePosition is an async storage write; the next load will
    // re-clamp against the current viewport on restore.
    saveOrbitalBadgePosition(position).catch(() => {});
  }, [persistPosition]);
  const persistRef = useRef<((position: OrbitalBadgePosition) => void) | null>(null);
  persistRef.current = persist;

  // Snap the badge to the nearest viewport edge when the browser resizes or
  // the device orientation changes. This keeps the half-moon badge visible
  // instead of getting stuck outside the new viewport.
  useEffect(() => {
    if (viewport != null) return;
    let raf = 0;
    const reposition = (): void => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const vp = resolveViewport(viewport);
        if (vp.width === 0 || vp.height === 0) return;
        const prevVp = prevViewportRef.current;
        prevViewportRef.current = vp;
        const currentCenter = centerRef.current;
        const currentDrag = dragCenterRef.current;
        // Scale the badge position proportionally to the new viewport so the
        // badge stays at the same RELATIVE spot (e.g. right edge at 39% height
        // in normal mode → right edge at 39% height in fullscreen). Without
        // this, getEdgeCenter keeps the absolute y (384px) — in a taller
        // fullscreen viewport the badge drifts up relative to the screen.
        const scalePoint = (p: Point): Point => {
          if (prevVp.width === 0 || prevVp.height === 0) return p;
          return { x: (p.x / prevVp.width) * vp.width, y: (p.y / prevVp.height) * vp.height };
        };
        const scaledCenter = scalePoint(currentCenter);
        const scaledDrag = scalePoint(currentDrag);
        // Keep the same edge when viewport changes — don't jump to a different
        // edge just because the viewport expanded. Falls back to nearest edge
        // when floating (edgeRef null).
        const nearestEdge = edgeRef.current ?? getNearestEdge(scaledCenter, vp).edge;
        const snapped = getEdgeCenter(nearestEdge, scaledCenter, badgeSize, vp);
        const dragNearestEdge = dragEdgeRef.current ?? getNearestEdge(scaledDrag, vp).edge;
        const dragSnapped = getEdgeCenter(dragNearestEdge, scaledDrag, badgeSize, vp);
        setCenter(snapped);
        setDragCenter(dragSnapped);
        // Keep userPreset on resize — don't override user's pointer position.
        persistRef.current?.({ x: snapped.x, y: snapped.y, edge: nearestEdge, preset: userPreset });
      });
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('orientationchange', reposition);
    document.addEventListener('fullscreenchange', reposition);
    // ResizeObserver detects scrollbar appearance/disappearance — clientWidth
    // shrinks when a classic scrollbar appears, but no 'resize' event fires
    // (window size is unchanged). Without this, the badge stays stuck behind
    // the scrollbar until the next window resize.
    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => reposition());
      resizeObserver.observe(document.documentElement);
    }
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('orientationchange', reposition);
      document.removeEventListener('fullscreenchange', reposition);
      resizeObserver?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [viewport, badgeSize, userPreset, setCenter, setDragCenter, persist]);

  const handleDrag = useCallback(
    (dx: number, dy: number): void => {
      const next = {
        x: dragStartCenterRef.current.x + dx,
        y: dragStartCenterRef.current.y + dy,
      };
      // Update ref synchronously so handleDragEnd (same event loop) reads
      // the live position, not the stale state from the previous render.
      dragCenterRef.current = next;
      setDragCenter(next);
    },
    [setDragCenter],
  );

  const handleDragStart = useCallback((): void => {
    // Start drag from the currently displayed position so the badge doesn't
    // jump to the nearest edge when grabbed while floating away from an edge.
    // - Already expanded: continue from dragCenter (no state change, no jump).
    // - Collapsed at edge: start from collapsedCenter (half-moon position).
    // - Collapsed floating: start from center (the visible floating position).
    const vp = resolveViewport(viewport);
    const { distance } = getNearestEdge(centerRef.current, vp);
    const isAtEdgeNow = distance <= badgeSize / 2;
    const start = expandedRef.current
      ? dragCenterRef.current
      : (isAtEdgeNow ? collapsedCenterRef.current : centerRef.current);
    dragStartCenterRef.current = start;
    dragCenterRef.current = start;
    setDragCenter(start);
    setExpanded(true);
    setDragging(true);
  }, [viewport, badgeSize, setDragCenter, setExpanded, setDragging]);

  const handleDragEnd = useCallback((): void => {
    const vp = resolveViewport(viewport);
    // Use dragCenterRef (live ref) not dragCenter (stale closure — state update
    // from handleDrag may not have been applied yet in the same event loop).
    const current = dragCenterRef.current;
    const { edge: nearestEdge, distance } = getNearestEdge(current, vp);
    // If dropped near an edge → snap + collapse (half-moon).
    // If dropped away from edge → stay expanded at drop position (full circle).
    const snapThreshold = badgeSize * 1.5;
    setDragging(false);
    if (distance <= snapThreshold) {
      const snapped = getEdgeCenter(nearestEdge, current, badgeSize, vp);
      setCenter(snapped);
      setDragCenter(snapped);
      setExpanded(false);
      persistRef.current?.({ x: snapped.x, y: snapped.y, edge: nearestEdge, preset: userPreset });
    } else {
      // Clamp inside viewport so badge doesn't go off-screen.
      const half = badgeSize / 2;
      const clamped = {
        x: Math.max(half, Math.min(vp.width - half, current.x)),
        y: Math.max(half, Math.min(vp.height - half, current.y)),
      };
      setCenter(clamped);
      setDragCenter(clamped);
      // Stay expanded — badge floats at drop position with pointer visible.
      persistRef.current?.({ x: clamped.x, y: clamped.y, edge: nearestEdge, preset: userPreset });
    }
  }, [badgeSize, viewport, userPreset, setCenter, setDragCenter, setExpanded, setDragging]);

  // Double-tap: toggle between 'top' and 'center'.
  const cyclePreset = useCallback((): void => {
    const next: PointerPreset = userPreset === 'top' ? 'center' : 'top';
    setUserPreset(next);
    onPresetChangeRef.current?.(next);
    persistRef.current?.({ x: activeCenter.x, y: activeCenter.y, edge, preset: next });
  }, [userPreset, activeCenter, edge, setUserPreset]);

  // Triple-tap: cycle between 'left' and 'right'.
  const reversePreset = useCallback((): void => {
    const next: PointerPreset = userPreset === 'left' ? 'right' : 'left';
    setUserPreset(next);
    onPresetChangeRef.current?.(next);
    persistRef.current?.({ x: activeCenter.x, y: activeCenter.y, edge, preset: next });
  }, [userPreset, activeCenter, edge, setUserPreset]);

  // Single-tap: only open panel when collapsed at edge. When expanded, ignore.
  const handleSingleTap = useCallback((): void => {
    if (!expanded) onClick?.();
  }, [expanded, onClick]);

  const gesture = useOrbitalGesture({
    onSingleTap: handleSingleTap,
    onDoubleTap: cyclePreset,
    onTripleTap: reversePreset,
    onDragStart: handleDragStart,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
  });

  return (
    <div
      className={[styles.host, 'js-cell-orbital-badge', expanded ? styles.expanded : styles.collapsed, dragging && styles.dragging].filter(Boolean).join(' ')}
      style={{
        left: 0,
        top: 0,
        width: badgeSize,
        height: badgeSize,
        transform: `translate3d(${displayedCenter.x - badgeSize / 2}px, ${displayedCenter.y - badgeSize / 2}px, 0)`,
      }}
      data-edge={isAtEdge ? edge : undefined}
      data-cell-id="orbital-badge"
      aria-label="Orbital dictionary badge"
      role="button"
      onPointerDown={gesture.onPointerDown}
      onPointerMove={gesture.onPointerMove}
      onPointerUp={gesture.onPointerUp}
      onPointerCancel={gesture.onPointerCancel}
    >
      <IconButton
        className={styles.badge}
        aria-label={expanded ? 'Drag to move' : 'Open dictionary'}
        data-cell-id="orbital-badge-button"
      />
      {(expanded || !isAtEdge || collapsedAtEdge) && (
        <div
          className={styles.pointer}
          style={{
            width: pointerSize,
            height: pointerSize,
            marginLeft: -pointerSize / 2,
            marginTop: -pointerSize / 2,
            transform: `translate3d(${pointerCenter.x - displayedCenter.x}px, ${pointerCenter.y - displayedCenter.y}px, 0)`,
          }}
          data-cell-id="orbital-pointer"
          aria-hidden="true"
        />
      )}
    </div>
  );
});
