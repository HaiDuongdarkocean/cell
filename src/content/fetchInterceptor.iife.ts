// === Main-world fetch interceptor (ADR-011) ===
// Runs in the PAGE's main world (world: 'MAIN', run_at: 'document_start') to
// patch `window.fetch` BEFORE page JS saves a reference to it. This catches
// subtitle fetches that page Service Workers serve from cache —
// `chrome.webRequest` does NOT fire for cached responses, so the extension's
// network interceptor misses them entirely.
//
// Detected subtitle URLs are forwarded to the isolated-world content-script
// via `window.postMessage` (main world has no `chrome.runtime` access). The
// isolated content-script listens for these messages and relays them to the
// background via `chrome.runtime.sendMessage`.
//
// ponytail: only patches `fetch` (verified themoviebox uses fetch, not XHR).
// Ceiling: sites using XMLHttpRequest for subtitle fetch won't be caught.
// Upgrade: also patch XMLHttpRequest.prototype.open/send.
//
// CRXJS: this file MUST use the `.iife.ts` suffix so CRXJS emits it as a
// standalone bundle (no HMR, no async loader) — see crxjs.dev/concepts/content.
(() => {
  const SUBTITLE_PATTERN = /\.srt(\?|$)|\.vtt(\?|$)|\.ass(\?|$)|\/(subtitles|subs|caption|cc)\//i;

  const originalFetch = window.fetch;

  window.fetch = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    try {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      if (SUBTITLE_PATTERN.test(url)) {
        window.postMessage(
          { type: '__DETECTED_SUBTITLE_FETCH', url },
          '*',
        );
      }
    } catch {
      // Swallow — never break page fetch on instrumentation error.
    }
    return originalFetch.call(this, input, init);
  };
})();
