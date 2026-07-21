// webTextDictionaryController — spec §2: top-level popup + lookup + highlight wiring.
//
// Manages the dictionary popup lifecycle independently of video presence.
// - Lives in content-script top-level and inside subtitle overlay controller.
// - Owns one WebTriggerController for web-text (document-level hover/click).
// - Receives SubtitleTriggerController callbacks for subtitle token lookup.
// - Owns WordHighlight to mark the target word/token.
// - Delegates popup rendering to popupDictionaryController.
// - Handles Card Creator / Quick Add actions from the popup.


import type { LookupRequest, LookupResult, TriggerMode, WordStatus } from '../types';
import type { DictionaryPopupSettings, CardCreatorSettings } from '@/entities/settings/types';
import type { PopupDictionaryState, PopupCardCreatorPrefill, PopupCardCreatorAction } from '@/features/dictionaryPopup/ui/popupDictionaryController';
import {
  createPopupDictionaryState,
  showPopup,
  appendCandidate,
  updatePopupSettings,
  destroyPopup,
} from '@/features/dictionaryPopup/ui/popupDictionaryController';
import { WebTriggerController } from '@/features/dictionaryPopup/trigger/webTriggerController';
import { createWordHighlight, type HighlightTarget } from '@/features/dictionaryPopup/ui/wordHighlight';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { mountCardCreatorDialog, type CardCreatorMountController, type CardCreatorOpenContext } from '@/features/cardCreator/ui/mountCardCreatorDialog';
import { captureScreenshot } from '@/features/cardCreator/media/screenshot';
import { captureSentenceAudio } from '@/features/cardCreator/media/sentenceAudio';
import { prefetchAnkiConnectData } from '@/features/cardCreator/service/cardCreatorPrefetch';
import { quickAddNote } from '@/features/cardCreator/service/quickAddNote';
import { fetchUrlAsMediaFile } from '@/features/cardCreator/media/mediaFile';
import type { MediaFile } from '@/features/cardCreator/media/mediaFile';
import { DraftAutosaver } from '@/features/cardCreator/state/cardDraft';
import { loadSettingsOrToast } from '@/features/subtitle/ui/subtitleControllerHelpers';
import { showToast } from '@/features/subtitle/ui/subtitleUI';

/** Minimal cue range used for sentence audio capture. */
export interface CueRange {
  readonly start: number;
  readonly end: number;
}

export interface WebTextDictionaryControllerDeps {
  readonly container: HTMLElement; // document.body or subtitle overlay container
  readonly dictionaryPopupSettings: DictionaryPopupSettings;
  readonly cardCreatorSettings: CardCreatorSettings;
  readonly nativeLanguage?: string;
  readonly hasVideo: boolean;
  readonly video?: HTMLVideoElement;
  /** Callback to get current target cues for sentence audio capture (subtitle path). */
  readonly getTargetCues?: () => readonly CueRange[];
  /** Called when the user cycles the word status inside the popup. The popup
   *  already persists the new status via its own WORD_STATUS_SET message; this
   *  callback lets external systems (tokenize controller) update their cached
   *  token metadata and rebind affected token spans so the new status sticks
   *  instead of reverting on the next scroll/toggle rebind. */
  readonly onStatusChange?: (term: string, langCode: string, status: WordStatus) => void;
}

/** Video/cue configuration for subtitle path. Can be set after construction. */
export interface WebTextDictionaryVideoConfig {
  readonly hasVideo: boolean;
  readonly video?: HTMLVideoElement;
  readonly getTargetCues?: () => readonly CueRange[];
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
  ) => void;
  /** Cancel an in-flight lookup. */
  readonly cancelLookup: (requestId: string) => void;
  /** Highlight a token span (subtitle) or a Range (web text). */
  readonly showHighlight: (target: HighlightTarget) => void;
  /** Clear active highlight. */
  readonly clearHighlight: () => void;
  /** Update card creator settings (lazy-updates the dialog mount if it exists). */
  readonly updateCardCreatorSettings: (settings: CardCreatorSettings) => void;
  /** Open the Card Creator dialog with the given context + optional action. */
  readonly openCardCreator: (context: CardCreatorOpenContext, action?: 'quick-add' | 'quick-update' | 'edit-card') => void;
  /** Whether the Card Creator dialog is currently open. */
  readonly isCardCreatorOpen: () => boolean;
}

/** Wait for the video to reach readyState ≥ 2 (HAVE_CURRENT_DATA) with a timeout. */
async function waitForVideoReady(video: HTMLVideoElement, timeoutMs = 2000): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0) return;
  const start = Date.now();
  await new Promise<void>((resolve) => {
    const check = (): void => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        resolve();
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve();
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
}

/** Create a top-level web-text dictionary controller. */
export function createWebTextDictionaryController(deps: WebTextDictionaryControllerDeps): WebTextDictionaryController {
  let dpSettings = deps.dictionaryPopupSettings;
  let ccSettings = deps.cardCreatorSettings;
  let nativeLang = deps.nativeLanguage ?? '';

  // Mutable video/cue config — late-bound by subtitle overlay controller.
  let hasVideo = deps.hasVideo;
  let video: HTMLVideoElement | undefined = deps.video;
  let getTargetCues: (() => readonly CueRange[]) | undefined = deps.getTargetCues;

  let popupDictState: PopupDictionaryState = createPopupDictionaryState(
    dpSettings,
    ccSettings,
    handlePopupCardCreatorAction,
    handlePopupQuickAdd,
    nativeLang,
  );
  let popupDictWasPlaying = false;
  const wordHighlight = createWordHighlight();

  let webTrigger: WebTriggerController | null = null;
  let currentAttachedMode: TriggerMode | null = null;
  let cardCreatorMount: CardCreatorMountController | null = null;
  let currentHighlightTarget: HighlightTarget | null = null;

  function showHighlight(target: HighlightTarget): void {
    wordHighlight.show(target);
  }

  function clearHighlight(): void {
    wordHighlight.clear();
  }

  const ALL_STATUSES: WordStatus[] = ['unknown', 'tracking', 'known', 'ignore'];

  function getTokenElement(target: HighlightTarget): HTMLElement | null {
    if (target instanceof HTMLElement) {
      return target.closest('.js-cell-token');
    }
    if (target instanceof Range) {
      const node = target.startContainer;
      const element = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
      return element?.closest('.js-cell-token') ?? null;
    }
    return null;
  }

  function applyTokenStatus(target: HighlightTarget, status: WordStatus): void {
    const token = getTokenElement(target);
    if (!token) return;
    for (const s of ALL_STATUSES) {
      token.classList.remove(`js-cell-token--status-${s}`);
    }
    token.classList.add(`js-cell-token--status-${status}`);
    if (status === 'known' || status === 'ignore') {
      token.classList.add('js-cell-token--frequency-off');
    } else {
      token.classList.remove('js-cell-token--frequency-off');
    }
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

  function configureVideo(config: WebTextDictionaryVideoConfig): void {
    hasVideo = config.hasVideo;
    video = config.video;
    getTargetCues = config.getTargetCues;
  }

  function onPopupDismiss(dismissedState: PopupDictionaryState): void {
    popupDictState = dismissedState;
    popupDictWasPlaying = false;
    currentHighlightTarget = null;
    wordHighlight.clear();
    resumeVideoIfNeeded();
  }

  function handleLookup(
    request: LookupRequest,
    requestId: string,
    anchorRect: DOMRect,
    highlightTarget: HighlightTarget,
  ): void {
    currentHighlightTarget = highlightTarget;
    wordHighlight.show(highlightTarget);

    void sendMessage({
      type: MESSAGE_TYPES.LOOKUP_REQUEST,
      payload: { requestId, request },
    })
      .then((response: unknown) => {
        const { success, data, error } = response as { success: boolean; data?: LookupResult[]; error?: string };
        if (success && data && data.length > 0) {
          pauseVideoIfNeeded();
          const [winner, ...rest] = data;
          popupDictState = showPopup(
            popupDictState,
            winner!,
            {
              anchor: {
                top: anchorRect.top,
                left: anchorRect.left,
                right: anchorRect.right,
                bottom: anchorRect.bottom + 4,
              },
              contextSentence: request.contextSentence,
              onDismiss: onPopupDismiss,
              onStatusChange: (term, langCode, status) => {
                if (currentHighlightTarget) {
                  applyTokenStatus(currentHighlightTarget, status);
                }
                deps.onStatusChange?.(term, langCode, status);
              },
            },
          );
          for (const candidate of rest) {
            popupDictState = appendCandidate(popupDictState, candidate, request.contextSentence);
          }
        } else {
          console.warn('[web-text-dict] lookup failed', error);
        }
      })
      .catch((err) => {
        console.warn('[web-text-dict] lookup error', err);
      });
  }

  function cancelLookup(requestId: string): void {
    void sendMessage({
      type: MESSAGE_TYPES.LOOKUP_CANCEL,
      payload: { requestId },
    });
  }

  function updateCardCreatorSettings(settings: CardCreatorSettings): void {
    ccSettings = settings;
    cardCreatorMount?.updateSettings(settings);
  }

  function openCardCreator(
    context: CardCreatorOpenContext,
    action?: 'quick-add' | 'quick-update' | 'edit-card',
  ): void {
    if (!cardCreatorMount) {
      cardCreatorMount = mountCardCreatorDialog(ccSettings, deps.container);
    } else {
      cardCreatorMount.updateSettings(ccSettings);
    }
    cardCreatorMount.open(context, action);
  }

  function isCardCreatorOpen(): boolean {
    return cardCreatorMount?.isOpen() ?? false;
  }

  async function handlePopupCardCreatorAction(
    action: PopupCardCreatorAction,
    prefill: PopupCardCreatorPrefill,
  ): Promise<void> {
    const settings = await loadSettingsOrToast(deps.container);
    if (!settings) return;
    updateCardCreatorSettings(settings.cardCreator);

    void prefetchAnkiConnectData(ccSettings.ankiConnectUrl).catch(() => {
      // Prefetch failure is non-fatal — loadData will retry.
    });

    const definitionsText = prefill.definitions
      .map((d) => (d.pos ? `(${d.pos}) ${d.text}` : d.text))
      .join('\n');

    const sourceLang = settings.subtitleOverlayTargetLanguage || prefill.langCode || 'en';
    const targetLang = settings.subtitleOverlayNativeLanguage || nativeLang || 'vi';

    const initialMedia: MediaFile[] = [];
    if (video && video.videoWidth > 0) {
      showToast('Capturing media…', deps.container, { variant: 'info' });
      await waitForVideoReady(video);
      try {
        const screenshot = await captureScreenshot(video);
        initialMedia.push(screenshot);
      } catch {
        showToast('Screenshot failed — you can capture manually in the dialog.', deps.container, { variant: 'warning' });
      }
      try {
        const cues = getTargetCues?.() ?? [];
        const currentMs = video.currentTime * 1000;
        const matchingCue = cues.find((c) => currentMs >= c.start && currentMs <= c.end);
        if (matchingCue) {
          const audioR = await captureSentenceAudio(video, { start: matchingCue.start, end: matchingCue.end });
          if (audioR.ok) initialMedia.push(audioR.file);
        }
      } catch {
        // Audio failure is non-fatal.
      }
    }

    openCardCreator({
      video: video && video.videoWidth > 0 ? video : undefined,
      sourceLang,
      targetLang,
      initialMedia: initialMedia.length > 0 ? initialMedia : undefined,
      prefill: {
        targetWord: prefill.term,
        definitions: definitionsText,
        sentenceTranslation: prefill.translation,
        sentence: prefill.contextSentence,
        wordAudioUrls: prefill.wordAudioUrls,
        sentenceAudioUrls: prefill.sentenceAudioUrls,
        imageUrls: prefill.imageUrls,
      },
    }, action);
  }

  async function handlePopupQuickAdd(prefill: PopupCardCreatorPrefill): Promise<void> {
    const settings = await loadSettingsOrToast(deps.container);
    if (!settings) return;
    const freshCcSettings = settings.cardCreator;
    const url = freshCcSettings.ankiConnectUrl;

    const autosaver = new DraftAutosaver();
    const restored = await autosaver.load();
    const deck = restored?.deck ?? freshCcSettings.defaultDeck;
    const noteType = restored?.noteType ?? freshCcSettings.defaultNoteType;
    const fieldMapping = restored?.fieldMapping ?? {};
    const tags = restored?.tags ?? freshCcSettings.defaultTags;

    if (!deck || !noteType) {
      showToast('Quick Add needs a deck + note type. Open Card Creator first to configure.', deps.container, { variant: 'error' });
      return;
    }
    if (Object.keys(fieldMapping).length === 0) {
      showToast('Quick Add needs field mapping. Open Card Creator first to configure.', deps.container, { variant: 'error' });
      return;
    }

    showToast('Quick Add — collecting media…', deps.container, { variant: 'info' });

    const wordAudios: MediaFile[] = [];
    const sentenceAudios: MediaFile[] = [];
    const images: MediaFile[] = [];
    const warnings: string[] = [];

    const [wordResults, sentenceResults, imageResults] = await Promise.all([
      Promise.allSettled((prefill.wordAudioUrls ?? []).map((u) => fetchUrlAsMediaFile(u, 'audio'))),
      Promise.allSettled((prefill.sentenceAudioUrls ?? []).map((u) => fetchUrlAsMediaFile(u, 'audio'))),
      Promise.allSettled((prefill.imageUrls ?? []).map((u) => fetchUrlAsMediaFile(u, 'image'))),
    ]);
    wordResults.forEach((r, i) => {
      if (r.status === 'fulfilled') wordAudios.push(r.value);
      else warnings.push(`word audio: ${prefill.wordAudioUrls![i]}`);
    });
    sentenceResults.forEach((r, i) => {
      if (r.status === 'fulfilled') sentenceAudios.push(r.value);
      else warnings.push(`sentence audio: ${prefill.sentenceAudioUrls![i]}`);
    });
    imageResults.forEach((r, i) => {
      if (r.status === 'fulfilled') images.push(r.value);
      else warnings.push(`image: ${prefill.imageUrls![i]}`);
    });

    if (video && video.videoWidth > 0) {
      await waitForVideoReady(video);
      try {
        const screenshot = await captureScreenshot(video);
        images.push(screenshot);
      } catch { warnings.push('screenshot'); }
      try {
        const cues = getTargetCues?.() ?? [];
        const currentMs = video.currentTime * 1000;
        const matchingCue = cues.find((c) => currentMs >= c.start && currentMs <= c.end);
        if (matchingCue) {
          const audioR = await captureSentenceAudio(video, { start: matchingCue.start, end: matchingCue.end });
          if (audioR.ok) sentenceAudios.push(audioR.file);
        }
      } catch { warnings.push('sentence audio capture'); }
    }

    const definitionsText = prefill.definitions
      .map((d) => (d.pos ? `(${d.pos}) ${d.text}` : d.text))
      .join('\n');

    const result = await quickAddNote(
      url,
      deck,
      noteType,
      fieldMapping,
      tags,
      {
        targetWord: prefill.term,
        sentence: prefill.contextSentence,
        sentenceTranslation: prefill.translation ?? '',
        definitions: definitionsText,
        note: '',
        moreExample: '',
      },
      { images, sentenceAudios, wordAudios },
      (msg) => warnings.push(msg),
    );

    if (result.ok) {
      if (result.noteId === null) {
        showToast('Card not added — a duplicate may already exist.', deps.container, { variant: 'warning' });
      } else {
        showToast(`Card added to "${deck}" (#${result.noteId}).`, deps.container, { variant: 'success' });
      }
    } else {
      showToast(`Quick Add failed: ${result.error}`, deps.container, { variant: 'error' });
    }
    if (warnings.length > 0) {
      showToast(`Skipped: ${warnings.join(', ')}`, deps.container, { variant: 'warning' });
    }
  }

  function attach(mode: TriggerMode): void {
    if (currentAttachedMode === mode && webTrigger) return;
    detach();
    currentAttachedMode = mode;
    webTrigger = new WebTriggerController({
      triggerMode: mode,
      onLookup: (request, requestId, anchorRect, range) => {
        void handleLookup(request, requestId, anchorRect, range);
      },
      onCancel: (requestId) => { cancelLookup(requestId); },
    });
    webTrigger.attach();
  }

  function detach(): void {
    webTrigger?.detach();
    webTrigger = null;
    currentAttachedMode = null;
  }

  function destroy(): void {
    detach();
    popupDictState = destroyPopup(popupDictState);
    cardCreatorMount?.unmount();
    cardCreatorMount = null;
    wordHighlight.destroy();
  }

  function updateSettings(settings: {
    dictionaryPopup: DictionaryPopupSettings;
    cardCreator: CardCreatorSettings;
    subtitleOverlayNativeLanguage?: string;
  }): void {
    dpSettings = settings.dictionaryPopup;
    ccSettings = settings.cardCreator;
    nativeLang = settings.subtitleOverlayNativeLanguage ?? nativeLang;
    popupDictState = updatePopupSettings(popupDictState, dpSettings, nativeLang);
    popupDictState = { ...popupDictState, cardCreatorSettings: ccSettings };
    cardCreatorMount?.updateSettings(ccSettings);
    if (dpSettings.enabled) {
      attach(dpSettings.triggerMode);
    } else {
      detach();
    }
  }

  return {
    attach,
    detach,
    updateSettings,
    configureVideo,
    destroy,
    handleLookup,
    cancelLookup,
    showHighlight,
    clearHighlight,
    updateCardCreatorSettings,
    openCardCreator,
    isCardCreatorOpen,
  };
}
