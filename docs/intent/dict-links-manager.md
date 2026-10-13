# Intent: Dictionary link tabs manager (CRUD external dict links)

> Slug: `dict-links-manager` · Mode: interactive · Source: user statement (2026-09-26, screenshot of popup link pills)
> ui_surface: yes
> confidence: medium

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | The dictionary lookup popup shows a fixed set of 3 external-dictionary shortcut pills; users who look up other languages or prefer other dictionaries cannot change which shortcuts appear | `config.ts:262-266` hardcoded defaults; user request | high |
| Change | `externalDictLinks` becomes a user-managed list (add / rename / delete / reorder) edited in Settings, and the popup actually renders from stored settings instead of defaults | `types.ts:241` field exists; `useDictionaryToolbar.ts:431` reads DEFAULT not user settings; `DictionaryPopupSettingsPanel.tsx` has no link UI | high |
| Solution | A link-list manager inside the existing Settings → Dictionary Popup section + wiring stored `externalDictLinks` into the popup toolbar | direction only | medium |
| Value | Users adapt the popup to their language/dictionary of choice (e.g. Jisho for ja, WordReference) without a release; removes a dead settings field | user request; schema shipped but unwired since v14 | medium |
| Stakeholder | Language learners using the dictionary popup on video sites (5–80 tuổi persona) | AGENTS.md persona | high |
| Context | MV3 extension; popup renders in shadow DOM; settings persist via `settingsStore` + profile sync (`profileResolution.ts:128-148`); i18n via MessageKey | codebase | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Tihoka maintainers | Small diff: schema field + defaults already exist; work = settings UI + one wiring line | Component/token system available; precedent for list management exists (custom cleanup rules) |
| Customer | Popup users on desktop/tablet/android | Add their dictionary, remove ones they never use, order by preference | Must be discoverable without reading docs → placeholder hint required by user |
| Supplier/Dependency | External dictionary sites | URL templates with `{term}`/`{lang}` placeholders | none — links open via `target=_blank`, no API contract |
| Organization | Future contributors | SSOT: one source for templates, order = display order | `mergeDictionaryPopupWithDefaults` already merges the field per profile |
| Regulator | Chrome Web Store policy | User-entered URLs must stay `noopener noreferrer` outbound links; no remote-code risk (plain anchors) | none — already compliant pattern in `LinksPanel.tsx:25-27` |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Manage the external dictionary link list from Settings → Dictionary Popup: add link (name + URL template), rename, delete, reorder | F | user request; `DictionaryPopupSettingsPanel.tsx` lacks it | high |
| N2 | Popup pills reflect the stored user list — order and labels — not the hardcoded defaults | F | `useDictionaryToolbar.ts:429-434` reads `DEFAULT_DICTIONARY_POPUP_SETTINGS` | high |
| N3 | A visible hint teaches the `{term}`/`{lang}` placeholders so users can write a working template without external docs | U | user request ("dòng hướng dẫn thêm placeholder"); `types.ts:115` documents placeholders | high |
| N4 | Buttons in the dictionary-popup surface that resolve to the 44px mobile touch-target are pinned to 40px (`--iconbutton-size-md`); existing 32px popup tabs stay 32px — the 44px size is removed from this surface | U | user decision (2026-09-26): "32px thì giữ nguyên, nút nào 44px đưa về 40px"; `tokens.css:162-163` touch-target 44px mobile / 40px desktop; `tokens.css:710` | high |
| N5 | Reject/flag templates missing `{term}` at input time — a link that can't substitute the word is a dead pill | R | `useDictionaryToolbar.ts:106-113` fill logic | medium [assumption: user wants validation, not silent dead links] |
| N6 | All list operations persist immediately through the existing settings save path (partial save = read-modify-write, no loss of sibling fields) | R | learning `partial-save-read-modify-write`; `update()` merge pattern `DictionaryPopupSettingsPanel.tsx:111-119` | high |
| N7 | All new user-visible strings route through i18n MessageKey (vi + en) | U | AGENTS.md i18n mandate; learning `i18n-entity-messagekey-fields` | high |

## Scope

- **In:** CRUD UI (add / rename / delete / **drag** reorder — user decision) for `externalDictLinks` inside Settings → Dictionary Popup; placeholder hint line; popup reads stored list (with langCodes filtering preserved); input validation (name non-empty, template contains `{term}`, http/https); 40px controls, no 44px on this surface.
- **Out:** Changing how pills render in the popup (existing `LinksPanel`); changing the 32px toolbar tabs; new placeholder variables beyond `{term}`/`{lang}`.
- **Non-goals:** Per-link `langCodes` editing — user decision: language scoping belongs to the **language profile**; `dictionaryPopup` is already a profile-resolved flat field (`profileResolution.ts:87`), so links follow the active profile automatically. `langCodes` stays untouched on rename; new links get `[]`. No import/export.

## Workflow

Narrative: a user studying Japanese looks up a word; the popup offers Cambridge/Wiktionary/Google Translate — none ideal for ja. They open Settings → Dictionary Popup, see the link list with the three defaults, tap add, type a name and a URL containing `{term}` (the hint line tells them placeholders exist), save; back on the video the next lookup shows their new pill in the position they chose. Person↔device only; system↔system is just `chrome.storage` sync already covered by the settings store.

## Journey

### AS-IS

1. User looks up a word; popup renders pills built from `DEFAULT_DICTIONARY_POPUP_SETTINGS.externalDictLinks` — always Cambridge, Wiktionary, Google Translate.
2. User wants Jisho/WordReference instead; opens Settings → Dictionary Popup.
3. Section shows only trigger mode / default tab / translations / examples — no link management anywhere.
4. Even hand-editing stored `settings.dictionaryPopup.externalDictLinks` changes nothing — the toolbar reads the constant, not the stored value (`useDictionaryToolbar.ts:431`).
5. User is stuck with the 3 shipped pills forever.

### TO-BE

1. User opens Settings → Dictionary Popup; the section lists current links in display order.
2. User adds a link: name + URL template; a hint line explains `{term}` and `{lang}`; invalid input (empty name, template without `{term}`, non-http(s)) is rejected inline.
3. User renames, deletes, or reorders entries; each change persists via the existing settings save path.
4. Next lookup renders pills from the stored list — same order, same names, `langCodes` filtering still applied.
5. User can delete all links → popup shows the existing empty state (`dict.links.empty`), and can re-add defaults manually.

## Stories

- S1: As a learner, I want to add a dictionary URL so that my preferred dictionary is one tap away — done when the new pill appears in the popup after saving.
- S2: As a learner, I want to rename a link so that the pill label is meaningful to me — done when the popup shows the new name.
- S3: As a learner, I want to delete links I never use so that the pill row stays short — done when the pill no longer appears.
- S4: As a learner, I want to drag links into my preferred order so that my most-used dictionary sits first — done when popup pill order matches settings order (reorder = drag, per user decision; touch + pointer, `touch-action:none` on the drag path per learning `ux-touch-action-none-for-pointer-drag`).
- S5: As a learner, I want the add-form to tell me about `{term}`/`{lang}` so that I can write a correct template without docs — done when a visible hint line exists and templates without `{term}` are rejected.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Malformed template saved → dead/confusing pill in popup | operational | medium — user-facing broken link | Validate `{term}` presence + http(s) scheme at input (N5); cheap |
| Concurrent edit in settings dir: `LanguageProfilePanel.tsx`, `ProfileMenu.tsx`, `SearchableSelect.*` dirty (other agent in flight) | internal | low — different files, same folder | Touch only `DictionaryPopupSettingsPanel*` + new sibling files |
| Drag reorder on touch screens fights the browser's scroll gesture | human | low — known pattern | `touch-action:none` on handle + pointer events (learning `ux-touch-action-none-for-pointer-drag`) |
| Deleting all links → empty pill row | human | low | Existing `EmptyState` already covers `links=[]` |
| User removes defaults then wants them back | human | low | They can re-add manually; name/template of defaults are public knowledge |

## Decision

go — schema field + defaults + render path already exist; the missing piece is a small settings UI and a one-line wiring fix; scope is bounded, risk low.

## Draft Acceptance Criteria

- [ ] Settings → Dictionary Popup shows the link list with add / rename / delete / **drag-reorder** controls; interactive controls 40px (`--iconbutton-size-md`), no 44px touch-target on this surface; 32px popup tabs unchanged.
- [ ] Add form has a visible `{term}`/`{lang}` placeholder hint; rejects empty name, template without `{term}`, and non-http(s) URLs.
- [ ] Popup pills render from `settings.dictionaryPopup.externalDictLinks` in stored order, honoring `langCodes` filtering; list follows the active language profile.
- [ ] Changes persist across reload; no sibling settings fields clobbered (read-modify-write).
- [ ] Empty list → existing `dict.links.empty` empty state; defaults remain the shipped initial value.
- [ ] All strings via MessageKey (en + vi).
