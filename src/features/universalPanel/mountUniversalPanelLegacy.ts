/**
 * mountUniversalPanelLegacy — light-DOM createRoot version of the universal panel
 * mount. Kept for the USE_LEGACY_UNIVERSAL_PANEL fallback (ADR-075).
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
import type { TokenizePanelState } from '@/features/tokenize/types';
import type { UniversalPanelTab, DictionaryPanelPrefill } from './types';

export interface UniversalPanelMountOptions {
  /** Tokenize state + callbacks forwarded to the Settings tab. */
  readonly panel?: {
    readonly getState: () => TokenizePanelState;
    readonly onToggle: (key: 'enabled' | 'showStatus' | 'showFrequency' | 'subtitleEnabled') => void;
    readonly onOpenDictionary: () => void;
    readonly subscribe: (cb: (state: TokenizePanelState) => void) => () => void;
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
const HOST_Z_INDEX = 'var(--z-overlay-secondary)';

/**
 * Create a fixed full-viewport host for the universal panel.
 * The host sits below the orbital badge z-index (var(--z-overlay-top)) per ADR-065.
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
export function mountUniversalPanelLegacy(options: UniversalPanelMountOptions = {}): UniversalPanelMountController {
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
  let isUnmounted = false;
  let currentTab: UniversalPanelTab = 'dictionary';

  // Card creator context pushed from popup or subtitle cluster via sendToCard().
  // It persists while the panel is open so the right pane survives tab switches;
  // the one-shot search term is cleared after the first open.
  let pendingCardCreatorContext: DictionaryPanelPrefill | null = null;
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
      pendingCardCreatorContext = null;
      clearPendingOneShots();
      options.onClose?.();
      render();
    },
    onTabChange: (tab) => {
      currentTab = tab;
      render();
    },
    onSendToCard: (context) => {
      pendingCardCreatorContext = context;
      pendingSearchTerm = context.term ?? null;
    },
  });

  const mountController: UniversalPanelMountController = {
    ...controller,
    getHosts: () => [host],
    unmount: () => {
      isUnmounted = true;
      controllerUnmount();
      tokenizeUnsubscribe?.();
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
    if (isUnmounted) return;
    dictionarySourceLang = settings.subtitleOverlayTargetLanguage || dictionarySourceLang;
    dictionaryTargetLang = settings.subtitleOverlayNativeLanguage || dictionaryTargetLang;
    dictionaryLangCode = dictionarySourceLang;
    if (!isUnmounted) render();
  });

  const renderDictionaryPanel = (open: boolean): ReactElement =>
    createElement(DictionaryTab, {
      langCode: dictionaryLangCode,
      sourceLang: dictionarySourceLang,
      targetLang: dictionaryTargetLang,
      initialTerm: pendingSearchTerm ?? options.dictionary?.initialTerm,
      isOpen: open,
      prefill: pendingCardCreatorContext,
    }) as ReactElement;

  const settingsPanel = createElement(SettingsTab) as ReactElement;

  // ADR-061: tokenize state lives in the universal header (above content),
  // not in the Settings tab. Subscribe at mount level so header re-renders
  // on tokenize state changes without re-mounting the panel.
  let tokenizeState: TokenizePanelState = options.panel?.getState() ?? {
    enabled: false,
    showStatus: false,
    showFrequency: false,
    subtitleEnabled: false,
  };
  const tokenizeUnsubscribe = options.panel?.subscribe((next) => {
    tokenizeState = next;
    render();
  }) ?? null;

  const render = (): void => {
    if (isUnmounted || !root) return;
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
        tokenizeState,
        onToggleTokenize: (key: 'enabled' | 'showStatus' | 'showFrequency' | 'subtitleEnabled') => {
          options.panel?.onToggle(key);
        },
        dictionaryPanel: renderDictionaryPanel(open),
        settingsPanel,
      }) as ReactElement,
    );
  };

  // Initial render (closed; persisted tab loads in background and updates state).
  render();

  return mountController;
}
