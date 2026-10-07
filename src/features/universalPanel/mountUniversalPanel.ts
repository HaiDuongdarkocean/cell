/**
 * mountUniversalPanel — mounts the UniversalPanel React shell into a fixed
 * full-viewport shadow host on document.body.
 *
 * Uses `mountReactShadow` for CSS isolation, token/component CSS injection,
 * `ShadowThemeProvider` for theme, and automatic fullscreen re-parenting.
 */
import { createElement, type ReactElement } from 'react';
import { mountReactShadow } from '@/shared/lib/shadowRoot/mountReactShadow';
import { allModuleCss } from '@/shared/lib/shadowRoot/allModuleCss';
import { buildTokenSpanCssForShadow } from '@/features/tokenize';
import { ShadowThemeProvider } from '@/features/theme';
import { ErrorBoundary } from '@/shared/ui';
import { UniversalPanel } from './UniversalPanel';
import { SettingsTab } from './tabs/SettingsTab';
import { DictionaryTab } from './tabs/DictionaryTab';
import { StudyModesTab } from '@/features/studyModes';
import { VocabularyTab } from '@/features/vocabulary';
import { PlaylistTab } from './tabs/PlaylistTab';
import { RecapTab } from '@/features/sessionRecap';
import {
  QueueTab,
  queueItemToPrefill,
  quickAddQueueItem,
  queueRemove,
  savePrefillToQueue,
} from '@/features/miningQueue';
import { showToast } from '@/features/subtitle';
import { addToOceanSrs } from '@/features/srs';
import { createUniversalPanelController, type UniversalPanelMountController } from './UniversalPanelController';
import { openSettingsSection } from './deepLink';
import { UNIVERSAL_PANEL_HOST_ID } from '@/shared/lib/dom/cellUiHosts';
import { getSessionStorage, setSessionStorage, onStorageChanged, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { getActiveProfileSettings, resolveProfile, type Settings } from '@/entities/settings';
import { useCardCreatorStore } from '@/features/cardCreator';
import { t } from '@/shared/i18n';
import type { TokenizePanelState } from '@/features/tokenize';
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

const HOST_CLASS_NAME = 'js-cell-universal-panel-host';
const HOST_Z_INDEX = 'var(--z-overlay-secondary)';

const SHADOW_CSS = [...allModuleCss, buildTokenSpanCssForShadow()];

async function restorePersistedTab(): Promise<UniversalPanelTab | null> {
  try {
    const data = await getSessionStorage<Record<string, string>>(STORAGE_KEYS.UNIVERSAL_PANEL_TAB);
    const tab = data[STORAGE_KEYS.UNIVERSAL_PANEL_TAB];
    return tab === 'dictionary' || tab === 'settings' || tab === 'studyModes' || tab === 'vocabulary' || tab === 'playlist' || tab === 'queue' || tab === 'recap' ? tab : null;
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
  const mount = mountReactShadow(createElement('div'), {
    parent: document.body,
    position: 'fixed',
    layer: 3,
    reparentOnFullscreen: true,
    css: SHADOW_CSS,
  });

  mount.host.id = UNIVERSAL_PANEL_HOST_ID;
  mount.host.className = HOST_CLASS_NAME;
  mount.host.style.cssText =
    'position:fixed;inset:0;width:auto;height:auto;box-sizing:border-box;margin:0;padding:0;border:none;background:transparent;color:var(--color-text);font-size:var(--font-size-base);line-height:normal;isolation:isolate;z-index:' +
    HOST_Z_INDEX +
    ';pointer-events:none;overflow:hidden;transform:none;';

  let isUnmounted = false;
  let currentTab: UniversalPanelTab = 'dictionary';

  // Card creator context pushed from popup or subtitle cluster via sendToCard().
  // The whole DictionaryPanelPrefill — including the popup selection snapshot
  // (selectedImageIds/selectedAudioIds/selectedDefinitionIds/translationSelected)
  // — is stored and forwarded to DictionaryTab so the integrated Dictionary can
  // initialize as a clone of the popup.
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
      // Close without clearing the card creator context so the unsaved draft
      // survives a close → reopen cycle. The one-shot search term is cleared
      // so a reopened panel does not replay the previous lookup.
      pendingSearchTerm = null;
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
    onLookup: (term) => {
      pendingSearchTerm = term;
    },
  });

  const mountController: UniversalPanelMountController = {
    ...controller,
    getHosts: () => [mount.host],
    unmount: () => {
      isUnmounted = true;
      removeOnStorageChangedListener(onSettingsStorageChange);
      controllerUnmount();
      tokenizeUnsubscribe?.();
      mount.unmount();
    },
  };

  // Default dictionary languages before settings load; updated once loadSettings resolves.
  let dictionaryLangCode = 'en';
  let dictionarySourceLang = 'en';
  let dictionaryTargetLang = 'vi';
  let languageProfiles: { readonly id: string; readonly name: string; readonly target: string }[] = [];
  let activeProfileId: string | null = null;
  let loadedSettings: Settings | null = null;

  const applySettings = (settings: Settings): void => {
    if (isUnmounted) return;
    loadedSettings = settings;
    dictionarySourceLang = settings.subtitleOverlayTargetLanguage || dictionarySourceLang;
    dictionaryTargetLang = settings.subtitleOverlayNativeLanguage || dictionaryTargetLang;
    dictionaryLangCode = getActiveProfileSettings(settings)?.resourceLangCode ?? dictionarySourceLang;
    languageProfiles = settings.languageProfiles.map((p) => ({ id: p.id, name: p.name, target: p.target }));
    activeProfileId = settings.activeProfileId;
    render();
  };

  void loadSettings().then(applySettings);

  const onSettingsStorageChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    if (area !== 'local' || !(STORAGE_KEYS.SETTINGS in changes)) return;
    void loadSettings().then(applySettings);
  };
  onStorageChanged(onSettingsStorageChange);

  const renderDictionaryPanel = (open: boolean): ReactElement =>
    createElement(DictionaryTab, {
      langCode: dictionaryLangCode,
      sourceLang: dictionarySourceLang,
      targetLang: dictionaryTargetLang,
      initialTerm: pendingSearchTerm ?? options.dictionary?.initialTerm,
      isOpen: open,
      prefill: pendingCardCreatorContext,
      onOpenSettings: () => { void openSettingsSection(mountController, 'resources'); },
      onSaveToQueue: (prefill) => {
        savePrefillToQueue(prefill, {
          sourceLabel: typeof document !== 'undefined' ? document.title || undefined : undefined,
          notify: (message, variant) => queueToast(message, variant),
        });
      },
      onAfterSubmit: () => {
        const queueItemId = pendingCardCreatorContext?.queueItemId;
        if (queueItemId) {
          void queueRemove(queueItemId).catch(() => {});
        }
        const store = useCardCreatorStore.getState();
        const { queueItems, queueActiveIndex } = store;
        const remaining = queueItems.filter((_, i) => i !== queueActiveIndex);

        if (remaining.length > 0) {
          store.reset();
          store.setQueueItems(remaining);
          store.setQueueSidebarOpen(true);
          pendingCardCreatorContext = null;
          pendingSearchTerm = null;
          render();
          return;
        }

        store.reset();
        pendingCardCreatorContext = null;
        pendingSearchTerm = null;
        mountController.close();
      },
    }) as ReactElement;

  const renderVocabularyPanel = (): ReactElement =>
    createElement(ErrorBoundary, null, createElement(VocabularyTab, {
      langCode: dictionaryLangCode,
      onLookup: (term: string) => { void mountController.openDictionaryLookup(term); },
    })) as ReactElement;

  const studyModesPanel = createElement(ErrorBoundary, null, createElement(StudyModesTab)) as ReactElement;
  const settingsPanel = createElement(ErrorBoundary, null, createElement(SettingsTab)) as ReactElement;

  // `isActive` is the pane lifecycle signal (up-tab-layout-contract): a kept-alive
  // `.tabPane[hidden]` subtree must produce no user-perceivable output, so tabs
  // with live resources bind the prop at element creation — same seam as
  // `renderDictionaryPanel(open)`.
  const renderPlaylistPanel = (isActive: boolean): ReactElement =>
    createElement(ErrorBoundary, null, createElement(PlaylistTab, { isActive })) as ReactElement;

  const renderRecapPanel = (isActive: boolean): ReactElement =>
    createElement(ErrorBoundary, null, createElement(RecapTab, {
      isActive,
      onLookup: (term: string) => { void mountController.openDictionaryLookup(term); },
    })) as ReactElement;

  const queueToast = (message: string, variant: 'info' | 'success' | 'error'): void => {
    showToast(message, mount.rootEl, { variant });
  };

  const renderQueuePanel = (): ReactElement =>
    createElement(ErrorBoundary, null, createElement(QueueTab, {
      onCardify: (item) => {
        void mountController.sendToCard(queueItemToPrefill(item)).catch((err: unknown) => {
          queueToast(err instanceof Error ? err.message : String(err), 'error');
        });
      },
      onQuickAdd: (item) => {
        void (async () => {
          try {
            const destination = await quickAddQueueItem(item, (msg) => queueToast(msg, 'info'), addToOceanSrs);
            await queueRemove(item.id);
            queueToast(t('queue.added', [destination === 'ocean-srs' ? 'Ocean SRS' : 'Anki']), 'success');
          } catch (err) {
            queueToast(err instanceof Error ? err.message : String(err), 'error');
          }
        })();
      },
      onActionError: (message) => queueToast(message, 'error'),
    })) as ReactElement;

  // ADR-061: tokenize state lives in the universal header (above content),
  // not in the Settings tab. Subscribe at mount level so header re-renders
  // on tokenize state changes without re-mounting the panel.
  let tokenizeState: TokenizePanelState = options.panel?.getState() ?? {
    enabled: false,
    showStatus: false,
    showFrequency: false,
    subtitleEnabled: false,
  };

  const render = (): void => {
    if (isUnmounted) return;
    const open = mountController.isOpen();
    mount.host.style.pointerEvents = open ? 'auto' : 'none';
    // ponytail: naive hasMedia detection via document.querySelector('video').
    // Covers HTML5 players in the top-level document; does not detect videos
    // inside cross-origin iframes or some custom players. Upgrade when needed.
    const hasMedia = typeof document !== 'undefined' && document.querySelector('video') !== null;
    mount.root.render(
      createElement(
        ShadowThemeProvider,
        { container: mount.rootEl },
        createElement(UniversalPanel, {
          isOpen: open,
          activeTab: currentTab,
          onTabChange: (tab: UniversalPanelTab) => {
            void controller.switchTab(tab);
          },
          onClose: () => controller.close(),
          tokenizeState,
          hasMedia,
          onToggleTokenize: (key: 'enabled' | 'showStatus' | 'showFrequency' | 'subtitleEnabled') => {
            options.panel?.onToggle(key);
          },
          languageProfiles,
          activeProfileId,
          onProfileChange: (id: string) => {
            activeProfileId = id;
            // Re-point dictionary/card-creator languages at the new profile
            // immediately — saveSettings only fixes the flattened fields for
            // the NEXT load; the mounted panel would otherwise keep looking
            // up the previous profile's language until remount.
            const next = loadedSettings?.languageProfiles.find((p) => p.id === id);
            if (next && loadedSettings) {
              const resolved = resolveProfile(next, loadedSettings.universalNativeLanguage);
              dictionarySourceLang = resolved.target;
              dictionaryTargetLang = resolved.native;
              dictionaryLangCode = resolved.resourceLangCode;
            }
            if (!isUnmounted) render();
            void saveSettings({ activeProfileId: id });
          },
          dictionaryPanel: renderDictionaryPanel(open),
          vocabularyPanel: renderVocabularyPanel(),
          studyModesPanel,
          settingsPanel,
          playlistPanel: renderPlaylistPanel(open && currentTab === 'playlist'),
          queuePanel: renderQueuePanel(),
          recapPanel: renderRecapPanel(open && currentTab === 'recap'),
        }) as ReactElement,
      ) as ReactElement,
    );
  };

  // Subscribe AFTER render is defined — subscribe callback fires synchronously
  // (cb(buildPanelState()) in content-script.ts), so render must be initialized
  // first to avoid TDZ (Temporal Dead Zone) ReferenceError.
  const tokenizeUnsubscribe = options.panel?.subscribe((next) => {
    tokenizeState = next;
    render();
  }) ?? null;

  // Initial render (closed; persisted tab loads in background and updates state).
  render();

  return mountController;
}
