# Vocabulary Tab Redesign — Component Mapping

> Chosen concept: **A — Chapter tabs** (picked autonomously in `all` loop, conservative option — see design brief § Chosen concept).
> Source mockup: `src/entrypoints/mockup-vocabulary-tab-redesign/ConceptA.tsx`
> Target: replace `src/features/vocabulary/ui/VocabularyTab.tsx` + `VocabularyTab.module.css`.

---

## Chosen interaction

- One segmented rail on top: `All · Tracking · Known · Ignored · Trash` — every segment shows its count; Trash carries `icon: trash2`.
- Search gets a dedicated full-width row (P0 audit fix — no shared row).
- Sub-row: sort `Select` left, `Edit`/`Done` ghost `Button` right (hidden while in Trash).
- List rows: term button (opens Dictionary lookup) + status `Chip` (tap cycles status) + `Timestamp` + edit-mode remove `IconButton`.
- Trash view rows: term + previous-status chip (read-only) + countdown text + `Restore` + delete-forever `IconButton`.
- Two confirm `Dialog`s: remove-confirm (mentions 24h) and purge-confirm (destructive).
- View/Edit split — destructive affordances only exist while `editMode` is on.

---

## Element → component mapping

| # | UI element | Existing component | File | Decision | Tokens | Icon |
|---|---|---|---|---|---|---|
| 1 | Segment rail (All/Tracking/Known/Ignored/Trash + counts) | `InkTabs` | `src/shared/ui/InkTabs.tsx` | **Extend** | `--color-primary-subtle`, `--radius-pill`, `--color-border-subtle` | — |
| 2 | Count inside each segment | `Badge` | `src/shared/ui/Badge.tsx` | **Reuse** | `--color-text-muted`, `--font-size-sm` | — |
| 3 | Trash segment glyph | `Icon` | `src/shared/icons/Icon.tsx` | **Reuse** | inherits segment color | `icon: trash2` |
| 4 | Search row | `SearchField` | `src/shared/ui/SearchField.tsx` | **Reuse** | `--color-field`, `--radius-md` | `icon: search` (built-in) |
| 5 | Sort control | `Select` | `src/shared/ui/Select.tsx` | **Reuse** | `--color-field`, `--radius-md` | — |
| 6 | Edit / Done toggle | `Button` | `src/shared/ui/Button.tsx` | **Reuse** | `variant="ghost"` | — |
| 7 | Word row | `ListItem` | `src/shared/ui/ListItem.tsx` | **Reuse** | `--color-border-subtle` divider, `--spacing-3` | — |
| 8 | Term (lookup trigger) | `Button` | `src/shared/ui/Button.tsx` | **Reuse** | `variant="ghost"`, `--color-text-primary` | — |
| 9 | Status pill (tap cycles) | `Chip` | `src/shared/ui/Chip.tsx` | **Reuse** | `--color-token-status-unknown` / `--color-token-status-tracking` / `--color-token-status-known` / `--color-token-status-ignore` | — |
| 10 | Row timestamp | `Timestamp` | `src/shared/ui/Timestamp.tsx` | **Reuse** | `--color-text-muted`, `--font-size-sm` | — |
| 11 | Edit-mode remove affordance | `IconButton` | `src/shared/ui/IconButton.tsx` | **Reuse** | `--color-destructive` on hover | `icon: trash` |
| 12 | Trash countdown text ("17h left") | `Text` | `src/shared/ui/Text.tsx` | **Reuse** | `--color-text-muted`, `--font-size-sm` | — |
| 13 | Restore action | `Button` | `src/shared/ui/Button.tsx` | **Reuse** | `variant="ghost"` | `icon: rotateCcw` |
| 14 | Delete-forever affordance | `IconButton` | `src/shared/ui/IconButton.tsx` | **Reuse** | `--color-destructive`, `--color-error-subtle` hover | `icon: x` |
| 15 | Remove-confirm dialog | `Dialog` | `src/shared/ui/Dialog.tsx` | **Reuse** | `--color-surface-popover`, `--color-overlay`, `--radius-md` | — |
| 16 | Purge-confirm dialog (destructive action) | `Dialog` + `Button` | `src/shared/ui/Dialog.tsx` | **Reuse** | `--color-destructive`, `--color-destructive-foreground` | — |
| 17 | List / filter / trash empty states | `EmptyState` | `src/shared/ui/EmptyState.tsx` | **Reuse** | `size="compact"`, `--color-text-muted` | — |
| 18 | Vertical layout stack | `Stack` / `Box` | `src/shared/ui/Stack.tsx` | **Reuse** | `--spacing-2` gaps | — |
| 19 | List scroll area | `Box` | `src/shared/ui/Box.tsx` | **Reuse** | scroll styling via `Scrollable.module.css` class | — |
| 20 | Tab container rewrite | `Stack` | `src/shared/ui/Stack.tsx` | **Redesign** | `--color-surface-card`; target file `src/features/vocabulary/ui/VocabularyTab.tsx` | — |

**Extend note (row 1):** `InkTabs` items currently carry `label` only — extend the item model with an optional `count`/`badge` slot rendering the `Badge` from row 2. If extension fights the component's ink-indicator geometry, fall back to a `Chip`-row rail (`role="tablist"`) — decision deferred to implementation, both options stay inside `src/shared/ui`.

**Create decisions:** none — every element maps onto the shipped component system. The only new code is feature-level composition (`VocabularyTab` rewrite) and the `InkTabs` item-model extension.

---

## State → UI notes

- `editMode` boolean lives in the tab component (not persisted — destructive affordances should not survive a reload).
- Trash entries: `{term, previousStatus, trashedAt}` — countdown derives `24h − (now − trashedAt)`, purged lazily on read (REQ-12, no UI beyond the countdown text).
- Status cycle on the row `Chip` reuses the existing `WORD_STATUS_CYCLE` message — no new channel.
- Confirm dialogs replace always-visible delete — `pendingDelete`/`pendingPurge` hold the term being confirmed, mirroring the mockup `state.tsx` contract.

## Trace

| REQ | Elements |
|---|---|
| REQ filter/search/sort | 1, 4, 5 |
| REQ lookup | 8 |
| REQ cycle status | 9 |
| REQ-6 edit mode | 6, 11 |
| REQ-7 remove→trash | 11, 15 |
| REQ-9/10/11 trash view/restore/purge | 12, 13, 14, 16 |
| REQ-12 expiry | 12 |
