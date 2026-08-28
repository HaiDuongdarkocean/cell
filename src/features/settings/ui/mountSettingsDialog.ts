/**
 * mountSettingsDialog — mounts the SettingsDialog React component into a fixed
 * overlay host inside an open Shadow DOM root.
 *
 * Uses `mountReactShadow` to get CSS isolation, token/component CSS injection,
 * `ShadowThemeProvider` for theme, and automatic fullscreen re-parenting.
 */
import { createElement, type ReactElement } from 'react';
import { mountReactShadow } from '@/shared/lib/shadowRoot/mountReactShadow';
import { ShadowThemeProvider } from '@/shared/lib/shadowRoot/ShadowThemeProvider';
import { SettingsDialog } from './SettingsDialog';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { onStorageChanged, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS, USE_LEGACY_SETTINGS } from '@/shared/config/config';
import { mountSettingsDialogLegacy } from './mountSettingsDialogLegacy';
import type { Settings } from '@/entities/media';

import apiKeyManagerCss from '@/features/settings/ui/ApiKeyManager.module.css?inline';
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

export interface SettingsDialogMountOptions {
  /** Called when the dialog closes (badge click-outside / Escape / close btn). */
  readonly onClose: () => void;
}

export interface SettingsDialogMountController {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  unmount: () => void;
}

const SHADOW_CSS = [
  apiKeyManagerCss,
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

/**
 * Mount the Settings dialog into a fixed full-viewport shadow host.
 * Returns a controller to open/close + unmount.
 */
export function mountSettingsDialog(
  options: SettingsDialogMountOptions,
): SettingsDialogMountController {
  if (USE_LEGACY_SETTINGS) {
    return mountSettingsDialogLegacy(options);
  }

  const mount = mountReactShadow(createElement('div'), {
    parent: document.body,
    position: 'fixed',
    layer: 4,
    reparentOnFullscreen: true,
    css: SHADOW_CSS,
  });

  mount.host.id = 'cell-settings-dialog-host';
  mount.host.className = 'js-cell-settings-dialog-host';
  mount.host.style.cssText =
    'position:fixed;inset:0;width:auto;height:auto;box-sizing:border-box;margin:0;padding:0;border:none;background:transparent;color:var(--color-text);font-size:var(--font-size-base);line-height:normal;isolation:isolate;z-index:var(--z-overlay-settings);pointer-events:none;overflow:hidden;transform:none;';

  let open = false;
  let settings: Settings | null = null;

  // Load settings asynchronously + listen for external changes.
  void loadSettings().then((s) => {
    settings = s;
    render();
  });

  const onStorageChange = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area !== 'local') return;
    if (STORAGE_KEYS.SETTINGS in changes) {
      void loadSettings().then((s) => { settings = s; render(); });
    }
  };
  onStorageChanged(onStorageChange);

  const render = (): void => {
    if (!settings) return;
    mount.host.style.pointerEvents = open ? 'auto' : 'none';
    mount.root.render(
      createElement(
        ShadowThemeProvider,
        {
          container: mount.rootEl,
          children: createElement(SettingsDialog, {
            isOpen: open,
            settings,
            onChange: (next: Settings) => {
              settings = next;
              void saveSettings(next);
              render();
            },
            onClose: () => {
              open = false;
              render();
              options.onClose();
            },
          }) as ReactElement,
        },
      ) as ReactElement,
    );
  };

  render();

  return {
    open: () => {
      open = true;
      render();
    },
    close: () => {
      open = false;
      render();
    },
    isOpen: () => open,
    unmount: () => {
      removeOnStorageChangedListener(onStorageChange);
      mount.unmount();
    },
  };
}
