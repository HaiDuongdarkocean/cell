/**
 * mountCardCreatorDialog — mounts the Card Creator React dialog into a fixed
 * overlay host.
 *
 * Two mount paths:
 * - Default (`USE_LEGACY_CARD_CREATOR = false`): open shadow root via
 *   `mountReactShadow`, full-viewport `position: fixed` host, shadow CSS
 *   isolation, `ShadowThemeProvider` theme, and automatic fullscreen
 *   re-parenting.
 * - Legacy (`USE_LEGACY_CARD_CREATOR = true`): previous light-DOM host on
 *   `document.body` with manual style reset and `themeTokens` sync.
 */
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { mountReactShadow } from '@/shared/lib/shadowRoot/mountReactShadow';
import { ShadowThemeProvider } from '@/shared/lib/shadowRoot/ShadowThemeProvider';
import { CardCreatorDialog } from './CardCreatorDialog';
import { CardCreatorBottomSheet } from './CardCreatorBottomSheet';
import { syncElementTheme, injectThemeTokens, THEME_STYLE_ID } from '@/shared/lib/themeTokens';
import type { CardCreatorSettings } from '@/entities/settings';
import type { MediaFile } from '../media/mediaFile';
import type {
  CardCreatorAction,
  CardCreatorOpenContext,
} from '../types';

import cardCreatorDialogCss from './CardCreatorDialog.module.css?inline';
import queueSidebarCss from './QueueSidebar.module.css?inline';
import mediaListCss from './MediaList.module.css?inline';
import previewBlockCss from './PreviewBlock.module.css?inline';
import fieldRowCss from './FieldRow.module.css?inline';
import dialogCss from '@/shared/ui/Dialog.module.css?inline';
import bottomSheetCss from '@/shared/ui/BottomSheet.module.css?inline';
import buttonCss from '@/shared/ui/Button.module.css?inline';
import iconButtonCss from '@/shared/ui/IconButton.module.css?inline';
import selectCss from '@/shared/ui/Select.module.css?inline';
import iconCss from '@/shared/icons/Icon.module.css?inline';

export type {
  CardCreatorAction,
  CardCreatorOpenContext,
  CardCreatorPrefill,
  CardCreatorQueueItem,
} from '../types';

/** Toggle to keep the pre-shadow light-DOM mount. Default `false` = shadow. */
export const USE_LEGACY_CARD_CREATOR = false;

/** Controller returned by mountCardCreatorDialog. */
export interface CardCreatorMountController {
  /** Open the dialog with the given context + optional initial action hint. */
  open: (context: CardCreatorOpenContext, action?: CardCreatorAction) => void;
  /** Close the dialog. */
  close: () => void;
  /** Whether the dialog is currently open (guard for keyboard shortcuts). */
  isOpen: () => boolean;
  /** Update settings (e.g. when AnkiConnect URL changes). */
  updateSettings: (settings: CardCreatorSettings) => void;
  /** Add media files to the open dialog (background fetch support —
   *  lets the dialog show immediately while media is fetched async). */
  addMediaFiles: (kind: 'images' | 'sentenceAudios' | 'wordAudios', files: readonly MediaFile[]) => void;
  /** Update a text field in the open dialog (e.g. translation fetched in background). */
  updateTextField: (key: 'targetWord' | 'sentence' | 'sentenceTranslation' | 'definitions' | 'note' | 'moreExample', value: string) => void;
  /** Unmount + remove host element. */
  unmount: () => void;
}

export function mountCardCreatorDialog(
  initialSettings: CardCreatorSettings,
  themeSource?: HTMLElement,
): CardCreatorMountController {
  if (USE_LEGACY_CARD_CREATOR) {
    return mountCardCreatorDialogLegacy(initialSettings, themeSource);
  }
  return mountCardCreatorDialogShadow(initialSettings);
}

/* ============================ Shadow DOM path ============================ */

const SHADOW_CSS = [
  cardCreatorDialogCss,
  queueSidebarCss,
  mediaListCss,
  previewBlockCss,
  fieldRowCss,
  dialogCss,
  bottomSheetCss,
  buttonCss,
  iconButtonCss,
  selectCss,
  iconCss,
];

function mountCardCreatorDialogShadow(
  initialSettings: CardCreatorSettings,
): CardCreatorMountController {
  const mount = mountReactShadow(createElement('div'), {
    parent: document.body,
    position: 'fixed',
    layer: 4,
    reparentOnFullscreen: true,
    css: SHADOW_CSS,
  });

  mount.host.id = 'cell-card-creator-host';
  mount.host.className = 'js-cell-card-creator-host';
  mount.host.style.cssText =
    'position:fixed;inset:0;width:auto;height:auto;box-sizing:border-box;margin:0;padding:0;border:none;background:transparent;color:var(--color-text);font-size:var(--font-size-base);line-height:normal;isolation:isolate;overflow:hidden;transform:none;pointer-events:none;';

  let open = false;
  let context: CardCreatorOpenContext | null = null;
  let settings = initialSettings;
  let initialAction: CardCreatorAction | undefined;

  let addMediaCb: ((kind: 'images' | 'sentenceAudios' | 'wordAudios', files: readonly MediaFile[]) => void) | null = null;
  let updateTextCb: ((key: 'targetWord' | 'sentence' | 'sentenceTranslation' | 'definitions' | 'note' | 'moreExample', value: string) => void) | null = null;

  const registerAddMedia = (cb: typeof addMediaCb): void => { addMediaCb = cb; };
  const registerUpdateText = (cb: typeof updateTextCb): void => { updateTextCb = cb; };

  const isMobile = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 768px)').matches;
  };

  function handleOpenChange(next: boolean): void {
    open = next;
    if (!next) {
      context = null;
      initialAction = undefined;
      addMediaCb = null;
      updateTextCb = null;
    }
    render();
  }

  function render(): void {
    mount.host.style.pointerEvents = open ? 'auto' : 'none';
    const Component = isMobile() ? CardCreatorBottomSheet : CardCreatorDialog;
    const commonProps = {
      open,
      onOpenChange: handleOpenChange,
      settings,
      openContext: context,
      initialAction,
      registerAddMedia,
      registerUpdateText,
    };
    mount.root.render(
      createElement(
        ShadowThemeProvider,
        { host: mount.host, children: createElement(Component, commonProps as never) },
      ) as ReactElement,
    );
  }

  render();

  return {
    open: (ctx: CardCreatorOpenContext, action?: CardCreatorAction) => {
      context = ctx;
      initialAction = action;
      open = true;
      render();
    },
    close: () => {
      open = false;
      context = null;
      initialAction = undefined;
      render();
    },
    isOpen: () => open,
    updateSettings: (next: CardCreatorSettings) => {
      settings = next;
      render();
    },
    addMediaFiles: (kind, files) => { addMediaCb?.(kind, files); },
    updateTextField: (key, value) => { updateTextCb?.(key, value); },
    unmount: () => {
      mount.unmount();
    },
  };
}

/* ============================ Legacy light-DOM path ============================ */

function mountCardCreatorDialogLegacy(
  initialSettings: CardCreatorSettings,
  themeSource?: HTMLElement,
): CardCreatorMountController {
  const host = document.createElement('div');
  host.id = 'cell-card-creator-host';
  host.style.cssText =
    'position:fixed;inset:0;width:auto;height:auto;box-sizing:border-box;margin:0;padding:0;border:none;background:transparent;color:var(--color-text);font-size:var(--font-size-base);line-height:normal;isolation:isolate;z-index:var(--z-overlay-secondary);pointer-events:none;overflow:hidden;transform:none;';
  document.body.appendChild(host);

  const moveThemeStyleInto = (parent: Element): void => {
    const style = document.getElementById(THEME_STYLE_ID);
    if (style && style.parentElement !== parent) {
      parent.appendChild(style);
    }
  };
  const restoreThemeStyleToHead = (): void => {
    const style = document.getElementById(THEME_STYLE_ID);
    if (style && style.parentElement !== document.head) {
      document.head.appendChild(style);
    }
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

  const themeCleanup = themeSource ? syncElementTheme(host, themeSource) : null;

  const rootEl = document.createElement('div');
  rootEl.style.cssText =
    'width:100%;height:100%;pointer-events:none;margin:0;padding:0;border:none;background:transparent;color:currentColor;font-size:var(--font-size-base);line-height:normal;';
  host.appendChild(rootEl);

  let open = false;
  let context: CardCreatorOpenContext | null = null;
  let settings = initialSettings;
  let initialAction: CardCreatorAction | undefined;
  let root: Root | null = createRoot(rootEl);

  let addMediaCb: ((kind: 'images' | 'sentenceAudios' | 'wordAudios', files: readonly MediaFile[]) => void) | null = null;
  let updateTextCb: ((key: 'targetWord' | 'sentence' | 'sentenceTranslation' | 'definitions' | 'note' | 'moreExample', value: string) => void) | null = null;

  const isMobile = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 768px)').matches;
  };

  const render = (): void => {
    if (!root) return;
    rootEl.style.pointerEvents = open ? 'auto' : 'none';
    const commonProps = {
      open,
      onOpenChange: (next: boolean) => {
        open = next;
        if (!next) {
          context = null;
          initialAction = undefined;
          addMediaCb = null;
          updateTextCb = null;
        }
        render();
      },
      settings,
      openContext: context,
      initialAction,
      registerAddMedia: (cb: typeof addMediaCb) => { addMediaCb = cb; },
      registerUpdateText: (cb: typeof updateTextCb) => { updateTextCb = cb; },
    };
    root.render(
      createElement(isMobile() ? CardCreatorBottomSheet : CardCreatorDialog, commonProps as never) as ReactElement,
    );
  };

  render();

  return {
    open: (ctx: CardCreatorOpenContext, action?: CardCreatorAction) => {
      const fsEl = document.fullscreenElement;
      if (fsEl && fsEl !== host.parentElement) {
        fsEl.appendChild(host);
        moveThemeStyleInto(fsEl);
      }
      context = ctx;
      initialAction = action;
      open = true;
      render();
    },
    close: () => {
      open = false;
      context = null;
      initialAction = undefined;
      render();
    },
    isOpen: () => open,
    updateSettings: (next: CardCreatorSettings) => {
      settings = next;
      render();
    },
    addMediaFiles: (kind, files) => { addMediaCb?.(kind, files); },
    updateTextField: (key, value) => { updateTextCb?.(key, value); },
    unmount: () => {
      if (root) {
        root.unmount();
        root = null;
      }
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      restoreThemeStyleToHead();
      themeCleanup?.();
      tokenStyleCleanup?.();
      host.remove();
    },
  };
}

/**
 * Build a BilingualCue from the current subtitle state.
 * Falls back to the nearest cue within 5 seconds if no exact time match.
 */
export function buildCardCreatorContext(
  video: HTMLVideoElement,
  targetCues: readonly { start: number; end: number; text: string; index: number }[],
  nativeCues: readonly { start: number; end: number; text: string; index: number }[],
  offsetMs: number,
  sourceLang: string,
  targetLang: string,
): CardCreatorOpenContext | null {
  const currentMs = video.currentTime * 1000;
  const adjustedMs = currentMs + offsetMs;

  let targetCue = targetCues.find((c) => adjustedMs >= c.start && adjustedMs <= c.end);
  if (!targetCue && targetCues.length > 0) {
    let nearest = targetCues[0];
    let minDiff = Math.abs(adjustedMs - nearest.start);
    for (const c of targetCues) {
      const diff = Math.abs(adjustedMs - c.start);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = c;
      }
    }
    if (minDiff <= 5000) targetCue = nearest;
  }
  if (!targetCue) return null;

  const nativeCue = nativeCues.find(
    (c) => c.start <= targetCue.end && c.end >= targetCue.start,
  );

  return {
    video,
    sourceLang,
    targetLang,
    cue: {
      index: targetCue.index,
      start: targetCue.start,
      end: targetCue.end,
      targetText: targetCue.text,
      nativeText: nativeCue?.text ?? '',
    },
  };
}
