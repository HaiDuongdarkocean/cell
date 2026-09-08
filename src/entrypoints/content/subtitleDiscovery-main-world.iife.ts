// === Generic MAIN-world subtitle discovery bridge (ADR-NNN) ===
//
// Runs in every frame (all_frames: true, world: MAIN, document_idle) and polls
// an allow-list of player-global variables. When it finds one, it posts a
// `__CELL_SUBTITLE_DISCOVERY` message to the isolated content-script in the
// same frame, which relays it to the background pipeline.
//
// Also scans `<track>` elements. Track `src` may be a `blob:` URL created by the
// player after decrypting a subtitle file. Isolated content scripts cannot fetch
// `blob:` URLs (storage-key partitioning), but the main world can. We fetch the
// body in the main world and post it as a `network-response` signal so the
// content script can cache the decrypted subtitle body before `autoLoad` asks
// for it.
//
// Allow-listed keys:
//   - `the_subtitles`       → noxx deep player state
//   - `playerjsSubtitle`    → MyAsianTV/kisscloud HTML variable
//   - `subtitleTracks`      → vidrift/OnlyFlix player state

(() => {
  // Avoid instrumenting hidden Cloudflare challenge iframes.
  try {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w <= 1 && h <= 1) return;
  } catch {
    return;
  }

  const PLAYER_KEYS: ReadonlyArray<{ key: string; type: 'player-state' | 'document-html' }> = [
    { key: 'the_subtitles', type: 'player-state' },
    { key: 'playerjsSubtitle', type: 'player-state' },
    { key: 'subtitleTracks', type: 'player-state' },
  ] as const;

  const posted = new Set<string>();

  function buildSignal(key: string, value: unknown): object | null {
    const origin = (() => {
      try {
        return window.location.origin;
      } catch {
        return '';
      }
    })();

    if (key === 'the_subtitles') {
      if (!Array.isArray(value)) return null;
      return {
        kind: 'player-state',
        origin,
        payload: value,
        tabId: 0,
        frameId: 0,
        initiator: origin,
        playerKey: 'the_subtitles',
      };
    }

    if (key === 'playerjsSubtitle') {
      if (typeof value !== 'string') return null;
      return {
        kind: 'player-state',
        origin,
        payload: value,
        tabId: 0,
        frameId: 0,
        initiator: origin,
        playerKey: 'playerjsSubtitle',
      };
    }

    if (key === 'subtitleTracks') {
      if (!Array.isArray(value)) return null;
      return {
        kind: 'player-state',
        origin,
        payload: value,
        tabId: 0,
        frameId: 0,
        initiator: origin,
        playerKey: 'subtitleTracks',
      };
    }

    return null;
  }

  function postDiscovery(signal: object): void {
    try {
      window.postMessage(
        { type: '__CELL_SUBTITLE_DISCOVERY', signal },
        '*',
      );
      // Also notify the parent frame when running inside a cross-origin
      // player iframe. The parent's isolated content script may be the only
      // Cell context with a live runtime connection (some player iframes
      // load too quickly for their own content script to register before the
      // player state is set, or anti-bot frames block child-frame injection).
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          { type: '__CELL_SUBTITLE_DISCOVERY', signal },
          '*',
        );
      }
    } catch {
      // never break page
    }
  }

  function pollOnce(): void {
    const win = window as unknown as Record<string, unknown>;
    for (const { key } of PLAYER_KEYS) {
      if (posted.has(key)) continue;
      const value = win[key];
      if (value === undefined) continue;
      const signal = buildSignal(key, value);
      if (signal) {
        posted.add(key);
        postDiscovery(signal);
      }
    }
  }

  // === Track/blob scanner ===================================================
  // Isolated content scripts cannot fetch `blob:` URLs (storage partitioning),
  // but the main world can. We watch `<track>` elements and fetch their bodies
  // so the content script has them cached when `autoLoad` asks for them.
  const fetchedTrackUrls = new Set<string>();
  const MAX_BODY_BYTES = 500_000;

  async function fetchTrackBody(src: string): Promise<void> {
    if (!src || fetchedTrackUrls.has(src)) return;
    // We only need the main world for `blob:` URLs. `https:` track URLs are
    // handled by the content script / background fetch path; fetching them here
    // would duplicate network traffic and may bypass the scanner's metadata.
    if (!/^blob:/i.test(src)) return;
    fetchedTrackUrls.add(src);
    try {
      const response = await fetch(src);
      if (!response.ok) return;
      const text = await response.text();
      const body = text.length > MAX_BODY_BYTES ? text.slice(0, MAX_BODY_BYTES) : text;
      const origin = (() => {
        try {
          return window.location.origin;
        } catch {
          return '';
        }
      })();
      const initiator = (() => {
        try {
          return window.location.href;
        } catch {
          return '';
        }
      })();
      postDiscovery({
        kind: 'network-response',
        url: src,
        body,
        tabId: 0,
        frameId: 0,
        initiator,
        method: 'GET',
        type: 'xmlhttprequest',
        origin,
      });
    } catch {
      // never break page
    }
  }

  function scanTracks(node: Document | Element): void {
    const tracks = node.querySelectorAll?.('track[src]');
    if (!tracks) return;
    for (const track of tracks) {
      const src = track.getAttribute('src');
      if (src) {
        void fetchTrackBody(src);
      }
    }
  }

  function observeTracks(): void {
    scanTracks(document);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const added of mutation.addedNodes) {
            if (added instanceof Element) {
              scanTracks(added);
            }
          }
        } else if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
          const target = mutation.target;
          if (target instanceof Element && target.tagName === 'TRACK') {
            const src = target.getAttribute('src');
            if (src) void fetchTrackBody(src);
          }
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });
  }

  // Initial poll on document_idle; then a few retries in case the player
  // populates the globals after a short delay. On players that lazy-load
  // state (playembed.vip embedded iframes), the subtitle list can appear
  // several seconds after the iframe loads, so keep polling for 30s.
  pollOnce();
  const intervalId = window.setInterval(pollOnce, 500);
  window.setTimeout(() => window.clearInterval(intervalId), 30_000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeTracks);
  } else {
    observeTracks();
  }
})();
