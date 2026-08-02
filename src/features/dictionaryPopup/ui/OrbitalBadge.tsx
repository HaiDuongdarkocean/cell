import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { useOrbitalPointer } from '@/features/dictionaryPopup/badgePointer/useOrbitalPointer';
import { useOrbitalSnap } from '@/features/dictionaryPopup/badgePointer/useOrbitalSnap';
import { getNearestEdge, getEdgeCenter, type ViewportRect } from '@/features/dictionaryPopup/badgePointer/badgeCollapse';
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

  useEffect(() => {
    if (!persistPosition) return;
    let mounted = true;
    loadOrbitalBadgePosition()
      .then((pos) => {
        if (!mounted || !pos) return;
        setCenter({ x: pos.x, y: pos.y });
        setPreset(pos.preset);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [persistPosition]);

  const activeViewport = resolveViewport(viewport);
  const activeCenter = expanded ? dragCenter : center;

  const { pointerCenter, pointerTip } = useOrbitalPointer({
    badgeCenter: activeCenter,
    badgeSize,
    pointerSize,
    viewportWidth: activeViewport.width,
    viewportHeight: activeViewport.height,
  });

  const { edge, collapsedCenter } = useOrbitalSnap({
    badgeCenter: activeCenter,
    badgeSize,
    viewport: activeViewport,
  });

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
    saveOrbitalBadgePosition(position).catch(() => {});
  }, [persistPosition]);

  const handleDrag = useCallback(
    (dx: number, dy: number): void => {
      setDragCenter({
        x: dragStartCenterRef.current.x + dx,
        y: dragStartCenterRef.current.y + dy,
      });
    },
    [],
  );

  const handleDragStart = useCallback((): void => {
    dragStartCenterRef.current = center;
    setExpanded(true);
  }, [center]);

  const handleDragEnd = useCallback((): void => {
    const vp = resolveViewport(viewport);
    const { edge: nearestEdge } = getNearestEdge(dragCenter, vp);
    const snapped = getEdgeCenter(nearestEdge, dragCenter, badgeSize, vp);
    setCenter(snapped);
    setDragCenter(snapped);
    setExpanded(false);
    const inward: PointerPreset =
      nearestEdge === 'left' ? 'right' :
      nearestEdge === 'right' ? 'left' :
      nearestEdge === 'top' ? 'bottom' : 'top';
    setPreset(inward);
    onPresetChange?.(inward);
    persist({ x: snapped.x, y: snapped.y, edge: nearestEdge, preset: inward });
  }, [dragCenter, badgeSize, viewport, onPresetChange, persist]);

  const cyclePreset = useCallback((): void => {
    const order: PointerPreset[] = ['center', 'right', 'top', 'left', 'bottom'];
    const next = order[(order.indexOf(preset) + 1) % order.length];
    setPreset(next);
    onPresetChange?.(next);
    persist({ x: activeCenter.x, y: activeCenter.y, edge, preset: next });
  }, [preset, onPresetChange, persist, activeCenter, edge]);

  const reversePreset = useCallback((): void => {
    const order: PointerPreset[] = ['center', 'right', 'top', 'left', 'bottom'];
    const idx = order.indexOf(preset);
    const next = order[(idx - 1 + order.length) % order.length];
    setPreset(next);
    onPresetChange?.(next);
    persist({ x: activeCenter.x, y: activeCenter.y, edge, preset: next });
  }, [preset, onPresetChange, persist, activeCenter, edge]);

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
        left: displayedCenter.x,
        top: displayedCenter.y,
        width: badgeSize,
        height: badgeSize,
        marginLeft: -badgeSize / 2,
        marginTop: -badgeSize / 2,
      }}
      data-cell-id="orbital-badge"
      aria-label="Orbital dictionary badge"
      role="button"
      onPointerDown={gesture.onPointerDown}
      onPointerMove={gesture.onPointerMove}
      onPointerUp={gesture.onPointerUp}
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
