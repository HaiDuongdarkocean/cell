/**
 * Card actions — shared subtitle-to-Anki orchestration.
 *
 * Extracted from contentScriptController.ts so both content-script and
 * local-player can reuse the same logic (SSOT). Each function is pure-ish:
 * it takes explicit dependencies (video, stores, etc.) rather than
 * closing over controller state.
 */

import { buildCardCreatorContext } from '@/features/cardCreator/ui/mountCardCreatorDialog';
import { captureScreenshot } from '@/features/cardCreator/media/screenshot';
import { captureSentenceAudio } from '@/features/cardCreator/media/sentenceAudio';
import { prefetchAnkiConnectData } from '@/features/cardCreator/service/cardCreatorPrefetch';
import { useCardCreatorStore } from '@/stores/cardCreatorStore';
import { t } from '@/shared/i18n';
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

/** ADR-026: Handle Card Creator action (quick-update, edit-card, or update-current).
 *  quick-update → open the integrated Card Creator with initialAction='quick-add'.
 *  edit-card → open with initialAction='edit-card' (neutral, edit form).
 *  update-current → open with initialAction='quick-update' (focus Update).
 *  No queue/prefill — the user picks the term in the integrated Dictionary. */
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

  // Open the card creator immediately with the cue text; captured media
  // arrives via a second sendToCard below. mediaPending keeps submit
  // disabled (capturingMedia) until that lands.
  ctx.webTextCtrl.sendToCard({ ...cardCtx, mediaPending: true }, initialAction);

  const initialMedia: MediaFile[] = [];
  try {
    // ADR-026 / spec §3 + §4: the screenshot must reflect the frame the user
    // saw when they clicked, so capture still runs ahead of any UI that would
    // change it. Audio capture seeks the video to cue.start and plays until
    // cue.end — the panel renders above the video without disturbing playback.
    await waitForVideoReady(ctx.video);
    try {
      initialMedia.push(await captureScreenshot(ctx.video));
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
  } finally {
    useCardCreatorStore.getState().setCapturingMedia(false);
  }

  // The user may have closed the panel during capture — respect the close.
  if (!ctx.webTextCtrl.isCardCreatorOpen()) return;
  ctx.webTextCtrl.sendToCard({ ...cardCtx, initialMedia }, initialAction);
}
