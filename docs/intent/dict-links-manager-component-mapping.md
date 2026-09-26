# Component mapping — dict-links-manager

Chosen concept: **A — Resource rows** (user-picked), extended with the popup-mirroring
surface tab strip (user direction). Maps the brief onto shared primitives; all changes
scope to `DictionaryPopupSettingsPanel.tsx` + `.module.css` and one promoted hook
(`useSectionDrag` → `src/shared/lib/`, string-id generalization per spec REQ-5).

## Shared components (reuse as-is)

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Surface tab strip | `Button` | reuse — pill strip with `role="tablist"`/`role="tab"`; mirrors `DictionaryToolbar` look but keeps icon + label visible | `component.iconbutton.size-sm`, `radius-full`, `core.light.primary`, `component.button.primary-dimmed-opacity`, `core.light.textSecondary`, `derived.light.color-surface-hover` | `audioWave`, `image`, `languages`, `link` (same ids as `DictionaryToolbar`) |
| Link row | `Card` | reuse — card padding `spacing-2`/`spacing-3`, `radius-lg` (ResourceCard recipe) | `core.light.surface`, `derived.light.color-border-subtle`, `radius-lg` | — |
| Row drag grip | `DragHandle` | reuse — `size="sm"` `orientation="vertical"`; local class pins `width/height/min-*` to `component.iconbutton.size-md` (40px floor, kills `touchTarget-mobile` 44px on mobile per NFR-5) | `component.iconbutton.size-md`, `spacing-1` negative margin | grip dots (built-in) |
| Drag mechanics | promoted `useSectionDrag` → `src/shared/lib/` | extend — `draggedId` `number`→`string`, slot-selector prefix as option; `ResourcesPanel` updated to import shared copy | — | — |
| Reorder helper | promoted `reorderItems` → `src/shared/lib/` | reuse — cardCreator-local today; cross-feature import fails deep-import ratchet | — | — |
| Inline rename input | `Input` | reuse — `size="sm"` `variant="ghost"`, autoFocus, Enter/blur commit, Esc cancel | `derived.light.color-border-focus` | — |
| Name button | native `button` | reuse pattern — unstyled button per `ResourceCard.nameButton` (reset + focus ring) | `radius-sm`, `derived.light.color-border-focus`, `weights-medium` | — |
| Edit affordance | `Button` | reuse — `variant="ghost"`, local class pins 40px (`width/height/min-width/min-height`) | `component.iconbutton.size-md`, `core.light.textSecondary` | `pencil` |
| Delete affordance | `Button` | reuse — `variant="ghost"`, 40px pin, destructive hover | `component.iconbutton.size-md`, `derived.light.color-destructive` | `trash` |
| Add link button | `Button` | reuse — `variant="outline"` `size="sm"` in subsection header | `core.light.primary`, `core.light.border` | `plus` |
| Editor dialog (add + edit) | `Dialog` | reuse — title Add dictionary link / Edit link, footer Cancel + `variant="primary"` Save | `derived.light.color-destructive` (inline error text) | — |
| Delete confirm dialog | `Dialog` | reuse — title `Delete {name}?`, footer Keep (`outline`) + Delete (`destructive`); nested under SettingsDialog via `pushEscapeLayer` precedent | — | — |
| Name/URL text fields in dialog | `Input` | reuse — `size="sm"`, URL `dir="ltr"`; label spans styled sm-medium | `font-sizes-sm`, `weights-medium` | — |
| Placeholder hint | `Text` | reuse — `as="p"` `color="secondary"` under URL field | `font-sizes-xs`, `core.light.textSecondary`, `derived.light.color-surface-hover` (`code` chip), `radius-xs` | — |
| Subsection heading + hint | `Heading` + `Text` | reuse — `Heading level={2} size={3}` title + `Text` xs hint (ResourcesPanel recipe) | `font-sizes-base`, `weights-semibold` | — |
| Empty state | `Text` | reuse — centered sm secondary | `core.light.textSecondary`, `spacing-4` | — |
| Empty-tab hint (audio/image) | `Text` | reuse — same as empty state | `core.light.textSecondary` | — |
| Translate-tab pills | existing panel-local pill group | reuse — `translationVisibility` group moves under the Translate tab unchanged | `component.iconbutton.size-sm`, `radius-full`, `core.light.primary` | — |

## CSS tokens consumed

| Use | Token |
|---|---|
| Row/card skin | `core.light.surface`, `derived.light.color-border-subtle`, `radius-lg` |
| Drag lift | `shadow-lg`, `duration-fast`, `ease-standard`, rotate −0.6deg (`cardDragging` recipe) |
| Drop target | `core.light.primary` inset top line |
| Controls 40px | `component.iconbutton.size-md` on `width`/`height`/`min-*` (double-class specificity per `DictionaryToolbar.module.css` precedent) |
| Grip behavior | `touch-action: none`, `cursor: grab/grabbing` |
| Surface tabs | `component.iconbutton.size-sm`, `radius-full`, `component.iconbutton.icon-sm`, `component.button.primary-dimmed-opacity` |
| Spacing rhythm | `spacing-0-5` … `spacing-4` (card gap `spacing-2`, field gap `spacing-1`, body gap `spacing-3`) |
| Focus | `derived.light.color-border-focus` outline on name button / dialog inputs |
| Text | `font-sizes-base`/`font-sizes-xs`/`font-sizes-sm`, `weights-medium`/`weights-semibold`, `derived.light.color-text-primary`, `core.light.textSecondary`, `derived.light.color-destructive` |

## New i18n keys (all under `settings.dictionaryPopup.*` unless noted)

`links.title`, `links.desc`, `links.add`, `links.empty`, `links.edit`, `links.delete`,
`links.deleteTitle`, `links.deleteBody`, `links.keep`, `links.nameLabel`, `links.urlLabel`,
`links.hint` (the `{term}`/`{lang}` explainer), `links.error.invalid`,
`links.editor.addTitle`, `links.editor.editTitle`, `links.rename`, `links.drag`,
`links.tabs.aria` + `links.tabEmpty.audio` / `links.tabEmpty.image`; tab labels reuse
`dict.tab.audio` / `dict.tab.image` / `dict.tab.translate` / `dict.tab.links`.

## Trace

| Element | REQ | Journey step |
|---|---|---|
| Surface tab strip | REQ-8 | TO-BE 1 |
| Row list + empty state | REQ-1 | TO-BE 1 |
| Add button + editor dialog + hint + error | REQ-2 | TO-BE 2 |
| Pencil → editor dialog; name → inline rename | REQ-3 | TO-BE 3 |
| Trash → confirm dialog | REQ-4 | TO-BE 3 |
| Grip + keyboard reorder | REQ-5 | TO-BE 3 |
| (popup pills — no new UI, wiring only) | REQ-6 | TO-BE 4 |
| Translate tab pills / audio+image hints | REQ-8 | TO-BE 1 |
