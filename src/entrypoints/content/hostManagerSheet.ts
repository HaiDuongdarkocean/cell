import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import {
  installManagerSheetBridge,
  setHostSheetCallbacks,
  sendManagerActionToChild,
  sendManagerCloseToChild,
} from '@/features/subtitle/logic/iframeManagerBridgeHost';
import { HostManagerSheet } from '@/features/subtitle/ui/HostManagerSheet';
import { ShadowThemeProvider } from '@/features/theme/ui/ShadowThemeProvider';
import { injectShadowCss } from '@/shared/lib/shadowRoot/injectShadowCss';
import { hostManagerSheetShadowCss } from '@/features/subtitle/ui/hostManagerSheetShadowCss';
import type { SerializedManagerState, ManagerAction } from '@/features/subtitle/logic/iframeManagerBridgeTypes';

// Host-side manager sheet bridge — renders bottom sheet on host page
// when a cross-origin child iframe requests it (mobile scenario where the
// iframe cannot expand its own overlay beyond its viewport).
export function installHostManagerSheet(): void {
  let hostSheetRoot: ReturnType<typeof createRoot> | null = null;
  let hostSheetHost: HTMLDivElement | null = null;
  let hostSheetInner: HTMLDivElement | null = null;
  let sheetCssCleanup: (() => void) | null = null;
  let currentFrameSrc = '';
  let currentState: SerializedManagerState | null = null;

  function renderHostSheet(): void {
    if (!hostSheetRoot || !currentState || !hostSheetInner) return;
    const frameSrc = currentFrameSrc;
    hostSheetRoot.render(
      createElement(
        ShadowThemeProvider,
        { container: hostSheetInner },
        createElement(HostManagerSheet, {
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

      const shadow = hostSheetHost.attachShadow({ mode: 'open' });
      sheetCssCleanup = injectShadowCss(shadow, { css: hostManagerSheetShadowCss });

      hostSheetInner = document.createElement('div');
      hostSheetInner.style.display = 'contents';
      shadow.appendChild(hostSheetInner);

      hostSheetRoot = createRoot(hostSheetInner);
      renderHostSheet();
    },
    onStateUpdate: (partialState: Partial<SerializedManagerState>, _frameSrc: string): void => {
      if (!currentState) return;
      currentState = { ...currentState, ...partialState };
      renderHostSheet();
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
