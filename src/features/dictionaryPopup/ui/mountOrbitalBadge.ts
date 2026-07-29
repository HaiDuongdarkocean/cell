import { createElement, type RefObject } from 'react';
import { mountReactShadow } from '@/shared/lib/shadowRoot/mountReactShadow';
import { ShadowThemeProvider } from '@/shared/lib/shadowRoot/ShadowThemeProvider';
import { OrbitalBadge, type OrbitalBadgeProps, type OrbitalBadgeHandle } from './OrbitalBadge';
import type { UniversalPanelMountController } from '@/features/universalPanel/UniversalPanelController';
import type { PointerPreset, Point } from '@/features/dictionaryPopup/badgePointer/pointerPosition';
import orbitalBadgeCss from './OrbitalBadge.module.css?inline';

export interface OrbitalBadgeMountOptions {
  /** Badge diameter in px. */
  badgeSize?: number;
  /** Pointer diameter as a ratio of the badge. */
  pointerScale?: number;
  /** Initial pointer preset. */
  initialPreset?: PointerPreset;
  /** Called when the user changes the pointer preset. */
  onPresetChange?: (preset: PointerPreset) => void;
  /** Called when the pointer tip settles after a drag/expand. */
  onTipReady?: (tip: Point, preset: PointerPreset, badgeCenter: Point) => void;
  /** Called while the pointer is hovering over the page. */
  onTipHover?: (tip: Point, preset: PointerPreset, badgeCenter: Point) => void;
  /** Called on every pointer move while expanded. */
  onTipMoving?: (tip: Point, preset: PointerPreset, badgeCenter: Point) => void;
  /** Generic panel controller. When provided, a single click toggles the panel. */
  panelController?: UniversalPanelMountController;
}

export interface OrbitalBadgeMountController {
  /** Update the pointer preset. */
  setPreset: (preset: PointerPreset) => void;
  /** Show the badge. */
  show: () => void;
  /** Hide the badge. */
  hide: () => void;
  /** Unmount + remove the host element. */
  destroy: () => void;
}

const BADGE_Z_INDEX = 'var(--z-overlay-top)';

export function mountOrbitalBadge(options: OrbitalBadgeMountOptions = {}): OrbitalBadgeMountController {
  const {
    badgeSize = 44,
    pointerScale = 0.25,
    initialPreset = 'center',
    onPresetChange,
    onTipReady,
    onTipHover,
    onTipMoving,
    panelController,
  } = options;

  const pointerSize = badgeSize * pointerScale;
  const badgeRef: RefObject<OrbitalBadgeHandle | null> = { current: null };

  const buildBadge = (preset: PointerPreset): OrbitalBadgeProps => ({
    badgeSize,
    pointerSize,
    initialPreset: preset,
    persistPosition: false,
    onPresetChange,
    onTipReady,
    onTipHover,
    onTipMoving,
    onClick: () => {
      if (!panelController) return;
      if (panelController.isOpen()) panelController.close();
      else void panelController.open();
    },
  });

  const badgeElement = (preset: PointerPreset) =>
    createElement(OrbitalBadge, { ...buildBadge(preset), ref: badgeRef });

  // First mount without ShadowThemeProvider so we can pass the inner container
  // after mountReactShadow returns it. We re-render with the provider immediately.
  const mount = mountReactShadow(badgeElement(initialPreset), {
    parent: document.body,
    position: 'fixed',
    css: [orbitalBadgeCss],
  });

  mount.host.classList.add('js-cell-orbital-badge-host');
  mount.host.style.zIndex = BADGE_Z_INDEX;

  mount.root.render(
    createElement(
      ShadowThemeProvider,
      { container: mount.rootEl, children: badgeElement(initialPreset) },
    ),
  );

  const isInsidePanel = (e: PointerEvent): boolean => {
    const hosts = panelController?.getHosts();
    if (!hosts) return false;
    const path = e.composedPath();
    for (const host of hosts) {
      if (path.includes(host)) return true;
    }
    return false;
  };

  const onDocPointerDown = (e: PointerEvent): void => {
    const path = e.composedPath();
    if (path.includes(mount.host)) return;

    // Collapse the badge when the user clicks outside it.
    badgeRef.current?.setExpanded(false);

    // Close the panel when the user clicks outside both the badge and panel.
    if (panelController?.isOpen() && !isInsidePanel(e)) {
      panelController.close();
    }
  };

  document.addEventListener('pointerdown', onDocPointerDown, true);

  const onFullscreenChange = (): void => {
    const fsEl = document.fullscreenElement;
    if (fsEl && fsEl !== mount.host.parentElement) {
      fsEl.appendChild(mount.host);
    } else if (!fsEl && mount.host.parentElement !== document.body) {
      document.body.appendChild(mount.host);
    }
  };

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  // If already in fullscreen when mount is called, attach to fullscreen element.
  if (document.fullscreenElement && document.fullscreenElement !== mount.host.parentElement) {
    document.fullscreenElement.appendChild(mount.host);
  }

  const destroy = (): void => {
    document.removeEventListener('pointerdown', onDocPointerDown, true);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    mount.unmount();
  };

  return {
    setPreset: (preset) => {
      badgeRef.current?.setPreset(preset);
    },
    show: () => {
      mount.host.style.display = '';
    },
    hide: () => {
      mount.host.style.display = 'none';
    },
    destroy,
  };
}
