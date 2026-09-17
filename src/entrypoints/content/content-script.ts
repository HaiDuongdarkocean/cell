import {
  clearAutoLoadCache,
  clearSubtitleBodyCache,
} from '@/features/subtitle';
import { installIframePlayerModeBridge } from '@/features/subtitle/logic/iframePlayerModeBridge';
import { startWordStatusCrossTabRelay } from '@/features/dictionary/services/wordStatusCrossTab';
import { installHostManagerSheet } from './hostManagerSheet';
import {
  installDebugFrameMessageListener,
  markContentScriptInjected,
  scheduleMediaLog,
} from './debugLog';
import { installMainWorldBridge, postSiteReadyHandshakes } from './subtitleBridges';
import { installRuntimeMessageListener } from './runtimeMessages';
import { initMediaScan } from './mediaScan';
import { cleanupVideoOverlay, findAndInitOverlay } from './videoOverlay';
import { cleanupEpisodeWatcher, initEpisodeChangeWatcherOnReady } from './episodeWatcher';
import {
  cleanupFeatureInit,
  initComprehension,
  initHeavyFeatures,
  initTokenize,
  initWebTextDictionary,
  installSettingsReloader,
  installTokenizeNavListeners,
} from './featureInit';

// Top-frame coordinator for Player Mode when the actual video is inside a
// cross-origin iframe. Child frames request the host container via postMessage.
installIframePlayerModeBridge();

// Relay cross-tab word status changes into the local event bus so all tabs
// sharing a video stay in sync.
startWordStatusCrossTabRelay();

// ponytail: lazy-import dep preloads resolve against the host page and always
// 404 in content-script context; swallowing the error lets the real
// chrome-extension:// import proceed (initHeavyFeatures, lazy panels).
window.addEventListener('vite:preloadError', (event) => event.preventDefault());

// Clear per-page caches immediately. The MAIN-world fetch interceptor may
// re-post captured bodies as soon as the listener below announces readiness,
// so the cache must be empty before registration to avoid replaying stale
// bodies from a previous navigation.
clearAutoLoadCache();
clearSubtitleBodyCache();

installHostManagerSheet();

const csInjectTime = markContentScriptInjected();
installDebugFrameMessageListener();

// Functional ADR-020/028/029 handshakes — MAIN-world scripts re-post subtitle
// tracks on receipt. Must stay ungated.
postSiteReadyHandshakes(csInjectTime);

installRuntimeMessageListener();

// Registers the MAIN→ISOLATED postMessage listener BEFORE any potentially-
// throwing initialization, then announces __CELL_CS_READY (functional —
// fetchInterceptor.iife.ts re-posts captured signals on it).
installMainWorldBridge();

initMediaScan();
installTokenizeNavListeners();
initEpisodeChangeWatcherOnReady();

function cleanupVideoLevelState(): void {
  cleanupVideoOverlay();
  cleanupEpisodeWatcher();
}

window.addEventListener('beforeunload', () => {
  try {
    cleanupVideoLevelState();
    cleanupFeatureInit();
  } catch {
    // Best-effort cleanup on content-script teardown.
  }
});
// pagehide fires on SPA navigations (bfcache) — only clean up video/overlay,
// NOT universal panel (it should persist across SPA navs).
window.addEventListener('pagehide', () => {
  try {
    cleanupVideoLevelState();
    // Keep webTextCtrl, webTokenizeCtrl, universalPanelMount
    // alive across SPA navigations — they are page-level, not video-level.
  } catch {
    // Best-effort cleanup on content-script teardown.
  }
});

// Skip heavy initialization in iframes — Cloudflare's challenge iframe (1x1
// hidden) runs our content script via all_frames: true. Creating badge hosts,
// MutationObservers, and viewport observers modifies the iframe's DOM, which
// Cloudflare's bot detection can flag, causing the challenge to fail and the
// page to get stuck at "Infinite loading". Tokenize/dictionary features only
// make sense in the top-level frame anyway.
const isTopFrame = window.self === window.top;

// Run heavy DOM setup (tokenize + dictionary) at DOMContentLoaded, before
// Angular/Vue hydration rewires the DOM. These features only observe when
// enabled, so the initial badge append is cheap. findAndInitOverlay is kept
// early because it must catch <video> as soon as it appears.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', findAndInitOverlay);
  if (isTopFrame) {
    document.addEventListener('DOMContentLoaded', () => { void initWebTextDictionary(); });
    document.addEventListener('DOMContentLoaded', () => { void initTokenize(); });
    document.addEventListener('DOMContentLoaded', () => { void initComprehension(); });
  }
} else {
  findAndInitOverlay();
  if (isTopFrame) {
    void initWebTextDictionary();
    void initTokenize();
    void initComprehension();
  }
}

installSettingsReloader();

if (isTopFrame) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { void initHeavyFeatures(isTopFrame); });
  } else {
    void initHeavyFeatures(isTopFrame);
  }
  scheduleMediaLog(isTopFrame);
}
