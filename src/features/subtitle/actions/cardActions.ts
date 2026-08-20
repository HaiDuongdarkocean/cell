/**
 * Card actions — shared subtitle-to-Anki orchestration.
 *
 * Extracted from contentScriptController.ts so both content-script and
 * local-player can reuse the same logic (SSOT). Each function is pure-ish:
 * it takes explicit dependencies (video, sendMessage, etc.) rather than
 * closing over controller state.
 */
import { sendMessage } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { getWordStatuses } from '@/features/dictionaryPopup/services/wordStatusClient';
import { buildCardCreatorContext } from '@/features/cardCreator/ui/mountCardCreatorDialog';
import { captureScreenshot } from '@/features/cardCreator/media/screenshot';
import { captureSentenceAudio } from '@/features/cardCreator/media/sentenceAudio';
import { prefetchAnkiConnectData } from '@/features/cardCreator/service/cardCreatorPrefetch';
import { quickAddNote } from '@/features/cardCreator/service/quickAddNote';
import { DraftAutosaver } from '@/features/cardCreator/state/cardDraft';
import type { CardCreatorQueueItem } from '@/features/cardCreator/ui/mountCardCreatorDialog';
import type { LookupResult } from '@/features/dictionaryPopup/types';
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
 *  filter unknown/tracking → lookup each in dictionary → return queue items.
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
  // Look up each word in the dictionary (parallel for speed).
  const results = await Promise.all(learnWords.map(async (term) => {
    try {
      const response = await sendMessage({
        type: MESSAGE_TYPES.LOOKUP_REQUEST,
        payload: {
          requestId: `queue-${Date.now()}-${term}`,
          request: { term, langCode: sourceLang, contextSentence: targetText, cursorOffset: 0 },
        },
      }) as { success: boolean; data?: LookupResult[] };
      const definitions = response.success && response.data && response.data.length > 0
        ? response.data.flatMap((r) => r.definitions).map((d) => (d.pos ? `(${d.pos}) ${d.text}` : d.text)).join('\n')
        : '';
      const status = statusMap.get(term) ?? 'unknown';
      return { term, definitions, status: status === 'tracking' ? 'tracking' : 'unknown' } as CardCreatorQueueItem;
    } catch {
      const status = statusMap.get(term) ?? 'unknown';
      return { term, definitions: '', status: status === 'tracking' ? 'tracking' : 'unknown' } as CardCreatorQueueItem;
    }
  }));
  return results;
}

/** ADR-026: Handle Card Creator action (quick-update, edit-card, or update-current).
 *  quick-update → batch quick-add all unknown/tracking words in the current
 *    subtitle line directly to Anki (no dialog). I+1 = 1 word → 1 card,
 *    I+N = N words → N cards.
 *  edit-card → open the Card Creator dialog pre-filled.
 *  update-current → open dialog with initialAction='quick-update' (focus Update). */
export async function handleCardCreatorAction(ctx: SubtitleActionContext, action: CardCreatorAction): Promise<void> {
  if (action === 'quick-update') {
    await handleClusterQuickAdd(ctx);
    return;
  }
  // edit-card + update-current need webTextCtrl to open the Card Creator dialog.
  if (!ctx.webTextCtrl) return;
  // edit-card + update-current: open dialog (flow below).
  // ADR-027: update-current → initialAction='quick-update' (focus Update button).
  // edit-card → initialAction='edit-card' (neutral).
  const initialAction = action === 'update-current' ? 'quick-update' : 'edit-card';
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
    ctx.showToast('No active subtitle — play the video and wait for a subtitle line.', { variant: 'info' });
    return;
  }

  // ADR-026 / spec §3 + §4: capture screenshot + sentence audio BEFORE
  // opening the dialog. The screenshot must reflect the frame the user saw
  // when they clicked (before any UI changes). Audio capture seeks the video
  // to cue.start and plays until cue.end — doing this before the dialog opens
  // avoids the overlay interfering with playback. Show a brief "capturing"
  // toast so the user knows why there's a short delay.
  ctx.showToast('Capturing media…', { variant: 'info' });
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
}

/** Batch quick-add: find all unknown/tracking words in the current subtitle
 *  line, look up each in the dictionary, and add a card for each directly to
 *  Anki (no dialog). I+1 = 1 unknown word → 1 card. I+N = N unknown words →
 *  N cards. Media (screenshot + sentence audio) is captured once and shared
 *  across all cards in the same sentence. */
export async function handleClusterQuickAdd(ctx: SubtitleActionContext): Promise<void> {
  const targetText = ctx.getCurrentTargetText();
  if (!targetText) {
    ctx.showToast('No active subtitle — play the video and wait for a subtitle line.', { variant: 'info' });
    return;
  }
  const nativeText = ctx.getCurrentNativeText() ?? '';

  // Load settings + draft config.
  const settings = await ctx.loadSettingsOrToast(ctx.container);
  if (!settings) return;
  const cc = settings.cardCreator;
  const autosaver = new DraftAutosaver();
  const restored = await autosaver.load();
  const deck = restored?.deck ?? cc.defaultDeck;
  const noteType = restored?.noteType ?? cc.defaultNoteType;
  const fieldMapping = restored?.fieldMapping ?? {};
  const tags = restored?.tags ?? cc.defaultTags;
  if (!deck || !noteType) {
    ctx.showToast('Quick Add needs a deck + note type. Open Card Creator first to configure.', { variant: 'error' });
    return;
  }
  if (Object.keys(fieldMapping).length === 0) {
    ctx.showToast('Quick Add needs field mapping. Open Card Creator first to configure.', { variant: 'error' });
    return;
  }

  const sourceLang = settings.subtitleOverlayTargetLanguage || 'en';

  // Tokenize the subtitle into unique lowercase word terms.
  const words = tokenizeSubtitleWords(targetText);
  if (words.length === 0) {
    ctx.showToast('No words found in the current subtitle.', { variant: 'info' });
    return;
  }

  // Get word statuses and filter to unknown/tracking.
  const statusMap = await getWordStatuses(sourceLang, words);
  const learnWords = words.filter((w) => {
    const s = statusMap.get(w);
    return s === 'unknown' || s === 'tracking';
  });
  if (learnWords.length === 0) {
    ctx.showToast('No unknown/tracking words in this subtitle line.', { variant: 'info' });
    return;
  }

  ctx.showToast(`Quick Add — looking up ${learnWords.length} word${learnWords.length > 1 ? 's' : ''}…`, { variant: 'info' });

  // Capture media once (shared across all cards).
  const images: MediaFile[] = [];
  const sentenceAudios: MediaFile[] = [];
  if (ctx.video && ctx.video.videoWidth > 0) {
    await waitForVideoReady(ctx.video);
    try {
      const screenshot = await captureScreenshot(ctx.video);
      images.push(screenshot);
    } catch { /* non-fatal */ }
    try {
      const cues = ctx.getTargetCues();
      const currentMs = ctx.video.currentTime * 1000;
      const matchingCue = cues.find((c) => currentMs >= c.start && currentMs <= c.end);
      if (matchingCue) {
        const audioR = await captureSentenceAudio(ctx.video, { start: matchingCue.start, end: matchingCue.end });
        if (audioR.ok) sentenceAudios.push(audioR.file);
      }
    } catch { /* non-fatal */ }
  }

  // Look up each word + add a card.
  let added = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const term of learnWords) {
    // Dictionary lookup via background service worker.
    let definitions = '';
    try {
      const response = await sendMessage({
        type: MESSAGE_TYPES.LOOKUP_REQUEST,
        payload: {
          requestId: `cluster-qa-${Date.now()}-${term}`,
          request: { term, langCode: sourceLang, contextSentence: targetText, cursorOffset: 0 },
        },
      }) as { success: boolean; data?: LookupResult[] };
      if (response.success && response.data && response.data.length > 0) {
        definitions = response.data
          .flatMap((r) => r.definitions)
          .map((d) => (d.pos ? `(${d.pos}) ${d.text}` : d.text))
          .join('\n');
      }
    } catch {
      // Lookup failure is non-fatal — card is added with empty definitions.
    }

    const result = await quickAddNote(
      cc.ankiConnectUrl,
      deck,
      noteType,
      fieldMapping,
      tags,
      {
        targetWord: term,
        sentence: targetText,
        sentenceTranslation: nativeText,
        definitions,
        note: '',
        moreExample: '',
      },
      { images, sentenceAudios, wordAudios: [] },
      (msg) => errors.push(`${term}: ${msg}`),
    );

    if (result.ok && result.noteId !== null) {
      added++;
    } else if (result.ok && result.noteId === null) {
      skipped++;
    } else if (!result.ok) {
      errors.push(`${term}: ${result.error}`);
    }
  }

  // Summary toast.
  if (added > 0) {
    ctx.showToast(`Added ${added} card${added > 1 ? 's' : ''} to "${deck}"${skipped > 0 ? `, ${skipped} duplicate${skipped > 1 ? 's' : ''} skipped` : ''}.`, { variant: 'success' });
  } else if (skipped > 0) {
    ctx.showToast(`All ${skipped} card${skipped > 1 ? 's' : ''} already exist (duplicates).`, { variant: 'warning' });
  } else {
    ctx.showToast(`Quick Add failed: ${errors.join('; ')}`, { variant: 'error' });
  }
}
