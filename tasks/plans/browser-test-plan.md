# Browser Test Plan — Local Video Player P1

> Based on spec `docs/specs/local-video-player.md` user stories #1-6 (P1 scope).
> Uses `/testing-extension-browser` skill: nodriver launch → MCP stealth-chrome-devtools.

## Test Contracts (Given/When/Then)

### TC-01: Page loads with EmptyState (User Story #1 — Manual open)
```
Given: Extension loaded, local-player page opened (chrome-extension://<id>/src/entrypoints/local-player/index.html)
When: Page fully loaded
Then: EmptyState visible — dropzone text "Drop a video file" + "Open file" button rendered
```

### TC-02: PlayerMenuBar renders (User Story #1)
```
Given: Local-player page loaded
When: Page fully loaded
Then: PlayerMenuBar visible — "Local Player" title + "Open file" button + "Library" button
```

### TC-03: Library toggle works (User Story #6 — History)
```
Given: Local-player page loaded, no video
When: Click "Library" button
Then: LibraryView panel visible — sort dropdown + empty state message (no videos yet)
```

### TC-04: Library sort dropdown renders (User Story #6)
```
Given: LibraryView panel open
When: Inspect sort dropdown
Then: Sort options visible — "recent", "title", "added"
```

### TC-05: Drag-drop video file (User Story #1 — Manual open)
```
Given: Local-player page loaded, EmptyState visible
When: Drop a video file (MP4) onto dropzone
Then: <video> element appears + video starts loading + PlayerControls bar visible
```

### TC-06: Video playback controls (User Story #1 — basic controls)
```
Given: Video loaded in player
When: Click play button
Then: Video plays (isPlaying=true) + play icon changes to pause
```

### TC-07: Keyboard shortcuts (User Story #1 — keyboard)
```
Given: Video loaded + playing
When: Press Space key
Then: Video pauses (isPlaying=false)
When: Press ArrowRight
Then: Video seeks +5s
When: Press ArrowLeft
Then: Video seeks -5s
When: Press "m"
Then: Video mutes
When: Press "f"
Then: Video enters fullscreen
```

### TC-08: Playback speed control (User Story #1 — basic controls)
```
Given: Video loaded + PlayerControls visible
When: Click speed button (shows "1x")
Then: Dropdown opens with speeds [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
When: Click 1.5x
Then: Video playbackRate changes to 1.5 + button shows "1.5x" + dropdown closes
```

### TC-09: Volume control (User Story #1 — basic controls)
```
Given: Video loaded + PlayerControls visible
When: Click volume slider + drag to 50%
Then: Video volume = 0.5
```

### TC-10: Timeline seek (User Story #1 — basic controls)
```
Given: Video loaded + duration > 0
When: Click on timeline at 50% position
Then: Video currentTime jumps to ~50% of duration
```

### TC-11: Subtitle auto-match (User Story #2 — Subtitle auto-match)
```
Given: Video loaded with matching subtitle file in same folder
When: Video opens
Then: SubtitleBlock overlay visible on video + target subtitle text appears at correct timestamps
```

### TC-12: No subtitle found (User Story #4 — Subtitle match failure)
```
Given: Video loaded with NO matching subtitle file
When: Video opens
Then: No subtitle overlay + "No subtitle found" indicator (or no SubtitleBlock)
```

### TC-13: Resume position prompt (User Story #5 — Resume position)
```
Given: Video previously watched to position 120s, saved in IndexedDB
When: Reopen same video
Then: Prompt dialog "Continue from 2:00?" with Yes/No buttons
```

### TC-14: Resume position — skip
```
Given: Resume prompt shown
When: Click "No" (or dismiss)
Then: Video starts from 0:00
```

### TC-15: Resume position — continue
```
Given: Resume prompt shown
When: Click "Yes"
Then: Video seeks to saved position (120s) + starts playing
```

### TC-16: History saved (User Story #6 — History)
```
Given: Video opened + played for a few seconds
When: Check IndexedDB
Then: History entry exists with videoId + watchedAt + position
```

### TC-17: Library shows watched videos (User Story #6)
```
Given: Video watched previously (history exists in IndexedDB)
When: Open Library
Then: LibraryCard visible with video title + resume % + last watched date
```

### TC-18: Library — click to reopen (User Story #6)
```
Given: Library open with video card visible
When: Click LibraryCard
Then: Video loads + starts playing
```

### TC-19: Bilingual subtitle rendering (User Story #2 — bilingual)
```
Given: Video with both target + native subtitle matched
When: Video plays at timestamp with active cue
Then: Target subtitle line (top) + native subtitle line (bottom) both visible
```

### TC-20: Fullscreen toggle (User Story #1)
```
Given: Video loaded
When: Click fullscreen button
Then: Player enters fullscreen mode
When: Click again (or press Esc)
Then: Player exits fullscreen
```

### TC-21: PiP toggle (User Story #1)
```
Given: Video loaded + playing
When: Click PiP button
Then: Picture-in-Picture mode activated
```

### TC-22: Open subtitle file manually (User Story #4)
```
Given: Video loaded, no subtitle matched
When: User manually opens subtitle file
Then: Subtitle parsed + SubtitleBlock overlay appears
```

## Test Execution Order

1. **TC-01, TC-02** — Page load verification (no video)
2. **TC-03, TC-04** — Library UI (empty state)
3. **TC-05** — Drag-drop video (critical path)
4. **TC-06, TC-07, TC-08, TC-09, TC-10** — Playback controls
5. **TC-11, TC-12, TC-19, TC-22** — Subtitle features
6. **TC-13, TC-14, TC-15** — Resume position
7. **TC-16, TC-17, TC-18** — History + library
8. **TC-20, TC-21** — Fullscreen + PiP

## Prerequisites

- Build: `npm run build` (dist/ must have local-player page)
- Test video: small MP4 file (use a sample from tests/data-test or generate one)
- Test subtitle: SRT file matching video name
