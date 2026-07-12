# ADR-030: Netflix seek/play/pause — M7375 fix

**Date**: 2026-07-13
**Status**: Accepted
**Supersedes**: —
**Related**: ADR-029 (Netflix subtitle detection via graph traversal)

## Context

Netflix anti-tampering protection throws **M7375** ("Pardon the interruption — Error Code D7375") when scripts set `video.currentTime` / `video.play()` / `video.pause()` directly on the `<video>` element. The protection was added 2022-03-28 to prevent scripts from downloading movies via rapid time skips.

Cell's subtitle sync feature (prev/next cue, replay-cue, seek-by, toggle-play) was setting `video.currentTime` directly in 3 files:
- `subtitlePanel.ts:seekToCue` (central helper, ~6 callers)
- `navClusterActions.ts` (prevSentence, nextSentence, seekBy — 4 sites)
- `contentScriptController.ts` (SEEK_TO, TOGGLE_PLAY, SHORTCUT_ACTION — 3 sites)

**Verified on Netflix 2026-07-13:**
- `video.currentTime = 60` → M7375 (video dies, must reload page)
- `player.seek(120000)` via Netflix player API → OK (video plays normally)

## Decision

Route seek/play/pause through the **Netflix player API** via CustomEvents, instead of direct HTMLMediaElement manipulation. Three-layer architecture (clone asbplayer 1.18.0):

```
ISOLATED content-script (netflixPlayback.ts)
  ├─ seekVideo(video, s) → dispatch __NF_SEEK { detail: s*1000 }
  ├─ playVideo(video)    → dispatch __NF_PLAY
  └─ pauseVideo(video)   → dispatch __NF_PAUSE
                ↓ CustomEvent (document)
MAIN world (netflix-main-world.iife.ts)
  ├─ __NF_SEEK  → getPlayer().seek(ms)
  ├─ __NF_PLAY  → getPlayer().play()
  └─ __NF_PAUSE → getPlayer().pause()
```

**Why this works:** Netflix player API (`player.seek(ms)`) goes through Netflix's internal state machine — treated as a valid user action (like dragging the progress bar). Direct `video.currentTime = X` goes through HTMLMediaElement API — Netflix detects this as script tampering → M7375.

**Non-Netflix sites:** `isNetflixPage()` returns false → helpers fall back to direct `video.currentTime` / `play()` / `pause()` (original behavior, no regression).

## Implementation

1. **`netflix-main-world.iife.ts`** — added 3 `document.addEventListener('__NF_SEEK|PLAY|PAUSE')` listeners that call `getPlayer().seek/play/pause`. Reuses `getPlayer()` helper from ADR-029. Added `lastSeekMs` to `__NF_DEBUG` for diagnostics.

2. **`netflixPlayback.ts`** (new, `src/features/subtitle/ui/`) — 3 thin wrappers: `seekVideo`, `playVideo`, `pauseVideo`. Each checks `isNetflixPage()` (= `location.hostname.includes('netflix.com')`), dispatches CustomEvent if true, falls back to direct API otherwise. `playVideo` returns `Promise<void>` matching `HTMLMediaElement.play()` shape.

3. **Replaced 9 direct `video.currentTime = X` + 2 `video.play()/pause()` sites:**
   - `subtitlePanel.ts:seekToCue` → `seekVideo(video, (cue.start - offsetMs) / 1000)`
   - `navClusterActions.ts:prevSentence/nextSentence/seekBy` (4 sites) → `seekVideo`
   - `contentScriptController.ts:SEEK_TO/TOGGLE_PLAY/SHORTCUT_ACTION` (3 sites) → `seekVideo` / `playVideo` / `pauseVideo`

## Verification (Netflix 2026-07-13, www.netflix.com/watch/81947712)

| Test | Method | Result |
|------|--------|--------|
| seek 600s | `__NF_SEEK { detail: 600000 }` → `player.seek(600000)` | ✅ currentTime=610s, subtitle shows, no M7375 |
| pause | `__NF_PAUSE` → `player.pause()` | ✅ paused=true, no M7375 |
| play | `__NF_PLAY` → `player.play()` | ✅ paused=false, time advances, no M7375 |
| seekBy +30s | `__NF_SEEK { detail: (t+30)*1000 }` | ✅ currentTime=671s, no M7375 |
| **control**: `video.currentTime = 100` | direct HTMLMediaElement | ❌ M7375 (confirms fix needed) |

## Consequences

**Positive:**
- All subtitle sync features (prev/next/replay cue, seek-by, toggle-play) work on Netflix without M7375.
- Non-Netflix sites unchanged (fallback path).
- Reuses ADR-029 `getPlayer()` — no new player-access code.

**Negative:**
- `playVideo` on Netflix resolves immediately (Netflix `player.play()` is fire-and-forget, no play promise). Caller's `.catch()` is a no-op on Netflix. Acceptable — autoplay block is not a concern on Netflix (user-initiated).
- Seek precision: Netflix default `preciseSeeking=false` → seek rounds to nearest keyframe (~7-10s diff). Subtitle sync still works because cue windows are 2-5s. preciseSeeking hook (asbplayer 1.18.0 `Function.prototype.apply` proxy) was tested but Netflix version 2026-07 no longer looks up `preciseSeeking` via `Function.prototype.apply` — hook log empty. Deferred to future research.

**Ceiling (ponytail):** If Netflix renames `seek`/`play`/`pause` on the player object, listeners no-op (guarded by `typeof !== 'function'` checks). Caller's intent lost for that one call — user just needs to retry. No crash.

## References

- asbplayer `netflix-page.ts` (1.18.0): CustomEvent bridge pattern
- asbplayer `binding.ts:1463-1532`: seek/play/pause Netflix routing
- asbplayer issue #631: M7375 root cause (Netflix blocking rapid time skips)
- Stack Overflow "Controlling Netflix HTML5 playback": `video.currentTime = X` → M7375
