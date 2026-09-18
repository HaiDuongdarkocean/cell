# Intent: Vocabulary tab redesign — responsive IA, view/edit modes, 24h trash for unknown

> Slug: `vocabulary-tab-redesign` · Mode: interactive · Source: user statement
> ui_surface: yes · confidence: medium

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Learners permanently lose a marked word the moment it returns to `unknown` — no undo window — and the vocabulary tab is unusable at narrow widths (search collapses next to the sort select) and poorly spaced at wide widths | user statement; `VocabularyTab.tsx:124-144` (search+Select same flex row), `VocabularyTab.tsx:196-205` (delete always visible), `VocabularyTab.module.css:22-31` | high |
| Change | Vocabulary tab gains (a) a 24h soft-delete trash for words transitioning to `unknown`, (b) view/edit modes so delete is only visible on demand, (c) redesigned status filters + control layout responsive across panel widths, in the Universal Panel / Dictionary visual language | user statement | high |
| Solution | Extend word-status persistence with retention metadata + restore path; rebuild tab IA (filter control, stacked controls, row structure, edit toggle) from `src/shared/ui/` components and tokens — direction only | `wordStatusStore.ts:101-135` (upsert/delete only, no retention), `src/shared/ui/` catalog | medium |
| Value | No accidental vocabulary loss; one consistent, comfortable panel UX across screen sizes for a 5–80yo persona | user statement; AGENTS persona | high |
| Stakeholder | Extension end user (language learner) inside the Universal Panel | `mountUniversalPanel.ts:18,204` | high |
| Context | MV3 extension; word status lives in extension-origin IndexedDB behind background messaging (`WORD_STATUS_*`); concurrent working-tree WIP exists in neighboring features | `wordStatus.ts:49-171`; `git status` WIP | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Devin agent + Anh | Buildable within existing store/messaging/UI primitives; must not disturb concurrent WIP | IDB + MV3 messaging + shared UI all in place; no new dependency needed |
| Customer | Learner using the vocabulary tab to review/manage marked words | Recoverable de-marks; clean list that works on phone-width and desktop-width panels | Persona: 5–80yo, any device |
| Supplier/Dependency | IndexedDB (`langWordStatus` store), background `WORD_STATUS_*` handlers, cross-tab broadcast events | Retention + purge must ride the existing store/messaging, not a parallel system | Store has keyPath `term`, index `by_status`; records are schemaless per-row — optional fields need no version bump |
| Organization | Repo maintainers | Consistent design language; i18n catalogs; `docs/2-architechture-system.md` + `docs/0-wiki.md` updates | Conventions documented in AGENTS.md |
| Regulator | none — no legal/licensing surface; Chrome Web Store policy unchanged | none — no manifest or permission change anticipated | — |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | A word removed from the vocabulary tab is retained in a trash area for one day, then permanently deleted | F | user statement + confirmed scope (Remove in tab only) | high |
| N2 | A trashed word can be restored before expiry, returning to its previous status | F | user confirmed: trash is a visible view ⇒ restorable | high |
| N3 | The trash is a visible, reachable view inside the vocabulary tab (list + restore + retention info) | F | user confirmed: separate view inside the tab | high |
| N3b | Only the vocabulary-tab Remove action routes to trash; marking `unknown` from other surfaces (status key `1`, cycle wrap, popup footer) keeps current unmark semantics — not trash | F | user confirmed: "chỉ Remove trong tab" | high |
| N3c | Only the three meaningful statuses are persisted; `unknown` = absence of a row, never a stored status | F | user statement: "chỉ lại 3 trạng thái" | high |
| N4 | Controls and list remain usable at ≤599px and comfortable at ≥840px — responsive, not fixed-width | U | user statement; `UniversalPanel.module.css:67-103` (839px/599px breakpoints) | high |
| N5 | Default view mode hides destructive affordances; edit mode reveals them | U | user statement | high |
| N6 | Search and sort controls never share a shrinking horizontal row | U | user statement; `VocabularyTab.tsx:124-144` | high |
| N7 | Status filter presentation redesigned to match Universal Panel / Dictionary toolbar language | U | user statement; `DictionaryToolbar.tsx` icon+label+count pattern | high |
| N8 | All new strings (modes, trash, restore, retention, empty states, aria) ship in en + vi catalogs | U | repo convention; `messages/en.json`, `messages/vi.json` | high |
| N9 | Purge must never remove a word that still has an active status; events keep other surfaces consistent | R | implicit; `wordStatusEvents.ts`, `wordStatusCrossTab.ts` | high |
| N10 | Reuse shared UI components/tokens/icons only; no new dependencies; token changes via `tokens.json` | +infra | AGENTS.md conventions | high |

## Scope

- **In:** VocabularyTab IA redesign (filters, controls, rows, view/edit mode); trash retention + lazy purge + restore reachable only from the tab's Remove action; `unknown`-as-absence semantics (no stored unknown rows); i18n keys; unit tests; docs updates.
- **Out:** Dictionary popup redesign; other panel tabs; Anki pipeline; tokenize coloring behavior; trashing `unknown` transitions made outside the tab.
- **Non-goals:** Cloud/cross-device sync of trash; bulk import/export; changing what `unknown` means for token coloring (an unstored word is still `unknown` — purge is invisible outside the list).

## Workflow

Person↔device: the learner opens the Universal Panel, switches to Vocabulary, scans the list in view mode. To manage it they enter edit mode; removing a word there sends it to the tab's trash view with the previous status remembered — the only entry path to trash (user-confirmed scope). From the trash view they can restore within a day. Marking `unknown` from other surfaces (status key `1`, cycle wrap, popup footer) simply unmarks the word — `unknown` is never a stored status, only tracking/known/ignored persist. Person↔person: none. System↔system: the content-side client calls background `WORD_STATUS_*` handlers; background persists to IDB and broadcasts `WORD_STATUS_CHANGED/DELETED` to other tabs; a lazy purge drops expired trash rows whenever the list is read. Start: an explicit Remove inside the vocabulary tab. End: either a restore (word back to its prior status, broadcast as a normal change) or expiry (trash row deleted).

## Journey

### AS-IS

1. Learner opens the Universal Panel → Vocabulary tab. On a narrow panel the search field shrinks/collapses because it shares one flex row with the sort Select (`VocabularyTab.tsx:124-144`); the wrapping chip row pushes the list down.
2. Every row permanently shows a trash icon (`VocabularyTab.tsx:196-205`); the learner taps it by accident and must dismiss a confirmation dialog.
3. The learner marks a word `unknown` (status key `1`, popup footer, row cycle) or confirms remove — the row disappears instantly with no recovery path; only the four `STATUS_CYCLE` filters exist, all rendered as equal-weight chips.
4. On a wide panel the same uniform `padding: var(--space-3)` and edge-to-edge rows waste space and look unfinished (`VocabularyTab.module.css:1-8`).

### TO-BE

1. Learner opens the Vocabulary tab: filters read as a coherent control (tracking/known/ignored + trash), search has guaranteed space, sort and edit controls sit in their own row — at 360px nothing collapses, at 1200px the layout breathes.
2. In view mode rows show term + status + timestamp only. The learner taps Edit; delete affordances appear; they remove a word and confirm.
3. The word lands in the trash view (counted, with retention info), not void. Marking `unknown` elsewhere unmarks without trash, and `unknown` rows are never stored — only tracking/known/ignored persist.
4. Within a day the learner opens trash and restores the word to its previous status; after a day the entry is purged automatically on next read.
5. The whole surface reads like the Universal Panel and Dictionary — same components, tokens, icon language.

## Stories

- S1: As a learner, I want words I remove kept for a day so that a slip doesn't cost my vocabulary — done when a removed word appears in trash and is purged after 24h.
- S2: As a learner, I want to restore a trashed word so that an accidental de-mark is reversible — done when restore returns the word to its previous status.
- S3: As a learner on a narrow screen, I want search and controls that never collapse so that I can find words — done when controls stack responsively with no zero-width field.
- S4: As a learner, I want a clean list by default and destructive actions only on demand — done when delete appears only in edit mode.
- S5: As a learner, I want the tab to look like the rest of the panel so that the product feels coherent — done when filters/rows use shared components and tokens matching Universal Panel + Dictionary.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| `unknown` must stop being a stored row (N3c) — touches `setWordStatus`/`cycleWordStatus` paths used by all surfaces; a row-deleting regression would corrupt unmark semantics | operational/internal | medium | Decide mechanics in specify (store-level normalize vs caller-level); unit tests pin "unknown ⇒ row absent" per surface |
| Trash data model: new IDB store/index needs schema version bump + migration; per-record fields do not | internal | low | Prefer optional fields on `WordStatusEntry` (records are schemaless); bump only if an index is required |
| Lazy purge (on read) leaves expired rows until next read — storage drift | hidden/operational | low | Rows are tiny; purge on every list read keeps drift bounded; document accepted bound |
| Concurrent WIP in working tree (dictionaryPopup/tokenize/cueDifficulty) contaminates diff | operational | medium | Commit only this item's files; verify `git status` before commit |
| Redesign regressions on existing `data-cell-id` hooks used by tests/e2e | internal | low | Keep stable ids; grep consumers before renaming |

## Decision

go — direct user request, bounded to one tab + one storage concern, all primitives exist.

## Draft Acceptance Criteria

- [ ] Removing a word via the vocabulary tab retains it in the trash view for 24h, then it is permanently deleted (clock-mocked test); marking `unknown` from other surfaces does not create a trash entry.
- [ ] No `unknown` status rows are persisted — only tracking/known/ignored exist in storage.
- [ ] A trashed word can be restored to its previous status before expiry.
- [ ] Delete affordances render only in edit mode; view mode rows contain no delete control.
- [ ] Search input never shares a shrinking row with the sort control; layout verified at narrow and wide viewports.
- [ ] Status filters present tracking/known/ignored (+ trash entry point) in the Universal Panel / Dictionary visual language.
- [ ] All new strings exist in `en.json` + `vi.json`; controls expose aria labels/roles.
- [ ] `npm run typecheck && npm run test:unit && npm run build` pass; real-browser verification at two viewports.
