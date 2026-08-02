// === Main-world fetch interceptor (ADR-011 + generic subtitle discovery) ===
// Runs in the PAGE's main world (world: 'MAIN', run_at: 'document_start') to
// patch `window.fetch` BEFORE page JS saves a reference to it.
//
// Two jobs:
//  1. Catch subtitle file fetches and forward the URL to the isolated content
//     script (`__DETECTED_SUBTITLE_FETCH`) — these are real subtitle URLs.
//  2. Catch listing / HLS playlist fetches, read a bounded clone of the response
//     body, and forward a `__CELL_SUBTITLE_DISCOVERY` `network-response` signal.
//
// The response body is needed for APIs whose tokens expire (lookmovie hash,
// videasy seed, onflix HLS) and for players whose Service Worker serves from
// cache (chrome.webRequest does not fire for SW-served responses).
//
// Ceiling: only `fetch` is patched; `XMLHttpRequest` is not. Sites using XHR
// for listing fetches will not have their bodies captured.

(() => {
  // Skip only hidden (likely challenge) iframes. Player iframes are normally
  // visible and must be instrumented for deep-frame subtitle discovery.
  if (window.self !== window.top) {
    try {
      if (window.innerWidth <= 10 && window.innerHeight <= 10) return;
    } catch {
      return;
    }
  }

  const SUBTITLE_PATTERN = /\.srt(\?|$)|\.vtt(\?|$)|\.ass(\?|$)|\/(subtitles|subs|caption|cc)\//i;

  const LISTING_PATTERNS = [
    /\/search\?id=/i,
    /\/api\/sub\/\d+/i,
    /\/api\/v1\/security\/episode-access/i,
    /streamdata\.vaplayer\.ru\/api\.php/i,
    /sources-with-title/i,
    /\.m3u8(?:\?|$)/i,
  ];

  const MAX_BODY_BYTES = 200_000;

  function isListingUrl(url: string): boolean {
    return LISTING_PATTERNS.some((p) => p.test(url));
  }

  const originalFetch = window.fetch;

  window.fetch = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    let url = '';
    try {
      url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
    } catch {
      // ignore
    }

    const isSubtitle = SUBTITLE_PATTERN.test(url);
    const isListing = isListingUrl(url);

    return originalFetch.call(this, input, init).then((response) => {
      if (isSubtitle) {
        try {
          window.postMessage({ type: '__DETECTED_SUBTITLE_FETCH', url }, '*');
        } catch {
          // swallow
        }
      }

      if (isListing && response.ok) {
        try {
          const clone = response.clone();
          void (async () => {
            try {
              const buffer = await clone.arrayBuffer();
              const size = Math.min(buffer.byteLength, MAX_BODY_BYTES);
              const slice = buffer.slice(0, size);
              const decoder = new TextDecoder('utf-8', { fatal: false });
              const body = decoder.decode(slice);
              const initiator = (() => {
                try {
                  return window.location.href;
                } catch {
                  return '';
                }
              })();
              const origin = (() => {
                try {
                  return window.location.origin;
                } catch {
                  return '';
                }
              })();

              window.postMessage(
                {
                  type: '__CELL_SUBTITLE_DISCOVERY',
                  signal: {
                    kind: 'network-response',
                    url,
                    body,
                    tabId: 0,
                    frameId: 0,
                    initiator,
                    method: init?.method ?? 'GET',
                    type: 'xmlhttprequest',
                  },
                  origin,
                },
                '*',
              );
            } catch {
              // swallow
            }
          })();
        } catch {
          // swallow
        }
      }

      return response;
    });
  };
})();
