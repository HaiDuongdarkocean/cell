/**
 * mountCardCreatorDialog — mounts the Card Creator React dialog into a fixed
 * overlay host appended to `document.body`.
 *
 * The host is a full-viewport `position: fixed` element with a very high z-index
 * so the Card Creator dialog floats above the page like the mockup, instead of
 * being injected into the page flow.
 *
 * The host does NOT use Shadow DOM: the dialog overlay already has
 * `position: fixed` and the CSS variables are inherited from the page theme
 * (ADR-022). A Shadow DOM host would create a new stacking context and trap the
 * fixed overlay, causing the dialog to render inline as seen in the bug report.
 */
import { createRoot, type Root } from 'react-dom/client';
import { createElement, type ReactElement } from 'react';
import { CardCreatorDialog } from './CardCreatorDialog';
import { CardCreatorBottomSheet } from './CardCreatorBottomSheet';
import { syncElementTheme, injectThemeTokens, THEME_STYLE_ID } from '@/shared/lib/themeTokens';
import type { CardCreatorSettings } from '@/entities/settings';
import type { MediaFile } from '../media/mediaFile';
import type {
  CardCreatorAction,
  CardCreatorOpenContext,
} from '../types';

export type {
  CardCreatorAction,
  CardCreatorOpenContext,
  CardCreatorPrefill,
  CardCreatorQueueItem,
} from '../types';









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

/**
 * Mount the Card Creator dialog into a fixed full-viewport host on
 * document.body. Returns a controller to open/close + update settings.
 *
 * @param initialSettings - Card Creator settings (URL, defaults).
 * @param themeSource - Element whose `data-theme` attribute is the source of
 *   truth for light/dark mode (usually the video container). The host syncs
 *   its `data-theme` from this element via MutationObserver so the dialog
 *   follows the user's theme preference in realtime.
 */
export function mountCardCreatorDialog(
  initialSettings: CardCreatorSettings,
  themeSource?: HTMLElement,
): CardCreatorMountController {
  // Create a full-viewport fixed host so the dialog floats above the page.
  // ADR-026:
  // - `inset:0` + `width/height:auto` fills the fixed viewport padding box
  //   instead of top/left + 100vw/100vh, which avoids scrollbar-width quirks.
  // - `box-sizing:border-box` prevents ancestor padding/borders from shrinking
  //   the host.
  // - Explicit reset (`all:initial` is not usable because it resets display/
  //   position) for font/line-height/color/background/border so sites like
  //   YouTube with aggressive global CSS cannot inherit unintended styles.
  // - `isolation:isolate` creates a new stacking context, keeping z-index
  //   predictable.
  const host = document.createElement('div');
  host.id = 'cell-card-creator-host';
  host.style.cssText =
    'position:fixed;inset:0;width:auto;height:auto;box-sizing:border-box;margin:0;padding:0;border:none;background:transparent;color:var(--color-text);font-size:var(--font-size-base);line-height:normal;isolation:isolate;z-index:var(--z-overlay-secondary);pointer-events:none;overflow:hidden;transform:none;';
  document.body.appendChild(host);

  // ADR-026: Fullscreen support. When the video element enters fullscreen,
  // the browser renders only the fullscreen element + its descendants —
  // `position:fixed` elements in `document.body` are NOT shown. To keep the
  // Card Creator dialog visible in fullscreen, we move the host into the
  // fullscreen element on `fullscreenchange`. When exiting fullscreen, we
  // move it back to `document.body`. The host keeps `position:fixed` so it
  // still overlays the fullscreen content correctly.
  //
  // ADR-026: Theme tokens (`<style id="subtitle-theme-tokens">`) are injected
  // into `document.head` by `injectThemeTokens`. In fullscreen, the browser
  // creates a top-layer rendering context — `<head>` styles do NOT apply
  // inside the fullscreen element. So when we move the host into fullscreen,
  // we move the original theme `<style>` into the fullscreen element. On exit,
  // we move it back to `document.head`. Moving (not cloning) keeps selectors
  // like `:root` and `[data-theme="dark"]` intact and avoids duplicate-id issues.
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
  // Also listen webkit-prefixed events for Safari/older browsers.
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  // ADR-022: ensure the global theme-tokens <style> exists in document.head.
  // On subtitle pages, contentScriptController already called injectThemeTokens
  // (which injects this style). On plain text-reading pages (e.g. a dictionary
  // lookup on an article with no video), it was never called → the
  // [data-theme="dark"] { --color-* } rules are absent → the dialog's
  // var(--color-background) etc. don't resolve → transparent background.
  // Inject with a detached throwaway container: we only need the global <style>
  // (with the user's custom palette + realtime storage updates); the host's
  // data-theme is synced separately below. The throwaway never enters the DOM,
  // so the host page is unaffected.
  let tokenStyleCleanup: (() => void) | null = null;
  if (!document.getElementById(THEME_STYLE_ID)) {
    const throwaway = document.createElement('div');
    tokenStyleCleanup = injectThemeTokens(throwaway);
  }

  // ADR-022: sync data-theme from the video container so CSS variables
  // (--color-background, --color-text, etc.) resolve correctly for light/dark.
  // Without this, the host inherits document.body's theme (none) and the
  // dialog renders with unstyled/default colors.
  const themeCleanup = themeSource
    ? syncElementTheme(host, themeSource)
    : null;

  const rootEl = document.createElement('div');
  rootEl.style.cssText =
    'width:100%;height:100%;pointer-events:none;margin:0;padding:0;border:none;background:transparent;color:currentColor;font-size:var(--font-size-base);line-height:normal;';
  host.appendChild(rootEl);

  let open = false;
  let context: CardCreatorOpenContext | null = null;
  let settings = initialSettings;
  let initialAction: CardCreatorAction | undefined;
  let root: Root | null = createRoot(rootEl);

  // Callbacks registered by the React component — let the controller push
  // media + text updates into the open dialog without re-rendering from scratch.
  let addMediaCb: ((kind: 'images' | 'sentenceAudios' | 'wordAudios', files: readonly MediaFile[]) => void) | null = null;
  let updateTextCb: ((key: 'targetWord' | 'sentence' | 'sentenceTranslation' | 'definitions' | 'note' | 'moreExample', value: string) => void) | null = null;

  /** Determine whether to render the bottom sheet variant based on viewport width. */
  const isMobile = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 768px)').matches;
  };

  const render = (): void => {
    if (!root) return;
    // ADR-026: sync rootEl pointer-events with the open state. When closed,
    // the dialog is unmounted but the host still occupies the full viewport
    // (position:fixed; 100vw x 100vh). If rootEl keeps pointer-events:auto,
    // it blocks all clicks on the page underneath. Toggle to 'none' when
    // closed so the host becomes click-through except when the dialog is open.
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
      createElement(isMobile() ? CardCreatorBottomSheet : CardCreatorDialog, commonProps) as ReactElement,
    );
  };

  render();

  return {
    open: (ctx: CardCreatorOpenContext, action?: CardCreatorAction) => {
      // ADR-026: if the page is already in fullscreen when the dialog opens,
      // move the host into the fullscreen element (the fullscreenchange
      // listener only fires on transitions — if the user was already in
      // fullscreen before clicking Card Creator, the host was appended to
      // document.body on mount and would be invisible). Also move the theme
      // `<style>` into the fullscreen element so CSS variables resolve.
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
