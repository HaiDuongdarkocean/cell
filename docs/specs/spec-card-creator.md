# Spec — Card Creator

> Source of truth for implementing the Card Creator feature.
> Intent: `docs/intent/intent-card-creator.md`
> Mockup (approved, must match exactly): `docs/mockups/anki-card-mockup.html`
> Icons: `docs/mockups/icon-svg/anki-quick.svg`, `docs/mockups/icon-svg/anki-edit.svg`

## 1. Overview

Card Creator lets users create and update Anki flashcards from video content inside Cell. Two entry points:

- **Quick update** (`q` key desktop / lightning button mobile): find the newest card in the selected deck + note type created within the last 10 minutes, update it with rich media extracted from the current video state. If none found, open Card Creator with an alert.
- **Edit** (`e` key desktop / pencil button mobile): open Card Creator dialog to create a new card or update an existing one manually.

Rich media Cell is responsible for: **sentence audio**, **screenshot**, **sentence translation**.
Not Cell's responsibility: target word, definitions, word audio (Yomitan/user handles those).

## 2. Goals & non-goals

### Goals
- One-key workflow from video to Anki card with rich media.
- Cross-device: desktop Chromium + Kiwi mobile (4GB RAM safe).
- UI matches mockup exactly.
- Field mapping inline per field, auto-map on note type change, manual override allowed.
- Resilient: AnkiConnect offline → clear status, no crash; translation API fails → empty, no crash.

### Non-goals
- SRS engine (future — name "Card Creator" kept generic for this).
- Word audio / target word / definitions (Yomitan).
- Cloud sync.
- Bulk card creation from multiple subtitles at once.

## 3. User flows

### 3.1 Quick update (q / lightning)
1. User watches video, pauses on a subtitle.
2. Press `q` (desktop) or tap lightning button (mobile).
3. Cell extracts: screenshot (current frame), sentence audio (current cue start→end), sentence translation (current cue's native track text if available, else Google Translate unofficial endpoint, else empty).
4. Cell queries AnkiConnect `findNotes` (NOT `findCards` — Android-compat) for notes in selected deck + note type, sorts by note id desc (Anki note ids are ms-timestamps → newest first), takes the first one. The UI then checks whether the note's id is within the last 10 minutes (id ≥ now − 600_000 ms).
5. If a recent note is found → `updateNoteFields` with media fields per update mode. Toast: "Updated card #N".
6. If no recent note found → open Card Creator dialog with alert: "No recent card found in the last 10 minutes. Fill in the fields below to create a new card." Media pre-filled.

### 3.2 Edit (e / pencil)
1. Press `e` (desktop) or tap pencil button (mobile).
2. Cell extracts the same media as quick update.
3. Open Card Creator dialog with media pre-filled, text fields empty (Yomitan fills those).
4. User selects deck + note type → auto-map runs → fields populate mapping.
5. User edits fields, adjusts mapping if needed, sets update mode.
6. User taps **Add** (create new note) or **Update** (find recent card like quick update, then update) or **Cancel**.
7. Toast confirms action or shows error.

### 3.3 Settings — Connection
1. User opens Settings → Card Creator section.
2. User edits AnkiConnect URL (default `http://localhost:8765`).
3. Status bar auto-tests on URL change (debounced) + "Test again" button.
4. Status: online (green dot + "Connected" + "Anki v{version} · {url}") / offline (red dot + "Disconnected" + error) / testing (yellow pulse + "Testing…").

## 4. UI specification (must match mockup)

> **Hard constraint**: implement UI **exactly** as `docs/mockups/anki-card-mockup.html`. Every class name, layout, spacing, color, icon, placeholder text, button label, and section order must match. Do not improvise.

### 4.1 Entry buttons in subtitle block
- Location: `block-right-column` (`subtitleBlockDom.ts` line 77-78), currently empty.
- Two `cluster-btn` buttons stacked vertically:
  - **Quick update**: `anki-quick.svg` icon, aria-label "Quick update card", title "Quick update (Q)".
  - **Edit**: `anki-edit.svg` icon, aria-label "Edit card", title "Edit card (E)".
- Same `cluster-btn` styling as existing buttons (hover `--color-surface-hover`, focus `--color-border-focus`).
- Hidden on mobile width < 768px (mobile uses bottom-sheet-attached buttons — see 4.3).

### 4.2 Card Creator dialog — desktop
- Use `Dialog` component (`src/shared/ui/Dialog.tsx`) as shell, custom body.
- Title: "Card Creator".
- Layout: vertical sections inside scrollable body.

**Section: Card destination**
- `pairRow`: Note type (Select) | Deck (Select).

**Section: Fields** (in this exact order)
1. Target word — Input. Inline map Select. Placeholder: "Enter the word or phrase to learn".
2. Sentence — Textarea. Inline map Select.
3. Sentence translation — Textarea. Inline map Select.
4. Definitions — Textarea. Inline map Select. Placeholder: "Definitions will be imported from your dictionary tool".
5. Image — Media list (vertical). Inline map Select. Each row: thumbnail (image icon SVG) + filename + remove button. Footer: "+ Add image" dashed button.
6. Sentence audio — Media list. Inline map Select. Each row: thumbnail (audio waveform icon SVG) + filename + remove. Footer: "+ Add sentence audio".
7. Word audio — Media list. Inline map Select. Same pattern. Footer: "+ Add word audio".
8. Note — Textarea. Inline map Select. Placeholder: "Add a personal note or context for this card".
9. More example — Textarea. Inline map Select. Placeholder: "Additional example sentences for context".
10. Tags — Input. Inline map Select.

**Inline field mapping** (each field header)
- `field-header`: `field-label` (left) + `field-map` (right).
- `field-map`: compact Select (height 24px, font xs, border + background like `.select`, chevron SVG 14px polyline `6 9 12 15 18 9` stroke 2 round caps, color `--color-text-muted`).
- `field-map .select option { background: var(--color-background); color: var(--color-text); }` (fix dark theme option list).
- Options = field names of the currently selected note type.
- On note type change → auto-map (see §6) → Selects update.
- User can override any Select manually.

**Footer**
- Left: Update mode — `field-label` "Update mode" + Select (Overwrite / Append / Skip).
- Right: buttons **Cancel** (secondary) | **Add** (secondary) | **Update** (primary).

**Alert (when no recent card)**
- Top of body: `alert` box "No recent card found in the last 10 minutes. Fill in the fields below to create a new card."

### 4.3 Card Creator dialog — mobile (bottom sheet)
- **New component**: `BottomSheet` (does not exist — must create in `src/shared/ui/BottomSheet.tsx`).
- Slides up from bottom, drag handle at top, overlay behind, tap overlay / drag down to dismiss.
- Same content as desktop, but:
  - `pairRow` stacks vertically.
  - Footer stacks vertically: Update mode (label on top, Select below, full width) then buttons row (Cancel | Add | Update, each flex:1).
- Mobile entry: two `cluster-btn` buttons appear in a floating cluster at bottom-right of the video viewport (since subtitle block right column is hidden on mobile). Same icons, same actions.

### 4.4 Settings — Card Creator section
- Add a new section in `SettingsDialog.tsx`: "Card Creator".
- **Only Connection subsection** (no Defaults, no Field mapping — those are inline in Card Creator now).
- Field: AnkiConnect URL (TextInput, default `http://localhost:8765`).
- Hint: "Default: localhost:8765. Change to your PC's IP address when using Kiwi or Edge on mobile."
- Connection status bar (card-style):
  - `status-indicator` with `status-dot` + `status-label` + `status-detail` + "Test again" button.
  - States: `.online` (green dot + glow), `.offline` (red dot + glow), `.testing` (yellow dot + pulse animation).
  - Online detail: "Connected · Anki v{version} · {url}".
  - Offline detail: "Disconnected · {error short}".
  - Testing detail: "Testing…".

### 4.5 Toasts
- Use existing toast system (verify in `src/shared/ui/` — if none, create minimal `Toast`).
- Success: "Card created" / "Card updated" / "Card updated (#N)".
- Error: "AnkiConnect: {message}" / "No recent card to update".

## 5. Data model

### 5.1 Settings additions (`entities/settings/types.ts`)
```typescript
interface CardCreatorSettings {
  readonly ankiConnectUrl: string;        // default "http://localhost:8765"
  readonly defaultDeck: string;           // default "Default"
  readonly defaultNoteType: string;       // default "Cell Video Card"
  readonly defaultTags: string;           // default "cell::learning"
  readonly mediaUpdateMode: MediaUpdateMode; // default "overwrite"
}

type MediaUpdateMode = 'overwrite' | 'append' | 'skip';
```
- Add `cardCreator: CardCreatorSettings` to `Settings` interface.
- Bump schema version 9 → 10, add migration in `settingsStore.ts`.

### 5.2 Card draft (in-memory, autosaved)
```typescript
interface CardDraft {
  readonly noteType: string;
  readonly deck: string;
  readonly fields: CardFields;
  readonly fieldMapping: FieldMapping;      // sourceKey -> ankiFieldName
  readonly tags: string;
  readonly mediaUpdateMode: MediaUpdateMode;
}

interface CardFields {
  readonly targetWord: string;
  readonly sentence: string;
  readonly sentenceTranslation: string;
  readonly definitions: string;
  readonly images: MediaFile[];
  readonly sentenceAudios: MediaFile[];
  readonly wordAudios: MediaFile[];
  readonly note: string;
  readonly moreExample: string;
}

interface MediaFile {
  readonly id: string;          // uuid
  readonly filename: string;    // e.g. "screenshot-01.png"
  readonly mimeType: string;
  readonly data: ArrayBuffer;   // raw bytes for AnkiConnect storeMediaFile
  readonly source: 'screenshot' | 'sentence-audio' | 'word-audio' | 'user-added';
}

type FieldMapping = Partial<Record<SourceFieldKey, string>>; // anki field name or "" if unmapped
type SourceFieldKey = 'targetWord' | 'sentence' | 'sentenceTranslation' | 'definitions' | 'images' | 'sentenceAudios' | 'wordAudios' | 'note' | 'moreExample' | 'tags';
```
- Draft autosaved to `chrome.storage.local` under key `cardCreatorDraft` (debounced 500ms). Cleared on successful Add/Update or explicit Cancel confirm.

### 5.3 Default note type "Cell Video Card"
- Field names (exact): `TargetWord`, `Sentence`, `SentenceTranslation`, `Definitions`, `Image`, `SentenceAudio`, `WordAudio`, `Note`, `MoreExample`, `Tags`.
- If missing on first connect → `createModel` via AnkiConnect (desktop only). Single card template: Front=`{{TargetWord}}<br>{{Sentence}}<br>{{SentenceAudio}}`, Back=`{{FrontSide}}<hr id=answer>{{SentenceTranslation}}<br>{{Definitions}}<br>{{Image}}<br>{{WordAudio}}<br>{{Note}}<br>{{MoreExample}}`.
- **Android limitation**: `createModel` is NOT supported by AnkiconnectAndroid. If the model is missing on Android, the UI shows a helpful error with the exact field list so the user can create it manually in AnkiDroid.
- Templates + styling: minimal default; user can customize in Anki.

## 6. Field mapping — auto-map algorithm

On note type change (or first load):
1. Fetch note type's field names via AnkiConnect `modelFieldNames`.
2. For each source field key, compute best match:
   - Exact case-insensitive match against canonical name (e.g. `targetWord` → `TargetWord`).
   - Else fuzzy match (Levenshtein distance ≤ 2, or substring contains) against field names.
   - Else "" (unmapped).
3. Set `fieldMapping` in draft. Inline Selects reflect result.
4. User can override any entry.

Canonical name table (sourceKey → preferred Anki field names in order):
- targetWord: TargetWord, Word, Front, Vocab
- sentence: Sentence, Context, Example, Sentence
- sentenceTranslation: SentenceTranslation, Translation, Native, Meaning
- definitions: Definitions, Definition, Glossary, Meaning
- images: Image, Picture, Screenshot, Image
- sentenceAudios: SentenceAudio, Audio, Sound, SentenceAudio
- wordAudios: WordAudio, Pronunciation, Audio
- note: Note, Notes, Extra, ExtraNote
- moreExample: MoreExample, Examples, ExtraExamples
- tags: Tags, Tag (special — handled as tags array, not a field)

## 7. AnkiConnect service

### 7.1 Location
- `src/features/cardCreator/service/ankiConnectClient.ts` — pure HTTP client (transport-agnostic `FetchFn` injected for testability), no side effects.
- `src/features/cardCreator/service/cardCreatorService.ts` — high-level API the UI calls (returns `Result<T>`, never throws).
- Called from background service worker via message bus (content script cannot fetch cross-origin reliably; SW has `<all_urls>` host permission).

### 7.2 AnkiConnect API conformance (verified 2026-11)

Sources verified:
- Canonical: https://git.sr.ht/~foosoft/anki-connect (FooSoft repo moved off GitHub)
- Android reimplementation: https://github.com/KamWithK/AnkiconnectAndroid
- Android action list: source code `AnkiAPIRouting.java` → `findRoute()` switch statement (authoritative — `docs/api.md` is incomplete, missing `version`).

**API version**: `6` (current). Requests use `{ version: 6, action, params }`. Responses are `{ result, error }` — `error` is `null` on success.

**Android-supported actions** (from source switch cases):
`version`, `deckNames`, `deckNamesAndIds`, `modelNames`, `modelNamesAndIds`, `modelFieldNames`, `findNotes`, `guiBrowse`, `canAddNotes`, `canAddNotesWithErrorDetail`, `addNote`, `updateNoteFields`, `storeMediaFile`, `notesInfo`, `multi`.

**CRITICAL Android behavior**: the `default` switch case returns `"AnkiConnect v.6"` as the result with HTTP 200 — **NOT an error**. Any unsupported action (e.g. `addTags`, `createModel`, `findCards`) silently "succeeds" without doing anything. We detect this:
- `addTags`: desktop success → `result: null`; Android default → `result: "AnkiConnect v.6"` (string) → detect via `result !== null`.
- `createModel`: re-check `modelNames` after call — if model still missing, it hit the default handler.

**Actions used + Android support**:

| Action | Desktop | Android | Notes |
|---|---|---|---|
| `version` | ✅ | ✅ | Connection test. Android returns `"6"` (not in api.md but confirmed in source). |
| `deckNames` | ✅ | ✅ | Populate Deck select. |
| `modelNames` | ✅ | ✅ | Populate Note type select. |
| `modelFieldNames` | ✅ | ✅ | Auto-map fields. |
| `findNotes` | ✅ | ✅ | Find recent note (NOT `findCards`). Android: quote-escaping broken unless new Rust backend → only quote deck/model names containing spaces; slower than desktop. |
| `notesInfo` | ✅ | ✅ | Get note fields + tags. |
| `addNote` | ✅ | ✅ | Create note. Android: media supports `url`+`data` only (no `skipHash`); picture/audio/video all supported. Tags in the note payload work on Android. |
| `updateNoteFields` | ✅ | ✅ | Update note fields per update mode. Only fields present in payload are updated; others preserved. |
| `storeMediaFile` | ✅ | ✅ | Upload media. **Android appends random number to filename** (`file.png` → `file_123456789.png`) → MUST use returned filename in field refs (`<img src="...">`, `[sound:...]`). Desktop may return `null` on success → fall back to input filename. |
| `addTags` | ✅ | ❌ (silent no-op) | Sync tags on update. Android: hits `default` case → returns `"AnkiConnect v.6"` as result → detected via result shape (`!== null`). UI shows non-blocking warning. |
| `createModel` | ✅ | ❌ (silent no-op) | Create "Cell Video Card" if missing. Android: hits `default` case → detected via re-check `modelNames`. UI shows helpful error with field list. |

**Actions NOT used (Android incompatibility — would hit default silent no-op)**:
- `findCards`, `cardsInfo`, `cardsToNotes` — use `findNotes` + `notesInfo` instead.
- `removeTags`, `getTags` — not needed (we only add tags, never remove).
- `suspend`, `unsuspend`, `areSuspended`, `areDue` — not needed.

**Query syntax** (Anki search):
- `deck:"Name"` — quote ONLY when name contains spaces or special chars. AnkiconnectAndroid breaks on quotes unless new Rust backend.
- `note:"Model"` — same quoting rule.
- `added:N` / `edited:N` — granularity is days, not minutes. NOT used for "recent" detection.
- Note ids are ms-timestamps → sorting by id desc gives newest-first. The UI checks `id ≥ now − 600_000` for the 10-minute window.

### 7.3 Message bus additions (`entities/message/types.ts`)
- New message type `CARD_CREATOR_REQUEST` (single generic action; the action name + params are in the payload). This keeps the message bus thin — the high-level API in `cardCreatorService.ts` wraps each AnkiConnect action.
- Background handler in `src/entrypoints/background/handlers/cardCreator.ts` performs the HTTP fetch via `globalThis.fetch` and returns `{ result }` or `{ error }`.
- Content script calls via `sendMessage({ type: CARD_CREATOR_REQUEST, payload })`.

```typescript
interface CardCreatorRequestPayload {
  url: string;
  action: string;
  params?: Record<string, unknown>;
  timeoutMs?: number; // default 10s
}
interface CardCreatorResponseData { result: unknown; }
```

### 7.4 Media upload flow
1. Content script extracts media (screenshot canvas → ArrayBuffer; audio via MediaElement captureStream + MediaRecorder → ArrayBuffer).
2. For each MediaFile: send `storeMediaFile` request through bus with base64-encoded data.
3. **Use the returned filename** (Android may rename `file.png` → `file_123456789.png`).
4. Anki field value for media = `<img src="returnedFilename.png">` (image) or `[sound:returnedFilename.mp3]` (audio). Multiple files → join with `<br>` (image) or space (audio).
5. Update mode applied in `cardCreatorService.updateNote`:
   - **overwrite**: only send non-empty fields from the new payload; other fields preserved by AnkiConnect.
   - **append**: append new value to existing field value (separator `\n`); only send fields with a new value.
   - **skip**: only send fields that are empty in the current note.

## 8. Media extraction

### 8.1 Screenshot
- `src/features/cardCreator/media/screenshot.ts`.
- `captureScreenshot(video: HTMLVideoElement): Promise<MediaFile>`.
- Create canvas at `video.videoWidth × video.videoHeight`, `ctx.drawImage(video, 0, 0)`, `canvas.toBlob('image/png')` → ArrayBuffer.
- Filename: `cell-screenshot-{timestamp}.png`.
- Edge case: video not ready → throw `ScreenshotError("Video not ready")`.

### 8.2 Sentence audio
- `src/features/cardCreator/media/sentenceAudio.ts`.
- `captureSentenceAudio(video, cue: SrtCue): Promise<MediaFile>`.
- Approach: `captureStream()` on video element → MediaRecorder (audio only) → seek to cue.start, play until cue.end, stop recorder → Blob → ArrayBuffer.
- **Performance constraint (4GB mobile)**: if cue longer than 15s, trim to first 15s. If MediaRecorder unsupported (older Kiwi) → fall back to empty + toast warning.
- Filename: `cell-sentence-{cue.index}.mp3` (or `.webm` if mp3 unsupported).
- Avoid blocking tab: run extraction in small chunks; if tab hidden, skip audio (screenshot only).

### 8.3 Sentence translation
- `src/features/cardCreator/media/translation.ts`.
- `getSentenceTranslation(sentence: string, sourceLang: string, targetLang: string): Promise<string>`.
- Priority:
  1. If current subtitle has native track (`nativeCues` matched by time) → use that text.
  2. Else Google Translate unofficial endpoint `https://translate.googleapis.com/translate_a/single?client=gtx&sl={src}&tl={tgt}&dt=t&q={encoded}`. Parse response `[0][*][0]` joined.
  3. On any error → return "" (no crash, no toast spam).
- Run in background SW via offscreen fetch adapter (reuse `offscreenFetch.ts`).

## 9. Keyboard shortcuts

- `src/features/subtitle/ui/cardCreatorKeyboard.ts` (new, mirrors `navClusterKeyboard.ts` pattern).
- `q` → quick update. `e` → edit. Only when:
  - Video focused / subtitle block active.
  - Not typing in an input/textarea.
  - Card Creator dialog not open.
- Wire into `contentScriptController.ts` `handleShortcutKey()` alongside existing shortcuts.

## 10. File structure (new)

```
src/features/cardCreator/
  ankiConnectClient.ts            # pure HTTP client
  ankiConnectClient.test.ts
  fieldMapping.ts                 # auto-map algorithm
  fieldMapping.test.ts
  cardDraft.ts                    # draft state + autosave
  cardDraft.test.ts
  media/
    screenshot.ts
    screenshot.test.ts
    sentenceAudio.ts
    sentenceAudio.test.ts
    translation.ts
    translation.test.ts
    mediaTypes.ts
  ui/
    CardCreatorDialog.tsx         # desktop modal content
    CardCreatorDialog.module.css
    CardCreatorDialog.test.tsx
    BottomSheet.tsx               # shared, mobile shell
    BottomSheet.module.css
    BottomSheet.test.tsx
    FieldRow.tsx                  # field + inline map select
    FieldRow.module.css
    FieldRow.test.tsx
    MediaList.tsx                 # vertical media list + add button
    MediaList.module.css
    MediaList.test.tsx
    ConnectionStatus.tsx          # settings status bar
    ConnectionStatus.module.css
    ConnectionStatus.test.tsx
    cardCreatorIcons.ts           # anki-quick + anki-edit SVG as TS strings

src/entrypoints/background/handlers/cardCreator.ts
src/entrypoints/background/handlers/cardCreator.test.ts

src/features/subtitle/ui/cardCreatorKeyboard.ts
src/features/subtitle/ui/cardCreatorKeyboard.test.ts

src/entities/settings/types.ts            # add CardCreatorSettings
src/shared/lib/storage/settingsStore.ts   # migration v9→v10
```

## 11. Settings schema migration

- Bump `SCHEMA_VERSION` 9 → 10 in `settingsStore.ts`.
- Add `migrateV9ToV10(settings)`:
  ```typescript
  cardCreator: {
    ankiConnectUrl: 'http://localhost:8765',
    defaultDeck: 'Default',
    defaultNoteType: 'Cell Video Card',
    defaultTags: 'cell::learning',
    mediaUpdateMode: 'overwrite',
  }
  ```

## 12. Tests (TDD)

### Unit (jest `unit` project)
- `ankiConnectClient.test.ts` — mock fetch, verify action payloads, error handling.
- `fieldMapping.test.ts` — auto-map cases: exact match, fuzzy, no match, user override preserved.
- `cardDraft.test.ts` — autosave debounce, clear on success, restore on reopen.
- `screenshot.test.ts` — mock canvas, video not ready error.
- `sentenceAudio.test.ts` — mock MediaRecorder, long cue trim, unsupported fallback.
- `translation.test.ts` — native track priority, Google endpoint, error → empty.
- `CardCreatorDialog.test.tsx` — render all fields, change note type triggers auto-map, Add/Update/Cancel buttons call right handlers.
- `FieldRow.test.tsx` — label + inline select + value input render, select change updates mapping.
- `MediaList.test.tsx` — rows render, remove button, add button.
- `ConnectionStatus.test.tsx` — online/offline/testing states render.
- `BottomSheet.test.tsx` — open/close, drag dismiss, overlay dismiss.
- `cardCreatorKeyboard.test.ts` — q/e trigger, ignored when typing or dialog open.

### Integration
- None required for v1 (AnkiConnect needs real Anki running — manual QA).

## 13. Performance & reliability

- **4GB mobile**: screenshot is cheap (one canvas draw). Audio extraction is the heavy part — cap 15s, skip if tab hidden, use `requestIdleCallback` for draft autosave.
- **Autosave**: debounce 500ms, only persist text fields + mapping + meta (not media ArrayBuffers — those stay in memory, re-extracted on reopen if needed).
- **AnkiConnect offline**: all actions fail gracefully → toast error, dialog stays open with draft intact.
- **Translation API**: never blocks card creation. Empty translation is valid.
- **No new dependencies** — use built-in `fetch`, `canvas`, `MediaRecorder`, `captureStream`. Polyfill `captureStream` if needed (`video.captureStream || video.mozCaptureStream`).

## 14. Accessibility

- All buttons have `aria-label`.
- Dialog traps focus, Esc closes, restore focus on close (Dialog already does this).
- BottomSheet: `role="dialog"`, `aria-modal="true"`, drag handle `aria-label="Dismiss"`.
- Inline map Select: `aria-label="Map {field name} to Anki field"`.
- Status indicator: `role="status"`, `aria-live="polite"`.

## 15. Build & verification

- `npm run typecheck` — must pass.
- `npm run lint` — must pass.
- `npm run test:unit` — all new tests pass.
- `npm run build` — extension builds, no bundle size regression > 20KB gzipped (verify with `vite-bundle-visualizer` if available).
- Manual QA: load extension in Chrome + Kiwi, connect to real Anki, run quick update + edit flows.

## 16. Documentation updates (required per AGENTS.md)

- `docs/2-architechture-system.md` — add `cardCreator` feature to tree + dependency + function index.
- `docs/0-wiki.md` — add spec + intent + mockup to mục lục.
- `docs/adr/` — new ADR `NNN-card-creator.md` (WHY only: why inline mapping over settings panel, why bottom sheet new component, why MediaRecorder approach).

## 17. Out of scope (explicit)

- SRS engine.
- Word audio / target word / definitions extraction.
- Cloud sync.
- Bulk multi-subtitle card creation.
- Custom Anki card templates beyond minimal default.
- Reverse mapping (Anki → Cell).
