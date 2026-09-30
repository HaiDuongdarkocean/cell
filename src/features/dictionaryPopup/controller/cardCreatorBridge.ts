import type {
  FetchCommunityAudioResponse,
  FetchImagesResponse,
  TtsFetchAudioResponse,
  AudioItem,
  ImageItem,
  PopupCardCreatorAction,
  PopupCardCreatorPrefill,
  OnCardCreatorActionResult,
  DictionaryPanelPrefill,
} from '@/entities/dictionary';
import type { CardCreatorSettings, SrsDestination } from '@/entities/settings/types';
import type { BilingualCue } from '@/entities/media';
import type { MessageResponse } from '@/entities/message/types';
import { mountCardCreatorDialog, type CardCreatorMountController, type CardCreatorOpenContext } from '@/features/cardCreator/ui/mountCardCreatorDialog';
import type { CardCreatorAction } from '@/features/cardCreator/types';
import { captureScreenshot } from '@/features/cardCreator/media/screenshot';
import { captureSentenceAudio, seekAndWaitReady } from '@/features/cardCreator/media/sentenceAudio';
import { prefetchAnkiConnectData } from '@/features/cardCreator/service/cardCreatorPrefetch';
import { fetchMediaFile, type MediaFile } from '@/features/cardCreator/media/mediaFile';
import { addToOceanSrs, openSrsStudyPage } from '@/features/dictionaryPopup/services/addToOceanSrs';
import { formatDefinitions, parseDefinitionsText } from '@/features/dictionary/logic/formatDefinitions';
import { formatDefEntry, formatDefFromLookup } from '@/features/srs';
import { loadSettingsOrToast } from '@/features/subtitle/ui/subtitleControllerHelpers';
import { showToast, showProgressToast } from '@/features/subtitle/ui/subtitleUI';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { t } from '@/shared/i18n';
import type { PanelMountController } from './panelBridge';
import type { CueRange, PopupLevel } from './controllerTypes';
import { isLookupFromSubtitle, lookupCueRange } from './lookupTargetDom';

function definitionsFieldText(prefill: PopupCardCreatorPrefill): string {
  const senses = formatDefinitions(prefill.definitions);
  if (!senses.trim()) return '';
  return prefill.lookupResult
    ? formatDefFromLookup(prefill.lookupResult, senses, prefill.term)
    : formatDefEntry({ term: prefill.term, reading: prefill.reading, senses });
}


export interface CardCreatorBridgeDeps {
  readonly container: HTMLElement;
  readonly cardCreatorSettings: CardCreatorSettings;
  readonly panelController?: PanelMountController;
  readonly getNativeLang: () => string;
  readonly getVideo: () => HTMLVideoElement | undefined;
  readonly getTargetCues: () => readonly CueRange[];
  readonly getNativeCues: () => readonly CueRange[];
  readonly getSrsDestination: () => SrsDestination;
  readonly closePopup: () => void;
}

export interface CardCreatorBridge {
  readonly updateSettings: (settings: CardCreatorSettings) => void;
  readonly open: (context: CardCreatorOpenContext, action?: CardCreatorAction) => void;
  readonly sendToCard: (
    context: CardCreatorOpenContext,
    action?: CardCreatorAction,
    selection?: PopupCardCreatorPrefill,
  ) => void;
  readonly isOpen: () => boolean;
  readonly handlePopupCardCreatorAction: (
    level: PopupLevel,
    action: PopupCardCreatorAction,
    prefill: PopupCardCreatorPrefill,
  ) => OnCardCreatorActionResult;
  readonly handlePopupQuickAdd: (level: PopupLevel, prefill: PopupCardCreatorPrefill) => void;
  readonly unmount: () => void;
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

export function createCardCreatorBridge(deps: CardCreatorBridgeDeps): CardCreatorBridge {
  let ccSettings = deps.cardCreatorSettings;
  let cardCreatorMount: CardCreatorMountController | null = null;

  function updateSettings(settings: CardCreatorSettings): void {
    ccSettings = settings;
    cardCreatorMount?.updateSettings(settings);
  }

  function open(
    context: CardCreatorOpenContext,
    action?: CardCreatorAction,
  ): void {
    if (!cardCreatorMount) {
      cardCreatorMount = mountCardCreatorDialog(ccSettings, deps.getSrsDestination);
    } else {
      cardCreatorMount.updateSettings(ccSettings);
    }
    cardCreatorMount.open(context, action);
  }

  function sendToCard(
    context: CardCreatorOpenContext,
    action?: CardCreatorAction,
    selection?: PopupCardCreatorPrefill,
  ): void {
    if (!deps.panelController) {
      open(context, action);
      return;
    }

    const sentence = context.prefill?.sentence ?? context.cue?.targetText ?? '';
    const translation =
      context.prefill?.sentenceTranslation ??
      context.cue?.nativeText ??
      selection?.translation ??
      '';

    // Prefer the explicit popup prefill (target word + definitions) even when a
    // queue is present, so the integrated Dictionary starts with the user's
    // selected term rather than empty. If no prefill term exists, leave the
    // dictionary empty and let the queue drive term selection.
    const prefillTerm = context.prefill?.targetWord;
    const prefillDefinitions = context.prefill?.definitions;
    const term = prefillTerm;
    const definitionsText = prefillDefinitions ?? '';

    const contextDefinitions = definitionsText
      ? parseDefinitionsText(definitionsText)
      : [];
    const definitions = selection?.definitions?.length
      ? selection.definitions
      : contextDefinitions;

    const rawDefinitions: string[] =
      selection?.rawDefinitions && selection.rawDefinitions.length > 0
        ? [...selection.rawDefinitions]
        : definitionsText
          ? definitionsText.split('\n').filter((line) => line.trim())
          : [];

    const wordAudioUrls = context.prefill?.wordAudioUrls?.length
      ? context.prefill.wordAudioUrls
      : (selection?.wordAudioUrls ?? []);
    const hasRecordedAudio = (context.initialMedia ?? []).some((f) => f.kind === 'audio');
    const sentenceAudioUrls = hasRecordedAudio
      ? []
      : context.prefill?.sentenceAudioUrls?.length
        ? context.prefill.sentenceAudioUrls
        : (selection?.sentenceAudioUrls ?? []);
    const imageUrls = context.prefill?.imageUrls?.length
      ? context.prefill.imageUrls
      : (selection?.imageUrls ?? []);

    const prefill: DictionaryPanelPrefill = {
      term,
      langCode: context.sourceLang,
      reading: selection?.reading ?? '',
      definitions,
      rawDefinitions,
      contextSentence: sentence,
      translation,
      wordAudioUrls,
      sentenceAudioUrls,
      imageUrls,
      // Clone the full popup lookup result and loaded media items so the
      // integrated Dictionary can re-render the exact candidate + tabs.
      lookupResult: selection?.lookupResult,
      audioItems: selection?.audioItems,
      imageItems: selection?.imageItems,
      video: context.video,
      cue: context.cue,
      initialMedia: context.initialMedia,
      queue: context.queue,
      initialAction: action,
      mediaPending: context.mediaPending,
      // Popup selection snapshot — cloned by the integrated Dictionary.
      selectedImageIds: selection?.selectedImageIds,
      selectedAudioIds: selection?.selectedAudioIds,
      selectedDefinitionIds: selection?.selectedDefinitionIds,
      selectedExampleIds: selection?.selectedExampleIds,
      translationSelected: selection?.translationSelected,
    };

    deps.panelController.sendToCard(prefill).catch((err: unknown) => {
      console.warn('[web-text-dict] sendToCard failed:', err);
    });
  }

  function isOpen(): boolean {
    return (cardCreatorMount?.isOpen() ?? false) || (deps.panelController?.isOpen() ?? false);
  }

  /** Capture screenshot + sentence audio for the cue a subtitle-origin lookup
   *  belongs to. When lookupCue names a cue that is not currently playing
   *  (subtitle panel), the video is first seeked into it and must land with
   *  decodable data — otherwise nothing is captured rather than attaching a
   *  wrong-position screenshot or a different sentence's audio. */
  async function captureCueMedia(
    captureVideo: HTMLVideoElement,
    lookupCue: CueRange | undefined,
    onRecordingStart?: () => void,
  ): Promise<{ screenshot?: MediaFile; audio?: MediaFile; cue?: BilingualCue }> {
    await waitForVideoReady(captureVideo);
    const currentMs = captureVideo.currentTime * 1000;

    if (lookupCue && !(currentMs >= lookupCue.start && currentMs <= lookupCue.end)) {
      const landed = await seekAndWaitReady(captureVideo, lookupCue.start / 1000);
      if (!landed) return {};
    }

    const result: { screenshot?: MediaFile; audio?: MediaFile; cue?: BilingualCue } = {};
    try {
      result.screenshot = await captureScreenshot(captureVideo);
    } catch { /* non-fatal */ }

    const target =
      lookupCue ??
      (() => {
        const cues = deps.getTargetCues();
        const ms = captureVideo.currentTime * 1000;
        return cues.find((c) => ms >= c.start && ms <= c.end);
      })();

    if (target) {
      const nativeCues = deps.getNativeCues();
      const nativeCue = nativeCues.find(
        (c) => c.start <= target.end && c.end >= target.start,
      );
      result.cue = {
        index: target.index ?? 0,
        start: target.start,
        end: target.end,
        targetText: target.text ?? '',
        nativeText: nativeCue?.text ?? '',
      };
      onRecordingStart?.();
      try {
        const audioR = await captureSentenceAudio(captureVideo, { start: target.start, end: target.end });
        if (audioR.ok) result.audio = audioR.file;
      } catch { /* non-fatal */ }
    }
    return result;
  }

  async function openStandaloneCardCreator(
    action: PopupCardCreatorAction,
    prefill: PopupCardCreatorPrefill,
    fromSubtitle: boolean,
    lookupCue?: CueRange,
  ): Promise<void> {
    const settings = await loadSettingsOrToast(deps.container);
    if (!settings) return;
    updateSettings(settings.cardCreator);

    if (deps.getSrsDestination() !== 'ocean-srs') {
      void prefetchAnkiConnectData(ccSettings.ankiConnectUrl).catch(() => {
        // Prefetch failure is non-fatal — loadData will retry.
      });
    }

    const definitionsText = definitionsFieldText(prefill);

    const sourceLang = settings.subtitleOverlayTargetLanguage || prefill.langCode || 'en';
    const targetLang = settings.subtitleOverlayNativeLanguage || deps.getNativeLang() || 'vi';

    const video = deps.getVideo();
    const captureVideo = video && video.videoWidth > 0 && fromSubtitle ? video : undefined;

    // Open the dialog IMMEDIATELY with whatever data is already available
    // (term, definitions, sentence, translation, media URLs selected in popup).
    // Missing media is fetched in the background and pushed into the open
    // dialog via addMediaFiles / updateTextField — so the user sees the dialog
    // right away instead of waiting for network calls to complete.
    const selectedWordAudios = (prefill.audioItems ?? []).filter(
      (item) => item.kind === 'word' && (prefill.selectedAudioIds ?? []).includes(item.id),
    );
    const selectedImages = (prefill.imageItems ?? []).filter(
      (item) => (prefill.selectedImageIds ?? []).includes(item.id),
    );
    open({
      video: captureVideo,
      sourceLang,
      targetLang,
      prefill: {
        targetWord: prefill.term,
        definitions: definitionsText,
        sentenceTranslation: prefill.translation,
        sentence: prefill.contextSentence,
        wordAudioUrls: prefill.wordAudioUrls,
        sentenceAudioUrls: captureVideo ? [] : prefill.sentenceAudioUrls,
        imageUrls: prefill.imageUrls,
        wordAudioItems: selectedWordAudios,
        imageItems: selectedImages,
      },
    }, action);

    // --- Background media fetch (non-blocking) ---
    // Screenshot + sentence audio (subtitle case only — requires video).
    if (captureVideo) {
      const chip = showProgressToast(t('dict.toast.recording'), deps.container);
      void (async () => {
        let recorded = false;
        try {
          const captured = await captureCueMedia(captureVideo, lookupCue);
          if (captured.screenshot) {
            cardCreatorMount?.addMediaFiles('images', [captured.screenshot]);
          }
          if (captured.audio) {
            cardCreatorMount?.addMediaFiles('sentenceAudios', [captured.audio]);
            recorded = true;
          }
        } catch { /* non-fatal */ }
        chip.dismiss();
        if (recorded) return;
        for (const url of prefill.sentenceAudioUrls ?? []) {
          try {
            const file = await fetchMediaFile(url, 'audio');
            cardCreatorMount?.addMediaFiles('sentenceAudios', [file]);
          } catch { /* non-fatal */ }
        }
        if ((prefill.sentenceAudioUrls ?? []).length === 0 && prefill.contextSentence) {
          try {
            const res = await sendMessage<MessageResponse<TtsFetchAudioResponse>>({
              type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
              payload: { tabId: 0, text: prefill.contextSentence.slice(0, 200), langCode: fromSubtitle ? sourceLang : prefill.langCode },
            });
            if (res?.success && res.data?.url) {
              const file = await fetchMediaFile(res.data.url, 'audio');
              cardCreatorMount?.addMediaFiles('sentenceAudios', [file]);
            }
          } catch { /* non-fatal */ }
        }
      })();
    }

    // Auto-fetch missing media (audio, images, translation) from the popup
    // dictionary's data sources. The popup lazily fetches these when the user
    // opens the Audio/Images/Translate tabs. If the user clicks "Send to Card"
    // without opening those tabs, the media is not yet available — fetch it
    // in the background and push into the open dialog.
    const needsAudio = !prefill.wordAudioUrls?.length;
    const needsImages = !prefill.imageUrls?.length;
    const needsSentenceAudio = !captureVideo && !prefill.sentenceAudioUrls?.length && !!prefill.contextSentence;
    const needsTranslation = !prefill.translation && !!prefill.contextSentence;

    if (needsAudio) {
      void (async () => {
        try {
          const res = await sendMessage<MessageResponse<FetchCommunityAudioResponse>>({
            type: MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO,
            payload: { tabId: 0, term: prefill.term, langCode: prefill.langCode, kind: 'word' },
          });
          const items = res?.data?.items ?? [];
          const wordItems = items.filter((a: AudioItem) => a.url && a.kind === 'word').slice(0, 1);
          if (wordItems.length > 0) {
            const file = await fetchMediaFile(wordItems[0].url!, 'audio');
            cardCreatorMount?.addMediaFiles('wordAudios', [file]);
            return;
          }
        } catch { /* non-fatal */ }
        // Fallback: TTS if community audio has no URL.
        try {
          const ttsRes = await sendMessage<MessageResponse<TtsFetchAudioResponse>>({
            type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
            payload: { tabId: 0, text: prefill.term, langCode: prefill.langCode },
          });
          if (ttsRes?.success && ttsRes.data?.url) {
            const file = await fetchMediaFile(ttsRes.data.url, 'audio');
            cardCreatorMount?.addMediaFiles('wordAudios', [file]);
          }
        } catch { /* non-fatal */ }
      })();
    }

    if (needsImages) {
      void (async () => {
        try {
          const res = await sendMessage<MessageResponse<FetchImagesResponse>>({
            type: MESSAGE_TYPES.FETCH_IMAGES,
            payload: { tabId: 0, term: prefill.term, langCode: prefill.langCode, maxResults: 8 },
          });
          const items = res?.data?.items ?? [];
          if (items.length > 0) {
            const file = await fetchMediaFile(items[0].src, 'image');
            cardCreatorMount?.addMediaFiles('images', [file]);
          }
        } catch { /* non-fatal */ }
      })();
    }

    if (needsSentenceAudio) {
      void (async () => {
        try {
          const res = await sendMessage<MessageResponse<TtsFetchAudioResponse>>({
            type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
            payload: { tabId: 0, text: prefill.contextSentence!.slice(0, 200), langCode: fromSubtitle ? sourceLang : prefill.langCode },
          });
          if (res?.success && res.data?.url) {
            const file = await fetchMediaFile(res.data.url, 'audio');
            cardCreatorMount?.addMediaFiles('sentenceAudios', [file]);
          }
        } catch { /* non-fatal */ }
      })();
    }

    if (needsTranslation) {
      void (async () => {
        try {
          const res = await sendMessage<MessageResponse<{ translated: string[] }>>({
            type: MESSAGE_TYPES.TRANSLATE,
            payload: { tabId: 0, text: prefill.contextSentence, sl: sourceLang, tl: targetLang },
          });
          if (res?.success && res.data?.translated?.length) {
            cardCreatorMount?.updateTextField('sentenceTranslation', res.data.translated.join(' '));
          }
        } catch { /* non-fatal */ }
      })();
    }
  }

  /** Collect audio/image URLs + captured subtitle media (screenshot + sentence audio)
   *  for a popup Card Creator / Quick Add action. Reused by both the integrated
   *  panel and standalone dialog paths so neither path forgets the recording.
   *  URL fetches run in parallel with the video capture; a recorded cue clip
   *  wins over TTS sentence audio. */
  async function collectCardCreatorMedia(
    prefill: PopupCardCreatorPrefill,
    sourceLang: string,
    fromSubtitle: boolean,
    warnings?: string[],
    onRecordingStart?: () => void,
    lookupCue?: CueRange,
  ): Promise<{
    wordAudioUrls: readonly string[];
    sentenceAudioUrls: readonly string[];
    imageUrls: readonly string[];
    initialMedia: MediaFile[];
    cue?: BilingualCue;
  }> {
    const initialMedia: MediaFile[] = [];
    let cue: BilingualCue | undefined;
    let wordAudioUrls = prefill.wordAudioUrls ?? [];
    let imageUrls = prefill.imageUrls ?? [];
    let ttsSentenceUrls: readonly string[] = [];

    const video = deps.getVideo();
    const captureTask = (async (): Promise<void> => {
      if (video && video.videoWidth > 0 && fromSubtitle) {
        try {
          const captured = await captureCueMedia(video, lookupCue, onRecordingStart);
          if (captured.screenshot) {
            initialMedia.push(captured.screenshot);
          } else {
            warnings?.push('screenshot');
          }
          if (captured.cue) {
            cue = {
              ...captured.cue,
              targetText: captured.cue.targetText || prefill.contextSentence || '',
            };
          }
          if (captured.audio) {
            initialMedia.push(captured.audio);
          } else if (captured.cue) {
            warnings?.push('sentence audio capture');
          }
        } catch { warnings?.push('sentence audio capture'); }
      }
    })();

    const fetchTask = (async (): Promise<void> => {
      const needsWordAudio = wordAudioUrls.length === 0;
      const needsImages = imageUrls.length === 0;
      const wantsSentenceTts = (prefill.sentenceAudioUrls ?? []).length === 0 && !!prefill.contextSentence;
      if (!needsWordAudio && !needsImages && !wantsSentenceTts) return;

      const tasks: Promise<void>[] = [];

      if (needsWordAudio) {
        tasks.push((async (): Promise<void> => {
          try {
            const res = await sendMessage<MessageResponse<FetchCommunityAudioResponse>>({
              type: MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO,
              payload: { tabId: 0, term: prefill.term, langCode: prefill.langCode, kind: 'word' },
            });
            const items = res?.data?.items ?? [];
            const wordItems = items.filter((a: AudioItem) => a.url && a.kind === 'word').slice(0, 1);
            if (wordItems.length > 0) {
              wordAudioUrls = wordItems.map((a: AudioItem) => a.url!);
            }
          } catch { /* non-fatal */ }
          if (!wordAudioUrls.length) {
            try {
              const ttsRes = await sendMessage<MessageResponse<TtsFetchAudioResponse>>({
                type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
                payload: { tabId: 0, text: prefill.term, langCode: prefill.langCode },
              });
              if (ttsRes?.success && ttsRes.data?.url) {
                wordAudioUrls = [ttsRes.data.url];
              }
            } catch { /* non-fatal */ }
          }
        })());
      }

      if (needsImages) {
        tasks.push((async (): Promise<void> => {
          try {
            const res = await sendMessage<MessageResponse<FetchImagesResponse>>({
              type: MESSAGE_TYPES.FETCH_IMAGES,
              payload: { tabId: 0, term: prefill.term, langCode: prefill.langCode, maxResults: 8 },
            });
            const items = res?.data?.items ?? [];
            if (items.length > 0) {
              imageUrls = items.slice(0, 1).map((img: ImageItem) => img.src);
            }
          } catch { /* non-fatal */ }
        })());
      }

      if (wantsSentenceTts) {
        tasks.push((async (): Promise<void> => {
          try {
            const res = await sendMessage<MessageResponse<TtsFetchAudioResponse>>({
              type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
              payload: { tabId: 0, text: prefill.contextSentence!.slice(0, 200), langCode: fromSubtitle ? sourceLang : prefill.langCode },
            });
            if (res?.success && res.data?.url) {
              ttsSentenceUrls = [res.data.url];
            }
          } catch { /* non-fatal */ }
        })());
      }

      await Promise.all(tasks);
    })();

    await Promise.all([captureTask, fetchTask]);

    const hasRecordedAudio = initialMedia.some((f) => f.kind === 'audio');
    const sentenceAudioUrls = hasRecordedAudio
      ? []
      : (prefill.sentenceAudioUrls?.length ? prefill.sentenceAudioUrls : ttsSentenceUrls);

    return { wordAudioUrls, sentenceAudioUrls, imageUrls, initialMedia, cue };
  }

  function handlePopupCardCreatorAction(
    level: PopupLevel,
    action: PopupCardCreatorAction,
    prefill: PopupCardCreatorPrefill,
  ): OnCardCreatorActionResult {
    // Capture subtitle context BEFORE returning — closePopup clears the
    // level's highlightTarget synchronously after this function returns.
    const fromSubtitle = isLookupFromSubtitle(level);
    const lookupCue = lookupCueRange(level) ?? undefined;
    deps.closePopup();

    if (deps.panelController) {
      // ADR-065: route to the integrated universal panel. Media is collected
      // asynchronously so the panel opens with screenshot/audio/image while
      // the progress chip reports the recording state over the video.
      const chip = showProgressToast(t('dict.toast.preparingCard'), deps.container);
      void (async (): Promise<void> => {
        try {
          const settings = await loadSettingsOrToast(deps.container);
          if (!settings) {
            chip.dismiss();
            return;
          }

          const sourceLang = settings.subtitleOverlayTargetLanguage || prefill.langCode || 'en';
          const targetLang = settings.subtitleOverlayNativeLanguage || deps.getNativeLang() || 'vi';
          const translationTask = (async (): Promise<string | undefined> => {
            if (prefill.translation || !prefill.contextSentence) return prefill.translation;
            try {
              const res = await sendMessage<MessageResponse<{ translated: string[] }>>({
                type: MESSAGE_TYPES.TRANSLATE,
                payload: { tabId: 0, text: prefill.contextSentence, sl: sourceLang, tl: targetLang },
              });
              if (res?.success && res.data?.translated?.length) {
                return res.data.translated.join(' ');
              }
            } catch { /* non-fatal */ }
            return undefined;
          })();
          const media = await collectCardCreatorMedia(prefill, sourceLang, fromSubtitle, undefined, () => {
            chip.update(t('dict.toast.recording'));
          }, lookupCue);
          const sentenceTranslation =
            media.cue?.nativeText ||
            prefill.translation ||
            (await translationTask);

          const selectedWordAudios = (prefill.audioItems ?? []).filter(
            (item) => item.kind === 'word' && (prefill.selectedAudioIds ?? []).includes(item.id),
          );
          const selectedImages = (prefill.imageItems ?? []).filter(
            (item) => (prefill.selectedImageIds ?? []).includes(item.id),
          );
          const video = deps.getVideo();
          const context: CardCreatorOpenContext = {
            video: video && video.videoWidth > 0 && fromSubtitle ? video : undefined,
            sourceLang,
            targetLang,
            cue: media.cue,
            initialMedia: media.initialMedia,
            prefill: {
              targetWord: prefill.term,
              definitions: definitionsFieldText(prefill),
              sentence: prefill.contextSentence,
              sentenceTranslation,
              wordAudioUrls: media.wordAudioUrls,
              sentenceAudioUrls: media.sentenceAudioUrls,
              imageUrls: media.imageUrls,
              wordAudioItems: selectedWordAudios,
              imageItems: selectedImages,
            },
          };

          sendToCard(context, action, prefill);
          chip.dismiss();
        } catch (err: unknown) {
          console.warn('[web-text-dict] sendToCard failed:', err);
          chip.finish(t('dict.toast.sendToCardFailed', [err instanceof Error ? err.message : String(err)]), 'error');
        }
      })();
      return { stayOpen: false };
    }

    // Standalone Card Creator dialog fallback — open the dialog in the background.
    void openStandaloneCardCreator(action, prefill, fromSubtitle, lookupCue);
    return { stayOpen: false };
  }

  function handlePopupQuickAdd(level: PopupLevel, prefill: PopupCardCreatorPrefill): void {
    const destination = deps.getSrsDestination();
    if (destination === 'ocean-srs') {
      void handlePopupAddToSrs(prefill);
      return;
    }
    // Anki Quick Add now routes through the same queue + Dictionary flow so the
    // user can pick one term before it is added.
    handlePopupCardCreatorAction(level, 'quick-add', prefill);
  }

  async function handlePopupAddToSrs(prefill: PopupCardCreatorPrefill): Promise<void> {
    deps.closePopup();
    showToast(t('dict.toast.srsAdding'), deps.container, { variant: 'info' });
    try {
      await addToOceanSrs(prefill);
      showToast(t('dict.toast.srsAdded'), deps.container, { variant: 'success' });
      await openSrsStudyPage();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(t('dict.toast.srsFailed', [msg]), deps.container, { variant: 'error' });
    }
  }

  function unmount(): void {
    cardCreatorMount?.unmount();
    cardCreatorMount = null;
  }

  return {
    updateSettings,
    open,
    sendToCard,
    isOpen,
    handlePopupCardCreatorAction,
    handlePopupQuickAdd,
    unmount,
  };
}
