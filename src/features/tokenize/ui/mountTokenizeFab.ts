import { createElement } from 'react';
import { mountReactShadow } from '@/shared/lib/shadowRoot/mountReactShadow';
import { ShadowThemeProvider } from '@/shared/lib/shadowRoot/ShadowThemeProvider';
import { TokenizeFab } from './TokenizeFab';
import type { TokenizeStateStore } from '@/features/tokenize/services/tokenizeStateStore';
import tokenizeFabCss from './TokenizeFab.module.css?inline';
import buttonCss from '@/shared/ui/Button.module.css?inline';
import toggleCss from '@/shared/ui/Toggle.module.css?inline';
import iconCss from '@/shared/icons/Icon.module.css?inline';

const HOST_CLASS = 'js-cell-tokenize-fab-host';
const FAB_Z_INDEX = 'var(--z-overlay-secondary)';

export interface MountTokenizeFabOptions {
  /** External tokenize store to sync toggle state. */
  readonly store: TokenizeStateStore;
  /** Called when the user clicks the dictionary button. */
  readonly onOpenDictionary?: () => void;
}

export interface TokenizeFabMount {
  /** Remove the host and all listeners. */
  readonly destroy: () => void;
}

/**
 * Mount the `TokenizeFab` React component into an open shadow root host.
 *
 * - Fixed position on the right viewport edge, below the orbital badge.
 * - Re-renders with `ShadowThemeProvider` so the inner container `data-theme`
 *   follows the selected theme and tokens resolve inside the shadow boundary.
 * - Re-parents the host onto `document.fullscreenElement` when the page
 *   enters fullscreen, and back to `document.body` on exit, so it survives
 *   Netflix/YouTube fullscreen video.
 */
export function mountTokenizeFab(options: MountTokenizeFabOptions): TokenizeFabMount {
  const { store, onOpenDictionary } = options;

  const fabElement = () => createElement(TokenizeFab, { store, onOpenDictionary });

  const mount = mountReactShadow(fabElement(), {
    parent: document.body,
    position: 'fixed',
    css: [tokenizeFabCss, buttonCss, toggleCss, iconCss],
  });

  mount.host.classList.add(HOST_CLASS);
  mount.host.style.zIndex = FAB_Z_INDEX;

  mount.root.render(
    createElement(
      ShadowThemeProvider,
      { container: mount.rootEl, children: fabElement() },
    ),
  );

  function onFullscreenChange(): void {
    const fsEl = document.fullscreenElement;
    if (fsEl && fsEl !== mount.host.parentElement) {
      fsEl.appendChild(mount.host);
    } else if (!fsEl && mount.host.parentElement !== document.body) {
      document.body.appendChild(mount.host);
    }
  }

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  // If already in fullscreen when mount is called, attach to fullscreen element.
  if (document.fullscreenElement && document.fullscreenElement !== mount.host.parentElement) {
    document.fullscreenElement.appendChild(mount.host);
  }

  return {
    destroy: () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      mount.unmount();
    },
  };
}
