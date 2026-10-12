import { createElement } from 'react';
import { mountReactShadow } from '@/shared/lib/shadowRoot/mountReactShadow';
import { allModuleCss } from '@/shared/lib/shadowRoot/allModuleCss';
import { ShadowThemeProvider } from '@/features/theme';
import { PopupDictionary } from './PopupDictionary';
import { getMountParent, POPUP_Z_INDEX } from './popupGeometry';
import type { PopupAnchor, PopupLineRect, PopupPointerHint, PopupSize } from './usePopupPosition';
import type { LookupResult, PopupCardCreatorPrefill, WordStatus, PopupTab } from '@/entities/dictionary';


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
  /** Called from the empty state to open Settings → Resources (import dictionary). */
  readonly onOpenSettings?: () => void;
  /** Default media tab to open when the result first appears. */
  readonly defaultActiveTab?: PopupTab | null;
  /**
   * When false, clicking outside the popup does NOT close it — the caller
   * owns dismissal (used in sheet mode so looking up a new word keeps the
   * sheet open and just feeds in the new result). Defaults to true.
   */
  readonly dismissOnOutsideClick?: boolean;
  /**
   * Extra "inside" predicate for the outside-click listener. Nested popup
   * stacks pass a check covering sibling popup hosts so a pointerdown inside
   * another level is not treated as an outside click.
   */
  readonly isInsideOtherHost?: (e: PointerEvent) => boolean;
  /**
   * Called instead of `close()` for outside pointerdowns when provided —
   * the nested-stack controller routes it to stack-level dismissal.
   */
  readonly onOutsidePointerDown?: () => void;
  /**
   * When the outside pointerdown is on an element that will immediately
   * re-trigger a lookup (e.g. another subtitle token / OCR hitbox), the
   * popup should stay mounted and let the caller re-anchor it instead of
   * closing and re-opening. Defaults to false.
   */
  readonly isReanchorPointerDown?: (e: PointerEvent) => boolean;
  /** Lookup chain terms (level 1 → N) — sheet mode renders them as a
   *  breadcrumb strip. Synced by the stack controller after push/prune. */
  readonly trail?: readonly string[];
  /** Breadcrumb tap: jump back to trail index `index` (closes deeper levels). */
  readonly onTrailNavigate?: (index: number) => void;
}

export interface PopupDictionaryMountController {
  /** The shadow host element — identifies this popup level for nested stacks. */
  readonly host: HTMLElement;
  /** Move DOM focus to the popup surface (after a deeper level closes). */
  readonly focus: () => void;
  /** Unmount the popup and remove the shadow host. */
  readonly destroy: () => void;
  /** Show or hide the forced loading state. */
  readonly setLoading: (isLoading: boolean) => void;
  /** Feed a new winner + candidates into the popup. */
  readonly setResult: (result: LookupResult, candidates?: readonly LookupResult[]) => void;
  /** Update the active result's status from an external source (e.g. keyboard shortcut). */
  readonly setStatus: (term: string, status: WordStatus) => void;
  /** Update mutable options (sourceLang, targetLang, size, sheetHeight, term, context, defaultActiveTab, dismiss policy) without re-mounting. */
  readonly setOptions: (options: Partial<Pick<MountPopupDictionaryOptions, 'sourceLang' | 'targetLang' | 'initialSize' | 'initialSheetHeight' | 'initialTerm' | 'contextSentence' | 'cursorOffset' | 'defaultActiveTab' | 'trail' | 'dismissOnOutsideClick'>>) => void;
  /** Move the popup to a new anchor without re-mounting (same-level re-lookup). */
  readonly setAnchor: (anchor: PopupAnchor, pointer?: PopupPointerHint, lineRect?: PopupLineRect | null) => void;
}

function isInsideHost(host: HTMLElement, e: PointerEvent): boolean {
  return e.composedPath().some((el) => {
    if (!(el instanceof HTMLElement)) return false;
    return el === host || el.classList.contains(ORBITAL_BADGE_HOST_CLASS);
  });
}

type MutableOptions = {
  -readonly [K in keyof MountPopupDictionaryOptions]: MountPopupDictionaryOptions[K];
};

type CurrentOptions = MutableOptions & {
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
  /** Bumped by setAnchor so usePopupPosition recomputes placement. */
  anchorVersion: number;
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
    anchorVersion: 0,
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
    onOpenSettings: current.onOpenSettings,
    trail: current.trail,
    onTrailNavigate: current.onTrailNavigate,
    defaultActiveTab: current.defaultActiveTab,
    syncStatus: current.syncStatus,
    anchorVersion: current.anchorVersion,
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
      css: allModuleCss,
      reparentOnFullscreen: true,
      provider: ShadowThemeProvider,
    },
  );

  mount.host.classList.add('js-cell-popup-host');
  mount.host.style.zIndex = POPUP_Z_INDEX;

  const onDocumentPointerDown = (e: PointerEvent): void => {
    if (isInsideHost(mount.host, e)) return;
    if (current.isInsideOtherHost?.(e)) return;
    // Sheet mode keeps the popup open on outside clicks so the user can look
    // up a new word without the sheet vanishing — the controller feeds the new
    // result in via setResult/setOptions. Desktop popup still dismisses.
    if (current.dismissOnOutsideClick === false) return;
    // A pointerdown on another lookup trigger (subtitle token / OCR hitbox)
    // should not close the popup; the caller will re-anchor it for the new term.
    if (current.isReanchorPointerDown?.(e)) return;
    if (current.onOutsidePointerDown) {
      current.onOutsidePointerDown();
      return;
    }
    close();
  };

  document.addEventListener('pointerdown', onDocumentPointerDown, true);

  const onFullscreenChange = (): void => {
    const parent = getMountParent();
    if (parent !== mount.host.parentNode) {
      parent.appendChild(mount.host);
    }
  };

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  onFullscreenChange();

  const cleanup = (): void => {
    document.removeEventListener('pointerdown', onDocumentPointerDown, true);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    mount.unmount();
  };

  return {
    host: mount.host,
    focus: () => {
      const el = mount.rootEl.querySelector<HTMLElement>('[data-cell-id="popup-dictionary"]');
      if (!el) return;
      if (el.tabIndex < 0) el.tabIndex = -1;
      el.focus();
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      cleanup();
    },
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
    setAnchor: (anchor, pointer, lineRect) => {
      current.anchor = anchor;
      current.pointer = pointer;
      current.lineRect = lineRect ?? null;
      current.anchorVersion += 1;
      render();
    },
  };
}
