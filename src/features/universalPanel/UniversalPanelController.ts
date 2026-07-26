import type { UniversalPanelController, UniversalPanelTab, DictionaryPanelPrefill } from './types';

export interface UniversalPanelControllerHost {
  readonly getHosts: () => readonly HTMLElement[];
}

export type UniversalPanelMountController = UniversalPanelController & UniversalPanelControllerHost;

export interface CreateUniversalPanelControllerOptions {
  /** Tab to use before (or instead of) persistence. */
  readonly initialTab?: UniversalPanelTab;
  /** Restore the last active tab. Called once on creation and awaited by open()/switchTab(). */
  readonly getPersistedTab?: () => Promise<UniversalPanelTab | null>;
  /** Persist the active tab. */
  readonly persistTab?: (tab: UniversalPanelTab) => Promise<void>;
  /** Called when the panel opens (after the tab is resolved). */
  readonly onOpen?: (tab: UniversalPanelTab) => void;
  /** Called when the panel closes. */
  readonly onClose?: () => void;
  /** Called when the active tab changes while the panel is open or closed. */
  readonly onTabChange?: (tab: UniversalPanelTab) => void;
  /** Called when the user sends a prefill to the integrated card creator. */
  readonly onSendToCard?: (prefill: DictionaryPanelPrefill) => void;
}

export interface UniversalPanelControllerHandle {
  readonly controller: UniversalPanelMountController;
  readonly unmount: () => void;
}

/**
 * createUniversalPanelController — imperative controller for the universal panel.
 *
 * Owns open/close state, active tab, and optional session persistence. It is
 * renderer-agnostic; mountUniversalPanel wires the callbacks to a React root.
 */
export function createUniversalPanelController(
  options: CreateUniversalPanelControllerOptions = {},
): UniversalPanelControllerHandle {
  let isOpen = false;
  let activeTab: UniversalPanelTab = options.initialTab ?? 'dictionary';
  let unmounted = false;
  let persistedLoaded = false;
  let loadPromise: Promise<void> | null = null;

  const loadPersistedTab = async (): Promise<void> => {
    if (persistedLoaded || !options.getPersistedTab) return;
    if (loadPromise) return loadPromise;
    loadPromise = options.getPersistedTab().then((tab) => {
      if (tab && (tab === 'dictionary' || tab === 'settings')) {
        activeTab = tab;
      }
      persistedLoaded = true;
      loadPromise = null;
    }).catch(() => {
      persistedLoaded = true;
      loadPromise = null;
    });
    return loadPromise;
  };

  const firePersist = (tab: UniversalPanelTab): void => {
    if (options.persistTab) {
      options.persistTab(tab).catch(() => { /* session persistence is best-effort */ });
    }
  };

  const setTab = (tab: UniversalPanelTab): void => {
    activeTab = tab;
    options.onTabChange?.(tab);
  };

  const controller: UniversalPanelMountController = {
    open: async (tab) => {
      if (unmounted) return;
      await loadPersistedTab();
      if (unmounted) return;
      if (tab) {
        setTab(tab);
        firePersist(tab);
      }
      if (!isOpen) {
        isOpen = true;
      }
      options.onOpen?.(activeTab);
    },
    close: () => {
      if (unmounted || !isOpen) return;
      isOpen = false;
      options.onClose?.();
    },
    switchTab: async (tab) => {
      if (unmounted) return;
      await loadPersistedTab();
      if (unmounted) return;
      if (activeTab === tab) return;
      setTab(tab);
      firePersist(tab);
    },
    sendToCard: (prefill) => {
      if (unmounted) return Promise.resolve();
      options.onSendToCard?.(prefill);
      return controller.open('dictionary');
    },
    isOpen: () => isOpen,
    unmount: () => {
      if (unmounted) return;
      unmounted = true;
      if (isOpen) {
        isOpen = false;
        options.onClose?.();
      }
    },
    getHosts: () => [],
  };

  return {
    controller,
    unmount: () => { controller.unmount(); },
  };
}
