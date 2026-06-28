# Task — Side Panel Video Controls

> **Giai đoạn**: G4 — Implementation (task breakdown)
> **Input**: `docs/specs/spec-side-panel-video-controls.md`, `docs/adr/009-side-panel-video-controls.md`
> **Trạng thái**: Completed (đã implement + verify)

## Task List

### Task 1: Add message types (TOGGLE_PLAY + SHORTCUT_ACTION)
- **Files**: `src/constants/messages.ts`, `src/types/message.ts`
- **Acceptance**: `TOGGLE_PLAY` + `SHORTCUT_ACTION` trong `MESSAGE_TYPES` + `MessageType` union; `ShortcutActionPayload` interface
- **Verify**: `npx tsc --noEmit` pass
- **Status**: ✅ Done

### Task 2: Background handlers (handleTogglePlay + handleShortcutAction)
- **Files**: `src/background/index.ts`
- **Acceptance**: `handleTogglePlay` relay `TOGGLE_PLAY` → active tab content-script; `handleShortcutAction` relay `SHORTCUT_ACTION` → active tab content-script; reuse `handleSeekTo` active-tab resolution pattern
- **Verify**: `npx tsc --noEmit` pass
- **Status**: ✅ Done

### Task 3: Content-script listeners (TOGGLE_PLAY + SHORTCUT_ACTION)
- **Files**: `src/content/content-script.ts`
- **Acceptance**: `TOGGLE_PLAY` → `video.play()`/`video.pause()`; `SHORTCUT_ACTION` → cue-seeking (prev/next/replay) + overlay toggle (reuse existing logic)
- **Verify**: Browser MCP — spacebar → play/pause; hotkeys → cue seek
- **Status**: ✅ Done

### Task 4: Side panel keydown handler
- **Files**: `src/sidepanel/App.tsx`
- **Acceptance**: Spacebar → `TOGGLE_PLAY`; hotkeys → `SHORTCUT_ACTION` (reuse `handleShortcutKey`); load shortcuts from storage async; guard input/textarea; `preventDefault` page scroll
- **Verify**: Browser MCP — intercept `chrome.runtime.sendMessage` → 5/5 hotkeys send correct message
- **Status**: ✅ Done

### Task 5: Media clear on navigation
- **Files**: `src/background/index.ts`
- **Acceptance**: `onTabUpdated` loading → `clearTab` + `clearSessionMedia` + `lastCuesByTab.delete` + `updateBadgeForTab`; update comment
- **Verify**: Unit test (integration.test.ts) — 2 tests updated from "media persists" → "clears media on navigation"; browser MCP — tab navigate → 11 media (not 22)
- **Status**: ✅ Done

### Task 6: Lint fix (pre-existing)
- **Files**: `tests/unit/background/integration.test.ts`
- **Acceptance**: `MockedFunction<typeof fetch>` not assignable → fix cast; `response.data` property access → fix cast
- **Verify**: `npx tsc --noEmit` pass (0 errors)
- **Status**: ✅ Done

### Task 7: Update unit tests
- **Files**: `tests/unit/background/integration.test.ts`
- **Acceptance**: 2 tests "does NOT clear toolbar badge (media persists)" → "clears toolbar badge + media on navigation"; assert `getMedia(123).videos.length === 0`
- **Verify**: `npm run test:unit` — 78/78 pass
- **Status**: ✅ Done

### Task 8: Browser verification
- **Acceptance**: Spacebar → `TOGGLE_PLAY` sent → `⏸` → `▶`; 5 hotkeys (a/d/s/w/Space) → correct messages; tab navigate → media clear (11, not 22)
- **Verify**: Edge DevTools MCP — all pass
- **Status**: ✅ Done

## Verification Summary
- `npx tsc --noEmit`: 0 errors ✅
- `npm run build`: OK ✅
- `npm run test:unit`: 78/78 pass ✅
- Browser MCP (Edge DevTools): all hotkeys + media clear verified ✅
