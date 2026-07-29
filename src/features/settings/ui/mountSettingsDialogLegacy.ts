/**
 * mountSettingsDialogLegacy — previous light-DOM SettingsDialog mount.
 *
 * Kept for `USE_LEGACY_SETTINGS` fallback only. It mounts into a fixed
 * overlay host on `document.body`, injects theme tokens into the light DOM,
 * and does its own fullscreen re-parenting.
 */
import { createRoot, type Root } from 'react-dom/client';
import { createElement, type ReactElement } from 'react';
import { SettingsDialog } from './SettingsDialog';
import { syncElementTheme, injectThemeTokens, THEME_STYLE_ID } from '@/shared/lib/themeTokens';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { onStorageChanged, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
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

export function mountSettingsDialogLegacy(
  options: SettingsDialogMountOptions,
): SettingsDialogMountController {
  const host = document.createElement('div');
  host.id = 'cell-settings-dialog-host-legacy';
  host.className = 'js-cell-settings-dialog-host-legacy';
  host.style.cssText =
    'position:fixed;inset:0;width:auto;height:auto;box-sizing:border-box;margin:0;padding:0;border:none;background:transparent;color:var(--color-text);font-size:var(--font-size-base);line-height:normal;isolation:isolate;z-index:var(--z-overlay-settings);pointer-events:none;overflow:hidden;transform:none;';
  document.body.appendChild(host);

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

  let tokenStyleCleanup: (() => void) | null = null;
  if (!document.getElementById(THEME_STYLE_ID)) {
    const throwaway = document.createElement('div');
    tokenStyleCleanup = injectThemeTokens(throwaway);
  }

  const themeSyncCleanup = syncElementTheme(host, document.body);

  const focusOverride = document.createElement('style');
  focusOverride.textContent = [
    `#${host.id} * { -webkit-tap-highlight-color: transparent; }`,
    `#${host.id} *:focus, #${host.id} *:focus-visible { outline: none !important; }`,
    `#${host.id} button:active, #${host.id} [role="switch"]:active { color: inherit !important; }`,
  ].join('\n');
  host.appendChild(focusOverride);

  const rootEl = document.createElement('div');
  rootEl.style.cssText =
    'width:100%;height:100%;pointer-events:none;margin:0;padding:0;border:none;background:transparent;color:currentColor;font-size:var(--font-size-base);line-height:normal;';
  host.appendChild(rootEl);

  let open = false;
  let settings: Settings | null = null;
  let root: Root | null = createRoot(rootEl);

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
    if (!root || !settings) return;
    rootEl.style.pointerEvents = open ? 'auto' : 'none';
    root.render(
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
    );
  };

  render();

  return {
    open: () => {
      const fsEl = document.fullscreenElement;
      if (fsEl && fsEl !== host.parentElement) {
        fsEl.appendChild(host);
        moveThemeStyleInto(fsEl);
      }
      open = true;
      render();
    },
    close: () => {
      open = false;
      render();
    },
    isOpen: () => open,
    unmount: () => {
      if (root) { root.unmount(); root = null; }
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      removeOnStorageChangedListener(onStorageChange);
      restoreThemeStyleToHead();
      themeSyncCleanup?.();
      tokenStyleCleanup?.();
      host.remove();
    },
  };
}
