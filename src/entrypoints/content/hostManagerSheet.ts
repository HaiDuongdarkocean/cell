import {
  installManagerSheetBridge,
  setHostSheetCallbacks,
  sendManagerActionToChild,
  sendManagerCloseToChild,
} from '@/features/subtitle/logic/iframeManagerBridgeHost';
import type { SerializedManagerState, ManagerAction } from '@/features/subtitle/logic/iframeManagerBridgeTypes';

interface SheetRenderDeps {
  createElement: typeof import('react').createElement;
  createRoot: typeof import('react-dom/client').createRoot;
  HostManagerSheet: typeof import('@/features/subtitle/ui/HostManagerSheet').HostManagerSheet;
  ShadowThemeProvider: typeof import('@/features/theme/ui/ShadowThemeProvider').ShadowThemeProvider;
  injectShadowCss: typeof import('@/shared/lib/shadowRoot/injectShadowCss').injectShadowCss;
  hostManagerSheetShadowCss: string[];
}

// Host-side manager sheet bridge — renders bottom sheet on host page
// when a cross-origin child iframe requests it (mobile scenario where the
// iframe cannot expand its own overlay beyond its viewport).
export function installHostManagerSheet(): void {
  let depsPromise: Promise<SheetRenderDeps> | null = null;
  const loadDeps = (): Promise<SheetRenderDeps> =>
    (depsPromise ??= Promise.all([
      import('react'),
      import('react-dom/client'),
      import('@/features/subtitle/ui/HostManagerSheet'),
      import('@/features/theme/ui/ShadowThemeProvider'),
      import('@/shared/lib/shadowRoot/injectShadowCss'),
      import('@/features/subtitle/ui/hostManagerSheetShadowCss'),
    ]).then(([react, reactDom, sheet, theme, css, sheetCss]) => ({
      createElement: react.createElement,
      createRoot: reactDom.createRoot,
      HostManagerSheet: sheet.HostManagerSheet,
      ShadowThemeProvider: theme.ShadowThemeProvider,
      injectShadowCss: css.injectShadowCss,
      hostManagerSheetShadowCss: sheetCss.hostManagerSheetShadowCss,
    })));

  let hostSheetRoot: ReturnType<SheetRenderDeps['createRoot']> | null = null;
  let hostSheetHost: HTMLDivElement | null = null;
  let hostSheetInner: HTMLDivElement | null = null;
  let sheetCssCleanup: (() => void) | null = null;
  let currentFrameSrc = '';
  let currentState: SerializedManagerState | null = null;

  function renderHostSheet(deps: SheetRenderDeps): void {
    if (!hostSheetRoot || !currentState || !hostSheetInner) return;
    const frameSrc = currentFrameSrc;
    hostSheetRoot.render(
      deps.createElement(
        deps.ShadowThemeProvider,
        { container: hostSheetInner },
        deps.createElement(deps.HostManagerSheet, {
          state: currentState,
          onAction: (action: ManagerAction, args: Record<string, unknown>) =>
            sendManagerActionToChild(frameSrc, action, args),
          onClose: () => sendManagerCloseToChild(frameSrc),
        }),
      ),
    );
  }

  setHostSheetCallbacks({
    onOpen: (state: SerializedManagerState, frameSrc: string): void => {
      // Tear down any existing sheet before opening a new one.
      if (hostSheetRoot) {
        hostSheetRoot.unmount();
        hostSheetRoot = null;
      }
      if (hostSheetHost) {
        hostSheetHost.remove();
        hostSheetHost = null;
      }
      if (sheetCssCleanup) {
        sheetCssCleanup();
        sheetCssCleanup = null;
      }

      currentFrameSrc = frameSrc;
      currentState = state;

      hostSheetHost = document.createElement('div');
      hostSheetHost.id = 'cell-host-manager-sheet';
      hostSheetHost.style.cssText =
        'position:fixed;inset:0;pointer-events:auto;z-index:2147483647;';
      document.body.appendChild(hostSheetHost);

      void loadDeps().then((deps) => {
        if (!hostSheetHost || currentState !== state) return;
        const shadow = hostSheetHost.shadowRoot ?? hostSheetHost.attachShadow({ mode: 'open' });
        sheetCssCleanup = deps.injectShadowCss(shadow, { css: deps.hostManagerSheetShadowCss });

        hostSheetInner = document.createElement('div');
        hostSheetInner.style.display = 'contents';
        shadow.appendChild(hostSheetInner);

        hostSheetRoot = deps.createRoot(hostSheetInner);
        renderHostSheet(deps);
      }).catch((err: unknown) => {
        console.warn('[content-script] host manager sheet init failed', err);
      });
    },
    onStateUpdate: (partialState: Partial<SerializedManagerState>, _frameSrc: string): void => {
      if (!currentState) return;
      currentState = { ...currentState, ...partialState };
      void loadDeps().then(renderHostSheet);
    },
    onClose: (_frameSrc: string): void => {
      if (hostSheetRoot) {
        hostSheetRoot.unmount();
        hostSheetRoot = null;
      }
      if (hostSheetHost) {
        hostSheetHost.remove();
        hostSheetHost = null;
      }
      hostSheetInner = null;
      if (sheetCssCleanup) {
        sheetCssCleanup();
        sheetCssCleanup = null;
      }
      currentFrameSrc = '';
      currentState = null;
    },
  });

  // Bridge lives for the page lifecycle — never cleaned up (the accidental
  // reuse of the old `hostSheetCleanup` variable for both bridge + CSS cleanup
  // was the root cause of the subtitle manager sheet not closing: onOpen called
  // the bridge cleanup, removing the message listener, so __CELL_MANAGER_CLOSED
  // from the child never reached the host and the sheet stayed mounted forever).
  installManagerSheetBridge();
}
