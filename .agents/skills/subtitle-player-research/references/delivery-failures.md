# Subtitle Player Research — known delivery-failure patterns

Repo-specific failure signatures with verified fix patterns. Read when extension inventory is correct but the overlay still fails.

## Cross-origin iframe delivery

Player lives in a cross-origin iframe (e.g. `moviepire` → `vidnest`): the subtitle list is in the child frame while overlay/broadcast logic lives elsewhere. Use when inventory is correct but the overlay doesn't load after an episode/provider switch.

```text
1. Confirm the child frame content script is injected.
2. Confirm a <video> exists and the overlay init condition is met.
3. Confirm tracks/sources appear and the page scanner re-scans after they appear.
4. Confirm the player frame asks for REQUEST_AUTO_LOAD_SUBTITLES.
5. Confirm AUTO_LOAD_SUBTITLES is sent to the exact frameId of the player frame.
6. Confirm the top frame receives __Tihoka_AUTOLOAD_HANDLED from the player frame.
```

Guards per step:

- `<video>` exists but no overlay → init condition may wait only for `readyState`/`blob:` URL; tracks with real `<track src>` should also count.
- `runPageScan` runs once and finds zero tracks → it must re-scan when tracks are assigned later.
- `AUTO_LOAD_SUBTITLES` broadcast to all frames → a freshly navigated iframe may not be in `getAllFrames` yet; direct frameId send + broadcast fallback.
- Player frame reloads on episode switch → old `SESSION_MEDIA` must be cleared and the new frame must request a re-push.

## Play-on-demand players (lazy video creation)

Some players (videasy, React/Next.js players) don't create `<video>` on load — it appears AFTER the user clicks play, possibly past the `findVideoObserver` 10s timeout. The encrypted listing fetch also fires on play, not iframe load.

**Symptom:** inventory shows subtitles (E4) but the overlay never initializes — `data-tihoka-autoload-handled` stale/absent, no `#Tihoka-subtitle-shadow-host` in the player frame.

```text
1. Navigate to the player URL directly (not via parent page).
2. Wait 10s without clicking play. <video> exists?
   - No  → play-on-demand. Continue.
   - Yes → different timing issue; don't apply this flow.
3. Click play. Does <video> appear now?
4. Is #Tihoka-subtitle-root present with a shadow root?
   - No → findVideoObserver timed out before the click. Root cause confirmed.
5. After fix: overlay inits within 1s of the click.
```

**Fix pattern (commit bf5082b4):** on `findVideoObserver` timeout, install a one-shot capture-phase `document.click` listener that re-triggers `findAndInitOverlay()` on the next user interaction; it removes itself once the overlay initializes. Cheaper than an indefinite MutationObserver.

**Known ceiling:** detection delayed until first click; if the player auto-plays without a click, this won't fire. Upgrade: also listen for `play`/`playing` on a late-attached video via lightweight periodic re-scan.

## In-player episode switches inside iframes

Player iframe with its own episode navigation (videasy's next-episode button): `<video>` is replaced inside the iframe; the top frame's `episodeChangeObserver` can't see cross-origin, so the watcher must run inside the iframe.

**Symptom:** in-player next-episode changes video + URL but the overlay stays on the old video and subtitles don't reload. The parent's next-episode button works because the top frame's iframe-src watcher fires.

```text
1. Click the in-player next-episode button (inside the iframe).
2. Does location.href change inside the iframe?
3. Is <video> replaced (different element identity)?
4. Does data-tihoka-episode-changed appear on the iframe's documentElement?
   - No → the iframe's episodeChangeWatcher isn't running. Root cause confirmed.
5. After fix: episodeChanged=replacement fires inside the iframe; overlay re-inits with new subtitles.
```

**Fix pattern (commit d8a60028):** replace the blanket `if (window.self !== window.top) return` guard in `initEpisodeChangeWatcher` with a hidden-iframe-only guard (same 1x1 check as `fetchInterceptor.iife.ts`). The iframe-baseline logic stays guarded by `isTop`.

**Known ceiling:** non-1x1 hidden iframes still skipped; a legitimate player in a <10x10 iframe won't be instrumented. Upgrade: check `display:none`/`visibility:hidden` instead of pixel dimensions.

## Full anti-patterns table

| Bad action | Correct replacement |
|---|---|
| Treat DevTools list as extension list | check E4 inventory |
| Add listing APIs to file URL patterns | create typed resolver |
| Treat page CORS failure as final | test the correct frame or DNR replay |
| Guess endpoint/token/selector | capture an actual request |
| Execute arbitrary HTML script | parse one allow-listed variable |
| Turn metadata into a fabricated URL | keep an `unresolved` handle |
| Strip query tokens for dedup | keep fetch URL; use a separate identity key |
| Conclude no subtitles after a blocked frame | report blocker and next experiment |
| Treat empty scan at `DOMContentLoaded` as no subtitles | re-scan when `<track>`/`<source>` `src` assigned later |
| Broadcast `AUTO_LOAD` to all frames only | target player frameId + broadcast fallback |
| Assume a navigated cross-origin iframe is reachable | wait for the frame's message listener, then re-push |
| Assume `<video>` exists on page load | play-on-demand creates it on click; check after interaction |
| Run episode watcher only in top frame | instrument visible player iframes |
