import { createElement } from 'react';
import { mountReactShadow } from '@/shared/lib/shadowRoot/mountReactShadow';
import { ShadowThemeProvider } from '@/shared/lib/shadowRoot/ShadowThemeProvider';
import { PopupDictionary } from './PopupDictionary';
import { getMountParent } from './popupGeometry';
import type { PopupAnchor, PopupLineRect, PopupPointerHint, PopupSize } from './usePopupPosition';
import type { LookupResult, PopupCardCreatorPrefill, WordStatus, PopupTab } from '@/features/dictionaryPopup/types';

import popupDictionaryCss from './PopupDictionary.module.css?inline';
import dictionaryPanelViewCss from './DictionaryPanelView.module.css?inline';
import searchFieldCss from '@/shared/ui/SearchField.module.css?inline';
import inputCss from '@/shared/ui/Input.module.css?inline';
import buttonCss from '@/shared/ui/Button.module.css?inline';
import spinnerCss from '@/shared/ui/Spinner.module.css?inline';
import skeletonCss from '@/shared/ui/Skeleton.module.css?inline';
import iconCss from '@/shared/icons/Icon.module.css?inline';
import sheetCss from '@/shared/ui/Sheet.module.css?inline';

const POPUP_Z_INDEX = 'var(--z-overlay-top)';
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
  /** Context sentence for Card Creator prefill. */
  readonly contextSentence?: string;
  /** Cursor offset inside `contextSentence` for phrase detection. */
  readonly cursorOffset?: number;
  /** Pre-fetched winner result. When provided the popup does not search. */
  readonly initialResult?: LookupResult;
  /** Pre-fetched additional candidates. */
  readonly initialCandidates?: readonly LookupResult[];
  /** Local token-status fallback for the winner. */
  readonly getTokenStatus?: (term: string) => WordStatus | undefined;
  /** Force a loading state while the parent controller is fetching. */
  readonly isLoading?: boolean;
  /** Initial popover size (width + maxHeight). */
  readonly initialSize?: Partial<PopupSize>;
  /** Initial sheet height in px. */
  readonly initialSheetHeight?: number;
  /** Called when the popup is closed. */
  readonly onClose?: () => void;
  /** Called when a new result arrives. */
  readonly onResult?: (winner: LookupResult, candidates: readonly LookupResult[], contextSentence: string) => void;
  /** Called when the popup size or sheet height changes. */
  readonly onSizeChange?: (size: PopupSize, sheetHeight: number) => void;
  /** Called when the user chooses to send a prefill to the card creator. */
  readonly onSendToCard?: (prefill: PopupCardCreatorPrefill) => void;
  /** Called when the user triggers a quick add. */
  readonly onQuickAdd?: (prefill: PopupCardCreatorPrefill) => void;
  /** Called when the user cycles a word's status inside the popup. */
  readonly onStatusChange?: (term: string, langCode: string, status: WordStatus) => void;
  /** Called when the user switches to a different candidate. */
  readonly onCandidateChange?: (term: string) => void;
  /** Default media tab to open when the result first appears. */
  readonly defaultActiveTab?: PopupTab | null;
  /**
   * When false, clicking outside the popup does NOT close it — the caller
   * owns dismissal (used in sheet mode so looking up a new word keeps the
   * sheet open and just feeds in the new result). Defaults to true.
   */
  readonly dismissOnOutsideClick?: boolean;
}

export interface PopupDictionaryMountController {
  /** Unmount the popup and remove the shadow host. */
  readonly destroy: () => void;
  /** Show or hide the forced loading state. */
  readonly setLoading: (isLoading: boolean) => void;
  /** Feed a new winner + candidates into the popup. */
  readonly setResult: (result: LookupResult, candidates?: readonly LookupResult[]) => void;
  /** Update the active result's status from an external source (e.g. keyboard shortcut). */
  readonly setStatus: (term: string, status: WordStatus) => void;
  /** Update mutable options (sourceLang, targetLang, size, sheetHeight, term, context) without re-mounting. */
  readonly setOptions: (options: Partial<Pick<MountPopupDictionaryOptions, 'sourceLang' | 'targetLang' | 'initialSize' | 'initialSheetHeight' | 'initialTerm' | 'contextSentence' | 'cursorOffset'>>) => void;
}

function isInsideHost(host: HTMLElement, e: PointerEvent): boolean {
  return e.composedPath().some((el) => {
    if (!(el instanceof HTMLElement)) return false;
    return el === host || el.classList.contains(ORBITAL_BADGE_HOST_CLASS);
  });
}

type CurrentOptions = MountPopupDictionaryOptions & {
  /** Forced loading state controlled by setLoading. */
  isLoading: boolean;
  /** Result controlled by setResult. */
  initialResult?: LookupResult;
  /** Candidates controlled by setResult. */
  initialCandidates?: readonly LookupResult[];
  /** Status controlled by setStatus. */
  syncStatus?: { readonly term: string; readonly status: WordStatus };
  /** Default media tab controlled by the parent. */
  defaultActiveTab?: PopupTab | null;
};

/**
 * Mount the popup dictionary as a React tree inside a Shadow DOM host.
 *
 * - Injects all required design-token and per-component CSS modules.
 * - Positions the host below the orbital badge with `z-index: var(--z-overlay-top)`.
 * - Closes on click/tap outside the popup (excluding the orbital badge).
 * - Moves the host to/from `document.fullscreenElement` as fullscreen changes.
 * - The returned controller can feed new results / loading / status / options
 *   into the mounted React tree without destroying it.
 */
export function mountPopupDictionary(options: MountPopupDictionaryOptions): PopupDictionaryMountController {
  let destroyed = false;

  const current: CurrentOptions = {
    ...options,
    isLoading: options.isLoading ?? false,
  };

  const close = (): void => {
    if (destroyed) return;
    destroyed = true;
    options.onClose?.();
    cleanup();
  };

  const buildProps = (): React.ComponentProps<typeof PopupDictionary> => ({
    anchor: current.anchor,
    pointer: current.pointer,
    lineRect: current.lineRect,
    langCode: current.langCode,
    sourceLang: current.sourceLang,
    targetLang: current.targetLang,
    initialTerm: current.initialTerm,
    contextSentence: current.contextSentence,
    cursorOffset: current.cursorOffset,
    initialResult: current.initialResult,
    initialCandidates: current.initialCandidates,
    getTokenStatus: current.getTokenStatus,
    isLoading: current.isLoading,
    initialSize: current.initialSize,
    initialSheetHeight: current.initialSheetHeight,
    onClose: close,
    onResult: current.onResult,
    onSizeChange: current.onSizeChange,
    onSendToCard: current.onSendToCard,
    onQuickAdd: current.onQuickAdd,
    onStatusChange: current.onStatusChange,
    onCandidateChange: current.onCandidateChange,
    defaultActiveTab: current.defaultActiveTab,
    syncStatus: current.syncStatus,
  });

  const render = (): void => {
    if (destroyed) return;
    mount.root.render(
      createElement(ShadowThemeProvider, { container: mount.rootEl }, createElement(PopupDictionary, buildProps())),
    );
  };

  const mount = mountReactShadow(
    createElement(PopupDictionary, buildProps()),
    {
      parent: getMountParent(),
      position: 'fixed',
      css: [
        sheetCss,
        popupDictionaryCss,
        dictionaryPanelViewCss,
        searchFieldCss,
        inputCss,
        buttonCss,
        spinnerCss,
        skeletonCss,
        iconCss,
      ],
    },
  );

  // Re-render after mount with the actual container so ShadowThemeProvider can set
  // the theme boundary.
  render();

  mount.host.classList.add('js-cell-popup-host');
  mount.host.style.zIndex = POPUP_Z_INDEX;

  const onDocumentPointerDown = (e: PointerEvent): void => {
    if (isInsideHost(mount.host, e)) return;
    // Sheet mode keeps the popup open on outside clicks so the user can look
    // up a new word without the sheet vanishing — the controller feeds the new
    // result in via setResult/setOptions. Desktop popup still dismisses.
    if (current.dismissOnOutsideClick === false) return;
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

  const cleanup = (): void => {
    document.removeEventListener('pointerdown', onDocumentPointerDown, true);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    mount.unmount();
  };

  return {
    destroy: cleanup,
    setLoading: (isLoading) => {
      current.isLoading = isLoading;
      // Clear the previous result when entering loading so the popup shows a
      // skeleton for the new term, not stale data from the previous lookup.
      if (isLoading) {
        current.initialResult = undefined;
        current.initialCandidates = [];
      }
      render();
    },
    setResult: (result, candidates = []) => {
      current.isLoading = false;
      current.initialResult = result;
      current.initialCandidates = candidates;
      render();
    },
    setStatus: (term, status) => {
      current.syncStatus = { term, status };
      render();
    },
    setOptions: (updates) => {
      Object.assign(current, updates);
      render();
    },
  };
}
