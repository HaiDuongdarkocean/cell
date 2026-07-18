# Popup Dictionary — Toolbar Tab Content UI Design

> Design options for Audio / Image / Translate / Links panel content.
> Each tab has **3 variants** × **3 states** (empty, no-active, active).
> Based on Cell design system: `tokens.css`, `components.css`, `popupDictionary.css`.

## Design constraints (from codebase)

- **Palette:** Slate + Blue primary. Flat, zero shadow.
- **Tokens:** `--color-surface-hover` for hover, `--color-primary-subtle` for selected/active.
- **Radius:** card `10px`, button pill `18px`, icon button `9999px`.
- **Spacing:** 4px scale, compact panels (`--space-2` = 8px).
- **Icons:** Lucide 24×24 currentColor, `ICON_CATALOG` only.
- **Accessibility:** keyboard focus ring `2px`, `aria-label` on icon buttons, real `<button>`/`<a>`.
- **Selection pattern:** Checkbox/dot gutter from `.cell-def__check`; selected state = primary ring/subtle fill.

## States defined

| State | Meaning | Visual cue |
|---|---|---|
| **Empty** | No content can be shown (no data + no user action yet produced data). | Centered EmptyState: icon, title, description, optional action. |
| **No-active** | Content exists but nothing is selected/active for the current word. | Content shown dim/unchecked; prompt to select. |
| **Active** | User has selected at least one item; item participates in Quick Add. | Selected item(s) get primary ring/subtle fill; summary/controls. |

---

## 1. Audio tab

Data model: `wordAudios: AudioItem[]`, `sentenceAudios: AudioItem[]`, each with `state: idle|loading|playing|paused|error`, `label`, `defaultSelected`.

### Variant A — Grouped list rows (enhanced current)

Rows grouped by "Word Audio" / "Sentence Audio". Each row: outlined play button, label, checkbox gutter.

| State | Content |
|---|---|
| Empty | Icon `audioWave` + "No audio available" + "Use system TTS" primary button. |
| No-active | Group labels + unchecked rows. Bottom hint: "Select 1 audio to include in your flashcard." |
| Active | Checked row(s) filled; play button switches to `pause` when `state === 'playing'`. |

**Pros:** Scannable, matches audio list mental model, compact.
**Cons:** Sentence audio may be missed below the fold.

### Variant B — Tab-segmented groups

Two mini-tabs inside the panel: [Word] [Sentence]. Only one group visible; saves vertical space.

| State | Content |
|---|---|
| Empty | Center empty state with `audioWave` icon + "No audio for '<term>'" + TTS fallback button. |
| No-active | Selected group shown as a list of rows; mini-tab has count badge. |
| Active | Selected rows highlighted; mini-tab badge shows selected count. |

**Pros:** Clean separation, saves height, clear counts.
**Cons:** Extra click to switch groups; two levels of tabs.

### Variant C — Source cards

Each audio source is a compact card (icon + source name + accent + play + check).

| State | Content |
|---|---|
| Empty | `audioWave` + "No audio sources found" + "Generate TTS" button. |
| No-active | Grid of source cards, none selected. |
| Active | Selected card gets primary ring + checkmark; playing card shows animated `audioWave` icon. |

**Pros:** Visual, great for few sources.
**Cons:** Less scannable with many sources; horizontal space limited in popup.

---

## 2. Image tab

Data model: `images: ImageItem[]`, `selection: Map<id, boolean>`, optional `searchTerm`.

### Variant A — Horizontal filmstrip (current, refined)

Single horizontal scroll row of image cards. Selected = primary ring + checkmark.

| State | Content |
|---|---|
| Empty | `image` icon + "No images" + "Search on Google Images" outline button. |
| No-active | Filmstrip of thumbnails, none selected. |
| Active | Selected card has ring + check; optional "1 image selected" text under strip. |

**Pros:** Compact, matches current layout, fast scanning.
**Cons:** Only ~3 images visible at once; no alt preview.

### Variant B — Compact 2-column grid

Grid 2 columns, scrollable. Thumbnails slightly larger than strip.

| State | Content |
|---|---|
| Empty | Empty state + search button. |
| No-active | Grid of 4+ thumbnails, none selected. |
| Active | Selected grid cells highlighted; selection count in panel header. |

**Pros:** More images visible, better use of popup width.
**Cons:** Taller panel; may push definitions further down.

### Variant C — Hero + filmstrip

Top: one larger hero image (first selected or first result). Bottom: horizontal thumbnails.

| State | Content |
|---|---|
| Empty | Empty state + search button. |
| No-active | Hero placeholder + prompt "Select an image"; thumbnails below. |
| Active | Hero shows selected image; thumbnails below with selected ring. |

**Pros:** Clear preview, feels like an image picker.
**Cons:** Requires more vertical space; overkill if only 1-2 images.

---

## 3. Translate tab

Data model: `translation: string`, `sourceSentence: string`, `targetLang: string`, `onTranslate`.

### Variant A — Single card flow (current, refined)

Button → result card + source sentence card.

| State | Content |
|---|---|
| Empty | "Translate to <lang>" outline button fills panel. |
| No-active | Translation result shown but with "Not included in flashcard" hint + "Include" toggle. |
| Active | Result card with `check` badge "Included in flashcard"; source sentence below. |

**Pros:** Simplest, minimal height.
**Cons:** Toggle inclusion may be missed.

### Variant B — Side-by-side cards

Two equal cards: source (left/top) | translation (right/bottom). Include toggle under translation.

| State | Content |
|---|---|
| Empty | "Translate" button centered. |
| No-active | Two cards shown; toggle off → translation card muted/half-opacity. |
| Active | Toggle on; translation card gets selected styling; "Included" badge. |

**Pros:** Clear source ↔ translation mapping.
**Cons:** Needs width; cramped in narrow popup.

### Variant C — Inline expandable

Translation shown inline in a read-only text block, collapsible source sentence.

| State | Content |
|---|---|
| Empty | "Translate to <lang>" button. |
| No-active | Result block + collapsed source sentence (chevron). |
| Active | Source expanded, result block highlighted as selected. |

**Pros:** Minimal chrome, content-first.
**Cons:** Less explicit action affordance.

---

## 4. Links tab

Data model: `links: ExternalDictLink[]` filled from user-configured templates.

### Variant A — Simple link list (current, refined)

Vertical list of external dictionary links as pills.

| State | Content |
|---|---|
| Empty | `link` icon + "No external dictionary links configured" + "Open settings" link. |
| No-active | List of links, all neutral. |
| Active | Last-clicked / primary link highlighted with primary subtle fill. |

**Pros:** Familiar, compact.
**Cons:** Plain; hard to scan many links.

### Variant B — Source chips

Horizontal wrap of source chips (Cambridge, Wiktionary, ...).

| State | Content |
|---|---|
| Empty | Empty state + settings link. |
| No-active | Chips wrap, none active. |
| Active | Active chip filled primary; opens in new tab on click. |

**Pros:** Space efficient, scannable.
**Cons:** Truncates long names; less obvious they are external links.

### Variant C — Categorized cards

Links grouped by category (Dictionary, Translator, Thesaurus). Each category a small card with icon + list.

| State | Content |
|---|---|
| Empty | Empty state + settings link. |
| No-active | Category cards shown, all links neutral. |
| Active | Active link inside category highlighted; category card may get subtle fill. |

**Pros:** Organized, scales to many links.
**Cons:** More vertical space; categories may be overkill if only 2-3 links.

---

## Recommendation

| Tab | Selected | Reason |
|---|---|---|
| Audio | **Variant A** | List rows grouped by Word/Sentence Audio; play button switches to pause while the Forvo item is playing. |
| Image | **Variant B** | Responsive `auto-fill` grid shows more thumbnails without horizontal scrolling. |
| Translate | **Variant A** | Single card flow keeps the panel compact. |
| Links | **Variant B** | Flex-wrap source chips with icon are scannable and fit narrow popups. |

## Implementation notes

Implemented in `popupDictionary.css`, `popupToolbar.ts`, `popupContent.ts`, `popupShell.ts`, and `popupDictionaryController.ts`:

- **Header**: added inline audio button (term pronunciation) and explicit close button; status badge title now shows the next cycle state.
- **Popup shell**: `role=dialog`, `aria-modal`, focus trap on `Tab`, focus restore on hide/destroy, pointer-drag header, viewport-clamped drag offset, `showToast()` overlay.
- **Audio panel**: `renderAudioPanel` accepts an optional `currentlyPlayingId`; play button swaps to pause and row gets `cell-audio__item--playing` while active.
- **Image panel**: `.cell-image__strip` is a CSS grid (`repeat(auto-fill, minmax(96px, 1fr))`) with `aspect-ratio: 4/3` cards.
- **Links panel**: links render as chips with `link` icon and `aria-label` indicating they open in a new tab.
- **Quick Add feedback**: `doQuickAdd` now awaits the response and shows a transient toast via `PopupShell.showToast`.
