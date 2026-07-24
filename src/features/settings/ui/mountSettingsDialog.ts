/**
 * mountSettingsDialog — mounts the SettingsDialog React component into a fixed
 * overlay host appended to `document.body`.
 *
 * Follows the same pattern as mountCardCreatorDialog (ADR-022/026): a
 * full-viewport `position: fixed` host with a high z-index so the dialog
 * floats above the page. The host is NOT inside the orbital badge's Shadow
 * DOM — CSS module styles from SettingsDialog.module.css are injected into
 * `document.head` by Vite and only apply in the light DOM.
 *
 * The orbital badge's single-click handler calls `open()` / `close()` to
 * toggle the dialog inline (visually center-screen, same as the old vanilla
 * panel). Tokenize state + callbacks are bridged from the badge options.
 */
import { createRoot, type Root } from 'react-dom/client';
import { createElement, type ReactElement } from 'react';
import { SettingsDialog } from './SettingsDialog';
import { syncElementTheme, injectThemeTokens, THEME_STYLE_ID } from '@/shared/lib/themeTokens';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { onStorageChanged, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import type { Settings } from '@/entities/media';

/** Tokenize state bridged from the orbital badge's tokenize controller. */
export interface TokenizeBridgeState {
  readonly enabled: boolean;
  readonly showStatus: boolean;
  readonly showFrequency: boolean;
}

export interface SettingsDialogMountOptions {
  /** Tokenize state + callbacks. When provided, a Tokenize section appears
   *  at the top of the settings sidebar. */
  readonly tokenize?: {
    readonly getState: () => TokenizeBridgeState;
    readonly onToggle: (key: 'enabled' | 'showStatus' | 'showFrequency') => void;
    readonly onOpenDictionary: () => void;
    readonly subscribe: (cb: (state: TokenizeBridgeState) => void) => () => void;
  };
  /** Called when the dialog closes (badge click-outside / Escape / close btn). */
  readonly onClose: () => void;
}

export interface SettingsDialogMountController {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  unmount: () => void;
}

export function mountSettingsDialog(
  options: SettingsDialogMountOptions,
): SettingsDialogMountController {
  const host = document.createElement('div');
  host.id = 'cell-settings-dialog-host';
  host.style.cssText =
    'position:fixed;inset:0;width:auto;height:auto;box-sizing:border-box;margin:0;padding:0;border:none;background:transparent;color:var(--color-text);font-size:medium;line-height:normal;isolation:isolate;z-index:2147483645;pointer-events:none;overflow:hidden;transform:none;';
  document.body.appendChild(host);

  // Fullscreen support — same as mountCardCreatorDialog (ADR-026).
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

  // Ensure theme tokens <style> exists (ADR-022).
  let tokenStyleCleanup: (() => void) | null = null;
  if (!document.getElementById(THEME_STYLE_ID)) {
    const throwaway = document.createElement('div');
    tokenStyleCleanup = injectThemeTokens(throwaway);
  }

  // Sync data-theme from document.body (the orbital badge sets data-theme on
  // its shadow root; for the light-DOM host we read the stored theme mode).
  const themeSyncCleanup = syncElementTheme(host, document.body);

  const rootEl = document.createElement('div');
  rootEl.style.cssText =
    'width:100%;height:100%;pointer-events:none;margin:0;padding:0;border:none;background:transparent;color:currentColor;font-size:medium;line-height:normal;';
  host.appendChild(rootEl);

  let open = false;
  let settings: Settings | null = null;
  let tokenizeState: TokenizeBridgeState | null = options.tokenize?.getState() ?? null;
  let root: Root | null = createRoot(rootEl);

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

  // Subscribe to tokenize state changes.
  const tokenizeUnsub = options.tokenize?.subscribe((s) => {
    tokenizeState = s;
    render();
  }) ?? null;

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
        tokenizeState: tokenizeState ?? undefined,
        onToggleTokenize: options.tokenize?.onToggle,
        onOpenDictionary: options.tokenize?.onOpenDictionary,
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
      tokenizeUnsub?.();
      restoreThemeStyleToHead();
      themeSyncCleanup?.();
      tokenStyleCleanup?.();
      host.remove();
    },
  };
}
