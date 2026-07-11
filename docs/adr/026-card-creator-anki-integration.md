# ADR-026: Card Creator — Anki integration via AnkiConnect

**Date**: 2026-11
**Status**: Accepted
**Supersedes**: —
**Related**: spec-card-creator, ADR-021 (Google Translate), ADR-025 (unified subtitle block)

## Context

The Cell extension helps learners watch videos with bilingual subtitles. A
natural next step is to capture vocabulary + sentence context into Anki
flashcards directly from the subtitle block — without copy-pasting into a
separate Anki window.

**Constraints**:
- Must work on desktop Chrome/Edge AND mobile (Kiwi Browser, Edge Android)
  which connect to AnkiDroid via AnkiconnectAndroid.
- 4GB RAM mobile — media extraction (screenshot, audio) must be cheap.
- AnkiConnect Android is a partial reimplementation — many desktop actions
  are not supported, and unsupported actions silently "succeed" (return
  `"AnkiConnect v.6"` with HTTP 200) instead of erroring.

## Decision

### 1. Transport: AnkiConnect HTTP via background service worker
- Content script cannot fetch cross-origin reliably → all AnkiConnect calls
  go through the message bus to the background SW, which has
  `<all_urls>` host permission.
- Single message type `CARD_CREATOR_REQUEST` with `{ url, action, params }`
  in the payload — keeps the bus thin; the high-level
  `cardCreatorService.ts` wraps each action.

### 2. Android silent no-op detection (CRITICAL)
- Verified from AnkiconnectAndroid source (`AnkiAPIRouting.java` switch):
  the `default` case returns `"AnkiConnect v.6"` as the result with HTTP
  200 — NOT an error. Unsupported actions (`addTags`, `createModel`,
  `findCards`...) silently "succeed" without doing anything.
- `addNoteTags`: detect via `result !== null` (desktop success → `null`).
- `ensureDefaultModel`: re-check `modelNames` after `createModel` — if the
  model still missing, it hit the default handler → show helpful error.

### 3. Field mapping: auto-map + inline override
- On note type change, `autoMapFields` matches each Cell source field to
  the best Anki field by canonical name (exact case-insensitive → fuzzy
  Levenshtein ≤ 2 → substring).
- Each Anki field used at most once (first-come-first-served within a
  priority tier).
- User can override any mapping inline via a Select in each field header.

### 4. Media extraction
- Screenshot: `canvas.drawImage(video)` → PNG ArrayBuffer. Cheap, works
  everywhere.
- Sentence audio: `MediaRecorder` on `video.captureStream()` audio tracks.
  Cap 15s (4GB mobile), skip if tab hidden, fall back gracefully if
  unsupported (older Kiwi).
- Translation: prefer native subtitle track text; else Google Translate
  unofficial endpoint via existing TRANSLATE message (ADR-021).

### 5. Card draft + autosave
- Draft autosaved to `chrome.storage.local` (debounced 500ms) so a tab
  crash doesn't lose work. Media ArrayBuffers NOT persisted (storage
  can't hold them reliably + would bloat) — user re-captures on restore.
- Cleared on successful Add/Update.

### 6. UI: desktop Dialog + mobile BottomSheet
- Desktop: `Dialog` (existing shared component) with Card Creator body.
- Mobile: new `BottomSheet` shared component (slide-up, drag handle, 75vh
  max height). Same content, stacked layout.
- Entry: 2 buttons in subtitle block right column (quick update + edit),
  hidden on mobile width < 768px. Keyboard: `q` (quick update), `e` (edit).

### 7. Settings: schema v9 → v10
- New `CardCreatorSettings` type: `ankiConnectUrl`, `defaultDeck`,
  `defaultNoteType`, `defaultTags`, `mediaUpdateMode`.
- Settings UI: only Connection subsection (URL + status bar + Test again).
  Defaults + field mapping are inline in the Card Creator dialog.

## Consequences

- **Positive**: Single codebase works on desktop + mobile. Android
  limitations are detected + surfaced as helpful warnings, not silent
  failures. Draft autosave prevents data loss.
- **Negative**: `addTags` + `createModel` don't work on Android — users
  must pre-create the note type manually. Word audio capture not yet
  implemented (placeholder button). Media not persisted across sessions.
- **Risk**: AnkiConnect Android may change its `default` handler behavior
  in future versions → re-verify the source switch statement periodically.
