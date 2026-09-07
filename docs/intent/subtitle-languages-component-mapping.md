# Subtitle Languages — Component Mapping (Concept C: Tag field)

Chosen direction: **C — tag field** (`selectedSubtitleLanguages` whitelist for `selectBestMedia`).

| Element | Decision | Notes |
|---|---|---|
| Picker control | **Redesign** `src/shared/ui/MultiSelect.tsx` | Single call site (`SettingsDialogContent`); tag-field internals, same props contract |
| Chip field wrap | **Redesign** `.container`/`.field` in `MultiSelect.module.css` | Single focus ring on the wrap; input has no own ring |
| Chip + remove × | **Create** `.chip` / `.chipRemove` inside MultiSelect | `Badge` is display-only → small internal element; × = shared `Icon name="x"` |
| Exclusive 'all' chip | **Extend** via `exclusiveValues` prop | `'all'` is a mode, not a sibling item — filled chip + clear-on-add semantics |
| Suggestion list | **Redesign** `.suggestions` | In-flow (section card grows — same convention as Select/SearchableSelect menus) |
| Popular quick-picks | **Extend** via `popularValues` prop | Shown only when selection is empty; `['en','vi','ja','ko','zh','es','fr','de']` at call site |
| Strings | `t()` keys | `ui.multiSelect.{popular,removeChip,addAria,searchPlaceholder}` + `common.noResults` |

## Behavior contract
- Click suggestion → add chip (input clears, focus stays).
- Enter → add first suggestion; Backspace on empty query → remove last chip; Escape → blur.
- Exclusive value on → replaces everything; specific add while exclusive set → drops it.
- Reduced-motion: transitions/animations removed under `prefers-reduced-motion`.

## Verification
- `tests/unit/features/settings/ui/MultiSelect.test.tsx` — 18 tests, all passing.
- Live: mockup "Real panel" now renders the shipped tag field; exclusive add verified
  (`['all'] + 'vi'` → `['vi']`).
