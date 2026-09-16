import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { useCuesStore } from '@/stores/cuesStore';
import { BackgroundPrefillController } from '@/features/translate/logic/translatePrefill';
import { isoCodeToLabel } from '@/features/detection/logic/languageDetector';
import {
  seekVideo,
  resumeIfPaused,
  navigateCue,
  handleAutoLoadSubtitles,
  mergeCuesForPanel,
  showToast,
  createTranslateFunction,
  broadcastCues,
} from '@/features/subtitle';
import { shouldDedupeCueSeek, canonicalNavUrl } from './contentScriptShared';
import type { ContentScriptContext } from './contentScriptContext';
import type { SrtCue } from '@/entities/media';
import type { AutoLoadSubtitlesPayload } from '@/entities/message';

export function createContentScriptMessageHandlers(ctx: ContentScriptContext): {
  onRuntimeMessage: (msg: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => boolean | void;
  onRuntimeMessage2: (msg: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => boolean | void;
} {
  const { video, container, blockController, syncController } = ctx;

  // Receive SEEK_TO from Side Panel (via background relay) → seek video
  // msg is `unknown` per onMessage signature; narrow to { type?, payload? }
  // for property access. Safe because chrome.runtime messages are plain objects.
  const onRuntimeMessage = (msg: unknown, _sender: chrome.runtime.MessageSender, _sendResponse: (response?: unknown) => void) => {
    const m = msg as { type?: string; payload?: unknown };
    // Background relays CLOSE_SIDE_PANEL back to this content script via
    // tabs.sendMessage after closing the panel. Reset our toggle state so the
    // next 'p' on the page opens instead of sending a stale CLOSE no-op.
    // (X-button close remains a known ceiling — background doesn't see it.)
    if (m?.type === MESSAGE_TYPES.CLOSE_SIDE_PANEL) {
      ctx.setSidePanelOpen(false);
    }
    if (m?.type === MESSAGE_TYPES.SEEK_TO) {
      const timeMs = (m.payload as { timeMs: number })?.timeMs;
      if (timeMs !== undefined) {
        // ADR-019 sync: side panel clicks cue.start (raw) → seek so overlay
        // DISPLAYS that cue → shift by -offsetMs (mirror seekToCue logic).
        // ADR-030: route through seekVideo to avoid Netflix M7375.
        const offsetMs = ctx.getOffsetController()?.getOffsetMs() ?? 0;
        seekVideo(video, (timeMs - offsetMs) / 1000);
      }
    }
    // Receive TOGGLE_PLAY from Side Panel (via background relay) → toggle play/pause
    if (m?.type === MESSAGE_TYPES.TOGGLE_PLAY) {
      // ADR-030: route through playVideo/pauseVideo to avoid Netflix M7375.
      ctx.togglePlay();
    }
    if (m?.type === MESSAGE_TYPES.SET_PLAYBACK_RATE) {
      const rate = (m.payload as { rate?: number })?.rate;
      if (rate === 0.5 || rate === 0.75 || rate === 1 || rate === 1.25 || rate === 1.5) {
        if (blockController) {
          blockController.setUserPlaybackSpeed(rate);
        } else {
          video.playbackRate = rate;
        }
      }
    }
    // Receive SHORTCUT_ACTION from Side Panel (via background relay) →
    // cue navigation. ADR-021 D8: if seekTime provided (from sidepanel's local
    // calculation), seek directly — avoids stale video.currentTime at arrival.
    // Fallback: calculate from video.currentTime (for in-page keydown handler).
    if (m?.type === MESSAGE_TYPES.SHORTCUT_ACTION) {
      const payload = m.payload as { action: string; seekTime?: number };
      const action = payload?.action;
      // ADR-032: dedupe cue-nav — in-page keydown handler already seeked.
      if ((action === 'prev-cue' || action === 'next-cue' || action === 'replay-cue') && shouldDedupeCueSeek(action)) {
        return;
      }
      const offsetMs = ctx.getOffsetController()?.getOffsetMs() ?? 0;
      // ADR-021 D8: sidepanel sends seekTime (calculated at keypress time).
      // Seek directly — no need to find cue from stale video.currentTime.
      if (payload?.seekTime !== undefined && (action === 'prev-cue' || action === 'next-cue' || action === 'replay-cue')) {
        // ADR-030: route through seekVideo to avoid Netflix M7375.
        seekVideo(video, (payload.seekTime - offsetMs) / 1000);
        if (action === 'replay-cue') resumeIfPaused(video);
      } else {
        // Fallback: calculate from video.currentTime (in-page keydown path)
        // ADR-033: use getEffectiveMs so rapid press computes from intended pos.
        const effectiveMs = ctx.getEffectiveMs();
        switch (action) {
          case 'prev-cue':
          case 'next-cue':
          case 'replay-cue': {
            navigateCue(action as 'prev-cue' | 'next-cue' | 'replay-cue', video, ctx.getBilingualCues(), effectiveMs, offsetMs);
            break;
          }
          case 'toggle-overlay': {
            ctx.toggleOverlay();
            break;
          }
          case 'play-pause': {
            // ADR-030: route through playVideo/pauseVideo to avoid Netflix M7375.
            ctx.togglePlay();
            break;
          }
        case 'toggle-translate': {
          // ADR-021 D7: temporary toggle (no setting change).
          // If prefill running → clear + hide native overlay. If not → restart from syncController.latestTargetCues.
          if (ctx.getTranslatePrefill()?.isRunning) {
            ctx.getTranslatePrefill()?.clear();
            ctx.setTranslatePrefill(null);
            // Reload target-only (no native) to hide translated overlay
            blockController?.loadBilingualCues(syncController.latestTargetCues, []);
            ctx.setBilingualCues(mergeCuesForPanel(syncController.latestTargetCues, []));
            // latestNativeCues tracked by blockController — no longer needed here
            // updateCues(syncController.latestTargetCues, []);
            showToast('Auto-translate off', container, { variant: 'info' });
          } else if (syncController.latestTargetCues.length > 0) {
            // Restart prefill — load settings for sl/tl
            void (async () => {
              const s = await loadSettings();
              const sl = s.subtitleOverlayTargetLanguage;
              const tl = s.subtitleOverlayNativeLanguage;
              if (!sl || !tl || sl === tl) return;
              ctx.getTranslatePrefill()?.clear();
              const translatePrefill = new BackgroundPrefillController({
                translate: createTranslateFunction(sl, tl),
                onChunkTranslated: (translatedCues: SrtCue[]) => {
                  blockController?.loadBilingualCues(syncController.latestTargetCues, translatedCues);
                  ctx.setBilingualCues(mergeCuesForPanel(syncController.latestTargetCues, translatedCues));
                  // updateCues(syncController.latestTargetCues, translatedCues);
                  broadcastCues(ctx.getBilingualCues());
                },
                onError: (msg: string) => {
                  showToast(msg, container, { variant: 'error' });
                },
              });
              ctx.setTranslatePrefill(translatePrefill);
              translatePrefill.start(syncController.latestTargetCues, sl, tl);
              showToast('Auto-translate on', container, { variant: 'success' });
            })();
          }
          break;
        }
        }
      }
    }
    return false; // synchronous listener
  };

  // === Bilingual auto-load wiring (ADR-007 D1, spec F3/F4/F7) ===
  // msg is `unknown` per onMessage signature; narrow to { type?, payload? }
  // for property access. Safe because chrome.runtime messages are plain objects.
  const onRuntimeMessage2 = (msg: unknown, _sender: chrome.runtime.MessageSender, _sendResponse: (response?: unknown) => void) => {
    const m = msg as { type?: string; payload?: unknown };
    if (m?.type === MESSAGE_TYPES.AUTO_LOAD_SUBTITLES) {
      const payload = m.payload as AutoLoadSubtitlesPayload;
      try { const a = JSON.parse(document.documentElement.getAttribute('data-cell-debug-autoload-arr') ?? '[]'); a.push({ step: 'msg-received', hasTarget: !!payload?.target, hasNative: !!payload?.native, targetUrl: payload?.target?.url?.slice(0, 60), nativeUrl: payload?.native?.url?.slice(0, 60), t: Date.now() }); document.documentElement.setAttribute('data-cell-debug-autoload-arr', JSON.stringify(a.slice(-20))); } catch { /* ignore */ }

      // Skip duplicate payloads to avoid re-loading the same subtitle and
      // restarting translate prefill (e.g. when PAGE_SCAN_RESULT or network
      // re-detection re-pushes the same target/native URLs on seek).
      const autoLoadKey = `${payload?.target?.url ?? ''}|${payload?.native?.url ?? ''}`;
      if (autoLoadKey === ctx.getLastAutoLoadKey() && autoLoadKey !== '|') {
        return;
      }
      ctx.setLastAutoLoadKey(autoLoadKey);

      // Debug: notify the top frame that this iframe's controller received the
      // auto-load message. Helps verify broadcast-to-all-frames on moviepire.
      try {
        window.parent.postMessage({
          type: '__CELL_AUTOLOAD_HANDLED',
          href: location.href,
          target: payload?.target?.url,
          native: payload?.native?.url,
        }, '*');
      } catch {
        // cross-origin parent may be unavailable in some embed contexts.
      }

      // SPA navigation: URL changed → clear the previous video's cues before
      // loading the new one. `loadBilingualCues` uses ADR-014 D1 merge semantics
      // (keep old side when new side empty — for same-video incremental re-push),
      // so without this clear a partial load on the new video (target only, no
      // native or vice versa) leaves the previous video's cues visible. Covers
      // all cases: 0 tracks, partial, full — any URL change clears both sides.
      const currentUrl = canonicalNavUrl(location.href);
      if (ctx.getLastAutoLoadUrl() !== undefined && ctx.getLastAutoLoadUrl() !== currentUrl) {
        blockController?.clearCues();
        ctx.getOffsetController()?.loadCues(false);
        // updateCues([], []);
        syncController.latestTargetCues = [];
        // Reset inline load status so stale messages from the previous video
        // don't persist into the new one (auto-load will set 'loading' or 'none').
        useCuesStore.getState().setLoadStatus('target', { state: 'idle' });
        useCuesStore.getState().setLoadStatus('native', { state: 'idle' });
      }
      ctx.setLastAutoLoadUrl(currentUrl);
      if (!payload?.target && !payload?.native) {
        // New video has no subtitles (SPA nav from a video WITH subtitles to
        // one WITHOUT). Clear the previous video's overlay + nav cluster so
        // stale cues do not persist into the new video.
        blockController?.clearCues();
        ctx.getOffsetController()?.loadCues(false);
        // updateCues([], []);
        // ADR-021: clear translate prefill on SPA nav to video with no subtitles
        ctx.getTranslatePrefill()?.clear();
        ctx.setTranslatePrefill(null);
        ctx.clearTranslatedNativeState();
        syncController.activeNativeSource = 'auto';
        ctx.updateGenerateNativeEnabled();
        useCuesStore.getState().setLoadStatus('target', { state: 'none' });
        useCuesStore.getState().setLoadStatus('native', { state: 'idle' });
        // Clear auto-detected track list + manager panel so stale tracks from
        // the previous video don't persist in the panel UI. onSpaNav may have
        // already cleared these (proactive clear on yt-navigate-finish), but
        // if onSpaNav didn't fire (lastAutoLoadUrl was undefined) this is the
        // only clear path.
        syncController.autoTargetItems = [];
        syncController.autoNativeItems = [];
        syncController.targetMatches = [];
        syncController.nativeMatches = [];
        syncController.activeTargetIndex = 0;
        syncController.activeNativeIndex = 0;
        ctx.refreshPanel('target');
        ctx.refreshPanel('native');
      }
      // ADR-021: clear translate prefill on SPA nav (URL changed)
      if (ctx.getLastAutoLoadUrl() !== undefined && ctx.getLastAutoLoadUrl() !== currentUrl) {
        ctx.getTranslatePrefill()?.clear();
        ctx.setTranslatePrefill(null);
        ctx.clearTranslatedNativeState();
        syncController.activeNativeSource = 'auto';
        ctx.updateGenerateNativeEnabled();
      }
      void (async () => {
        const currentSettings = await loadSettings();
        await handleAutoLoadSubtitles(payload, {
        controller: {
          loadBilingualCues: (t: SrtCue[], n: SrtCue[]) => { blockController?.loadBilingualCues(t, n); ctx.showOverlay(); },
          loadCues: (c: SrtCue[]) => { blockController?.loadCues(c); ctx.showOverlay(); },
          clearCues: () => {
            blockController?.clearCues();
            // ADR-019: subtitles cleared → reset offset + cancel lazy
            ctx.getOffsetController()?.loadCues(false);
            ctx.clearTranslatedNativeState();
            syncController.activeNativeSource = 'auto';
            ctx.updateGenerateNativeEnabled();
          },
        },
        tabUrl: window.location.href,
        onPanelRender: (targetCues: SrtCue[], nativeCues: SrtCue[]) => {
          try { const a = JSON.parse(document.documentElement.getAttribute('data-cell-debug-autoload-arr') ?? '[]'); a.push({ step: 'rendered', t: targetCues.length, n: nativeCues.length, time: Date.now() }); document.documentElement.setAttribute('data-cell-debug-autoload-arr', JSON.stringify(a.slice(-20))); } catch { /* ignore */ }
          ctx.setBilingualCues(mergeCuesForPanel(targetCues, nativeCues));
          // ADR-018: keep nav cluster cue source in sync with auto-loaded subtitles
          // (4↔6 nút transition when subtitles become available).
          syncController.latestTargetCues = targetCues;
          // Auto-load resets the translated native slot; native active is auto.
          ctx.clearTranslatedNativeState();
          syncController.activeNativeSource = 'auto';
          ctx.updateGenerateNativeEnabled();
          // updateCues(targetCues, nativeCues);
          // ADR-019: notify offset controller that subtitles loaded
          ctx.getOffsetController()?.loadCues(true);
          // Send cues to Side Panel
          broadcastCues(ctx.getBilingualCues());
        },
        onLoadStatus: (role, status) => {
          try { const a = JSON.parse(document.documentElement.getAttribute('data-cell-debug-autoload-arr') ?? '[]'); a.push({ step: 'status', role, state: status.state, err: status.errorType, t: Date.now() }); document.documentElement.setAttribute('data-cell-debug-autoload-arr', JSON.stringify(a.slice(-20))); } catch { /* ignore */ }
          useCuesStore.getState().setLoadStatus(role, status);
        },
        autoTranslate: currentSettings.subtitleOverlayAutoTranslate,
        onStartTranslatePrefill: (targetCues: SrtCue[]) => {
          // ADR-021: start background prefill to translate target→native.
          // Translate function sends TRANSLATE message to background SW (CORS bypass).
          const sl = currentSettings.subtitleOverlayTargetLanguage;
          const tl = currentSettings.subtitleOverlayNativeLanguage;
          if (!sl || !tl || sl === tl) return;
          // If a manual generate-native is already active, don't overwrite it with
          // auto-translate. Manual generate is the user's explicit choice.
          if (syncController.translatedNativeSlot && syncController.activeNativeSource === 'translated') return;
          // Inline load status: native language label for the translating state.
          const nativeLabel = isoCodeToLabel(tl);
          const label = nativeLabel ? nativeLabel.charAt(0).toUpperCase() + nativeLabel.slice(1) : tl;
          // Snapshot target info and create the translated manager entry upfront
          // so the native tab shows the translation as a selectable track.
          const snapshot = syncController.getGenerateNativeSnapshot();
          const translatedItem: import('./subtitlePanelModel').SubtitlePanelItem = {
            id: 'translated-native',
            name: `${label} (translated)`,
            format: snapshot.targetFormat,
            size: snapshot.targetSize,
            source: 'translated',
            role: 'native',
            index: 0,
          };
          syncController.setTranslatedNativeSlot({
            replacedSource: snapshot.replacedSource,
            replacedIndex: snapshot.replacedIndex,
            item: translatedItem,
            cues: [],
            runId: Date.now(),
          });
          ctx.refreshPanel('native');
          // Clear any previous prefill (SPA nav or re-trigger)
          ctx.getTranslatePrefill()?.clear();
          const translatePrefill = new BackgroundPrefillController({
            translate: createTranslateFunction(sl, tl),
            onChunkTranslated: (translatedCues: SrtCue[]) => {
              // Feed translated cues to overlay (reuse loadBilingualCues path ADR-013/014)
              blockController?.loadBilingualCues(targetCues, translatedCues);
              ctx.showOverlay();
              // Update panel + nav cluster with bilingual cues
              ctx.setBilingualCues(mergeCuesForPanel(targetCues, translatedCues));
              syncController.latestTargetCues = targetCues;
              syncController.setTranslatedNativeCues(translatedCues);
              // updateCues(targetCues, translatedCues);
              broadcastCues(ctx.getBilingualCues());
              useCuesStore.getState().setLoadStatus('native', { state: 'translating', languageLabel: label, source: 'translated', progress: { current: ctx.getTranslatePrefill()?.cacheSize ?? 0, total: targetCues.length } });
            },
            onError: (msg: string) => {
              console.error('[onStartTranslatePrefill] translation error', msg);
              useCuesStore.getState().setLoadStatus('native', { state: 'error', languageLabel: label, source: 'translated', errorType: 'unknown' });
            },
            onComplete: () => {
              useCuesStore.getState().setLoadStatus('native', { state: 'loaded', languageLabel: label, source: 'translated' });
            },
          });
          ctx.setTranslatePrefill(translatePrefill);
          useCuesStore.getState().setLoadStatus('native', { state: 'translating', languageLabel: label, source: 'translated', progress: { current: 0, total: targetCues.length } });
          translatePrefill.start(targetCues, sl, tl);
        },
        onSubtitleMatches: (targetM, nativeM) => {
          // ADR-015 T4/T10: build auto panel items from matches in-place.
          syncController.setAutoMatches([...targetM], [...nativeM]);
          ctx.refreshPanel('target');
          ctx.refreshPanel('native');
        },
      });
      })();
    }
    return false; // synchronous listener, no async response
  };

  return { onRuntimeMessage, onRuntimeMessage2 };
}
