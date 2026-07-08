# Components — Cell Extension

> DSDS-style: metadata + variants + states + a11y + usage guide.

## Component files

| File | Content | Status |
|---|---|---|
| [popup-react.md](popup-react.md) | Popup React components (`src/shared/ui/` + `src/features/settings/ui/`) — IconButton, MultiSelect, SettingsDialog, SubtitlePreview, SubtitleStylePanel, NavClusterSettingsPanel + usage guide | stable |
| [popup-media.md](popup-media.md) | Popup layout/media components (`src/entrypoints/popup/components/`) — Header, SelectionBar, VideoCard, SubtitleCard, DownloadCard, MediaEmpty + usage guide | stable |
| [content-script-factories.md](content-script-factories.md) | Content-script DOM factories (`src/features/subtitle/ui/`) — 9 factories returning HTMLElement + usage guide | stable |
| [controllers.md](controllers.md) | Content-script controllers — ContentScriptController, NavClusterController (lifecycle) | stable |

---

## Composition rules (atomic design mapping)

> Cell does NOT use strict atomic design nomenclature, but composition follows the same hierarchy. Map for clarity:

| Atomic level | Cell equivalent | Examples |
|---|---|---|
| **Atoms** (HTML elements + tokens) | Raw `<button>`, `<input>`, `<div>` + tokens from `theme.css` | `<button style="background: var(--color-primary)">` |
| **Molecules** (small functional groups) | `IconButton`, `MultiSelect`, `SubtitlePreview` | label + input + button = MultiSelect |
| **Organisms** (distinct UI sections) | `Header`, `SelectionBar`, `VideoCard`, `SubtitleStylePanel`, `NavClusterSettingsPanel` | Header = logo + title + actions |
| **Templates** (page-level layout) | `SettingsDialog` body layout, popup `App` layout | SettingsDialog composes organisms |
| **Pages** (real content instances) | Popup main, Options page, Sidepanel | App renders Header + SelectionBar + media cards |

**Rules**:
- Atoms → use tokens, never raw hex ([../guidelines/development.md](../guidelines/development.md) "must")
- Molecules → compose atoms, expose typed props + JSDoc
- Organisms → compose molecules + atoms, own their state slice
- Templates → place organisms, do NOT add new props (composition over configuration — [../guidelines/development.md](../guidelines/development.md))
- Pages → fill templates with real content, no layout decisions here
