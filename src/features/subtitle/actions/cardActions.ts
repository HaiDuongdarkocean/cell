/**
 * Card actions — shared subtitle-to-Anki orchestration.
 *
 * Extracted from contentScriptController.ts so both content-script and
 * local-player can reuse the same logic (SSOT). Each function is pure-ish:
 * it takes explicit dependencies (video, sendMessage, etc.) rather than
 * closing over controller state.
 */

import { getWordStatuses } from '@/features/dictionary/services/wordStatusClient';
import { buildCardCreatorContext } from '@/features/cardCreator/ui/mountCardCreatorDialog';
import { captureScreenshot } from '@/features/cardCreator/media/screenshot';
import { captureSentenceAudio } from '@/features/cardCreator/media/sentenceAudio';
import { prefetchAnkiConnectData } from '@/features/cardCreator/service/cardCreatorPrefetch';
import { showProgressToast } from '@/features/subtitle/ui/subtitleUI';
import { t } from '@/shared/i18n';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { buildPrefill } from '@/features/dictionaryPopup/ui/buildCandidatePrefill';
import { formatDefinitions } from '@/features/dictionary/logic/formatDefinitions';
import type {
  AudioItem,
  FetchCommunityAudioResponse,
  FetchImagesResponse,
  ImageItem,
  LookupResult,
  PopupCardCreatorPrefill,
  TtsFetchAudioResponse,
} from '@/entities/dictionary';
import type { MessageResponse } from '@/entities/message';
import type { CardCreatorPrefill, CardCreatorQueueItem } from '@/features/cardCreator/types';
import type { MediaFile } from '@/features/cardCreator/media/mediaFile';
import type { CardCreatorAction } from '@/features/subtitle/ui/subtitleCueEngine';
import type { SubtitleActionContext } from './subtitleActionContext';

/** Wait for the video to reach readyState ≥ 2 (HAVE_CURRENT_DATA) with a
 *  timeout. Used before screenshot capture — the user may have just seeked
 *  or paused, leaving the video in a transient state where drawImage would
 *  throw "Video not ready". */
export async function waitForVideoReady(video: HTMLVideoElement, timeoutMs = 2000): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0) return;
  const start = Date.now();
  await new Promise<void>((resolve) => {
    const check = (): void => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        resolve();
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(); // give up — captureScreenshot will throw a clear error
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });
}

/** Split a subtitle line into unique lowercase word terms (letters only).
 *  Used by batch quick-add to find unknown/tracking words. */
export function tokenizeSubtitleWords(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of text.split(/[^a-zA-Z]+/)) {
    const w = raw.toLowerCase();
    if (w.length >= 2 && !seen.has(w)) {
      seen.add(w);
      result.push(w);
    }
  }
  return result;
}

/** Build a Card Creator queue from the current subtitle line: tokenize →
 *  filter unknown/tracking → return queue items without dictionary lookup.
 *  Lookup is deferred until the user selects a term in the queue.
 *  Used by edit-card action for the I+N review flow. */
export async function buildSubtitleQueue(targetText: string, sourceLang: string): Promise<CardCreatorQueueItem[]> {
  const words = tokenizeSubtitleWords(targetText);
  if (words.length === 0) return [];
  const statusMap = await getWordStatuses(sourceLang, words);
  const learnWords = words.filter((w) => {
    const s = statusMap.get(w);
    return s === 'unknown' || s === 'tracking';
  });
  if (learnWords.length === 0) return [];
  return learnWords.map((term) => {
    const status = statusMap.get(term) ?? 'unknown';
    return { term, definitions: '', status: status === 'tracking' ? 'tracking' : 'unknown' } as CardCreatorQueueItem;
  });
}

async function translateSentence(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string | undefined> {
  try {
    const res = await sendMessage<MessageResponse<{ translated: string[] }>>({
      type: MESSAGE_TYPES.TRANSLATE,
      payload: { tabId: 0, text, sl: sourceLang, tl: targetLang },
    });
    if (res?.success && res.data?.translated?.length) {
      return res.data.translated.join(' ');
    }
  } catch { /* non-fatal */ }
  return undefined;
}

async function fetchWordAudioItems(term: string, langCode: string): Promise<readonly AudioItem[]> {
  try {
    const res = await sendMessage<MessageResponse<FetchCommunityAudioResponse>>({
      type: MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO,
      payload: { tabId: 0, term, langCode, kind: 'word' },
    });
    if (res?.success && res.data?.items) {
      const wordItems = res.data.items.filter((a) => (a.url || a.audioBytes) && a.kind === 'word');
      if (wordItems.length > 0) return wordItems;
    }
  } catch { /* non-fatal */ }

  try {
    const ttsRes = await sendMessage<MessageResponse<TtsFetchAudioResponse>>({
      type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
      payload: { tabId: 0, text: term, langCode },
    });
    if (ttsRes?.success && ttsRes.data?.url) {
      return [{
        id: `tts-auto-${term}-${langCode}`,
        kind: 'word',
        source: 'cloud-tts',
        label: 'TTS',
        state: 'idle',
        url: ttsRes.data.url,
        defaultSelected: true,
      }];
    }
  } catch { /* non-fatal */ }

  return [];
}

async function fetchImageItems(term: string, langCode: string): Promise<readonly ImageItem[]> {
  try {
    const res = await sendMessage<MessageResponse<FetchImagesResponse>>({
      type: MESSAGE_TYPES.FETCH_IMAGES,
      payload: { tabId: 0, term, langCode, maxResults: 8 },
    });
    if (res?.success && res.data?.items) {
      return res.data.items;
    }
  } catch { /* non-fatal */ }
  return [];
}

async function lookupSingleWord(
  term: string,
  sourceLang: string,
  targetText: string,
): Promise<LookupResult | null> {
  const requestId = `auto-${term}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const res = await sendMessage<MessageResponse<LookupResult[]>>({
      type: MESSAGE_TYPES.LOOKUP_REQUEST,
      payload: {
        requestId,
        request: {
          term,
          langCode: sourceLang,
          contextSentence: targetText,
          cursorOffset: 0,
          fallback: true,
        },
      },
    });
    if (res?.success && res.data && res.data.length > 0) {
      return res.data[0]!;
    }
  } catch { /* non-fatal */ }
  return null;
}

interface SingleWordContext {
  readonly queue: readonly CardCreatorQueueItem[];
  readonly prefill: CardCreatorPrefill;
  readonly selection: PopupCardCreatorPrefill;
}

function fallbackLookupResult(term: string, langCode: string): LookupResult {
  return {
    term,
    langCode,
    reading: '',
    readingKind: 'none',
    frequency: null,
    status: 'unknown',
    partsOfSpeech: [],
    definitions: [],
    rawDefinitions: [],
    detectedPhrase: null,
    matchSource: 'fallback',
  };
}

async function buildSingleWordContext(
  term: string,
  targetText: string,
  nativeText: string | undefined,
  sourceLang: string,
  targetLang: string,
): Promise<SingleWordContext> {
  const result = await lookupSingleWord(term, sourceLang, targetText);
  const safeResult = result ?? fallbackLookupResult(term, sourceLang);

  const [audioItems, imageItems, translation] = await Promise.all([
    fetchWordAudioItems(safeResult.term, safeResult.langCode),
    fetchImageItems(safeResult.term, safeResult.langCode),
    nativeText ? Promise.resolve(nativeText) : translateSentence(targetText, sourceLang, targetLang),
  ]);

  const translationText = nativeText || translation || '';
  const popupPrefill = buildPrefill(
    safeResult,
    safeResult.definitions,
    targetText,
    translationText,
    audioItems,
    new Map<string, boolean>(),
    imageItems,
    new Map<string, boolean>(),
    !!translationText,
  );

  const definitionsText = formatDefinitions(popupPrefill.definitions);
  const wordAudioItems = (popupPrefill.audioItems ?? []).filter(
    (item) => item.kind === 'word' && (popupPrefill.selectedAudioIds ?? []).includes(item.id),
  );
  const imageItemsSelected = (popupPrefill.imageItems ?? []).filter(
    (item) => popupPrefill.selectedImageIds?.includes(item.id),
  );
  const prefill: CardCreatorPrefill = {
    targetWord: popupPrefill.term,
    definitions: definitionsText,
    sentence: popupPrefill.contextSentence,
    sentenceTranslation: popupPrefill.translation,
    wordAudioUrls: popupPrefill.wordAudioUrls,
    imageUrls: popupPrefill.imageUrls,
    wordAudioItems,
    imageItems: imageItemsSelected,
  };

  const queue: CardCreatorQueueItem[] = [{
    term: popupPrefill.term,
    definitions: definitionsText,
    status: safeResult.status === 'tracking' ? 'tracking' : 'unknown',
  }];

  return { queue, prefill, selection: popupPrefill };
}

/** ADR-026: Handle Card Creator action (quick-update, edit-card, or update-current).
 *  quick-update → open the integrated Card Creator queue with initialAction='quick-add'
 *    so the user picks a term, looks it up, and the card is added directly.
 *  edit-card → open the queue with initialAction='edit-card' (neutral, edit form).
 *  update-current → open the queue with initialAction='quick-update' (focus Update). */
export async function handleCardCreatorAction(ctx: SubtitleActionContext, action: CardCreatorAction): Promise<void> {
  if (!ctx.webTextCtrl) return;
  const initialAction: 'quick-add' | 'quick-update' | 'edit-card' =
    action === 'quick-update' ? 'quick-add' : (action === 'update-current' ? 'quick-update' : 'edit-card');
  // Load settings fresh (URL/deck/noteType/lang may have changed since init).
  const settings = await ctx.loadSettingsOrToast(ctx.container);
  if (!settings) return;
  ctx.webTextCtrl.updateCardCreatorSettings(settings.cardCreator);

  // ADR-026: prefetch AnkiConnect decks + models NOW (on click) so the
  // network round-trip overlaps with media capture (screenshot + sentence
  // audio, 2-5s). When the dialog mounts and loadData runs, it reuses the
  // cached promise — resolving instantly if capture finished first.
  void prefetchAnkiConnectData(settings.cardCreator.ankiConnectUrl).catch(() => {
    // Prefetch failure is non-fatal — loadData will retry with a fresh
    // promise and surface the error via toast.
  });

  // Build context from current subtitle state + actual subtitle languages.
  const sourceLang = settings.subtitleOverlayTargetLanguage || 'en';
  const targetLang = settings.subtitleOverlayNativeLanguage || 'vi';
  const cardCtx = buildCardCreatorContext(
    ctx.video,
    ctx.getTargetCues(),
    ctx.getNativeCues(),
    ctx.getOffsetMs(),
    sourceLang,
    targetLang,
  );
  if (!cardCtx) {
    ctx.showToast(t('dict.toast.noActiveSubtitle'), { variant: 'info' });
    return;
  }

  // ADR-026 / spec §3 + §4: capture screenshot + sentence audio BEFORE
  // opening the dialog. The screenshot must reflect the frame the user saw
  // when they clicked (before any UI changes). Audio capture seeks the video
  // to cue.start and plays until cue.end — doing this before the dialog opens
  // avoids the overlay interfering with playback.
  const chip = showProgressToast(t('dict.toast.recording'), ctx.container);
  await waitForVideoReady(ctx.video);
  const initialMedia: MediaFile[] = [];
  try {
    const screenshot = await captureScreenshot(ctx.video);
    initialMedia.push(screenshot);
  } catch {
    // Screenshot failure is non-fatal — the user can re-capture manually.
  }
  try {
    const cue = cardCtx.cue!;
    const audioR = await captureSentenceAudio(ctx.video, { start: cue.start, end: cue.end });
    if (audioR.ok) initialMedia.push(audioR.file);
  } catch {
    // Audio failure is non-fatal — screenshot + text fields still work.
  }

  // Build queue: find unknown/tracking words in the current subtitle line,
  // look up each in the dictionary. The full queue is sent to the integrated
  // panel; `useCardCreatorState` shows the sidebar when N ≥ 2 and pre-fills
  // the first item even when N = 1.
  const targetText = cardCtx.cue?.targetText ?? '';
  const queue = await buildSubtitleQueue(targetText, sourceLang);

  // If there is exactly one unknown/tracking word, perform the dictionary
  // lookup in advance so the Card Creator can be pre-filled without forcing
  // the user to open the integrated Dictionary and select the term.
  if (queue.length === 1) {
    const nativeText = cardCtx.cue?.nativeText;
    const singleWordCtx = await buildSingleWordContext(
      queue[0].term,
      targetText,
      nativeText,
      sourceLang,
      targetLang,
    );
    ctx.webTextCtrl.sendToCard(
      { ...cardCtx, initialMedia, queue: singleWordCtx.queue, prefill: singleWordCtx.prefill },
      initialAction,
      singleWordCtx.selection,
    );
    chip.dismiss();
    return;
  }

  ctx.webTextCtrl.sendToCard({ ...cardCtx, initialMedia, queue }, initialAction);
  chip.dismiss();
}
