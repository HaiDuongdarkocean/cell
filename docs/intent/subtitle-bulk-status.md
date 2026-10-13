# Intent: Subtitle bulk status — parity for subtitle block + subtitle panel on streaming and local player

> Slug: `subtitle-bulk-status` · Mode: interactive · Source: user statement
> ui_surface: yes · confidence: medium

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | A learner cannot bulk-change word status inside the two subtitle surfaces the way they already can on web page text — worst in the local player where no status-key path exists at all, even though its cue list already renders tokenized, status-colored words | user statement; `useSubtitleActions.ts:77-94` (CueList tokenize wired, no status keys); no `statusKeyControls`/`subtitleTokenizeController` in `src/entrypoints/local-player/` (grep-verified) | high |
| Change | From "bulk status (select text → keys 1–4, ctrl+click) only on page text + streaming subtitle surfaces" to "same bulk mechanism on subtitle block + subtitle panel in BOTH the streaming content script and the local-player page"; plus the ctrl+click multi-select gets a visible selected state everywhere | user statement; gap matrix verified vs `statusKeyControls.ts`, `subtitleTokenizeController.ts`, `CueList.tsx:113` | high |
| Solution | Reuse the existing primitives — `extractTermsFromSelection`, `createStatusKeyControls`, `setWordStatus`/`emitWordStatusChanged`, tokenize pipeline (`VideoTokenMap`/preloader) — to bind the local-player surfaces, and extend `CueListTokenize` with ctrl+click selection + selected styling — direction only | `statusKeyControls.ts:35-81`, `selectionTerms.ts:78`, `CueList.tsx:50-53` | medium |
| Value | Mark whole phrases/cues as known/ignored in one keypress while watching — the local player stops being a second-class surface for vocabulary learning | user statement; AGENTS persona (learn while watching) | high |
| Stakeholder | Extension end user (language learner) on streaming pages AND the built-in local player | `PlayerView.tsx`, `useSubtitleActions.ts` | high |
| Context | MV3 extension; streaming surfaces run in content-script context (shadow roots), local player is an extension page (light DOM); another agent concurrently owns `vocabulary-tab-redesign` which may redefine `unknown` semantics — this item must ride `setWordStatus` unchanged | `manifest.json`, pipeline-state active item | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Devin agent + Anh | Buildable on existing primitives; must not collide with concurrent WIP (vocab spec, PrimerTab) | `extractTermsFromSelection`/`statusKeyControls`/`cueListTokens`/`VideoTokenMap` all in place |
| Customer | Learner marking words while watching, incl. on own media files in the local player | Same bulk-status gestures work wherever tokenized words appear | Persona 5–80yo: gesture must stay simple + visible |
| Supplier/Dependency | `wordStatus` messaging (`setWordStatus`, `WORD_STATUS_CHANGED`), `Selection.getComposedRanges` (Chrome 137+), tokenize metadata resolution | Behavior must ride the existing status pipeline — no parallel write path | All stable, in production use on page text today |
| Organization | Repo maintainers | Subtitle surfaces behave identically across contexts; `docs/2-architechture-system.md` + `docs/0-wiki.md` updated | Conventions in AGENTS.md |
| Regulator | none — no legal/policy surface; no manifest/permission change anticipated | none — same extension, same permissions | — |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Selecting words in the local-player subtitle panel (CueList) and pressing 1–4 changes all selected words' status | F | no `statusKeyControls` in `src/entrypoints/local-player/`; CueList already tokenized (`useSubtitleActions.ts:77-94`); `extractTermsFromSelection` works on light DOM | high |
| N2 | The local-player subtitle block (overlay) is tokenized and supports the same select→1–4 bulk change | F | overlay shows plain text — no `subtitleTokenizeController` in local player; user confirmed surface scope | high |
| N3 | Ctrl/Cmd+click on a token in the subtitle panel toggles it into the multi-selection — works on streaming (split view + Player Mode) and local player | F | `CueList.tsx:113` binds only `onTokenClick`; `tokenSpanRenderer.ts:68-71` already routes ctrl/meta-click to `onTokenCtrlClick` | high |
| N4 | Selected words render a visible selected state on every tokenized surface | U | `[assumption]` — no `js-Tihoka-token--selected` class exists anywhere (grep-verified); invisible selection makes ctrl+click undiscoverable today | medium |
| N5 | A status change made on a subtitle surface re-renders every live surface showing that term (panel, overlay, popup) via the existing broadcast | R | `emitWordStatusChanged`/`onWordStatusChanged` already drive CueList (`CueList.tsx:163-168`) + videoTokenMap (`subtitleTokenizeController.ts:99-117`) | high |
| N6 | The mechanism is identical to what works on web page text — same keys, same gestures, no new UI controls | U | user confirmed "giống hiện tại" | high |
| N7 | Reuse existing tokenize/status primitives; no new dependencies | +infra | AGENTS.md conventions; all primitives cited above exist | high |
| N8 | Every new user-visible string/state ships in en + vi and exposes accessible state (selected tokens readable by AT) | U | repo convention (`messages/en.json`, `messages/vi.json`) | medium |

## Scope

- **In:** local-player status-key wiring (selection → 1–4 → status, incl. popup-target priority parity); tokenizing the local-player subtitle block; ctrl+click multi-select + selected styling in CueList (all consumers) and visible selected state on bound token spans; status broadcast propagation; i18n/a11y for new states; unit tests; docs updates.
- **Out:** any change to web page text behavior (already works); changing what `unknown`/status transitions mean (`setWordStatus` stays the single write path — the concurrent vocab spec owns semantics); mobile/touch multi-select UI; vocabulary tab.
- **Non-goals:** new bulk UI (checkboxes, toolbars, select-all buttons); status change via mouse-only flows beyond ctrl+click; syncing selection state across tabs (selection is per-page ephemeral, like today).

## Workflow

Person↔device, streaming page: the learner already drag-selects subtitle text in the overlay block or the cue-list panel and presses 1–4 — every token under the selection changes status and recolors (shipped 2026-09-16). The gap there is narrow: ctrl+click on a cue-list token does nothing, and a ctrl+clicked word shows no visible "selected" mark anywhere. Person↔device, local player: the learner opens a video + subtitles, opens the subtitle panel — words are tokenized and status-colored, but selecting text and pressing 1–4 does nothing (no key handler exists); the overlay block shows plain untokenized text. Person↔person: none. System↔system: the content-script/local-player client calls `setWordStatus` → background persists → `WORD_STATUS_CHANGED` broadcasts re-render every listening surface (cue list token map, overlay block, dictionary popup). Start: a selection (native or ctrl+click) inside a tokenized subtitle surface. End: all selected terms persisted at the new status and every surface recolored.

## Journey

### AS-IS

1. Learner opens the local player, loads a video with subtitles, and opens the subtitle panel — the cue list shows tokenized, status-colored words (`cueListTokenize` wired in `useSubtitleActions.ts:77-94`).
2. They drag-select a phrase in the panel and press `3` (known) — nothing happens: no `statusKeyControls` exists in the local-player entrypoint, so the keypress dies; the overlay block above the video is plain text with no word coloring at all.
3. Their only path is clicking one word → dictionary popup → footer status buttons — one word at a time (`CueList.tsx:113` → `onTokenClick`).
4. On a streaming page the same learner can drag-select the overlay or the split-view panel and press 1–4 — but ctrl+click on a cue-list token does nothing (`CueList` binds no `onTokenCtrlClick`), and words they ctrl+click on page text or the overlay enter `selectedTerms` with zero visual feedback (no `js-Tihoka-token--selected` class exists).

### TO-BE

1. Learner in the local player drag-selects words in the subtitle panel — or ctrl+clicks several tokens — and presses `3`; every selected word flips to `known`, colors update in place, and the change broadcasts like any other status write.
2. The same gestures work on the local-player overlay block, which now renders tokenized, status-colored words identical to the streaming overlay.
3. On streaming pages the cue list behaves like the overlay: ctrl+click toggles a token into the selection, and selected words show a visible selected state on every surface (page text, overlay, both panels).
4. The whole interaction uses the keys and gestures already learned on page text — no new controls to discover; every change lands via `setWordStatus` + `WORD_STATUS_CHANGED` so popup, panel, and overlay stay consistent.

## Stories

- S1: As a learner using the local player, I want to select subtitle words and press a status key so that I can mark many words at once — done when a selection in the panel or overlay + 1–4 changes all selected words' statuses.
- S2: As a learner, I want the local-player subtitle block tokenized like the streaming overlay so that word colors and bulk status work there too — done when the overlay shows status-colored tokens that respond to select→1–4.
- S3: As a learner, I want to ctrl+click words in the cue list to build a multi-selection so that non-contiguous words change together — done when ctrl+click toggles selection and 1–4 applies to all selected terms on both contexts.
- S4: As a learner, I want to see which words are selected so that I don't mis-mark vocabulary — done when selected tokens render a distinct visible state on every tokenized surface.
- S5: As a learner, I want status changes to recolor every surface showing the word so that the UI never contradicts itself — done when a bulk change updates panel, overlay, and any open popup via the existing broadcast.

## Risks

| Risk | Type (human/operational/internal/external/legal/hidden) | Impact | Team's ability to respond |
|---|---|---|---|
| Local-player overlay tokenize adds a second tokenize pipeline (VideoTokenMap/preloader) per page — memory/CPU on large subtitle files | operational | medium | Reuse the same windowed preloader (DEFAULT_WINDOW=1); spec decides exact reuse vs adapter |
| `CueListTokenize` contract extension (ctrl+click + selected set) must serve all CueList consumers (split view, Player Mode, local player) without breaking existing callers | internal | low | Optional props on the existing type; grep all consumers before changing |
| Keys 1–4 firing while the learner types in an input | human | low | `isEditableEvent` guard already in `statusKeyControls` — reuse unchanged |
| Ctrl+click on macOS opens the context menu — metaKey path | external | low | `tokenSpanRenderer.ts:68` already treats ctrl+meta uniformly; verify on real browser |
| Concurrent agents (vocab spec redefining `unknown`; PrimerTab WIP) contaminate the diff or change `setWordStatus` semantics mid-flight | operational | medium | Commit only this item's files; bulk path calls `setWordStatus` unchanged so semantics land automatically |
| Selection inside shadow roots needs `getComposedRanges` (Chrome 137+) — local player is light DOM, but Player Mode / split view roots must stay registered | hidden | low | Existing `getShadowRoots`/`getExtraShadowRoots` pattern already proven by `bulk-status-selection` e2e |

## Decision

go — direct user request; the mechanism and primitives already exist on other surfaces; work is bounded to wiring + one tokenize binding + one styling/state addition.

## Draft Acceptance Criteria

- [ ] Drag-selecting words in the local-player subtitle panel and pressing 1–4 changes every selected term's status, recolors in place, and broadcasts `WORD_STATUS_CHANGED`.
- [ ] The local-player subtitle block renders tokenized, status-colored words; select→1–4 works there too.
- [ ] Ctrl/Cmd+click on a cue-list token toggles it into the multi-selection on streaming (split view + Player Mode) and local player; 1–4 applies to all selected terms.
- [ ] Selected tokens show a distinct visible selected state on every tokenized surface (page text, overlay, panels).
- [ ] An open dictionary popup's term still wins over selection for 1–4 (existing priority), and keys are inert inside editable fields.
- [ ] All new strings in `en.json` + `vi.json`; selected state exposed to AT; `npm run typecheck && npm run test:unit && npm run build` pass; real-browser verification on a streaming mock and the local player.
