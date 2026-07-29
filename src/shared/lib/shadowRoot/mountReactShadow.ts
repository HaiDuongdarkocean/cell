import { type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { injectShadowCss } from './injectShadowCss';

export type ShadowPosition = 'fixed' | 'absolute' | 'relative';

export interface MountShadowOptions {
  /** Light-DOM parent. Defaults to `document.body`. */
  parent?: HTMLElement;
  /**
   * Stacking layer. Higher numbers render above lower numbers.
   * Maps to `z-index: layer * 100` by default.
   */
  layer?: number;
  /** CSS `position` of the host element. */
  position?: ShadowPosition;
  /** Extra CSS strings (e.g. `*.module.css?inline`) injected after tokens. */
  css?: string[];
}

export interface ShadowMount {
  host: HTMLElement;
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
  root.render(component);

  return {
    host,
    shadow,
    root,
    unmount: () => {
      cleanupCss();
      root.unmount();
      host.remove();
    },
  };
}
