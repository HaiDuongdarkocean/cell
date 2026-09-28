import { useCuesStore } from '../cuesStore';
import { mergeCuesForPanel, broadcastCues } from '@/features/subtitle';
import { cleanTargetCues } from '../logic/subtitleCleanupRuntime';
import { canonicalNavUrl } from './contentScriptShared';
import { t } from '@/shared/i18n';
import type { ContentScriptContext } from './contentScriptContext';
import type { SrtCue } from '@/entities/media';

import { isCellDebug } from '@/shared/lib/cellDebug';

export function createContentScriptLifecycleHandlers(ctx: ContentScriptContext): {
  onVisibilityChange: () => void;
  onSpaNav: () => void;
  onOcrTracksMessage: (e: MessageEvent) => void;
} {
  const { blockController, syncController } = ctx;

  // Re-send SUBTITLE_CUES_LOADED when tab becomes visible again.
  // Bug: switching to another tab and back left sidepanel showing "No subtitles
  // loaded" because the background's per-tab cue cache was cleared (SW restart or
  // onTabUpdated loading), and the content-script only sends cues once on auto-load.
  // On re-visibility, re-broadcast cached bilingualCues so the background can
  // re-cache + relay to the sidepanel. ponytail: visibilitychange is the native
  // signal for "tab became active again" — no polling, no chrome.tabs API needed
  // (content-script cannot access chrome.tabs).
  const onVisibilityChange = (): void => {
    // ADR-021 D6: pause translate prefill when tab hidden, resume when visible
    if (document.visibilityState === 'hidden') {
      ctx.getTranslatePrefill()?.pause();
    } else if (document.visibilityState === 'visible') {
      ctx.getTranslatePrefill()?.resume();
      if (ctx.getBilingualCues().length === 0) return;
      broadcastCues(ctx.getBilingualCues());
    }
  };

  // ponytail: proactive SPA-nav clear. YouTube keep <video> on SPA nav →
  // overlay not re-init → stale cues from previous video persist when the
  // background round-trip (MAIN-world detect → DETECTED_SUBTITLES →
  // AUTO_LOAD_SUBTITLES null) is delayed/lost (poll timeout 2s, InnerTube
  // error, SW restart). Native yt-navigate-finish + popstate fire reliably
  // on YouTube SPA nav → clear ngay, không đợi background.
  // Ceiling: nav without URL change (rare on YouTube) → not caught. Upgrade:
  // MutationObserver on <video> src.
  const onSpaNav = (): void => {
    // Tokenize enablement is per-URL — re-evaluate on every nav, even when the
    // cue-clearing path below early-returns (e.g. no auto-load ran yet).
    void ctx.syncSubtitleTokenize();
    const lastAutoLoadUrl = ctx.getLastAutoLoadUrl();
    const currentNavUrl = canonicalNavUrl(location.href);
    if (lastAutoLoadUrl === undefined || lastAutoLoadUrl === currentNavUrl) return;
    if (isCellDebug()) {
      try { const a = JSON.parse(document.documentElement.getAttribute('data-cell-debug-autoload-arr') ?? '[]'); a.push({ step: 'spaNav-clear', lastAutoLoadUrl, navUrl: currentNavUrl, href: location.href, t: Date.now() }); document.documentElement.setAttribute('data-cell-debug-autoload-arr', JSON.stringify(a.slice(-20))); } catch { /* ignore */ }
    }
    blockController?.clearCues();
    ctx.getOffsetController()?.loadCues(false);
    syncController.latestTargetCues = [];
    ctx.getTranslatePrefill()?.clear();
    ctx.setTranslatePrefill(null);
    ctx.clearTranslatedNativeState();
    syncController.activeNativeSource = 'auto';
    ctx.updateGenerateNativeEnabled();
    ctx.setLastAutoLoadKey(undefined);
    ctx.setLastAutoLoadUrl(undefined);
    // Clear auto-detected track list + manager panel so stale tracks from the
    // previous video don't persist. Without this, the SubtitleManagerPanel
    // keeps showing the old video's tracks after SPA nav to a video with no
    // subtitles (onSpaNav cleared overlay cues but not the panel items).
    syncController.autoTargetItems = [];
    syncController.autoNativeItems = [];
    syncController.targetMatches = [];
    syncController.nativeMatches = [];
    syncController.activeTargetIndex = 0;
    syncController.activeNativeIndex = 0;
    ctx.refreshPanel('target');
    ctx.refreshPanel('native');
    useCuesStore.getState().setLoadStatus('target', { state: 'none' });
    useCuesStore.getState().setLoadStatus('native', { state: 'idle' });
    void ctx.syncSubtitleTokenize();
  };

  // OCR dual-stream bridge (spec ocr-split-dual-stream): the OCR content script
  // (same isolated world) posts '__CELL_OCR_TRACKS' with growing target/native cue
  // lists and '__CELL_OCR_TRACKS_END' when the split session stops or split turns
  // off. First message snapshots the active sources (restored on END), creates the
  // two virtual slots and auto-switches both roles to the OCR source.
  const onOcrTracksMessage = (e: MessageEvent): void => {
    if (e.source !== window) return;
    const d = e.data as { type?: string; targetCues?: SrtCue[]; nativeCues?: SrtCue[] };
    if (d?.type === '__CELL_OCR_TRACKS' && d.targetCues && d.nativeCues) {
      if (!syncController.ocrTargetSlot || !syncController.ocrNativeSlot) {
        syncController.preOcrSources = { target: syncController.activeTargetSource, native: syncController.activeNativeSource };
        syncController.ocrTargetSlot = { item: syncController.makeOcrPanelItem('ocr-target', t('subtitle.ocr.targetLive'), 'target'), cues: [] };
        syncController.ocrNativeSlot = { item: syncController.makeOcrPanelItem('ocr-native', t('subtitle.ocr.nativeLive'), 'native'), cues: [] };
      }
      const targetCues = cleanTargetCues(d.targetCues);
      syncController.ocrTargetSlot.cues = targetCues;
      syncController.ocrNativeSlot.cues = d.nativeCues;
      syncController.activeTargetSource = 'ocr';
      syncController.activeNativeSource = 'ocr';
      blockController?.loadBilingualCues(targetCues, d.nativeCues);
      ctx.showOverlay();
      syncController.latestTargetCues = targetCues;
      ctx.getOffsetController()?.loadCues(true);
      ctx.setBilingualCues(mergeCuesForPanel(targetCues, d.nativeCues));
      broadcastCues(ctx.getBilingualCues());
      ctx.refreshPanel('target');
      ctx.refreshPanel('native');
      return;
    }
    if (d?.type === '__CELL_OCR_TRACKS_END') {
      syncController.ocrTargetSlot = null;
      syncController.ocrNativeSlot = null;
      if (syncController.preOcrSources) {
        syncController.activeTargetSource = syncController.preOcrSources.target;
        syncController.activeNativeSource = syncController.preOcrSources.native;
        syncController.preOcrSources = null;
      }
      ctx.refreshPanel('target');
      ctx.refreshPanel('native');
    }
  };

  return { onVisibilityChange, onSpaNav, onOcrTracksMessage };
}
