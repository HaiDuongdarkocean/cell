// === Generic MAIN-world subtitle discovery bridge (ADR-NNN) ===
//
// Runs in every frame (all_frames: true, world: MAIN, document_idle) and polls
// an allow-list of player-global variables. When it finds one, it posts a
// `__CELL_SUBTITLE_DISCOVERY` message to the isolated content-script in the
// same frame, which relays it to the background pipeline.
//
// Allow-listed keys:
//   - `the_subtitles`       → noxx deep player state
//   - `playerjsSubtitle`    → MyAsianTV/kisscloud HTML variable
//
// The list is intentionally short. Other patterns (JSON listing, iframe hash,
// HLS) are handled by the isolated content-script scanner or by the background
// network interceptor.

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

    return null;
  }

  function postDiscovery(signal: object): void {
    try {
      window.postMessage(
        { type: '__CELL_SUBTITLE_DISCOVERY', signal },
        '*',
      );
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

  // Initial poll on document_idle; then a few retries in case the player
  // populates the globals after a short delay.
  pollOnce();
  const intervalId = window.setInterval(pollOnce, 500);
  window.setTimeout(() => window.clearInterval(intervalId), 5000);
})();
