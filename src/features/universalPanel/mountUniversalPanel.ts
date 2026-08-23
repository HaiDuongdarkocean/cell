/**
 * mountUniversalPanel — mounts the UniversalPanel React shell into a fixed
 * full-viewport shadow host on document.body.
 *
 * Uses `mountReactShadow` for CSS isolation, token/component CSS injection,
 * `ShadowThemeProvider` for theme, and automatic fullscreen re-parenting.
 * Falls back to the legacy light-DOM createRoot path via USE_LEGACY_UNIVERSAL_PANEL.
 */
import { createElement, type ReactElement } from 'react';
import { mountReactShadow } from '@/shared/lib/shadowRoot/mountReactShadow';
import { ShadowThemeProvider } from '@/shared/lib/shadowRoot/ShadowThemeProvider';
import { UniversalPanel } from './UniversalPanel';
import { SettingsTab } from './tabs/SettingsTab';
import { DictionaryTab } from './tabs/DictionaryTab';
import { createUniversalPanelController, type UniversalPanelMountController } from './UniversalPanelController';
import { getSessionStorage, setSessionStorage } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS, USE_LEGACY_UNIVERSAL_PANEL } from '@/shared/config/config';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { mountUniversalPanelLegacy } from './mountUniversalPanelLegacy';
import type { TokenizePanelState } from '@/features/tokenize/types';
import type { UniversalPanelTab, DictionaryPanelPrefill } from './types';

import universalPanelCss from './UniversalPanel.module.css?inline';
import universalPanelHeaderCss from './UniversalPanelHeader.module.css?inline';
import cardCreatorPanelCss from './tabs/CardCreatorPanel.module.css?inline';
import dictionaryTabCss from './tabs/DictionaryTab.module.css?inline';
import settingsTabCss from './tabs/SettingsTab.module.css?inline';

import popupDictionaryCss from '@/features/dictionaryPopup/ui/PopupDictionary.module.css?inline';
import dictionaryPanelViewCss from '@/features/dictionaryPopup/ui/DictionaryPanelView.module.css?inline';
import orbitalBadgeCss from '@/features/dictionaryPopup/ui/OrbitalBadge.module.css?inline';

import cardCreatorDialogCss from '@/features/cardCreator/ui/CardCreatorDialog.module.css?inline';
import queueSidebarCss from '@/features/cardCreator/ui/QueueSidebar.module.css?inline';
import mediaListCss from '@/features/cardCreator/ui/MediaList.module.css?inline';
import previewBlockCss from '@/features/cardCreator/ui/PreviewBlock.module.css?inline';
import fieldRowCss from '@/features/cardCreator/ui/FieldRow.module.css?inline';

import cardCreatorSettingsPanelCss from '@/features/settings/ui/CardCreatorSettingsPanel.module.css?inline';
import dictionaryPopupSettingsPanelCss from '@/features/settings/ui/DictionaryPopupSettingsPanel.module.css?inline';
import multiSelectCss from '@/features/settings/ui/MultiSelect.module.css?inline';
import settingsDialogCss from '@/features/settings/ui/SettingsDialog.module.css?inline';
import { appearanceShadowCss } from '@/features/subtitle/ui/appearance/appearanceShadowCss';

import colorCustomizationCss from '@/features/theme/ui/ColorCustomization.module.css?inline';
import contrastBadgesCss from '@/features/theme/ui/ContrastBadges.module.css?inline';
import modeCardsCss from '@/features/theme/ui/ModeCards.module.css?inline';
import themeImportExportCss from '@/features/theme/ui/ThemeImportExport.module.css?inline';
import themePanelCss from '@/features/theme/ui/ThemePanel.module.css?inline';
import themePreviewCss from '@/features/theme/ui/ThemePreview.module.css?inline';

import ttsVoiceManagerPanelCss from '@/features/tts/ui/TtsVoiceManagerPanel.module.css?inline';

import dropzoneCss from '@/features/dictionary/ui/Dropzone.module.css?inline';
import importProgressCss from '@/features/dictionary/ui/ImportProgress.module.css?inline';
import resourceCardCss from '@/features/dictionary/ui/ResourceCard.module.css?inline';
import resourcesPanelCss from '@/features/dictionary/ui/ResourcesPanel.module.css?inline';

import iconCss from '@/shared/icons/Icon.module.css?inline';

import accordionCss from '@/shared/ui/Accordion.module.css?inline';
import alertCss from '@/shared/ui/Alert.module.css?inline';
import badgeCss from '@/shared/ui/Badge.module.css?inline';
import bottomSheetCss from '@/shared/ui/BottomSheet.module.css?inline';
import buttonCss from '@/shared/ui/Button.module.css?inline';
import cardCss from '@/shared/ui/Card.module.css?inline';
import checkboxCss from '@/shared/ui/Checkbox.module.css?inline';
import checkboxGroupCss from '@/shared/ui/CheckboxGroup.module.css?inline';
import dialogCss from '@/shared/ui/Dialog.module.css?inline';
import drawerCss from '@/shared/ui/Drawer.module.css?inline';
import emptyStateCss from '@/shared/ui/EmptyState.module.css?inline';
import errorBoundaryCss from '@/shared/ui/ErrorBoundary.module.css?inline';
import formGroupCss from '@/shared/ui/FormGroup.module.css?inline';
import headerCss from '@/shared/ui/Header.module.css?inline';
import hintIconCss from '@/shared/ui/HintIcon.module.css?inline';
import iconButtonCss from '@/shared/ui/IconButton.module.css?inline';
import inputCss from '@/shared/ui/Input.module.css?inline';
import inputFieldCss from '@/shared/ui/InputField.module.css?inline';
import labelCss from '@/shared/ui/Label.module.css?inline';
import listItemCss from '@/shared/ui/ListItem.module.css?inline';
import navItemCss from '@/shared/ui/NavItem.module.css?inline';
import progressCss from '@/shared/ui/Progress.module.css?inline';
import radioCss from '@/shared/ui/Radio.module.css?inline';
import radioGroupCss from '@/shared/ui/RadioGroup.module.css?inline';
import searchFieldCss from '@/shared/ui/SearchField.module.css?inline';
import searchableSelectCss from '@/shared/ui/SearchableSelect.module.css?inline';
import selectCss from '@/shared/ui/Select.module.css?inline';
import shortcutInputCss from '@/shared/ui/ShortcutInput.module.css?inline';
import sidebarCss from '@/shared/ui/Sidebar.module.css?inline';
import skeletonCss from '@/shared/ui/Skeleton.module.css?inline';
import sliderCss from '@/shared/ui/Slider.module.css?inline';
import spinnerCss from '@/shared/ui/Spinner.module.css?inline';
import tabsCss from '@/shared/ui/Tabs.module.css?inline';
import textareaCss from '@/shared/ui/Textarea.module.css?inline';
import toggleCss from '@/shared/ui/Toggle.module.css?inline';
import tooltipCss from '@/shared/ui/Tooltip.module.css?inline';

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
const HOST_CLASS_NAME = 'js-cell-universal-panel-host';
const HOST_Z_INDEX = 'var(--z-overlay-secondary)';

const SHADOW_CSS = [
  universalPanelCss,
  universalPanelHeaderCss,
  cardCreatorPanelCss,
  dictionaryTabCss,
  settingsTabCss,

  popupDictionaryCss,
  dictionaryPanelViewCss,
  orbitalBadgeCss,

  cardCreatorDialogCss,
  queueSidebarCss,
  mediaListCss,
  previewBlockCss,
  fieldRowCss,

  cardCreatorSettingsPanelCss,
  dictionaryPopupSettingsPanelCss,
  multiSelectCss,
  settingsDialogCss,
  ...appearanceShadowCss,

  colorCustomizationCss,
  contrastBadgesCss,
  modeCardsCss,
  themeImportExportCss,
  themePanelCss,
  themePreviewCss,

  ttsVoiceManagerPanelCss,

  dropzoneCss,
  importProgressCss,
  resourceCardCss,
  resourcesPanelCss,

  iconCss,

  accordionCss,
  alertCss,
  badgeCss,
  bottomSheetCss,
  buttonCss,
  cardCss,
  checkboxCss,
  checkboxGroupCss,
  dialogCss,
  drawerCss,
  emptyStateCss,
  errorBoundaryCss,
  formGroupCss,
  headerCss,
  hintIconCss,
  iconButtonCss,
  inputCss,
  inputFieldCss,
  labelCss,
  listItemCss,
  navItemCss,
  progressCss,
  radioCss,
  radioGroupCss,
  searchFieldCss,
  searchableSelectCss,
  selectCss,
  shortcutInputCss,
  sidebarCss,
  skeletonCss,
  sliderCss,
  spinnerCss,
  tabsCss,
  textareaCss,
  toggleCss,
  tooltipCss,
];

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
  if (USE_LEGACY_UNIVERSAL_PANEL) {
    return mountUniversalPanelLegacy(options);
  }

  const mount = mountReactShadow(createElement('div'), {
    parent: document.body,
    position: 'fixed',
    layer: 3,
    reparentOnFullscreen: true,
    css: SHADOW_CSS,
  });

  mount.host.id = PANEL_HOST_ID;
  mount.host.className = HOST_CLASS_NAME;
  mount.host.style.cssText =
    'position:fixed;inset:0;width:auto;height:auto;box-sizing:border-box;margin:0;padding:0;border:none;background:transparent;color:var(--color-text);font-size:var(--font-size-base);line-height:normal;isolation:isolate;z-index:' +
    HOST_Z_INDEX +
    ';pointer-events:none;overflow:hidden;transform:none;';

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
    getHosts: () => [mount.host],
    unmount: () => {
      isUnmounted = true;
      controllerUnmount();
      tokenizeUnsubscribe?.();
      mount.unmount();
    },
  };

  // Default dictionary languages before settings load; updated once loadSettings resolves.
  let dictionaryLangCode = 'en';
  let dictionarySourceLang = 'en';
  let dictionaryTargetLang = 'vi';
  let languageProfiles: { readonly id: string; readonly name: string }[] = [];
  let activeProfileId: string | null = null;

  void loadSettings().then((settings) => {
    if (isUnmounted) return;
    dictionarySourceLang = settings.subtitleOverlayTargetLanguage || dictionarySourceLang;
    dictionaryTargetLang = settings.subtitleOverlayNativeLanguage || dictionaryTargetLang;
    dictionaryLangCode = dictionarySourceLang;
    languageProfiles = settings.languageProfiles.map((p) => ({ id: p.id, name: p.name }));
    activeProfileId = settings.activeProfileId;
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

  const render = (): void => {
    if (isUnmounted) return;
    const open = mountController.isOpen();
    mount.host.style.pointerEvents = open ? 'auto' : 'none';
    mount.root.render(
      createElement(
        ShadowThemeProvider,
        {
          container: mount.rootEl,
          children: createElement(UniversalPanel, {
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
            languageProfiles,
            activeProfileId,
            onProfileChange: (id: string) => {
              activeProfileId = id;
              if (!isUnmounted) render();
              void saveSettings({ activeProfileId: id });
            },
            dictionaryPanel: renderDictionaryPanel(open),
            settingsPanel,
          }) as ReactElement,
        },
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
