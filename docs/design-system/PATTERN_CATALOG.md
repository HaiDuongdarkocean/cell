# Pattern Catalog

> Proven UX patterns extracted from production flows. Each pattern is defined only when it has at least one real consumer in the codebase and is composed from existing `src/shared/ui` components.

## Catalog rules

1. A pattern must have a **real production consumer** before it is added.
2. A pattern must not introduce a new visual language; it reuses existing components and tokens.
3. Each entry documents the problem, when to use it, when not to use it, anatomy, states, and a11y requirements.
4. Patterns are **not** components; they are conventions for composing components in a flow.

---

## 1. Async state (loading / empty / error)

### Problem
Data-fetching surfaces need to communicate four states to the user: waiting for data, no data available, something went wrong, and success. Without a consistent convention, each feature invents its own layout, causing inconsistent spacing, iconography, and a11y announcements.

### When to use
- Any panel or block that fetches remote data (subtitle list, dictionary entry, translation, image results).
- Use when the user has already triggered the action or the feature auto-loads on mount.

### When not to use
- Do not use for instantaneous local state changes (use `Button` loading or direct feedback instead).
- Do not use `Skeleton` for indeterminate spinner-only actions where no content shape is known.

### Anatomy
```
<Container>
  loading  → <Spinner /> + optional <Skeleton /> shapes
  empty    → <EmptyState icon title description action />
  error    → <Alert variant="error" title description onDismiss? />
  success  → the actual content
</Container>
```

### States
1. **Idle** — no request has been made or the surface is ready for input.
2. **Loading** — request in flight. Prefer `Spinner` for inline/block-level waits and `Skeleton` when the final layout is known.
3. **Empty** — request succeeded with zero results. Use `EmptyState` with a primary action when the user can create/change input.
4. **Error** — request failed. Use `Alert variant="error"` with a human-readable message and a retry action.
5. **Success** — render the real content.

### A11y
- `Spinner` has `role="status"` and an `aria-label`; do not remove it.
- `Skeleton` uses `aria-hidden="true"` because it is visual-only.
- `EmptyState` uses `role="status"`; ensure the action has an accessible name.
- `Alert` uses `role="alert"` by default for errors; include the error in the message, not just color.
- Focus should remain logical: on retry button after error, on first result after success (where applicable).

### Production consumers
- `src/features/subtitle/ui/SubtitleSearchPanel.tsx` (search → loading → empty/error/results)
- `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx` (search → loading → empty/error/result)
- `src/features/dictionaryPopup/ui/TranslatePanel.tsx` (loading → translation/error)
- `src/features/dictionaryPopup/ui/ImagePanel.tsx` (loading → image/error)
- `src/features/subtitle/ui/SubtitleBlock.tsx` (auto-load → loading → loaded/error/none)

---

## 2. Search → result

### Problem
The user needs to find an item in a large set (subtitles, dictionary entries, languages, profiles). The pattern must support typing, filtering, selection, and feedback without losing focus or context.

### When to use
- Searching a list of external items (subtitles, dictionary terms, language profiles).
- Filtering a manageable client-side list (settings, language list).

### When not to use
- Do not use for simple toggles or filters with fewer than ~10 items (use `Select` or `Tabs` directly).
- Do not use when the result can be shown instantly as the user types and no explicit submit is needed (consider a live filter instead).

### Anatomy
```
<form>
  <SearchField aria-label />   or <Input type="search" />
  <Button type="submit" />
</form>
<Tabs />                      // optional grouping/filtering
<Results role="listbox">
  <ResultItem role="option" aria-selected />
</Results>
```

### States
1. **Idle** — empty or hint state; input is focused.
2. **Typing** — optionally debounced live filter or explicit submit.
3. **Submitting** — `Spinner` or `Button loading` while the search runs.
4. **Results** — selectable list; keyboard Arrow/Enter navigation.
5. **Empty** — no matches; show `EmptyState` with a clear-search action.
6. **Error** — network/parse failure; show `Alert` with retry.

### A11y
- Search input must have an `aria-label` or visible `<label>`.
- Result list must use `role="listbox"` and items `role="option"` with `aria-selected`.
- Keyboard: Arrow keys move, Enter selects, Escape clears/closes.
- Maintain focus: return focus to the search input after a failed search; move to the first result after a successful search.
- Use `aria-live` only for global status messages, not per-result.

### Production consumers
- `src/features/subtitle/ui/SubtitleSearchPanel.tsx`
- `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx`
- `src/features/subtitle/ui/SubtitleManagerPanel.tsx`

---

## 3. Form submit

### Problem
The user needs to create, edit, or delete configuration (API keys, profiles, card fields). The pattern must guide the user through validation, submission, and confirmation while preventing data loss.

### When to use
- Creating or editing records (API keys, language profiles, card fields).
- Destructive actions that need a confirmation step.

### When not to use
- Do not use for single-value toggles (use `Toggle` or `Select`).
- Do not use when changes are applied immediately and no explicit submit is required.

### Anatomy
```
<form>
  <Label htmlFor="field" />
  <Input id="field" aria-invalid? aria-describedby="error" />
  <ErrorText id="error" />
  <Button type="submit" disabled={submitting} />
</form>
<Dialog /> // for destructive confirmations
```

### States
1. **Idle** — form is ready, no validation errors.
2. **Editing** — user changes a field; validate on blur/submit.
3. **Validating** — inline errors appear; invalid fields use `aria-invalid="true"`.
4. **Submitting** — submit button disabled or shows loading state.
5. **Success** — close the form or show a success `Alert`/`Toast`.
6. **Error** — show a non-dismissible or retryable `Alert` with the server-side reason.

### A11y
- Every form control must have an associated label (`htmlFor` + `id` or `aria-label`).
- Error messages must be linked with `aria-describedby`.
- Submit buttons must be disabled while submitting to prevent double submission.
- Focus the first invalid field after failed validation.
- Confirmation dialogs must trap focus and restore focus on cancel/confirm.

### Production consumers
- `src/features/settings/ui/ApiKeyManager.tsx`
- `src/features/cardCreator/ui/CardCreatorDialogContent.tsx`
- `src/features/ocr/ui/OcrSettingsPanel.tsx`

---

## 4. Subtitle acquisition

### Problem
The extension must detect, fetch, parse, and display subtitles without blocking the video. The pattern must handle CORS failures, format detection, caching, and status feedback.

### When to use
- Any feature that loads a subtitle file from the current page or an external URL.
- Auto-load on player ready or manual load by user action.

### When not to use
- Do not use for local-only subtitle rendering that is already in memory (use direct display).
- Do not use for real-time subtitle generation unless the status contract is extended.

### Anatomy
```
<SubtitleBlock>
  <StatusText role="status" />
  <LanguageSelector />
  <OffsetControls />
</SubtitleBlock>
```

### States
1. **Idle** — no subtitle loaded; surface is ready.
2. **Detecting** — scanning the page for subtitle links.
3. **Loading** — fetching and parsing.
4. **Loaded** — subtitle is active; show brief success status then auto-clear.
5. **None** — no subtitle found for this language/video.
6. **Error** — timeout/CORS/parse failure; show message with retry and auto-clear.

### A11y
- Status text must use `role="status"` and include the language name (e.g., "Loading English…").
- Auto-clear success after ~5s and errors after ~10s to avoid stale announcements.
- Language controls must be labeled.
- Offset steppers must announce the new value.

### Production consumers
- `src/features/subtitle/logic/subtitleAutoLoad.ts` (`handleAutoLoadSubtitles`)
- `src/features/subtitle/ui/SubtitleBlock.tsx`

---

## 5. Vocabulary capture

### Problem
The user encounters a word in a subtitle or page and wants to capture it for later study. The pattern must support one-click save and provide clear feedback without interrupting reading.

### When to use
- Dictionary popup lookup results, subtitle word selection, clipboard page.
- Anywhere the user can create an Anki/card-creator note from selected text.

### When not to use
- Do not use for actions that require mandatory user input before saving (use Form submit).
- Do not use when the save cannot be undone or retried safely.

### Anatomy
```
<IconButton aria-label="Quick Add" onClick={capture} />
<Button leadingIcon={<Icon name="send" />} onClick={openCardCreator} />
```

### States
1. **Idle** — buttons are visible and enabled.
2. **Capturing** — `IconButton` shows a loading state or disabled.
3. **Success** — toast/inline status confirms the word was added.
4. **Error** — toast/inline status explains the failure (network, media upload, duplicate).

### A11y
- Quick Add button must have a descriptive `aria-label` (e.g., "Quick Add to Anki").
- Send to Card Creator button must have a descriptive `aria-label`.
- Provide non-visual feedback for success/error (toast or status region).
- Keep focus on the triggering button if the panel stays open.

### Production consumers
- `src/features/dictionaryPopup/ui/CandidateView.tsx`
- `src/features/cardCreator/service/quickAddNote.ts`
- `src/features/dictionaryPopup/ui/useCandidate.ts`

---

## 6. Loading (single async operation)

### Problem
A single button or control needs to show that an action is in progress without replacing the whole UI.

### When to use
- Submit buttons, quick-add buttons, refresh buttons, or any action that triggers a short async call.

### When not to use
- Do not replace the button with a full `Spinner` when a `Button` loading state is enough.
- Do not use for operations that are synchronous and faster than ~200ms.

### Anatomy
```
<Button loading={isLoading} onClick={submit}>
  {isLoading ? 'Saving…' : 'Save'}
</Button>
```

### States
1. **Idle** — button is enabled with its normal label.
2. **Loading** — button is disabled and shows a spinner or loading label.
3. **Done** — button returns to idle or shows a brief success state.

### A11y
- Disabled buttons must not be focusable (use `disabled` or `aria-disabled` with `aria-live` feedback).
- The loading state must be announced (spinner `role="status"` or button text change).

### Production consumers
- `src/features/settings/ui/ApiKeyManager.tsx` (add/edit API keys)
- `src/features/cardCreator/ui/CardCreatorDialogContent.tsx` (save card)

---

## 7. Empty state

### Problem
A list, panel, or result area has no content. The pattern must explain why and give the user a next step.

### When to use
- Search results with zero matches.
- Lists with no items (no API keys, no language profiles).
- Panels that require an upstream selection first.

### When not to use
- Do not use `EmptyState` for errors (use `Alert`).
- Do not use `EmptyState` when content is loading (use `Spinner`/`Skeleton`).

### Anatomy
```
<EmptyState
  icon={<Icon name="inbox" />}
  title="No results"
  description="Try a different search term."
  action={<Button onClick={clearSearch}>Clear search</Button>}
/>
```

### States
1. **Empty** — show the illustration, title, description, and optional action.
2. **Action triggered** — transition to loading or success as appropriate.

### A11y
- `EmptyState` uses `role="status"`.
- The action must have an accessible name.
- Do not rely on icon alone; the title provides the semantic meaning.

### Production consumers
- `src/features/subtitle/ui/SubtitleSearchPanel.tsx`
- `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx`
- `src/features/dictionaryPopup/ui/TranslatePanel.tsx`
- `src/features/settings/ui/ApiKeyManager.tsx`
