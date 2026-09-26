# Spec: Dictionary link tabs manager (CRUD external dict links)

> Intent: `docs/intent/dict-links-manager.md` · ui_surface: yes · Mode: interactive

## Objective

`settings.dictionaryPopup.externalDictLinks` is a shipped-but-dead field (schema v14): the popup renders link pills from `DEFAULT_DICTIONARY_POPUP_SETTINGS` (`useDictionaryToolbar.ts:431`) and no UI edits the list. The system must let users manage that list — add, rename, delete, drag-reorder — from Settings → Dictionary Popup, and the popup must render the stored list in stored order.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| User (learner) | Opens Settings → Dictionary Popup; add / rename / delete / drag actions | link name, URL template, drag position | link list state, inline validation errors, popup pills |
| Chrome storage | — | — | persisted `settings.dictionaryPopup.externalDictLinks` |

System-internal: validation, id generation, persistence, profile sync, popup link fill. Human behavior never appears inside a system step.

## Requirements

### Functional

REQ-1: View link list
- Actor: user
- Goal: see current external dictionary links in display order
- Preconditions: Settings → Dictionary Popup section visible
- Basic flow:
  1. actor opens Settings → Dictionary Popup
  2. system reads `settings.dictionaryPopup.externalDictLinks` (merged with `DEFAULT_DICTIONARY_POPUP_SETTINGS` fallback)
  3. system renders one row per link: drag handle, name, URL preview, rename, delete
- Alt flow: list empty → system renders an empty state (no rows) — add control still available
- Exception: stored list missing/undefined → system falls back to defaults
- Rules: display order = array order; `langCodes` is not shown or editable
- Postcondition: none (read-only view)
- NFR refs: NFR-1, NFR-5

REQ-2: Add link
- Actor: user
- Goal: append a new link to the list
- Preconditions: manager visible
- Basic flow:
  1. actor activates Add → system shows the add form (name + URL template inputs) with the placeholder hint line
  2. actor submits name + URL template
  3. system validates (Rules), generates `id` (guarded: `typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : <counter+timestamp fallback>` — mediaScan.ts:147 pattern; settings UI can run in content-script context), sets `langCodes: []`, appends to the array
  4. system persists via the existing `onChange` → `saveSettings` path (REQ-7)
- Alt flow: actor cancels → system discards the form, no mutation
- Exception: invalid input → system blocks submit and shows inline error; nothing persisted. Double-submit prevented (submit control disabled while a mutation is in flight)
- Rules: name trimmed, non-empty, ≤64 chars; template trimmed, ≤2048 chars, must contain `{term}`; probe validation — substitute `{term}`→`'x'`, `{lang}`→`'en'`, result must `new URL()`-parse with `http:`/`https:` scheme; `{lang}` optional; duplicate names/templates are allowed (user's responsibility)
- Postcondition: list contains the new link at the end
- NFR refs: NFR-1, NFR-2, NFR-3, NFR-5

REQ-3: Edit link (name + URL template)
- Actor: user
- Goal: change a link's display name and/or URL template
- Preconditions: ≥1 link in list
- Basic flow:
  1. actor activates edit (pencil) on a row → system opens the link editor dialog prefilled with name + `urlTemplate` + the placeholder hint line
  2. actor edits either/both fields → commits (Save / Enter)
  3. system validates with the same rules as REQ-2 (name trimmed non-empty ≤64; template trimmed ≤2048, contains `{term}`, http(s) probe) → writes both fields, leaves `id`/`langCodes`/position untouched, persists
- Alt flow 1 (quick rename): actor clicks the row name → name editable inline (`ResourceCard` precedent); Enter/blur commits a non-empty trimmed name, Esc cancels; `urlTemplate` untouched
- Alt flow 2: actor cancels the dialog (Cancel / Esc / close) → no mutation
- Exception: invalid input → system blocks submit and shows inline error in the dialog; nothing persisted
- Postcondition: stored entry updated in place
- NFR refs: NFR-1, NFR-2, NFR-3

REQ-4: Delete link
- Actor: user
- Goal: remove a link
- Preconditions: ≥1 link in list
- Basic flow:
  1. actor activates delete on a row
  2. system asks confirmation — compose shared `Dialog` (`src/shared/ui/Dialog`) locally (resource-specific `DeleteConfirmModal` stays feature-local); nested inside SettingsDialog → escape/focus layering follows the `pushEscapeLayer` precedent
  3. actor confirms → system removes the entry and persists
- Alt flow: actor cancels (cancel button / Esc / close) → list unchanged
- Exception: deleting the last link → list becomes `[]`, popup shows `dict.links.empty` state
- Rules: delete is permanent within the session; re-add manually to restore
- Postcondition: entry removed from stored array
- NFR refs: NFR-1, NFR-2, NFR-5

REQ-5: Reorder links (drag)
- Actor: user
- Goal: change display order
- Preconditions: ≥2 links in list
- Basic flow:
  1. actor presses the row's drag handle and moves it (pointer drag)
  2. system live-previews the target position while dragging
  3. actor releases → system commits the new array order via `reorderItems` and persists
- Alt flow: keyboard — focused drag handle + arrow keys move the row −1/+1 and persist (ResourceCard precedent)
- Exception: drop outside list / Esc during drag → cancel, order unchanged
- Rules: order persisted = popup pill order; no reorder affordance with <2 items. Implementation: promote `useSectionDrag` (`src/features/dictionary/ui/useSectionDrag.ts`) to `src/shared/lib/` as a generic list-drag hook — generalize `draggedId` `number`→`string` (link ids are uuid strings) and the `slot-*` selector prefix to an option (default preserved); `ResourcesPanel`/`ResourceCard` imports updated. Promote `reorderItems` (cardCreator-local) to `src/shared/lib/` — cross-feature deep imports fail the `check-deep-imports` ratchet otherwise.
- Postcondition: array reordered, persisted
- NFR refs: NFR-1, NFR-2, NFR-4, NFR-5

REQ-6: Popup renders stored links
- Actor: user (implicit — opening the dictionary popup)
- Goal: pills reflect the user's list
- Preconditions: lookup result exists
- Basic flow:
  1. system loads settings on popup mount (`useCandidate` already calls `loadSettings()` — extend that read with `externalDictLinks`)
  2. system passes the stored templates into `useDictionaryToolbar` via a new option (replaces `DEFAULT_DICTIONARY_POPUP_SETTINGS.externalDictLinks` at `useDictionaryToolbar.ts:431`); the `links` useMemo gains the option in its deps
  3. system fills `{term}`/`{lang}` per link, filters by `langCodes`, renders pills in stored order
- Alt flow: settings load fails → fall back to `DEFAULT_DICTIONARY_POPUP_SETTINGS.externalDictLinks` (current behavior)
- Exception: stored list `[]` → `dict.links.empty` empty state
- Rules: `fillExternalDictLinks` gains a render-time whitelist — after substitution, entries whose result fails `new URL()` parse or whose scheme isn't `http:`/`https:` are dropped (stored entries predate input validation; `LinksPanel` renders `href` verbatim). Fill logic otherwise unchanged (`encodeURIComponent(term)`). Pills render shipped defaults until `loadSettings` resolves, and stay stale while the popup remains open — accepted (ephemeral surface).
- Postcondition: pills match settings
- NFR refs: NFR-2, NFR-3, NFR-5

REQ-7: Settings save must not resurrect stale profile slices
- Actor: none (system-internal integrity rule; surfaced via REQ-2..5)
- Goal: `dictionaryPopup` edits persist through every host
- Preconditions: an active language profile carrying `dictionaryPopup` exists (post-v23 near-universal)
- Basic flow:
  1. `saveSettings` merges caller patch over current (existing)
  2. system runs `syncFlatFieldsToActiveProfile(toStore)` BEFORE `resolveSettingsFlatFields(toStore)` (`settingsStore.ts:667-675`) — single-point fix; repairs `SettingsTab` (already syncs — becomes redundant-but-harmless), the action-popup dialog path (`App.redesigned.tsx:269` → `UPDATE_SETTINGS` → `handlers/settings.ts:42`), and any future host
  3. stored settings keep the caller's `dictionaryPopup` edit
- Alt flow: no active profile → sync is a no-op (`profileResolution.ts:129` early return)
- Exception: none beyond existing storage errors
- Rules: profile remains SSOT for flat fields; sync direction on save is top-level → profile
- Postcondition: top-level and active-profile `dictionaryPopup` are identical
- NFR refs: NFR-2, NFR-6

REQ-8: Surface tabs in Dictionary Popup settings
- Actor: user
- Goal: settings for each popup surface sit under a tab that mirrors the popup's own toolbar (`DictionaryToolbar`: audio / image / translate / external dictionary)
- Preconditions: Settings → Dictionary Popup section visible
- Basic flow:
  1. system renders a `role="tablist"` strip styled after `DictionaryToolbar` (icon + label pills): Audio, Image, Translate, External dictionary
  2. actor selects a tab → system shows that surface's settings
  3. selecting External dictionary reveals the link manager (REQ-1..5); Translate reveals `translationVisibility`; Audio/Image show a hint pointing at the owning settings card (Audio section / none yet)
- Alt flow: none — tab selection is local UI state, not persisted
- Rules: general settings (trigger mode, default tab, example-selection) stay above the strip — they are popup-global, not per-surface; tab icons/labels reuse `dict.tab.*` keys + `ICON_CATALOG` ids from `DictionaryToolbar`
- Postcondition: active tab remembered for the panel's session only
- NFR refs: NFR-1, NFR-5

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | All new strings via i18n `MessageKey` in `src/shared/i18n/messages/{en,vi}.json`; no `t()` at module scope | U | learning `i18n-t-call-module-scope-freezes-locale` |
| NFR-2 | Persist via `onChange` → `saveSettings`; read-modify-write, no sibling-field clobber; REQ-7 fix included | R | learning `partial-save-read-modify-write` |
| NFR-3 | Reject invalid template inline; never persist a link without `{term}`; render-time http(s) whitelist on stored entries | R +security | user input is a trust boundary |
| NFR-4 | Drag: pointer events + `touch-action:none` on handle; keyboard reorder fallback | U | learning `ux-touch-action-none-for-pointer-drag`; persona 5–80 |
| NFR-5 | Interactive controls on this surface: 40px — pin `width`/`height`/`min-width`/`min-height` to `var(--iconbutton-size-md)` locally (double-class specificity precedent `DictionaryToolbar.module.css:28-31`) so shared `--touch-target` mins can't reach 44px on mobile; existing 32px popup tabs unchanged. Tokens cited from `tokens.json` (tokens.css is generated) | U | user decision; `tokens.json` space.11=44px / touch-target-mobile=44px / iconbutton-size-md=40px |
| NFR-6 | Per-profile semantics: list lives inside `dictionaryPopup` slice → follows active language profile via flat-field sync; no per-link language UI | S | `profileResolution.ts:87` |

## Flows / States

Add-form state machine (local component state):

```
closed --add→ editing(draft) --submit+valid→ closed (persist)
editing --submit+invalid→ editing (inline error)
editing --cancel/Esc→ closed
```

Drag session:

```
idle --pointerdown on handle→ dragging --pointermove→ dragging (preview index)
dragging --pointerup→ idle (commit order, persist)
dragging --Esc/pointercancel→ idle (no mutation)
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Store & expose the editable link list | `externalDictLinks` slice (exists), `saveSettings` profile-sync fix (REQ-7) |
| Present links for lookup | Pills row (exists, `LinksPanel`), `fillExternalDictLinks` + scheme whitelist, settings→toolbar wiring (new option) |
| Manage list entries | Link-manager subsection in `DictionaryPopupSettingsPanel` (new): row list, add form, inline rename, delete confirm dialog, shared list-drag + `reorderItems` |
| Teach placeholders | Hint line under the add form (new i18n string) |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `ExternalDictLinkTemplate` | `id`, `name`, `urlTemplate`, `langCodes` | `settings.dictionaryPopup.externalDictLinks` → `chrome.storage` via settingsStore; synced into active language profile (`syncFlatFieldsToActiveProfile`) | until user deletes |
| `ExternalDictLink` (resolved) | `id`, `name`, `url` | derived at render (`fillExternalDictLinks`) | per popup mount |

## Alternatives Considered

- **dnd-kit / react-dnd dependency**: rejected — no dnd dep in package.json; `useSectionDrag` already implements pointer drag + edge scroll + settle animation in-repo.
- **In-popup editing** (manage links from the popup itself): rejected — user decision places management in Settings only.
- **Per-link `langCodes` UI**: rejected — language scoping follows the language profile (user decision); field stays for fill-time filtering.
- **Promote `DeleteConfirmModal` to shared**: rejected — its copy is resource-specific; composing shared `Dialog` locally is smaller.
- **Sync per-host instead of in `saveSettings`**: rejected — leaves future hosts broken; single-point fix covers all callers.

## Traceability

| Need (intent ID) | REQ | AC |
|---|---|---|
| N1 manage list | REQ-1..5, REQ-8 | SC-1..5 |
| N2 popup uses stored list | REQ-6 | SC-6 |
| N3 placeholder hint | REQ-2 | SC-2 |
| N4 40px not 44px | NFR-5 | SC-7 |
| N5 template validation | REQ-2, REQ-6 | SC-2, SC-6 |
| N6 persist read-modify-write | REQ-2..5, REQ-7, NFR-2 | SC-5, SC-9 |
| N7 i18n | NFR-1 | SC-8 |

| Journey step | REQ |
|---|---|
| AS-IS 4 (dead field) | REQ-6 |
| TO-BE 1 (list visible) | REQ-1 |
| TO-BE 2 (add + hint + validation) | REQ-2 |
| TO-BE 3 (rename/delete/reorder) | REQ-3, REQ-4, REQ-5 |
| TO-BE 4 (popup reflects) | REQ-6 |
| TO-BE 5 (empty state) | REQ-4 exception, REQ-6 |

## Boundaries

- Always: tokens via `tokens.json`; components from `src/shared/ui`; icons from `ICON_CATALOG`; i18n keys for every visible string; run `npm run typecheck && npm run test:unit && npm run build` before commit.
- Ask first: new dependency; `manifest.json` change.
- Never: edit `tokens.css`/`tokens.ts` (generated); touch the other agent's dirty files (`LanguageProfilePanel*`, `ProfileMenu*`, `SearchableSelect*`); leave 44px (`--touch-target` mobile) on this surface.

## Success Criteria

- [ ] SC-1: Settings → Dictionary Popup shows a surface tab strip mirroring the popup toolbar (audio/image/translate/external dictionary); the External dictionary tab lists each stored link (name + URL) in stored order with add/edit/delete/drag controls; fresh install shows the 3 shipped defaults.
- [ ] SC-2: Add form shows the `{term}`/`{lang}` hint; submit rejected with inline error when name is blank, template lacks `{term}`, or probe-substituted URL is not http(s) — nothing persisted on rejection; submit disabled while a mutation is in flight.
- [ ] SC-3: Edit dialog commits a validated name+URL change preserving `id`/`langCodes`/position; inline rename commits a non-empty name (Enter/blur = commit, Esc = cancel).
- [ ] SC-4: Delete requires confirmation and removes the entry; deleting the last link leaves `externalDictLinks: []`.
- [ ] SC-5: Drag (pointer + touch) and keyboard reorder persist new order; all mutations persist across reload without clobbering sibling `dictionaryPopup` fields.
- [ ] SC-6: Dictionary popup pills render from the stored list in stored order, honoring `langCodes`; stored non-http(s)/malformed entries are dropped at render; empty list → `dict.links.empty`; settings-load failure → defaults.
- [ ] SC-7: Interactive controls in the manager measure 40px (`--iconbutton-size-md` incl. `min-*`) on desktop AND mobile; no 44px target on this surface; popup toolbar tabs remain 32px.
- [ ] SC-8: en + vi messages exist for every new string; no hardcoded user-visible text.
- [ ] SC-9: Edits made via the action-popup settings dialog (not only the in-page SettingsTab) persist — `saveSettings` syncs flat fields to the active profile before resolving; regression covered by a unit test on `saveSettings` + profile stub.
- [ ] SC-10: Link list follows the active language profile — edits under profile A are absent under profile B and intact when switching back.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] UI passes design-system check (tokens, shared components, no hardcoded px)
- [ ] Browser verify: settings CRUD + popup pills on real Chrome
- [ ] `docs/2-architechture-system.md` updated for changed `src/` surface

## Open Questions / Accepted Risks

- URL edits happen in the same editor dialog as rename (user direction: "nhấn vào edit là edit cả name và link"); `id`/position/`langCodes` untouched.
- `langCodes` preserved on edit but never shown; new links default to `[]` (all languages).
- Pills show shipped defaults until `loadSettings` resolves; stale while popup stays open — accepted (ephemeral surface).
