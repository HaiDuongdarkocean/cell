import { runOncePerDocument } from '@/shared/lib/dom/claimSingletonInstall';
import {
  installManagerSheetBridge,
  setHostSheetCallbacks,
  sendManagerActionToChild,
  sendManagerCloseToChild,
} from '@/features/subtitle/logic/iframeManagerBridgeHost';
import type { SerializedManagerState, ManagerAction } from '@/features/subtitle/logic/iframeManagerBridgeTypes';

interface SheetRenderDeps {
  createElement: typeof import('react').createElement;
  mountReactShadow: typeof import('@/shared/lib/shadowRoot/mountReactShadow').mountReactShadow;
  HostManagerSheet: typeof import('@/features/subtitle/ui/HostManagerSheet').HostManagerSheet;
  ShadowThemeProvider: typeof import('@/features/theme/ui/ShadowThemeProvider').ShadowThemeProvider;
  hostManagerSheetShadowCss: string[];
}

// Host-side manager sheet bridge — renders bottom sheet on host page
// when a cross-origin child iframe requests it (mobile scenario where the
// iframe cannot expand its own overlay beyond its viewport).
export function installHostManagerSheet(): void {
  runOncePerDocument('host-manager-sheet', installHostManagerSheetOnce);
}

function installHostManagerSheetOnce(): void {
  let depsPromise: Promise<SheetRenderDeps> | null = null;
  const loadDeps = (): Promise<SheetRenderDeps> =>
    (depsPromise ??= Promise.all([
      import('react'),
      import('@/shared/lib/shadowRoot/mountReactShadow'),
      import('@/features/subtitle/ui/HostManagerSheet'),
      import('@/features/theme/ui/ShadowThemeProvider'),
      import('@/features/subtitle/ui/hostManagerSheetShadowCss'),
    ]).then(([react, mount, sheet, theme, sheetCss]) => ({
      createElement: react.createElement,
      mountReactShadow: mount.mountReactShadow,
      HostManagerSheet: sheet.HostManagerSheet,
      ShadowThemeProvider: theme.ShadowThemeProvider,
      hostManagerSheetShadowCss: sheetCss.hostManagerSheetShadowCss,
    })));

  let sheetMount: ReturnType<SheetRenderDeps['mountReactShadow']> | null = null;
  let currentFrameSrc = '';
  let currentState: SerializedManagerState | null = null;

  function renderHostSheet(deps: SheetRenderDeps): void {
    if (!sheetMount || !currentState) return;
    const frameSrc = currentFrameSrc;
    sheetMount.root.render(
      deps.createElement(
        deps.ShadowThemeProvider,
        { container: sheetMount.rootEl },
        deps.createElement(deps.HostManagerSheet, {
          state: currentState,
          onAction: (action: ManagerAction, args: Record<string, unknown>) =>
            sendManagerActionToChild(frameSrc, action, args),
          onClose: () => sendManagerCloseToChild(frameSrc),
        }),
      ),
    );
  }

  function closeSheet(): void {
    sheetMount?.unmount();
    sheetMount = null;
    currentFrameSrc = '';
    currentState = null;
  }

  setHostSheetCallbacks({
    onOpen: (state: SerializedManagerState, frameSrc: string): void => {
      closeSheet();

      currentFrameSrc = frameSrc;
      currentState = state;

      void loadDeps().then((deps) => {
        if (currentState !== state) return;
        const m = deps.mountReactShadow(
          deps.createElement(deps.HostManagerSheet, {
            state,
            onAction: (action: ManagerAction, args: Record<string, unknown>) =>
              sendManagerActionToChild(frameSrc, action, args),
            onClose: () => sendManagerCloseToChild(frameSrc),
          }),
          {
            provider: deps.ShadowThemeProvider,
            css: deps.hostManagerSheetShadowCss,
          },
        );
        sheetMount = m;
        m.host.id = 'Tihoka-host-manager-sheet';
        m.host.style.cssText =
          'position:fixed;inset:0;pointer-events:auto;z-index:2147483647;';
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
      closeSheet();
    },
  });

  // Bridge lives for the page lifecycle — never cleaned up (the accidental
  // reuse of the old `hostSheetCleanup` variable for both bridge + CSS cleanup
  // was the root cause of the subtitle manager sheet not closing: onOpen called
  // the bridge cleanup, removing the message listener, so __Tihoka_MANAGER_CLOSED
  // from the child never reached the host and the sheet stayed mounted forever).
  installManagerSheetBridge();
}
