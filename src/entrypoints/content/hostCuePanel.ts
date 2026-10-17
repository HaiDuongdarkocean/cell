// Host-side cue panel bridge — renders the 't' cue panel on the top document
// when a cross-origin child iframe requests it (the panel cannot escape the
// iframe's viewport otherwise). Middle frames forward state up / actions down.
// Same shape as hostManagerSheet.ts.

import { isChildFrame } from '@/shared/lib/dom/isChildFrame';
import { runOncePerDocument } from '@/shared/lib/dom/claimSingletonInstall';
import {
  isIframeContentWindow,
  isResolvableHttpOrigin,
  resolveParentFrameOrigin,
} from '@/shared/lib/dom/frameOrigin';
import {
  CUE_PANEL_ACTION_MSG,
  CUE_PANEL_STATE_MSG,
} from '@/features/subtitle/logic/iframeCuePanelBridgeTypes';
import { handleShortcutKey } from '@/features/subtitle/ui/subtitleShortcuts';
import type {
  CuePanelAction,
  SerializedCuePanelState,
} from '@/features/subtitle/logic/iframeCuePanelBridgeTypes';

interface PanelDeps {
  createElement: typeof import('react').createElement;
  mountReactShadow: typeof import('@/shared/lib/shadowRoot/mountReactShadow').mountReactShadow;
  HostCuePanel: typeof import('@/features/subtitle/ui/HostCuePanel').HostCuePanel;
  ShadowThemeProvider: typeof import('@/features/theme/ui/ShadowThemeProvider').ShadowThemeProvider;
  allModuleCss: string[];
  buildTokenSpanCssForShadow: () => string;
}

const loadDeps = (): Promise<PanelDeps> =>
  Promise.all([
    import('react'),
    import('@/shared/lib/shadowRoot/mountReactShadow'),
    import('@/features/subtitle/ui/HostCuePanel'),
    import('@/features/theme/ui/ShadowThemeProvider'),
    import('@/shared/lib/shadowRoot/allModuleCss'),
    import('@/features/tokenize'),
  ]).then(([react, mount, panel, theme, moduleCss, tokenize]) => ({
    createElement: react.createElement,
    mountReactShadow: mount.mountReactShadow,
    HostCuePanel: panel.HostCuePanel,
    ShadowThemeProvider: theme.ShadowThemeProvider,
    allModuleCss: moduleCss.allModuleCss,
    buildTokenSpanCssForShadow: tokenize.buildTokenSpanCssForShadow,
  }));

export function installHostCuePanel(): () => void {
  // Stacked reinjections would each post a relay → N toggles per keypress.
  let dispose: (() => void) | null = null;
  runOncePerDocument('host-cue-panel', () => { dispose = installHostCuePanelOnce(); });
  return () => dispose?.();
}

function installHostCuePanelOnce(): () => void {
  const isTop = !isChildFrame();
  let depsPromise: Promise<PanelDeps> | null = null;
  const deps = (): Promise<PanelDeps> => (depsPromise ??= loadDeps());

  let mount: ReturnType<PanelDeps['mountReactShadow']> | null = null;
  let childWin: Window | null = null;
  let childOrigin: string | null = null;
  // The 't' relay needs the route to survive close (toggle back ON) —
  // separate from childWin which closeLocal() clears.
  let routeWin: Window | null = null;
  let routeOrigin: string | null = null;
  let routeBindings: SerializedCuePanelState['shortcuts'];
  let latestState: SerializedCuePanelState | null = null;

  // Each relayed action carries a unique rid — stacked child worlds use it
  // to claim exactly one dispatch per message.
  let relaySeq = 0;
  function postAction(action: CuePanelAction, args: Record<string, unknown> = {}): void {
    if (!childWin || !childOrigin) return;
    try {
      childWin.postMessage(
        { type: CUE_PANEL_ACTION_MSG, action, rid: `${Date.now()}-${++relaySeq}`, ...args },
        childOrigin,
      );
    } catch { /* dead child */ }
  }

  function render(): void {
    if (!mount || !latestState) return;
    void deps().then((d) => {
      if (!mount || !latestState) return;
      mount.root.render(
        d.createElement(
          d.ShadowThemeProvider,
          { container: mount.rootEl },
          d.createElement(d.HostCuePanel, { state: latestState, post: postAction }),
        ),
      );
    });
  }

  function open(state: SerializedCuePanelState): void {
    closeLocal();
    latestState = state;
    void deps().then((d) => {
      // Only bail if the panel was closed — state refreshes mid-load are
      // normal (throttled time ticks) and must not cancel the mount.
      if (latestState !== state) return;
      const m = d.mountReactShadow(
        d.createElement(d.HostCuePanel, { state, post: postAction }),
        {
          provider: d.ShadowThemeProvider,
          css: [...d.allModuleCss, d.buildTokenSpanCssForShadow()],
        },
      );
      mount = m;
      m.host.id = 'Tihoka-host-cue-panel';
      // z-overlay-video (10000) — the cue sheet is a video-adjacent surface and
      // must sit UNDER settings/popup/manager layers (10001+). The old max-int
      // value placed it above the universal panel + dict popup sheet.
      m.host.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:var(--z-overlay-video);';
      m.rootEl.style.pointerEvents = 'auto';
    }).catch((err) => {
      console.warn('[Tihoka] host cue panel mount failed', err);
      closeLocal();
    });
  }

  function closeLocal(): void {
    mount?.unmount();
    mount = null;
    latestState = null;
    childWin = null;
    childOrigin = null;
  }

  const onMessage = (e: MessageEvent): void => {
    const data = e.data;
    if (!data || typeof data !== 'object') return;

    // Host → child direction (middle frames forward actions down). Only
    // messages from our own parent — a sibling iframe must not forge
    // seek/close/tokenClick.
    if (isChildFrame() && data.type === CUE_PANEL_ACTION_MSG) {
      if (e.source !== window.parent) return;
      if (e.origin !== resolveParentFrameOrigin()) return;
      if (childWin && childOrigin) {
        try {
          childWin.postMessage(data, childOrigin);
        } catch { /* dead child */ }
      }
      return;
    }

    if (data.type !== CUE_PANEL_STATE_MSG) return;
    const state = data.state as SerializedCuePanelState | undefined;
    if (!state) return;
    if (!isIframeContentWindow(e.source as Window | null)) return;
    if (!isResolvableHttpOrigin(e.origin)) return;
    const src = e.source as Window;

    if (!isTop) {
      // Middle frame — forward state upward, remember route for actions.
      const parentOrigin = resolveParentFrameOrigin();
      if (!parentOrigin) return;
      childWin = src;
      childOrigin = e.origin;
      try {
        window.parent.postMessage(data, parentOrigin);
      } catch { /* dead parent */ }
      return;
    }

    childWin = src;
    childOrigin = e.origin;
    routeWin = src;
    routeOrigin = e.origin;
    if (state.shortcuts) routeBindings = state.shortcuts;
    if (state.open) {
      if (!mount) {
        open(state);
      } else {
        latestState = state;
        render();
      }
    } else {
      closeLocal();
    }
  };
  window.addEventListener('message', onMessage);

  // Source iframe navigated → drop the panel.
  const onIframeLoad = (e: Event): void => {
    if (!(e.target instanceof HTMLIFrameElement)) return;
    if (e.target.contentWindow === childWin || e.target.contentWindow === routeWin) {
      closeLocal();
      routeWin = null;
      routeOrigin = null;
    }
  };
  document.addEventListener('load', onIframeLoad, true);

  // Tihoka hotkeys live in the child frame — a keypress on the top document
  // never reaches them. Relay any key matching the child's own serialized
  // bindings down as a 'keydown' action; the child redispatches it through
  // its real handler, so every configured shortcut (toggle panel, play/pause,
  // cue nav, seek…) works regardless of which frame is focused. Guards mirror
  // the child's own: no repeat/meta, editable targets blocked.
  const onKey = (e: KeyboardEvent): void => {
    if (!isTop || e.repeat || e.metaKey || !routeWin || !routeOrigin) return;
    const target = e.composedPath()[0] ?? e.target;
    const action = handleShortcutKey(
      e.key.toLowerCase(),
      routeBindings ?? [{ key: 't', action: 'toggle-panel' }],
      target,
      { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey },
    );
    if (!action) return;
    e.preventDefault();
    try {
      routeWin.postMessage(
        { type: CUE_PANEL_ACTION_MSG, action: 'keydown',
          rid: `${Date.now()}-${++relaySeq}`,
          key: e.key, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey },
        routeOrigin,
      );
    } catch { /* dead child */ }
  };
  window.addEventListener('keydown', onKey, true);

  return () => {
    window.removeEventListener('message', onMessage);
    document.removeEventListener('load', onIframeLoad, true);
    window.removeEventListener('keydown', onKey, true);
    closeLocal();
  };
}
