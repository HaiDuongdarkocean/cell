/**
 * mountUniversalPanel — mounts the UniversalPanel React shell into a fixed
 * full-viewport host on document.body.
 *
 * Follows the same mount pattern as mountSettingsDialog / mountCardCreatorDialog
 * (ADR-022/026): fixed host, createRoot, theme token injection, fullscreen
 * re-parenting, and a returned imperative controller.
 */
import { createRoot, type Root } from 'react-dom/client';
import { createElement, type ReactElement } from 'react';
import { UniversalPanel } from './UniversalPanel';
import { createUniversalPanelController, type UniversalPanelMountController } from './UniversalPanelController';
import { syncElementTheme, injectThemeTokens, THEME_STYLE_ID } from '@/shared/lib/themeTokens';
import { getSessionStorage, setSessionStorage } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import type { UniversalPanelTab } from './types';
import type { OrbitalBadgePanelState } from '@/features/dictionaryPopup/badgePointer/createOrbitalBadge';

export interface UniversalPanelMountOptions {
  /** Tokenize state + callbacks forwarded to the Settings tab. */
  readonly panel?: {
    readonly getState: () => OrbitalBadgePanelState;
    readonly onToggle: (key: 'enabled' | 'showStatus' | 'showFrequency') => void;
    readonly onOpenDictionary: () => void;
    readonly subscribe: (cb: (state: OrbitalBadgePanelState) => void) => () => void;
  };
  /** Called when the panel closes. */
  readonly onClose?: () => void;
}

const PANEL_HOST_ID = 'cell-universal-panel-host';
const HOST_Z_INDEX = '2147483646';

/**
 * Create a fixed full-viewport host for the universal panel.
 * The host sits below the orbital badge z-index (2147483647) per ADR-065.
 */
function createHost(): HTMLElement {
  const host = document.createElement('div');
  host.id = PANEL_HOST_ID;
  host.style.cssText =
    'position:fixed;inset:0;width:auto;height:auto;box-sizing:border-box;margin:0;padding:0;border:none;background:transparent;color:var(--color-text);font-size:var(--font-size-base);line-height:normal;isolation:isolate;z-index:' +
    HOST_Z_INDEX +
    ';pointer-events:none;overflow:hidden;transform:none;';
  document.body.appendChild(host);
  return host;
}

async function restorePersistedTab(): Promise<UniversalPanelTab | null> {
  try {
    const data = await getSessionStorage<Record<string, string>>(STORAGE_KEYS.UNIVERSAL_PANEL_TAB);
    const tab = data[STORAGE_KEYS.UNIVERSAL_PANEL_TAB];
    return tab === 'dictionary' || tab === 'settings' ? tab : null;
  } catch {
    return null;
  }
}

function persistTab(tab: UniversalPanelTab): Promise<void> {
  return setSessionStorage({ [STORAGE_KEYS.UNIVERSAL_PANEL_TAB]: tab }).catch(() => {
    /* session persistence is best-effort */
  });
}

/**
 * Mount the universal panel into the page and return a controller that can
 * open/close/switch-tab/unmount it.
 */
export function mountUniversalPanel(options: UniversalPanelMountOptions = {}): UniversalPanelMountController {
  const host = createHost();

  // Fullscreen support: move the host + theme style into the fullscreen element
  // when the browser enters fullscreen, so the panel remains visible over the
  // video player (ADR-026).
  const moveThemeStyleInto = (parent: Element): void => {
    const style = document.getElementById(THEME_STYLE_ID);
    if (style && style.parentElement !== parent) parent.appendChild(style);
  };
  const restoreThemeStyleToHead = (): void => {
    const style = document.getElementById(THEME_STYLE_ID);
    if (style && style.parentElement !== document.head) document.head.appendChild(style);
  };
  const onFullscreenChange = (): void => {
    const fsEl = document.fullscreenElement;
    if (fsEl && fsEl !== host.parentElement) {
      fsEl.appendChild(host);
      moveThemeStyleInto(fsEl);
    } else if (!fsEl && host.parentElement !== document.body) {
      document.body.appendChild(host);
      restoreThemeStyleToHead();
    }
  };
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  // Ensure global theme tokens exist and sync data-theme from document.body.
  let tokenStyleCleanup: (() => void) | null = null;
  if (!document.getElementById(THEME_STYLE_ID)) {
    const throwaway = document.createElement('div');
    tokenStyleCleanup = injectThemeTokens(throwaway);
  }
  const themeSyncCleanup = syncElementTheme(host, document.body);

  const rootEl = document.createElement('div');
  rootEl.style.cssText =
    'width:100%;height:100%;pointer-events:none;margin:0;padding:0;border:none;background:transparent;color:currentColor;font-size:var(--font-size-base);line-height:normal;';
  host.appendChild(rootEl);

  let root: Root | null = createRoot(rootEl);
  let currentTab: UniversalPanelTab = 'dictionary';

  const { controller, unmount: controllerUnmount } = createUniversalPanelController({
    getPersistedTab: restorePersistedTab,
    persistTab,
    onOpen: (tab) => {
      currentTab = tab;
      render();
    },
    onClose: () => {
      options.onClose?.();
      render();
    },
    onTabChange: (tab) => {
      currentTab = tab;
      render();
    },
  });

  const mountController: UniversalPanelMountController = {
    ...controller,
    getHosts: () => [host],
    unmount: () => {
      controllerUnmount();
      if (root) {
        root.unmount();
        root = null;
      }
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      restoreThemeStyleToHead();
      themeSyncCleanup?.();
      tokenStyleCleanup?.();
      host.remove();
    },
  };

  const placeholderDictionary = createElement(
    'div',
    { 'data-testid': 'universal-panel-dictionary-placeholder' },
    'Dictionary',
  ) as ReactElement;

  const placeholderSettings = createElement(
    'div',
    { 'data-testid': 'universal-panel-settings-placeholder' },
    'Settings',
  ) as ReactElement;

  const render = (): void => {
    if (!root) return;
    const open = mountController.isOpen();
    rootEl.style.pointerEvents = open ? 'auto' : 'none';
    root.render(
      createElement(UniversalPanel, {
        isOpen: open,
        activeTab: currentTab,
        onTabChange: (tab: UniversalPanelTab) => {
          void controller.switchTab(tab);
        },
        onClose: () => controller.close(),
        dictionaryPanel: placeholderDictionary,
        settingsPanel: placeholderSettings,
      }) as ReactElement,
    );
  };

  // Initial render (closed; persisted tab loads in background and updates state).
  render();

  return mountController;
}
