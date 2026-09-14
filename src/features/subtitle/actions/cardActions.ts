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
import type { CardCreatorQueueItem } from '@/features/cardCreator/ui/mountCardCreatorDialog';

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

  ctx.webTextCtrl.sendToCard({ ...cardCtx, initialMedia, queue }, initialAction);
  chip.dismiss();
}


