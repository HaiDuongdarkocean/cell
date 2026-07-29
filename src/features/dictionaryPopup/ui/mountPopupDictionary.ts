import { createElement } from 'react';
import { mountReactShadow } from '@/shared/lib/shadowRoot/mountReactShadow';
import { ShadowThemeProvider } from '@/shared/lib/shadowRoot/ShadowThemeProvider';
import { USE_LEGACY_POPUP_DICTIONARY } from '@/shared/config/featureFlags';
import { PopupDictionary } from './PopupDictionary';
import { clampPopupSize, getMountParent, POPUP_DEFAULT_HEIGHT_PX, POPUP_MARGIN_PX, POPUP_MIN_HEIGHT_PX, PopupShell } from './popupShell';
import type { PopupAnchor, PopupLineRect, PopupPointerHint, PopupSize } from './usePopupPosition';
import type { PopupCardCreatorPrefill } from './popupDictionaryController';

import tokensCss from '@/shared/styles/tokens.css?raw';
import componentsCss from '@/shared/styles/components.css?inline';
import popupDictionaryCss from './PopupDictionary.module.css?inline';
import dictionaryPanelViewCss from './DictionaryPanelView.module.css?inline';
import searchFieldCss from '@/shared/ui/SearchField.module.css?inline';
import inputCss from '@/shared/ui/Input.module.css?inline';
import iconButtonCss from '@/shared/ui/IconButton.module.css?inline';
import buttonCss from '@/shared/ui/Button.module.css?inline';
import spinnerCss from '@/shared/ui/Spinner.module.css?inline';
import skeletonCss from '@/shared/ui/Skeleton.module.css?inline';
import iconCss from '@/shared/icons/Icon.module.css?inline';

const POPUP_Z_INDEX = 'var(--z-overlay-settings)';
const ORBITAL_BADGE_HOST_CLASS = 'js-cell-orbital-badge-host';

export interface MountPopupDictionaryOptions {
  /** Bounding box of the looked-up token. */
  readonly anchor: PopupAnchor;
  /** Optional orbital pointer hint for positioning. */
  readonly pointer?: PopupPointerHint;
  /** Optional line/cue band rectangle to avoid. */
  readonly lineRect?: PopupLineRect | null;
  /** Language code for the dictionary lookup. */
  readonly langCode: string;
  /** Source language of the looked-up text. */
  readonly sourceLang: string;
  /** Target language for translations. */
  readonly targetLang: string;
  /** Initial term shown in the search input. */
  readonly initialTerm?: string;
  /** Initial popover size (width + maxHeight). */
  readonly initialSize?: Partial<PopupSize>;
  /** Initial sheet height in px. */
  readonly initialSheetHeight?: number;
  /** Called when the popup is closed. */
  readonly onClose?: () => void;
  /** Called when the popup size or sheet height changes. */
  readonly onSizeChange?: (size: PopupSize, sheetHeight: number) => void;
  /** Called when the user chooses to send a prefill to the card creator. */
  readonly onSendToCard?: (prefill: PopupCardCreatorPrefill) => void;
  /** Called when the user triggers a quick add. */
  readonly onQuickAdd?: (prefill: PopupCardCreatorPrefill) => void;
}

export interface PopupDictionaryMountController {
  /** Unmount the popup and remove the shadow host. */
  readonly destroy: () => void;
}

function getClientWidth(): number {
  return document.documentElement?.clientWidth ?? window.innerWidth;
}

function getClientHeight(): number {
  return document.documentElement?.clientHeight ?? window.innerHeight;
}

function mountLegacyPopupDictionary(options: MountPopupDictionaryOptions): PopupDictionaryMountController {
  const vw = getClientWidth();
  const vh = getClientHeight();

  const size = clampPopupSize(
    {
      width: options.initialSize?.width ?? 420,
      maxHeight: options.initialSize?.maxHeight ?? POPUP_DEFAULT_HEIGHT_PX,
    },
    vw,
    vh,
  );

  const sheetHeight = Math.max(
    POPUP_MIN_HEIGHT_PX,
    Math.min(
      options.initialSheetHeight ?? POPUP_DEFAULT_HEIGHT_PX,
      vh - POPUP_MARGIN_PX,
    ),
  );

  const onDismiss = (): void => { options.onClose?.(); };
  const onResizeEnd: (size: PopupSize, sheetHeight: number) => void =
    options.onSizeChange ?? (() => {});

  const shell = new PopupShell(size, sheetHeight, onDismiss, onResizeEnd);
  shell.mount();
  shell.setPosition(options.anchor, options.pointer, options.lineRect ?? null);
  shell.show();

  return { destroy: () => shell.destroy() };
}

function isInsideHost(host: HTMLElement, e: PointerEvent): boolean {
  return e.composedPath().some((el) => {
    if (!(el instanceof HTMLElement)) return false;
    return el === host || el.classList.contains(ORBITAL_BADGE_HOST_CLASS);
  });
}

function buildProps(
  options: MountPopupDictionaryOptions,
  onClose: () => void,
): React.ComponentProps<typeof PopupDictionary> {
  return {
    anchor: options.anchor,
    pointer: options.pointer,
    lineRect: options.lineRect,
    langCode: options.langCode,
    sourceLang: options.sourceLang,
    targetLang: options.targetLang,
    initialTerm: options.initialTerm,
    initialSize: options.initialSize,
    initialSheetHeight: options.initialSheetHeight,
    onClose,
    onSizeChange: options.onSizeChange,
    onSendToCard: options.onSendToCard,
    onQuickAdd: options.onQuickAdd,
  };
}

/**
 * Mount the popup dictionary as a React tree inside a Shadow DOM host.
 *
 * - Injects all required design-token and per-component CSS modules.
 * - Positions the host below the orbital badge with `z-index: var(--z-overlay-settings)`.
 * - Closes on click/tap outside the popup (excluding the orbital badge).
 * - Moves the host to/from `document.fullscreenElement` as fullscreen changes.
 */
export function mountPopupDictionary(options: MountPopupDictionaryOptions): PopupDictionaryMountController {
  if (USE_LEGACY_POPUP_DICTIONARY) {
    return mountLegacyPopupDictionary(options);
  }

  let destroy = (): void => {};

  const close = (): void => {
    destroy();
    options.onClose?.();
  };

  const mount = mountReactShadow(createElement(PopupDictionary, buildProps(options, close)), {
    parent: getMountParent(),
    position: 'fixed',
    css: [
      tokensCss,
      componentsCss,
      popupDictionaryCss,
      dictionaryPanelViewCss,
      searchFieldCss,
      inputCss,
      iconButtonCss,
      buttonCss,
      spinnerCss,
      skeletonCss,
      iconCss,
    ],
  });

  mount.host.classList.add('js-cell-popup-host');
  mount.host.style.zIndex = POPUP_Z_INDEX;

  mount.root.render(
    createElement(
      ShadowThemeProvider,
      { host: mount.host, children: createElement(PopupDictionary, buildProps(options, close)) },
    ),
  );

  const onDocumentPointerDown = (e: PointerEvent): void => {
    if (isInsideHost(mount.host, e)) return;
    close();
  };

  document.addEventListener('pointerdown', onDocumentPointerDown, true);

  const onFullscreenChange = (): void => {
    const parent = getMountParent();
    if (parent !== mount.host.parentElement) {
      parent.appendChild(mount.host);
    }
  };

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  // If already in fullscreen when mount is called, attach to the fullscreen element.
  if (document.fullscreenElement && document.fullscreenElement !== mount.host.parentElement) {
    document.fullscreenElement.appendChild(mount.host);
  }

  destroy = (): void => {
    document.removeEventListener('pointerdown', onDocumentPointerDown, true);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    mount.unmount();
  };

  return { destroy };
}
