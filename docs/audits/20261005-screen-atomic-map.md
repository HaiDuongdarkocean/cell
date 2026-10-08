# Screen Atomic Map — Real System Surfaces

**Date:** 2026-10-05 · **Owner:** devin-ds-atomic-1791216653
**Pipeline item:** `design-system-atomic-rebuild` (stage: analyze → foundations)
**Destination:** Figma `R3z3P3ejk9D75uF4wwPnwj` — "Tihoka — Design System"
**Scope rule:** real system/product surfaces only. `mock-*` pages are NOT audited as surfaces (mount/evidence environments only). `options.html` included as audit-lite utility page.

Evidence: `tmp/penpot-atomic-ds/extraction.json` (import graph per surface), `tmp/penpot-atomic-ds/screens/` (296 showcase screenshots, light+dark), `tmp/showcase-titles.json` (123 showcase catalog entries).

---

## 1. Atomic-level taxonomy used

| Level | Definition here | Examples |
|---|---|---|
| Atom | Single-purpose primitive, no internal slots | `Button`, `Icon`, `Badge`, `Input`, `Toggle`, `Slider`, `Text`, `Heading`, `Spinner`, `Skeleton`, `StatusDot`, `Separator`, `Chip`, `Checkbox`, `Radio`, `Kbd`, `Avatar`, `Progress` |
| Molecule | Composition of atoms with one job | `SearchField`, `InputField`, `SettingsRow`, `NavItem`, `ListItem`, `SliderRow`, `FormGroup`, `HintIcon`, `CloseButton`, `CopyButton`, `Pagination`, `Timestamp`, `MenuItem`, `SelectableCard`, `SegmentedControl`, `IconButton` |
| Organism | Section-level, owns stateful region or data list | `Dialog`, `Drawer`, `BottomSheet`, `MobileSheet`, `Sheet`, `Navigation`, `Sidebar`, `Header`, `Menu`, `Tabs`/`InkTabs`, `EmptyState`, `Accordion`, `Tree`, `ConfirmDialog`, `Popover`, `Tooltip`, `SearchableSelect`, `MultiSelect` |
| Template | Screen skeleton wiring organisms | player layout, panel tab layout, settings dialog layout |
| Page | Concrete mounted surface | entries below |

> Pragmatic rule (matches repo conventions): overlay containers count as organisms even though they host molecules; layout primitives (`Box`, `Flex`, `Stack`, `Grid`, `Center`, `Surface`, `Container`, `Section`) are *structural atoms* — in Figma they become auto-layout conventions + the `Surface`/`Card` atoms, not drawn components.

## 2. Surface → component map (21 real surfaces)

### Extension pages

| Surface | Files | Dominant shared components | Notes |
|---|---|---|---|
| `popup` | 17 | Button, Icon, HStack, Card, VStack, Flex, Center, Spinner, InkTabs, Heading | Compact launcher; card + tabbed nav patterns |
| `sidepanel` | 4 | EmptyState, ErrorBoundary | Thin shell — real content is universal-panel |
| `launcher-dashboard` | 8 | Button, Icon, Input | Dashboard tiles = candidate organism (`DashTile`) |
| `local-player` | 36 | Icon, Button, Select, Card, VisuallyHidden, EmptyState | Dense transport UI; `CueCard`, `SubtitleBlock` gaps |
| `reader` | 12 | Button | Reader surface mostly custom typographic layout → atom set: Text/Heading + controls |
| `srs-study` | 67 | Box, Button, Text, Icon, Heading, ConfirmDialog, Input, Badge, Dialog, Menu (+21) | Largest surface; `ModeCard`, `PhonemeChip` gaps |
| `options-tts-verify` | 0 | — | Utility page; audit-lite (typography + Button only) |

### Overlay / panel surfaces (shadow-mounted)

| Surface | Files | Dominant shared components | Notes |
|---|---|---|---|
| `subtitle-overlay + player-mode` | 97 | Button, Icon, Input, Slider, Label, Select, Tabs, EmptyState | Highest reuse density; `CueCard`, `SubtitleBlock`, `FabCluster`, `NavCluster` gaps |
| `universal-panel` | 45 | Icon, Button, Spinner, EmptyState, MobileSheet, Card, Text, Surface | Host panel; tab content lives in feature surfaces |
| `dictionary-popup` | 63 | Icon, Button, EmptyState, Skeleton, Heading, Spinner, Tooltip, Surface, Sheet | `WordRow`, `PhonemeChip`, `ProfileRow` gaps |
| `card-creator` | 45 | Icon, Button, Select, Dialog, Heading, BottomSheet, Input, Text | Form-heavy; field molecules reused |
| `settings-dialog` | 11 | Icon, Button, Text, Dialog, SearchableSelect, Select, SegmentedControl, SettingsRow (+20) | Molecule-dense (`SettingsRow` family) |
| `study-modes` | 24 | Button, Icon, Text, Dialog, Input, FormGroup, Toggle, Heading (+16) | `ModeCard` grid gap |

### Feature panel groups

| Surface | Files | Dominant shared components | Notes |
|---|---|---|---|
| `vocabulary` | 4 | Alert, Button, Dialog, EmptyState, Icon, Pagination, Menu, SearchField | Standard list management → template exists |
| `sync + anki + jobs` | 102 | Button, Text, Icon, Spinner, Alert, Badge, Dialog, Select, StatusDot, Timestamp (+22) | Status feedback dense; `StatusPill` gap |
| `audio + ocr + tts + pronunciation` | 59 | Button, Icon, SettingsRow, Select, Toggle, HintIcon, Input, SegmentedControl (+12) | SettingsRow-heavy → molecule catalog source |
| `theme` | 11 | Card, Icon, Select | Theme picker = `ModeCard`-like organism candidate |
| `dictionary-mgmt` | 59 | Button, Icon, Dialog, Input, Chip, Spinner, Checkbox, Separator, Card, DragHandle | `WordRow`/row-list patterns |
| `session-recap` | 5 | Alert, Badge, Button, Card, Chip, EmptyState, Heading, Icon, ListItem, SectionHeader | Compact recap cards |
| `condensed-audio` | 7 | Button, ConfirmDialog, Icon, Text | Small dialog cluster |
| `whitelist + detection` | 29 | — (feature-local components) | Uses feature-local row components → flag for migration or specialized components |

## 3. Atom inventory for Figma build (Phase 3 target list)

**Control atoms:** `Button`, `IconButton`, `CloseButton`, `CopyButton`, `InfoButton`, `PinButton`, `CollapseButton`, `MinimizeButton`, `MaximizeButton`, `Link`, `Toggle`, `Checkbox`, `Radio`, `Slider`, `Input`, `Textarea`, `Select` (trigger atom), `ColorInput`, `ShortcutInput`, `Kbd`, `DragHandle`, `ResizeHandle`

**Feedback atoms:** `Badge`, `Chip`, `StatusDot`, `Spinner`, `Skeleton`, `Progress`, `Separator`, `Alert` (borderline organism — keep as atom: one-shot message block)

**Content atoms:** `Text`, `Heading`, `Label`, `Icon` (+ `ICON_CATALOG` glyphs), `Avatar`, `Thumbnail`, `FlagIcon`, `Code`, `Blockquote`, `Citation`, `Timestamp`, `VisuallyHidden` (n/a visually — document only), `AspectRatio`

**Structural atoms (drawn as conventions):** `Surface`, `Card`, `Box`, `Flex`/`HStack`/`VStack`, `Stack`, `Grid`, `Center`, `Container`, `Section`, `Portal`, `Overlay`, `Transition`, `Collapsible`

**Molecule seed list (Phase 4):** `SearchField`, `InputField`, `FormGroup`, `LabelGroup`, `SettingsRow`, `SliderRow`, `NavItem`, `ListItem`, `Pagination`, `PaginationDots`, `MenuItem`, `MenuSeparator`, `SelectableCard`, `SegmentedControl`, `Tabs`/`InkTabs` (molecule border — items are atoms), `Breadcrumb`, `RadioGroup`, `CheckboxGroup`, `SectionHeader`, `FooterBar`, `Header`, `HintIcon` (icon+tooltip), `SearchableSelect`, `MultiSelect` (border organism)

**Organism seed list (Phase 5):** `Dialog`, `ConfirmDialog`, `Drawer`, `Sheet`, `BottomSheet`, `MobileSheet`, `Popover`, `Tooltip`, `Menu`, `Navigation`, `Sidebar`, `CollapsibleSidebar`, `Accordion`, `Tree`, `EmptyState`, `ErrorBoundary` (documented only)

## 4. New component candidates (gaps found during audit)

| Candidate | Level | Evidence surfaces | Status |
|---|---|---|---|
| `CueCard` | molecule | local-player, subtitle-overlay | New — repeated subtitle cue row |
| `SubtitleBlock` | molecule | subtitle-overlay, local-player | New — grouped cues + translation line |
| `NavCluster` | molecule | subtitle-overlay, universal-panel | New — prev/next/context button group |
| `FabCluster` | molecule | subtitle-overlay, player-mode | New — floating action group |
| `ModeCard` | molecule | srs-study, study-modes, theme | New — big selectable mode tile (extends `SelectableCard`?) |
| `WordRow` | molecule | dictionary-popup, dictionary-mgmt, vocabulary | New — word + reading + actions row |
| `PhonemeChip` | molecule | dictionary-popup, srs-study | New — phoneme glyph + score chip |
| `ProfileRow` | molecule | dictionary-popup, settings | New — avatar + name + meta row |
| `StatusPill` | molecule | sync+anki+jobs | New — StatusDot + label + timestamp |
| `DashTile` | organism | launcher-dashboard | New — dashboard tile with icon+metric+action |
| `ThemeCard` | organism | theme | Possible specialization of ModeCard |

## 5. Decisions locked for Figma file structure

- Starter plan caps: **3 pages/file, 1 mode/variable-collection** → atomic levels become **sections**, not pages.
  - `01 Foundations` → sections: Color·Presets, Typography, Spacing & Sizing, Radius & Elevation
  - `02 Components` → sections: Atoms, Molecules, Organisms
  - `03 Screens` → sections: Templates, Pages, Audit Map
- Theme axes (4 presets × light/dark) become **10 variable collections** (1 mode each): `core`, `static`, `semantic/dawn-light`, `dawn-dark`, `forest-light`, `forest-dark`, `ocean-light`, `ocean-dark`, `warmth-light`, `warmth-dark`. Theme switching = scripted rebind (helper documented in file + plan).
- `component.*` tokens split: numeric → `static`; color refs → per-theme semantic collections.
- `color-mix()`/`rgba()` compounds stored literal; direct `var(--…)` refs become **VARIABLE_ALIAS** so editing primitives propagates.
- `setVariableCodeSyntax('WEB', 'var(--token-name)')` on every variable → code sync by construction.

## 6. Phase-gate status

| Phase | Status |
|---|---|
| 0 Re-baseline (Figma file + repo truth) | ✅ done — file `R3z3P3ejk9D75uF4wwPnwj`, 3 pages + sections created, 1-mode limit probed |
| 1 Screen audit + atomic map | ✅ this document + `extraction.json` + 296 screenshots |
| 2 Foundations (collections, vars, styles) | ⏭ next |
| 3 Atoms → review gate | pending |
