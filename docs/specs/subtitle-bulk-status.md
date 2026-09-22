# Spec: Subtitle bulk status — select→1–4 + ctrl+click parity on subtitle block and subtitle panel

> Intent: `docs/intent/subtitle-bulk-status.md` · ui_surface: yes · Mode: interactive

## Objective

Bring the bulk word-status mechanism that already works on web page text (native text selection or ctrl+click multi-select → keys 1–4) to the two subtitle surfaces — the overlay **subtitle block** and the cue-list **subtitle panel** — in **both** runtime contexts: the streaming content script (where drag-select already works on both surfaces but ctrl+click in the cue list currently opens the dictionary) and the local player (where no status-key path exists and the overlay is not tokenized). Selected tokens gain a visible selected state on every tokenized surface.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Learner | drag-selects text over tokens, ctrl/cmd+clicks tokens, presses 1–4 or Esc, plain-clicks a token | selection ranges, modifier clicks, key presses | recolored token statuses, visible selected state, selection-count announcements, dictionary popup on plain click |
| Dictionary popup | open popup with a looked-up term | term, langCode | status applied via `PopupStatusTarget` (existing priority over selection); repaints on `WORD_STATUS_CHANGED` |

System-internal processing never includes human behavior. Decisions ("learner picks key 3") are actor inputs, not system steps. Word-status persistence and cross-tab relays are internal suppliers, not actors.

## Requirements

### Functional

REQ-1: Tokenize the local-player subtitle block and wire its status-key path
- Actor: Learner (opens the local player and loads subtitles)
- Goal: overlay target line renders tokenized, status-colored word spans identical to the streaming overlay, and status keys work on it
- Preconditions: `subtitleOverlayTargetLanguage` set (same gate as the existing local-player `cueListTokenize`); cues loaded in `cuesStore`
- Basic flow:
  1. system creates one `createSubtitleTokenizeController` for the local-player page, wired with: `getLineElements` → the live overlay line spans (`[data-cell-id="subtitle-block"] [data-role="target"|"native"] span`, **scoped to the live block — excludes the editable `OverlayPreview` instance**); `getExtraShadowRoots` → `[data-cell-split-view="panel"].shadowRoot` (same `SPLIT_VIEW_PANEL_SELECTOR` pattern as the content script — the local-player cue list lives in a shadow root too, `subtitleSplitView.ts:280`); `onOpenDictionary` → the local `webTextCtrl.handleLookup` (same adapter as `cueListTokenize.onTokenClick`); `getPopupStatusTarget` → `webTextCtrl.getPopupStatusTarget`
  2. system subscribes to `cuesStore` and drives `setCues(targetCues, nativeCues)` on cue-list changes and `render(targetActiveIndex, nativeActiveIndex)` on active-index changes
  3. system binds token spans for the **active cue only** (`render` binds `activeTargetIndex`; the ±`DEFAULT_WINDOW` scope is the preloader's prepare window, not a bind scope) and resolves status/frequency metadata
  4. the controller's `createStatusKeyControls` attaches its capture-phase window keydown — 1–4 become live for the whole local-player page
- Alt flow: no target language configured → controller never created; block stays plain text and keys do nothing (today's behavior)
- Exception: metadata resolution failure → tokens render uncolored (same graceful degradation as streaming); controller destroyed on page teardown/language change
- Rules: only the target line is tokenized — native line stays plain; `getLineElements` must return the live overlay spans only (the manager-panel `OverlayPreview` renders a second `SubtitleBlock editable` and must never be tokenized)
- Postcondition: overlay block shows `.js-cell-token` spans with status/frequency classes; ctrl+click on them multi-selects (free via the controller's `onTokenCtrlClick` wiring); 1–4 apply on the page
- NFR refs: NFR-1, NFR-4

REQ-2: Apply a status to a native text selection on any subtitle surface
- Actor: Learner
- Goal: change status of every word under a drag selection in one keypress
- Preconditions: tokenized words rendered; a non-collapsed selection covering ≥1 token; no editable field focused
- Basic flow:
  1. actor drag-selects text in the subtitle block or subtitle panel
  2. actor presses 1/2/3/4
  3. system resolves the status (`1→unknown, 2→tracking, 3→known, 4→ignore`) and extracts `data-cell-term` values intersecting the selection via `extractTermsFromSelection`; the allowed root set is **`document` ∪ every registered shadow root** — required because the local player mixes a light-DOM overlay with a shadow-DOM panel (registering the panel root alone would filter out overlay selections)
  4. system calls `setWordStatus` per term and emits `WORD_STATUS_CHANGED` per term; clears the native selection
  5. every live surface showing a changed term repaints via the existing subscriptions (cue-list token map, overlay block, open popup; other tabs via the `wordStatusCrossTab` message relay)
- Alt flow: open dictionary popup term wins over selection (existing `getPopupStatusTarget` priority); `selectedTerms` non-empty wins over native selection; neither present → `hoveredTerm` fallback **on bound-span surfaces only** (overlay/page text — cue lists wire no hover tracking); all empty → key returns false and the event passes through
- Exception: `setWordStatus` failure for a term → best-effort continue for remaining terms (existing `applyStatusToTerms` semantics — unchanged)
- Rules: works identically on streaming (overlay, split-view panel, Player Mode panel) and local player (overlay, panel); keys inert inside editable fields (`isEditableEvent`)
- Postcondition: selected terms persisted at new status; surfaces consistent
- NFR refs: NFR-2, NFR-3, NFR-5

REQ-3: Ctrl/Cmd+click multi-select on cue-list tokens
- Actor: Learner
- Goal: build a non-contiguous multi-word selection in the cue list
- Preconditions: tokenized cue list rendered (streaming split view, streaming Player Mode, or local player); the surface's `CueListTokenize` adapter opted into selection
- Basic flow:
  1. actor ctrl/cmd+clicks a word token in the cue list — CueList intercepts ctrl/meta **before** `onTokenClick` (same ordering as `tokenSpanRenderer.ts:68-71`; today the click opens the dictionary — this spec intentionally diverts that gesture)
  2. system toggles the term in the selection store owned by the context's subtitle tokenize controller (the store its `statusKeyControls` reads — the controller exposes a selection API: toggle + read + subscribe)
  3. system renders the selected state on matching tokens (REQ-4)
  4. actor presses 1–4 → system applies status to all selected terms (REQ-2 flow steps 3–5) and clears the store
- Alt flow: plain click still opens the dictionary popup (unchanged); Esc clears the selection (and the hovered term, per existing `statusKeyControls`); ctrl+click on an already-selected term deselects it; a `CueListTokenize` consumer that does not pass selection members keeps today's behavior (ctrl+click → dictionary)
- Exception: none — selection is in-memory only
- Rules: selection is per-store, per-page ephemeral — never persisted, never synced across tabs; on streaming the cue-list store is the **subtitle** controller's store (web controller's store remains independent — see §Flows cross-store rule)
- Postcondition: `selectedTerms` reflects toggled terms until applied or cleared
- NFR refs: NFR-2, NFR-3

REQ-4: Visible selected state on tokenized surfaces
- Actor: Learner
- Goal: see which words are currently selected, and have the selection count readable by assistive tech
- Preconditions: a term is present in a context's selection store
- Basic flow:
  1. system marks every rendered token whose term ∈ the selection store backing its surface with the `js-cell-token--selected` modifier — bound spans (`tokenSpanRenderer` display options + restyle path) and cue-list spans (`CueList`) alike
  2. system updates the marks whenever that store changes (store subscribe → `restyleTokenBlock` in place for bound blocks; React re-render via the `CueListTokenize` adapter for cue lists)
  3. system announces selection-count changes through one document-level `VisuallyHidden` `aria-live="polite"` region per page (e.g., "2 words selected" / "selection cleared") — covers every surface uniformly
- Alt flow: term selected but not currently rendered → no mark needed until it renders
- Exception: none
- Rules: marking is per-store — a token is marked iff its term ∈ the store backing the surface that renders it (streaming: subtitle-store selection marks cue list + overlay; web-store selection marks page text); the `--selected` style is added to BOTH token-span CSS builders (`buildTokenSpanCss` and `buildTokenSpanCssForShadow` — the cue list is shadow-DOM in both contexts); the mark is a distinct visual (e.g., outline/ring), **not** a status recolor
- Postcondition: the user sees the exact selection before pressing a status key; AT users hear the count change
- NFR refs: NFR-3, NFR-5

REQ-5: Keep status propagation consistent (system-internal invariant)
- Actor: none — invariant on every apply path
- Goal: every bulk change lands through the single status write path and repaints every surface
- Preconditions: a status apply ran (REQ-2/REQ-3)
- Basic flow:
  1. system writes each term via `setWordStatus` (single write path — no parallel store)
  2. system emits `WORD_STATUS_CHANGED` per term (same-context pub/sub) so cue-list token maps, overlay blocks, and open popups repaint; cross-tab convergence rides the existing `wordStatusCrossTab` message relay
- Alt flow: none
- Exception: broadcast failure for a term → that surface repaints on next metadata refresh (existing behavior)
- Rules: no change to `setWordStatus` semantics — `unknown` handling stays whatever the store implements (concurrent vocab spec owns it); no new message types
- Postcondition: all surfaces converge to the persisted status
- NFR refs: NFR-1, NFR-5

REQ-6: Selection lifecycle
- Actor: Learner
- Goal: predictable start/end of a selection session
- Preconditions: none
- Basic flow:
  1. selection begins empty (per page, per tokenize session, per store)
  2. ctrl+click adds/removes terms; a status apply or Esc empties it; Esc also clears `hoveredTerm` (existing `statusKeyControls` behavior)
  3. cue-list reload or controller destroy drops the selection with the session
- Alt flow: native selection and ctrl+click selection are independent inputs — whichever yields terms wins in the resolution order (selectedTerms first)
- Exception: none
- Rules: no persistence, no cross-tab sync — matches today's page-text behavior; a dropped selection also drops its visual marks
- Postcondition: selection never leaks across videos, cue reloads, or page navigations
- NFR refs: NFR-3

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Reuse existing primitives only: `createSubtitleTokenizeController`, `createStatusKeyControls`, `extractTermsFromSelection`, `setWordStatus`/`emitWordStatusChanged`, `tokenSpanCss`, `cueListTokens` — no new dependencies | +infra | diff review — zero new entries in package.json |
| NFR-2 | Selection extraction covers every token-bearing root: `document` (local-player overlay, page text) ∪ every registered shadow root (cue-list panels in both contexts, streaming overlay root) | F | unit tests: light-DOM selection + shadow-root selection + mixed document∪shadow extraction |
| NFR-3 | Status keys inert in editable fields; popup-term priority preserved; plain click still opens the dictionary | U | unit tests on `statusKeyControls` resolution order + CueList click routing |
| NFR-4 | Local-player overlay tokenize bounded by the same `DEFAULT_WINDOW=1` preloader window — no full-list tokenize | P | memory stays in the same class as streaming |
| NFR-5 | Selected-state styling lives in the shared token-span CSS SSOT (both builders); any new strings (selection announcements) ship in `en.json` + `vi.json`; selection count exposed via `aria-live` region | U | design-system check; i18n diff; AT announcement verified |
| NFR-6 | Selection/keypress path stays O(tokens under selection) per keypress; `CueListTokenize` extension is backward-compatible (non-opt-in consumers unchanged) | P | existing behavior preserved |
| NFR-7 | Real-browser verification on a streaming mock (split view + Player Mode) and the local player | R | `testing-extension-browser` / stage-2 spec |

## Flows / States

Status-key resolution order (sequence, per keypress — existing `statusKeyControls` semantics, now instantiated in the local player too):

```
keydown 1–4 ──editable?──> ignore (event passes through)
  └─> popupTarget? ──yes──> apply to popup term
  └─> selectedTerms non-empty? ──yes──> apply to all selected, clear selection store
  └─> native selection terms (allowed roots = document ∪ registered roots)? ──yes──> apply to all, clear native selection
  └─> hoveredTerm? (bound-span surfaces only) ──yes──> apply to hovered term
  └─> none ──> return false (other handlers/shortcuts proceed)
```

Cross-store rule (streaming only — two controllers, two private stores): each `statusKeyControls` listener reads exactly one store; listeners run in registration order and a successful apply `stopImmediatePropagation`s. Both stores non-empty → the first listener applies+clears its store; the second store keeps its terms and applies on the next status keypress. Accepted semantics (matches today's per-controller isolation).

Selection lifecycle (state view):

```
selection: ∅ --ctrl+click term--> {term…} --ctrl+click same term--> {term…} \ term
{terms} --status key--> applied → ∅
{terms} --Esc--> ∅            (Esc also clears hoveredTerm)
{terms} --cue reload / destroy / navigation--> ∅
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Tokenize local-player overlay cues | subtitle tokenize controller bound to local-player line elements + `cuesStore` subscription driving `setCues`/`render` |
| Resolve a bulk status intent | `createStatusKeyControls` instance per context (capture-phase window keydown, popup-target priority, selection→hover fallbacks) |
| Extract terms from a text selection | `extractTermsFromSelection` with allowed roots = `document` ∪ registered shadow roots (`SPLIT_VIEW_PANEL_SELECTOR` panel root in both contexts) |
| Track a multi-token selection | `selectedTerms` in each controller's tokenize state store + a controller selection API (toggle/read/subscribe) consumed by cue-list surfaces via extended `CueListTokenize` |
| Mark selected tokens | `js-cell-token--selected` styling in both token-span CSS builders + selected-class application in `tokenSpanRenderer` and `CueList` |
| Announce selection to AT | one document-level `VisuallyHidden` `aria-live="polite"` region per page, fed by store subscribe |
| Persist + broadcast a status | `setWordStatus` + `emitWordStatusChanged`; existing `onWordStatusChanged` subscriptions repaint cue lists, overlay maps, popups; `wordStatusCrossTab` relay for other tabs |
| Open dictionary on click | existing `onTokenClick` wiring (unchanged — CueList intercepts ctrl/meta before it) |

## Alternatives considered

| Alternative | Verdict | Reason |
|---|---|---|
| Standalone shared selection store (new SSOT module outside controllers) | rejected | duplicates `tokenizeStateStore.selectedTerms` which `statusKeyControls` already reads; adds plumbing for zero behavioral gain |
| New bulk UI (checkboxes/toolbar/select-all) in the cue list | rejected | user confirmed mechanism parity ("giống hiện tại"); new chrome costs i18n/a11y/layout for no requested value |
| Expose the owning controller's store via a selection API on `SubtitleTokenizeController` | chosen | smallest diff — the store is already the exact model the key handler consumes; cue-list adapter bridges React↔store |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `selectedTerms` | `ReadonlySet<term>` | in-memory `TokenizeState` per controller, per page | until apply/Esc/destroy — never persisted |
| `WordStatusEntry` | `term`, `status`, `updatedAt` | IDB `langWordStatus` (existing) | unchanged — this spec adds no stores/messages |
| `CueListTokenize` (contract) | `langCode`, `onTokenClick` + optional `onTokenCtrlClick`, selected-set + subscribe members | prop contract `CueList.tsx` | compile-time |

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 (local-player panel select→1–4) | REQ-1, REQ-2, REQ-5 | AC-1, AC-5 |
| N2 (local-player overlay tokenized) | REQ-1, REQ-2 | AC-2 |
| N3 (ctrl+click in cue list, both contexts) | REQ-3, REQ-6 | AC-3 |
| N4 (visible selected state) | REQ-4 | AC-4 |
| N5 (surfaces converge) | REQ-5 | AC-5, AC-10 |
| N6 (mechanism parity, no new UI) | REQ-2, REQ-3, REQ-6 | AC-6, AC-9 |
| N7 (reuse, no deps) | REQ-1, REQ-5 | AC-7 |
| N8 (i18n/a11y) | REQ-4 | AC-8 |

| Journey step | REQ |
|---|---|
| TO-BE 1 (local player select/ctrl+click → status flips) | REQ-2, REQ-3, REQ-5 |
| TO-BE 2 (local overlay tokenized + same gestures) | REQ-1, REQ-2, REQ-3 |
| TO-BE 3 (streaming cue list ctrl+click + visible selection) | REQ-3, REQ-4 |
| TO-BE 4 (single write path, consistent surfaces) | REQ-5, REQ-6 |

## Boundaries

- Always: reuse the listed primitives; keep `data-cell-id`/`data-cell-term`/`js-cell-token` contracts stable; barrel imports; unit tests for selection extraction (light-DOM + shadow + mixed roots), key resolution order, and CueList selection; design tokens only for the selected-state styling; `getLineElements` scoped to the live overlay block (never `OverlayPreview`).
- Ask first: any manifest/permission change (none anticipated); any new dependency (none anticipated); changing `setWordStatus` semantics (owned by the vocab spec).
- Never: persist or sync selection across tabs; add new bulk UI chrome (checkboxes/toolbars); write status via any path other than `setWordStatus`; edit generated token files; tokenize the `OverlayPreview`/editable subtitle block.

## Success Criteria

- [ ] AC-1: In the local player, drag-selecting ≥1 token (verified with 2+) in the shadow-DOM subtitle panel and pressing `3` sets every selected term to `known`, recolors them in place, and emits `WORD_STATUS_CHANGED` per term.
- [ ] AC-2: In the local player, the subtitle block renders status-colored token spans for the active cue; drag-select→1–4 and ctrl+click→1–4 both apply to them; the `OverlayPreview` block is never tokenized.
- [ ] AC-3: Ctrl/cmd+click on a cue-list token toggles it in the multi-selection on streaming split view, streaming Player Mode, and local player (3 contexts verified separately); pressing 1–4 applies to all selected terms; Esc clears; plain click still opens the dictionary; a `CueListTokenize` consumer without selection members keeps ctrl+click→dictionary.
- [ ] AC-4: Selected tokens render `js-cell-token--selected` — a distinct visual mark that is not a status recolor — on bound spans (page text, overlay) and cue-list tokens, updating live on selection change.
- [ ] AC-5: An open dictionary popup's term still wins over any selection for 1–4 (local player included); keys are inert inside editable fields.
- [ ] AC-6: No new bulk UI exists — gestures/keys match page text exactly; selection is never persisted or synced, and is dropped on cue reload/navigation (verified).
- [ ] AC-7: `npm run typecheck && npm run lint && npm run test:unit && npm run build` pass; no new dependencies.
- [ ] AC-8: Selection-count changes are announced via a document-level `aria-live="polite"` region in each context (AT-verifiable); any new strings exist in `en.json` + `vi.json`; `--selected` styling comes from the shared token-span CSS (both builders) using design tokens.
- [ ] AC-9: Regression — drag-select→1–4 still works on streaming overlay and split-view panel (existing `bulk-status-selection` e2e stays green); page-text ctrl+click unchanged.
- [ ] AC-10: After a bulk apply on one surface, every other live surface showing a changed term — including an open dictionary popup — repaints via `WORD_STATUS_CHANGED` without reload.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] UI changes pass design-system check (tokens, shared components, no hardcoded values)
- [ ] Real-browser verification: streaming mock (split view + Player Mode) and local player — select→1–4 + ctrl+click paths
- [ ] `docs/2-architechture-system.md` + `docs/0-wiki.md` updated
- [ ] Commit contains only this item's files (working tree has concurrent WIP)

## Open Questions / Accepted Risks

- The Words tab (`PrimerTab`) renders `.js-cell-token` spans in the same panel root — it inherits native-select→1–4 "for free" once a status-key handler exists, but NOT ctrl+click (its row `onClick` routes unconditionally to `onTokenClick`). Accepted consequence, not in scope.
- Cross-store apply semantics on streaming (first-non-empty-store wins per keypress; the other store applies on the next key) — accepted; revisit if real-browser verification shows confusing stale marks.
- Ctrl+click on macOS maps to metaKey — `tokenSpanRenderer` already routes both; CueList must apply the same `ctrl||meta` check; real-browser check confirms no context-menu regression.
- If `vocabulary-tab-redesign` lands `unknown`-as-absence first, bulk `1` semantics follow automatically since every write goes through `setWordStatus` — no coordination needed.
- `restyleTokenBlock` strips only status-/frequency-prefixed classes, so `--selected` survives restyles today — revisit if class-stripping broadens.
- Double keydown listeners (web + subtitle controllers on streaming) already resolve in registration order; a miss returns false without `stopImmediatePropagation` so the next listener gets the key — unchanged by this spec.
