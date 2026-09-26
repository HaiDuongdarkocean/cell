// webTextDictionaryController — spec §2: top-level popup + lookup + highlight wiring.
//
// Manages the dictionary popup lifecycle independently of video presence.
// - Lives in content-script top-level and inside subtitle overlay controller.
// - Owns one WebTriggerController for web-text (document-level hover/click).
// - Receives SubtitleTriggerController callbacks for subtitle token lookup.
// - Delegates popup stack/lookup rendering to popupLifecycle, Card Creator /
//  Quick Add / SRS actions to cardCreatorBridge, and the orbital badge to
//  orbitalBadgeSync.

import type {
  LookupRequest,
  TriggerMode,
  WordStatus,
  PopupCardCreatorPrefill,
} from '@/entities/dictionary';
import type { DictionaryPopupSettings, CardCreatorSettings } from '@/entities/settings/types';
import { WebTriggerController, type WebTriggerPointer } from '@/features/dictionaryPopup/trigger/webTriggerController';
import type { HighlightTarget } from '@/features/dictionaryPopup/ui/wordHighlight';
import type { CardCreatorOpenContext } from '@/features/cardCreator/ui/mountCardCreatorDialog';
import type { CardCreatorAction } from '@/features/cardCreator/types';

import { sendMessage, onStorageChanged, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '@/shared/config/config';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { getActiveProfileSettings } from '@/entities/settings';

import type { PanelMountController } from './panelBridge';
import type { PopupStatusTarget } from '@/features/tokenize';
import { type CueRange } from './controllerTypes';
import { createLookupCache } from './lookupCache';
import { createPopupLifecycle } from './popupLifecycle';
import { createCardCreatorBridge } from './cardCreatorBridge';
import { createOrbitalBadgeSync } from './orbitalBadgeSync';

export type { CueRange };

export interface WebTextDictionaryControllerDeps {
  readonly container: HTMLElement; // document.body or subtitle overlay container
  readonly dictionaryPopupSettings: DictionaryPopupSettings;
  readonly cardCreatorSettings: CardCreatorSettings;
  readonly nativeLanguage?: string;
  readonly hasVideo: boolean;
  readonly video?: HTMLVideoElement;
  /** Callbacks to get current target/native cues for sentence audio capture and
   *  translation (subtitle path). */
  readonly getTargetCues?: () => readonly CueRange[];
  readonly getNativeCues?: () => readonly CueRange[];
  /** Called when the user cycles the word status inside the popup. The popup
   *  already persists the new status via its own WORD_STATUS_SET message; this
   *  callback lets external systems (tokenize controller) update their cached
   *  token metadata and rebind affected token spans so the new status sticks
   *  instead of reverting on the next scroll/toggle rebind. */
  readonly onStatusChange?: (term: string, langCode: string, status: WordStatus) => void;
  /** Get the locally cached word status from the tokenize controller, used as a
   *  fallback when the background DB read races or fails. */
  readonly getTokenStatus?: (term: string) => WordStatus;

  /** Generic panel controller toggled by the orbital badge (ADR-065).
   *  When present, Send to Card routes to the integrated universal panel
   *  instead of opening a standalone Card Creator dialog. */
  readonly panelController?: PanelMountController;
}

/** Video/cue configuration for subtitle path. Can be set after construction. */
export interface WebTextDictionaryVideoConfig {
  readonly hasVideo: boolean;
  readonly video?: HTMLVideoElement;
  readonly getTargetCues?: () => readonly CueRange[];
  readonly getNativeCues?: () => readonly CueRange[];
}

export interface WebTextDictionaryController {
  readonly attach: (mode: TriggerMode) => void;
  readonly detach: () => void;
  readonly updateSettings: (settings: {
    dictionaryPopup: DictionaryPopupSettings;
    cardCreator: CardCreatorSettings;
    subtitleOverlayNativeLanguage?: string;
  }) => void;
  /** Late-bind video + cue source when subtitle overlay initializes. */
  readonly configureVideo: (config: WebTextDictionaryVideoConfig) => void;
  readonly destroy: () => void;
  /** Handle a lookup request and render popup + highlight. */
  readonly handleLookup: (
    request: LookupRequest,
    requestId: string,
    anchorRect: DOMRect,
    highlightTarget: HighlightTarget,
    pointer?: WebTriggerPointer,
  ) => void;
  /** Cancel an in-flight lookup. */
  readonly cancelLookup: (requestId: string) => void;
  /** Hide the popup, clear highlight, and cancel the current lookup. */
  readonly dismissLookup: () => void;
  /** Close the popup stack immediately (no reposition grace window). */
  readonly closePopup: () => void;
  /** Whether a lookup popup is currently open. */
  readonly hasOpenPopup: () => boolean;
  /** Highlight a token span (subtitle) or a Range (web text). */
  readonly showHighlight: (target: HighlightTarget) => void;
  /** Clear active highlight. */
  readonly clearHighlight: () => void;
  /** Sync the popup status with an external status change (e.g. keyboard shortcut). */
  readonly syncStatus: (term: string, status: WordStatus) => void;
  /** The term the deepest open popup is showing + an apply() routing a status
   *  change through the popup path. Lets 1-4 keys target the looked-up word. */
  readonly getPopupStatusTarget: () => PopupStatusTarget | null;
  /** Update card creator settings (lazy-updates the dialog mount if it exists). */
  readonly updateCardCreatorSettings: (settings: CardCreatorSettings) => void;
  /** Open the Card Creator dialog with the given context + optional action. */
  readonly openCardCreator: (context: CardCreatorOpenContext, action?: 'quick-add' | 'quick-update' | 'edit-card') => void;
  /** Send the context to the integrated Card Creator in the universal panel.
   *  `selection` carries the full popup prefill (lookup result + loaded media
   *  + selection snapshot) so the integrated Dictionary can initialize as an
   *  exact clone of the popup (Task 4).
   *  Falls back to the standalone dialog when no panel controller is available. */
  readonly sendToCard: (context: CardCreatorOpenContext, action?: 'quick-add' | 'quick-update' | 'edit-card', selection?: PopupCardCreatorPrefill) => void;
  /** Whether the Card Creator dialog is currently open. */
  readonly isCardCreatorOpen: () => boolean;
}

export function createWebTextDictionaryController(deps: WebTextDictionaryControllerDeps): WebTextDictionaryController {
  let dpSettings = deps.dictionaryPopupSettings;
  let nativeLang = deps.nativeLanguage ?? '';

  // Mutable video/cue config — late-bound by subtitle overlay controller.
  let hasVideo = deps.hasVideo;
  let video: HTMLVideoElement | undefined = deps.video;
  let getTargetCues: (() => readonly CueRange[]) | undefined = deps.getTargetCues;
  let getNativeCues: (() => readonly CueRange[]) | undefined = deps.getNativeCues;

  let popupDictWasPlaying = false;

  const lookupCache = createLookupCache();

  let webTrigger: WebTriggerController | null = null;
  let currentAttachedMode: TriggerMode | null = null;

  function cancelLookup(requestId: string): void {
    void sendMessage({
      type: MESSAGE_TYPES.LOOKUP_CANCEL,
      payload: { requestId },
    });
  }

  function pauseVideoIfNeeded(): void {
    if (hasVideo && video && !video.paused) {
      video.pause();
      popupDictWasPlaying = true;
    }
  }

  function resumeVideoIfNeeded(): void {
    if (hasVideo && video && popupDictWasPlaying) {
      void video.play();
      popupDictWasPlaying = false;
    }
  }

  const lifecycle = createPopupLifecycle({
    getDpSettings: () => dpSettings,
    setDpSettings: (settings) => { dpSettings = settings; },
    getNativeLang: () => nativeLang,
    getTokenStatus: deps.getTokenStatus,
    onStatusChange: deps.onStatusChange,
    panelController: deps.panelController,
    lookupCache,
    pauseVideo: pauseVideoIfNeeded,
    resumeVideo: resumeVideoIfNeeded,
    resetVideoPlaying: () => { popupDictWasPlaying = false; },
    sendLookupCancel: cancelLookup,
    onCardCreatorAction: (level, action, prefill) => cardBridge.handlePopupCardCreatorAction(level, action, prefill),
    onQuickAdd: (level, prefill) => cardBridge.handlePopupQuickAdd(level, prefill),
  });

  const cardBridge = createCardCreatorBridge({
    container: deps.container,
    cardCreatorSettings: deps.cardCreatorSettings,
    panelController: deps.panelController,
    getNativeLang: () => nativeLang,
    getVideo: () => video,
    getTargetCues: () => getTargetCues?.() ?? [],
    getNativeCues: () => getNativeCues?.() ?? [],
    getSrsDestination: () => deps.dictionaryPopupSettings.srsDestination ?? 'anki',
    closePopup: () => lifecycle.closePopup(),
  });

  const orbital = createOrbitalBadgeSync({
    getDpSettings: () => dpSettings,
    setDpSettings: (settings) => { dpSettings = settings; },
    panelController: deps.panelController,
    onLookup: (request, requestId, anchorRect, range, pointer) => {
      handleLookup(request, requestId, anchorRect, range, pointer);
    },
    onCancel: cancelLookup,
  });

  let profileLangCode: string | undefined;

  const refreshProfileLang = async (): Promise<void> => {
    const settings = await loadSettings().catch(() => DEFAULT_SETTINGS);
    const next = getActiveProfileSettings(settings)?.resourceLangCode;
    const prev = profileLangCode;
    profileLangCode = next;
    if (prev !== undefined && next !== prev) lifecycle.closePopup();
  };

  const onSettingsStorageChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    if (area !== 'local' || !(STORAGE_KEYS.SETTINGS in changes)) return;
    lookupCache.clear();
    void refreshProfileLang();
  };

  onStorageChanged(onSettingsStorageChange);
  void refreshProfileLang();

  function handleLookup(
    request: LookupRequest,
    requestId: string,
    anchorRect: DOMRect,
    highlightTarget: HighlightTarget,
    pointer?: WebTriggerPointer,
  ): void {
    const effectiveRequest = profileLangCode
      ? { ...request, langCode: profileLangCode }
      : request;
    lifecycle.handleLookup(effectiveRequest, requestId, anchorRect, highlightTarget, pointer);
  }

  function configureVideo(config: WebTextDictionaryVideoConfig): void {
    hasVideo = config.hasVideo;
    video = config.video;
    getTargetCues = config.getTargetCues;
    getNativeCues = config.getNativeCues;
  }

  function attach(mode: TriggerMode): void {
    if (currentAttachedMode === mode) return;
    detach();
    currentAttachedMode = mode;
    webTrigger = new WebTriggerController({
      triggerMode: mode,
      onLookup: (request, requestId, anchorRect, range, pointer) => {
        handleLookup(request, requestId, anchorRect, range, pointer);
      },
      onCancel: (requestId) => { cancelLookup(requestId); },
      // Auto-dismiss on hover-leave removed: popup only closes on explicit
      // user action (click outside / Esc / close button).
    });
    webTrigger.attach();
  }

  function detach(): void {
    // Detach is intentional teardown (mode switch, settings update) — cancel
    // any pending delayed dismiss and in-flight lookup so they don't fire
    // after re-attach.
    lifecycle.cancelPendingDismiss();
    lifecycle.cancelInFlightLookup();
    webTrigger?.detach();
    webTrigger = null;
    currentAttachedMode = null;
    orbital.teardownBadge();
  }

  function destroy(): void {
    removeOnStorageChangedListener(onSettingsStorageChange);
    detach();
    lifecycle.dispose();
    cardBridge.unmount();
    orbital.dispose();
    lookupCache.clear();
  }

  function updateSettings(settings: {
    dictionaryPopup: DictionaryPopupSettings;
    cardCreator: CardCreatorSettings;
    subtitleOverlayNativeLanguage?: string;
  }): void {
    dpSettings = settings.dictionaryPopup;
    nativeLang = settings.subtitleOverlayNativeLanguage ?? nativeLang;
    cardBridge.updateSettings(settings.cardCreator);
    lifecycle.syncMountSettings(nativeLang, dpSettings);
    if (dpSettings.enabled) {
      attach(dpSettings.triggerMode);
    } else {
      detach();
    }
    orbital.sync(dpSettings);
  }

  return {
    attach,
    detach,
    updateSettings,
    configureVideo,
    destroy,
    handleLookup,
    cancelLookup,
    dismissLookup: lifecycle.dismissLookup,
    closePopup: lifecycle.closePopup,
    hasOpenPopup: lifecycle.hasOpenPopup,
    showHighlight: lifecycle.showHighlight,
    clearHighlight: lifecycle.clearHighlight,
    syncStatus: lifecycle.syncStatus,
    getPopupStatusTarget: lifecycle.getPopupStatusTarget,
    updateCardCreatorSettings: cardBridge.updateSettings,
    openCardCreator: (context, action?: CardCreatorAction) => cardBridge.open(context, action),
    sendToCard: cardBridge.sendToCard,
    isCardCreatorOpen: cardBridge.isOpen,
  };
}
