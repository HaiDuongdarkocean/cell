import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Icon } from '@/shared/icons/Icon';
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
  return viewport ?? { width: getClientWidth(), height: getClientHeight() };
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
  initialPreset = 'center',
  viewport,
  persistPosition = true,
  onPresetChange,
  onTipReady,
  onClick,
}, ref): React.JSX.Element {
  const resolvedViewport = resolveViewport(viewport);
  const defaultCenter = { x: resolvedViewport.width - badgeSize / 2, y: resolvedViewport.height / 2 };

  const [expanded, setExpanded] = useState(false);
  const [preset, setPreset] = useState<PointerPreset>(initialPreset);
  const [center, setCenter] = useState<Point>(initialCenter ?? defaultCenter);
  const [dragCenter, setDragCenter] = useState<Point>(center);
  const dragStartCenterRef = useRef<Point>(center);
  const centerRef = useRef<Point>(center);
  const dragCenterRef = useRef<Point>(dragCenter);
  const expandedCenterRef = useRef<Point>(center);
  const collapsedCenterRef = useRef<Point>(center);
  const onPresetChangeRef = useRef(onPresetChange);

  centerRef.current = center;
  dragCenterRef.current = dragCenter;
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
        setPreset(inward);
        onPresetChangeRef.current?.(inward);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [persistPosition, badgeSize, viewport, setCenter, setDragCenter, setPreset]);

  const activeViewport = resolveViewport(viewport);
  const activeCenter = expanded ? dragCenter : center;

  const { pointerCenter, pointerTip } = useOrbitalPointer({
    badgeCenter: activeCenter,
    badgeSize,
    pointerSize,
    viewportWidth: activeViewport.width,
    viewportHeight: activeViewport.height,
  });

  const { edge, collapsedCenter, expandedCenter } = useOrbitalSnap({
    badgeCenter: activeCenter,
    badgeSize,
    viewport: activeViewport,
  });

  expandedCenterRef.current = expandedCenter;
  collapsedCenterRef.current = collapsedCenter;

  useImperativeHandle(ref, () => ({
    setPreset: (next) => setPreset(next),
    setExpanded: (next) => setExpanded(next),
    getState: () => ({ expanded, preset, center: activeCenter }),
  }), [expanded, preset, activeCenter]);

  useEffect(() => {
    if (expanded) {
      onTipReady?.(pointerTip, preset, activeCenter);
    }
  }, [expanded, pointerTip, preset, activeCenter, onTipReady]);

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
        const currentCenter = centerRef.current;
        const currentDrag = dragCenterRef.current;
        const { edge: nearestEdge } = getNearestEdge(currentCenter, vp);
        const snapped = getEdgeCenter(nearestEdge, currentCenter, badgeSize, vp);
        const inward = inwardPreset(nearestEdge);
        const { edge: dragEdge } = getNearestEdge(currentDrag, vp);
        const dragSnapped = getEdgeCenter(dragEdge, currentDrag, badgeSize, vp);
        setCenter(snapped);
        setDragCenter(dragSnapped);
        setPreset(inward);
        onPresetChangeRef.current?.(inward);
        persistRef.current?.({ x: snapped.x, y: snapped.y, edge: nearestEdge, preset: inward });
      });
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('orientationchange', reposition);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('orientationchange', reposition);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [viewport, badgeSize, setCenter, setDragCenter, setPreset, persist]);

  const handleDrag = useCallback(
    (dx: number, dy: number): void => {
      setDragCenter({
        x: dragStartCenterRef.current.x + dx,
        y: dragStartCenterRef.current.y + dy,
      });
    },
    [setDragCenter],
  );

  const handleDragStart = useCallback((): void => {
    const start = collapsedCenterRef.current;
    dragStartCenterRef.current = start;
    setDragCenter(start);
    setExpanded(true);
  }, [setDragCenter, setExpanded]);

  const handleDragEnd = useCallback((): void => {
    const vp = resolveViewport(viewport);
    const { edge: nearestEdge } = getNearestEdge(dragCenter, vp);
    const snapped = getEdgeCenter(nearestEdge, dragCenter, badgeSize, vp);
    setCenter(snapped);
    setDragCenter(snapped);
    setExpanded(false);
    const inward = inwardPreset(nearestEdge);
    setPreset(inward);
    onPresetChangeRef.current?.(inward);
    persistRef.current?.({ x: snapped.x, y: snapped.y, edge: nearestEdge, preset: inward });
  }, [dragCenter, badgeSize, viewport, setCenter, setDragCenter, setExpanded, setPreset]);

  const cyclePreset = useCallback((): void => {
    const order: PointerPreset[] = ['center', 'right', 'top', 'left', 'bottom'];
    const next = order[(order.indexOf(preset) + 1) % order.length];
    setPreset(next);
    onPresetChangeRef.current?.(next);
    persistRef.current?.({ x: activeCenter.x, y: activeCenter.y, edge, preset: next });
  }, [preset, activeCenter, edge, setPreset]);

  const reversePreset = useCallback((): void => {
    const order: PointerPreset[] = ['center', 'right', 'top', 'left', 'bottom'];
    const idx = order.indexOf(preset);
    const next = order[(idx - 1 + order.length) % order.length];
    setPreset(next);
    onPresetChangeRef.current?.(next);
    persistRef.current?.({ x: activeCenter.x, y: activeCenter.y, edge, preset: next });
  }, [preset, activeCenter, edge, setPreset]);

  const gesture = useOrbitalGesture({
    onSingleTap: onClick,
    onDoubleTap: cyclePreset,
    onTripleTap: reversePreset,
    onDragStart: handleDragStart,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
  });

  const displayedCenter = expanded ? dragCenter : (edge ? collapsedCenter : center);

  return (
    <div
      className={[styles.host, 'js-cell-orbital-badge', expanded ? styles.expanded : styles.collapsed].filter(Boolean).join(' ')}
      style={{
        left: 0,
        top: 0,
        width: badgeSize,
        height: badgeSize,
        transform: `translate3d(${displayedCenter.x - badgeSize / 2}px, ${displayedCenter.y - badgeSize / 2}px, 0)`,
      }}
      data-edge={edge}
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
      >
        <Icon name={expanded ? 'x' : 'search'} size={18} />
      </IconButton>
      {expanded && (
        <div
          className={styles.pointer}
          style={{
            left: pointerCenter.x - displayedCenter.x + badgeSize / 2,
            top: pointerCenter.y - displayedCenter.y + badgeSize / 2,
            width: pointerSize,
            height: pointerSize,
            marginLeft: -pointerSize / 2,
            marginTop: -pointerSize / 2,
          }}
          data-cell-id="orbital-pointer"
          aria-hidden="true"
        />
      )}
    </div>
  );
});
