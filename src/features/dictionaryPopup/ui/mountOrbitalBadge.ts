import { createElement, type RefObject } from 'react';
import { mountReactShadow } from '@/shared/lib/shadowRoot/mountReactShadow';
import { allModuleCss } from '@/shared/lib/shadowRoot/allModuleCss';
import { ShadowThemeProvider } from '@/features/theme';
import { OrbitalBadge, type OrbitalBadgeProps, type OrbitalBadgeHandle } from './OrbitalBadge';
import type { PanelMountController } from '../controller/panelBridge';
import type { PointerPreset, Point } from '@/features/dictionaryPopup/badgePointer/pointerPosition';
import { Tihoka_PANEL_DISMISS_EXEMPT_SELECTORS } from '@/shared/lib/dom/TihokaUiHosts';

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
  panelController?: PanelMountController;
}

export interface OrbitalBadgeMountController {
  /** Re-resolve the attach target (fullscreen element or Player Mode host)
   *  and move the badge host into it. Needed for transitions that do not
   *  fire fullscreenchange, e.g. iframe Player Mode via the top-frame bridge. */
  reattach: () => void;
  /** Update the pointer preset. */
  setPreset: (preset: PointerPreset) => void;
  /** Update badge dimensions without remounting (preserves position state). */
  update: (dims: { badgeSize?: number; pointerScale?: number }) => void;
  /** Show the badge. */
  show: () => void;
  /** Hide the badge. */
  hide: () => void;
  /** Unmount + remove the host element. */
  destroy: () => void;
}

const BADGE_Z_INDEX = 'var(--z-overlay-orbital)';

export function mountOrbitalBadge(options: OrbitalBadgeMountOptions = {}): OrbitalBadgeMountController {
  const {
    initialPreset = 'center',
    onPresetChange,
    onTipReady,
    onTipHover,
    onTipMoving,
    panelController,
  } = options;

  const dims = {
    badgeSize: options.badgeSize ?? 44,
    pointerScale: options.pointerScale ?? 0.25,
  };
  const badgeRef: RefObject<OrbitalBadgeHandle | null> = { current: null };

  const buildBadge = (preset: PointerPreset): OrbitalBadgeProps => ({
    badgeSize: dims.badgeSize,
    pointerSize: dims.badgeSize * dims.pointerScale,
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

  const renderBadge = (preset: PointerPreset): void => {
    mount.root.render(
      createElement(
        ShadowThemeProvider,
        { container: mount.rootEl },
        badgeElement(preset),
      ),
    );
  };

  const mount = mountReactShadow(badgeElement(initialPreset), {
    parent: document.body,
    position: 'fixed',
    css: allModuleCss,
    provider: ShadowThemeProvider,
  });

  mount.host.classList.add('js-Tihoka-orbital-badge-host');
  mount.host.style.zIndex = BADGE_Z_INDEX;

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
    if (path.some((el) => el instanceof Element && el.matches(Tihoka_PANEL_DISMISS_EXEMPT_SELECTORS))) return;

    // Close the panel when the user clicks outside both the badge and panel.
    // The badge itself stays expanded — it only collapses when dragged near an
    // edge (handleDragEnd) so the user can re-grab it from its floating spot.
    if (panelController?.isOpen() && !isInsidePanel(e)) {
      panelController.close();
    }
  };

  document.addEventListener('pointerdown', onDocPointerDown, true);

  // The badge host (--z-overlay-orbital) sits above the panel host
  // (--z-overlay-secondary), so the badge must be suppressed while the panel
  // is open. Suppression rides panel open state via the existing
  // `onOpenChange` channel — a flag consulted by the fullscreen restore below
  // (reparenting unconditionally resets display, which would otherwise leak
  // the badge over the open panel).
  let panelSuppressed = panelController?.isOpen() ?? false;
  const applyPanelSuppression = (): void => {
    mount.host.style.display = panelSuppressed ? 'none' : '';
  };
  const unsubscribePanelOpen = panelController?.onOpenChange?.((open) => {
    panelSuppressed = open;
    applyPanelSuppression();
  });
  if (panelSuppressed) mount.host.style.display = 'none';

  // A fullscreen element with shadow DOM swallows light-DOM children that
  // are not slotted (e.g. #Tihoka-subtitle-root in Player Mode) — the badge
  // must go inside the shadow tree to render.
  const attachToFullscreen = (fsEl: Element): void => {
    const shadow = fsEl.shadowRoot;
    if (shadow) {
      if (mount.host.getRootNode() !== shadow) shadow.appendChild(mount.host);
      return;
    }
    if (mount.host.parentElement !== fsEl) fsEl.appendChild(mount.host);
  };

  // In a cross-origin iframe the top document fullscreens the <iframe>
  // element, so the child document's fullscreenElement stays null and the
  // child-frame Player Mode host (#Tihoka-subtitle-root) covers the viewport
  // with a max-int z-index instead. The badge must attach into that host's
  // shadow tree or it stays invisible behind the overlay.
  const resolveAttachTarget = (): Element | null =>
    document.fullscreenElement
    ?? document.querySelector('#Tihoka-subtitle-root[data-tihoka-player-mode]');

  const onFullscreenChange = (): void => {
    const fsEl = document.fullscreenElement;
    // When a child iframe's video goes native fullscreen, the browser puts
    // the <iframe> element in the TOP document's top layer — it covers the
    // entire top viewport. The host badge (position:fixed in the top document)
    // cannot render over a top-layer iframe, and appending into an <iframe>
    // element does not render inside the child document. So hide the host
    // badge while a child iframe is fullscreen; the child frame mounts its
    // own badge inside its fullscreen document (see syncOrbitalBadge).
    if (fsEl?.tagName === 'IFRAME') {
      mount.host.style.display = 'none';
      return;
    }
    // Non-iframe fullscreen (e.g. Tihoka Player Mode container), a child-frame
    // Player Mode host, or exit: move the badge into that element so it stays
    // visible, or back to body when leaving. Restore display — unless the
    // panel is open, in which case the badge stays suppressed across the
    // transition.
    const target = resolveAttachTarget();
    if (target) {
      attachToFullscreen(target);
    } else if (mount.host.getRootNode() !== document) {
      document.body.appendChild(mount.host);
    }
    applyPanelSuppression();
  };

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  // If already in fullscreen or a child-frame Player Mode when mount is
  // called, attach into that element.
  const initialTarget = resolveAttachTarget();
  if (initialTarget) {
    attachToFullscreen(initialTarget);
  }

  const destroy = (): void => {
    unsubscribePanelOpen?.();
    document.removeEventListener('pointerdown', onDocPointerDown, true);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    mount.unmount();
  };

  return {
    reattach: onFullscreenChange,
    setPreset: (preset) => {
      badgeRef.current?.setPreset(preset);
    },
    update: (next) => {
      if (next.badgeSize !== undefined) dims.badgeSize = next.badgeSize;
      if (next.pointerScale !== undefined) dims.pointerScale = next.pointerScale;
      renderBadge(badgeRef.current?.getState().preset ?? initialPreset);
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
