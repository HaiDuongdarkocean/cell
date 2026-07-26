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
import { SettingsTab } from './tabs/SettingsTab';
import { DictionaryTab } from './tabs/DictionaryTab';
import { createUniversalPanelController, type UniversalPanelMountController } from './UniversalPanelController';
import { syncElementTheme, injectThemeTokens, THEME_STYLE_ID } from '@/shared/lib/themeTokens';
import { getSessionStorage, setSessionStorage } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import type { UniversalPanelTab, DictionaryPanelPrefill } from './types';
import type { OrbitalBadgePanelState } from '@/features/dictionaryPopup/badgePointer/createOrbitalBadge';

export interface UniversalPanelMountOptions {
  /** Tokenize state + callbacks forwarded to the Settings tab. */
  readonly panel?: {
    readonly getState: () => OrbitalBadgePanelState;
    readonly onToggle: (key: 'enabled' | 'showStatus' | 'showFrequency') => void;
    readonly onOpenDictionary: () => void;
    readonly subscribe: (cb: (state: OrbitalBadgePanelState) => void) => () => void;
  };
  /** Dictionary tab configuration. */
  readonly dictionary?: {
    /** Initial term to search when the Dictionary tab opens. */
    readonly initialTerm?: string;
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

  // Prefill pushed from an external popup dictionary via sendToCard().
  // The prefill persists while the panel is open so the right pane survives
  // tab switches; the one-shot search term is cleared after the first open.
  let pendingPrefill: DictionaryPanelPrefill | null = null;
  let pendingSearchTerm: string | null = null;

  function clearPendingOneShots(): void {
    pendingSearchTerm = null;
  }

  const { controller, unmount: controllerUnmount } = createUniversalPanelController({
    getPersistedTab: restorePersistedTab,
    persistTab,
    onOpen: (tab) => {
      currentTab = tab;
      render();
      clearPendingOneShots();
    },
    onClose: () => {
      pendingPrefill = null;
      clearPendingOneShots();
      options.onClose?.();
      render();
    },
    onTabChange: (tab) => {
      currentTab = tab;
      render();
    },
    onSendToCard: (prefill) => {
      pendingPrefill = prefill;
      pendingSearchTerm = prefill.term;
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

  // Default dictionary languages before settings load; updated once loadSettings resolves.
  let dictionaryLangCode = 'en';
  let dictionarySourceLang = 'en';
  let dictionaryTargetLang = 'vi';

  void loadSettings().then((settings) => {
    dictionarySourceLang = settings.subtitleOverlayTargetLanguage || dictionarySourceLang;
    dictionaryTargetLang = settings.subtitleOverlayNativeLanguage || dictionaryTargetLang;
    dictionaryLangCode = dictionarySourceLang;
    render();
  });

  const renderDictionaryPanel = (open: boolean): ReactElement =>
    createElement(DictionaryTab, {
      langCode: dictionaryLangCode,
      sourceLang: dictionarySourceLang,
      targetLang: dictionaryTargetLang,
      initialTerm: pendingSearchTerm ?? options.dictionary?.initialTerm,
      isOpen: open,
      prefill: pendingPrefill,
    }) as ReactElement;

  const settingsPanel = createElement(
    SettingsTab,
    {
      tokenize: options.panel
        ? {
            getState: options.panel.getState,
            onToggle: options.panel.onToggle,
            subscribe: options.panel.subscribe,
          }
        : undefined,
      onOpenDictionary: () => { void controller.open('dictionary'); },
    },
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
        dictionaryPanel: renderDictionaryPanel(open),
        settingsPanel,
      }) as ReactElement,
    );
  };

  // Initial render (closed; persisted tab loads in background and updates state).
  render();

  return mountController;
}
