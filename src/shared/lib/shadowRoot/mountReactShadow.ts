import { createElement, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { injectShadowCss } from './injectShadowCss';

export type ShadowPosition = 'fixed' | 'absolute' | 'relative';

export interface MountShadowOptions {
  /** Light-DOM parent. Defaults to `document.body`. A ShadowRoot parent is
   *  also accepted (e.g. when the fullscreen element is itself a shadow
   *  host — light-DOM children without a <slot> never render). */
  parent?: HTMLElement | ShadowRoot;
  /**
   * Stacking layer. Higher numbers render above lower numbers.
   * Maps to `z-index: layer * 100` by default.
   */
  layer?: number;
  /** CSS `position` of the host element. */
  position?: ShadowPosition;
  /** Extra CSS strings (e.g. `*.module.css?inline`) injected after tokens. */
  css?: string[];
  /**
   * Move the host into `document.fullscreenElement` when the page enters
   * fullscreen, and back to `parent` on exit. This keeps the overlay visible
   * on YouTube/Netflix-style video fullscreen.
   */
  reparentOnFullscreen?: boolean;
  /**
   * Persistent chrome surface (e.g. a pill docked in the PM layout): when the
   * fullscreen-like target's shadow exposes a `cell-host-chrome` slot, project
   * the host there instead of the top shadow level — so hoisted host menus and
   * sheets still render above it. Has no effect without `reparentOnFullscreen`.
   */
  chromeLayer?: boolean;
  provider?: ComponentType<{ container: HTMLElement; children?: ReactNode }>;
}

export interface ShadowMount {
  host: HTMLElement;
  /** Inner container inside the shadow root where the React tree is rendered. */
  rootEl: HTMLElement;
  shadow: ShadowRoot;
  root: ReturnType<typeof createRoot>;
  unmount: () => void;
}

/**
 * Mount a React element into a freshly created open shadow root.
 *
 * Injects `tokens.css`, `components.css`, and any supplied per-component CSS,
 * then renders the React tree. Returns `unmount()` which removes the host.
 */
export function mountReactShadow(
  component: ReactElement,
  options: MountShadowOptions = {},
): ShadowMount {
  const {
    parent = document.body,
    layer = 0,
    position = 'fixed',
    css = [],
    reparentOnFullscreen = false,
  } = options;

  const host = document.createElement('div');
  host.style.position = position;
  host.style.zIndex = String(layer * 100);

  const shadow = host.attachShadow({ mode: 'open' });

  const cleanupCss = injectShadowCss(shadow, { css });

  const rootEl = document.createElement('div');
  rootEl.style.display = 'contents';
  shadow.appendChild(rootEl);

  parent.appendChild(host);

  const root = createRoot(rootEl);
  root.render(
    options.provider
      ? createElement(options.provider, { container: rootEl }, component)
      : component,
  );

  const removeKeyboardTrap = attachKeyboardTrap(shadow);

  if (options.chromeLayer) host.setAttribute('data-cell-chrome', '');
  const removeFullscreenListeners = reparentOnFullscreen
    ? attachFullscreenReparenting(host, parent)
    : null;

  return {
    host,
    rootEl,
    shadow,
    root,
    unmount: () => {
      removeKeyboardTrap();
      removeFullscreenListeners?.();
      cleanupCss();
      root.unmount();
      host.remove();
    },
  };
}

function attachKeyboardTrap(shadow: ShadowRoot): () => void {
  const handler: EventListener = (e) => {
    if (!(e instanceof KeyboardEvent)) return;
    if (e.key === 'Escape') return;
    e.stopPropagation();
  };
  const target = shadow as unknown as EventTarget;
  target.addEventListener('keydown', handler);
  target.addEventListener('keyup', handler);
  return () => {
    target.removeEventListener('keydown', handler);
    target.removeEventListener('keyup', handler);
  };
}

export function attachFullscreenReparenting(
  host: HTMLElement,
  parent: HTMLElement | ShadowRoot,
): () => void {
  const mountPoint = (el: Element): HTMLElement | ShadowRoot =>
    el.tagName === 'VIDEO'
      ? ((el as HTMLElement).parentElement ?? document.body)
      : ((el as HTMLElement).shadowRoot ?? (el as HTMLElement));

  // In a cross-origin iframe, Player Mode runs via the top-frame bridge: the
  // top document fullscreens the <iframe> element, so this document's
  // fullscreenElement stays null. The child PM host covers the iframe
  // viewport with a max-int z-index — surfaces must attach into its shadow
  // tree the same way they attach into a fullscreen element.
  const resolveFsLikeElement = (): Element | null =>
    document.fullscreenElement
    ?? document.querySelector('#cell-subtitle-root[data-cell-player-mode]');

  const onFullscreenChange = (): void => {
    const fsEl = resolveFsLikeElement();
    if (fsEl) {
      // The fullscreen element can be this host itself (Player Mode roots the
      // overlay host) — appending it into its own shadow throws.
      if (fsEl === host || host.contains(fsEl)) return;
      // Chrome surfaces (persistent chrome like pills) project into the
      // overlay's chrome layer — below the popup stage so hoisted host menus
      // and sheets still render above them. Only possible when the target's
      // shadow exposes the chrome slot; a slotted element without a matching
      // slot never renders.
      if (
        host.hasAttribute('data-cell-chrome')
        && fsEl instanceof HTMLElement
        && fsEl.shadowRoot?.querySelector('slot[name="cell-host-chrome"]')
      ) {
        host.slot = 'cell-host-chrome';
        if (host.parentElement !== fsEl) fsEl.appendChild(host);
        return;
      }
      host.removeAttribute('slot');
      const target = mountPoint(fsEl);
      if (target !== host.parentNode) target.appendChild(host);
    } else {
      host.removeAttribute('slot');
      if (host.parentNode !== parent && !host.contains(parent)) {
        parent.appendChild(host);
      }
    }
  };

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  // The PM host attribute does not fire fullscreenchange — Player Mode marks
  // itself via data-cell-player-mode on <html>. MutationObserver callbacks run
  // after the commit, so the host attribute is already set when we resolve.
  const pmObserver = new MutationObserver(onFullscreenChange);
  pmObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-cell-player-mode'],
  });

  onFullscreenChange();

  return () => {
    pmObserver.disconnect();
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
  };
}
