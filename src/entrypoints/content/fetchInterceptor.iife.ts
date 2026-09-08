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
// It also implements a receiver-announces-readiness handshake (see
// learning-and-apply/messaging-receiver-announces-readiness-handshake):
// the isolated content script may register its `message` listener later than
// the first intercepted fetch. We cache the last signals and re-post them
// when the content script announces `__CELL_CS_READY`.
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

  const SUBTITLE_PATTERN = /\.srt(\?|$)|\.vtt(\?|$)|\.ass(\?|$)|\/(subtitles?|subs|caption|cc)\//i;
  const CACHE_SUBTITLE_PATTERN = /cache[-_]?vtt\.php(?:\?|$)|\/cache\.php\?.*\baction=get\b/i;
  const SUBTITLE_PATTERN_COMBINED = new RegExp(
    `(?:${SUBTITLE_PATTERN.source})|(?:${CACHE_SUBTITLE_PATTERN.source})`,
    'i',
  );

  const LISTING_PATTERNS = [
    /rest\.opensubtitles\.org\/search\//i,
    /\/search\?id=/i,
    /\/api\/sub\/\d+/i,
    /\/api\/v1\/security\/episode-access/i,
    /streamdata\.vaplayer\.ru\/api\.php/i,
    /sources-with-title/i,
    /eat-peach\.sbs/i,
    /\.m3u8(?:\?|$)/i,
    /\/_app\/remote\/[^/]+\/getSubtitles\?payload=/i,
    /\/api\/subtitles\/play\?id=/i,
    /\/api\/embed\/[^/]+\/subtitles(?:\?|$)/i,
    /\/api\/embed\/[^/]+\/subtitle\//i,
  ];

  const MAX_BODY_BYTES = 200_000;

  function isListingUrl(url: string): boolean {
    return LISTING_PATTERNS.some((p) => p.test(url));
  }

  const originalFetch = window.fetch;

  // Cache the last few signals until the isolated content script is ready.
  // Re-post when we receive `__CELL_CS_READY`.
  const pendingSignals: { type: string; payload: Record<string, unknown> }[] = [];
  const MAX_PENDING = 20;
  let contentScriptReady = false;

  function post(type: string, payload: Record<string, unknown>) {
    const msg = { type, ...payload };
    if (contentScriptReady) {
      try {
        window.postMessage(msg, '*');
      } catch {
        // swallow
      }
      return;
    }
    pendingSignals.push({ type, payload });
    if (pendingSignals.length > MAX_PENDING) {
      pendingSignals.shift();
    }
  }

  function flushPending() {
    contentScriptReady = true;
    while (pendingSignals.length) {
      const { type, payload } = pendingSignals.shift()!;
      const msg = { type, ...payload };
      try {
        window.postMessage(msg, '*');
      } catch {
        // swallow
      }
    }
  }

  window.addEventListener('message', (e) => {
    if (e.data?.type === '__CELL_CS_READY') {
      flushPending();
    }
  });

  function looksLikeSubtitleBody(body: string): boolean {
    const stripped = body.replace(/^\uFEFF/, '').trimStart();
    const head = stripped.slice(0, 40).toUpperCase();
    if (head.startsWith('WEBVTT')) return true;
    if (head.startsWith('[SCRIPT INFO]') || head.startsWith('DIALOGUE:')) return true;
    if (/^\d+\s*(?:\r?\n|\r)\d{1,2}:\d{2}:/.test(stripped.slice(0, 40))) return true;
    return false;
  }

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

    const isSubtitle = SUBTITLE_PATTERN_COMBINED.test(url);
    const isListing = isListingUrl(url);

    return originalFetch.call(this, input, init).then((response) => {
      // A URL can be either a direct subtitle file or a listing, not both.
      // Listings are handled via __CELL_SUBTITLE_DISCOVERY with a captured body.
      // For direct subtitle fetches, peek at the body: some APIs (e.g. OnzLoad
      // /api/embed/.../subtitle/<uuid>) return an encrypted payload, not a real
      // subtitle. Treating that as a subtitle URL would add an unplayable item
      // to the inventory. Only forward the URL when the body looks like a
      // known subtitle format.
      if (isSubtitle && !isListing && response.ok) {
        try {
          const clone = response.clone();
          void (async () => {
            try {
              const buffer = await clone.arrayBuffer();
              const size = Math.min(buffer.byteLength, MAX_BODY_BYTES);
              const slice = buffer.slice(0, size);
              const decoder = new TextDecoder('utf-8', { fatal: false });
              const body = decoder.decode(slice);
              if (looksLikeSubtitleBody(body)) {
                post('__DETECTED_SUBTITLE_FETCH', { url });
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
                post('__CELL_SUBTITLE_DISCOVERY', {
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
                });
              }
            } catch {
              // swallow
            }
          })();
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

              post(
                '__CELL_SUBTITLE_DISCOVERY',
                {
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
