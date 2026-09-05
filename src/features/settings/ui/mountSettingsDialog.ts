/**
 * mountSettingsDialog — mounts the SettingsDialog React component into a fixed
 * overlay host inside an open Shadow DOM root.
 *
 * Uses `mountReactShadow` to get CSS isolation, token/component CSS injection,
 * `ShadowThemeProvider` for theme, and automatic fullscreen re-parenting.
 */
import { createElement, type ReactElement } from 'react';
import { mountReactShadow } from '@/shared/lib/shadowRoot/mountReactShadow';
import { allModuleCss } from '@/shared/lib/shadowRoot/allModuleCss';
import { ShadowThemeProvider } from '@/shared/lib/shadowRoot/ShadowThemeProvider';
import { SettingsDialog } from './SettingsDialog';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { onStorageChanged, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS, USE_LEGACY_SETTINGS } from '@/shared/config/config';
import { mountSettingsDialogLegacy } from './mountSettingsDialogLegacy';
import type { Settings } from '@/entities/media';







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

const SHADOW_CSS = allModuleCss;

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
        { container: mount.rootEl },
        createElement(SettingsDialog, {
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
