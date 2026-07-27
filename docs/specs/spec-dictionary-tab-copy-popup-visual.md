# Spec: Dictionary Tab — Copy Floating Popup Visual Exactly

## 1. Objective & Scope

Make the **integrated Dictionary tab** inside `UniversalPanel` (left pane) visually identical to the **floating dictionary popup** used by the subtitle/web-text dictionary, while preserving all existing UniversalPanel behavior:

- No drag, resize, pin, or shadow DOM shell.
- No backdrop/dismiss gestures.
- The panel is still mounted by `UniversalPanel`/`DictionaryTab` and the right pane is still `CardCreatorPanel`.
- The search input must remain functional.

The work is concentrated in two files:

- `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx`
- `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css`

with small, additive changes to `src/features/dictionaryPopup/ui/useDictionaryPanel.ts` for definition selection and `Quick Add` wiring.

The source of truth for the visual design is the popup's vanilla-DOM implementation:

- `src/features/dictionaryPopup/ui/popupContent.ts`
- `src/features/dictionaryPopup/ui/popupToolbar.ts`
- `src/features/dictionaryPopup/ui/popupDictionary.css`
- `src/features/dictionaryPopup/ui/popupShell.ts` (only for the outer scroll container markup, not the floating shell)
- `src/shared/styles/components.css` (shared `.btn`/`.icon-btn` atoms)
- `src/shared/styles/tokens.css` (generated from `tokens.json`)

## 2. Source of Truth vs Target file mapping

| Visual area | Source of truth (popup) | Target (integrated panel) |
|---|---|---|
| Outer scroll container / layout | `popupShell.ts` lines 519–564, `popupDictionary.css` `.cell-popup` (lines 12–48) and `.cell-popup__content` (lines 115–125) | `DictionaryPanelView.tsx` root, `DictionaryPanelView.module.css` `.dictionaryPanel` |
| Header (2-row, word, reading, audio, actions, status, frequency) | `popupContent.ts` `renderHeader` (lines 38–189), `popupDictionary.css` `.cell-header` (lines 159–420) | `DictionaryPanelView.tsx` header block (current lines 191–218), `.header`/`.term`/`.reading`/`.headerBadges`/`.frequency` |
| Candidates | `popupContent.ts` `renderCandidateChips` (lines 306–334), `popupDictionary.css` `.cell-candidates` / `.cell-chip` (lines 1185–1265) | `DictionaryPanelView.tsx` candidates block (current lines 220–234), `.candidates` |
| Definitions (checkboxes, POS, examples) | `popupContent.ts` `renderDefinitions` (lines 191–265), `popupDictionary.css` `.cell-def` (lines 422–547) | `DictionaryPanelView.tsx` `DefinitionItem` (current lines 307–323), `.definitions`/`.definition` |
| Toolbar (Audio/Image/Translate/Links) | `popupToolbar.ts` `renderToolbar` (lines 57–96), `popupDictionary.css` `.cell-toolbar` (lines 549–589) | `DictionaryPanelView.tsx` `Tabs` usage (current lines 250–279), `.tabs`/`.tabList`/`.tabTrigger` |
| Audio panel | `popupToolbar.ts` `renderAudioPanel` (lines 98–282), `popupDictionary.css` `.cell-audio` (lines 591–742) | `DictionaryPanelView.tsx` `AudioPanel` (current lines 325–345), `.tabPanel`/`.tabContent` |
| Image panel | `popupToolbar.ts` `renderImagePanel` (lines 284–392), `popupDictionary.css` `.cell-image` (lines 784–957) | `DictionaryPanelView.tsx` `ImagePanel` (current lines 348–368) |
| Translate panel | `popupToolbar.ts` `renderTranslatePanel` (lines 394–537), `popupDictionary.css` `.cell-translate` (lines 959–1083) | `DictionaryPanelView.tsx` `TranslatePanel` (current lines 371–406) |
| Links panel | `popupToolbar.ts` `renderLinksPanel` (lines 539–588), `popupDictionary.css` `.cell-links` (lines 1083–1147) | `DictionaryPanelView.tsx` `LinksPanel` (current lines 409–432) |
| State (definition selection, Quick Add, prefill) | `popupContent.ts` `initDefinitionSelection`/`getSelectedDefinitions` (lines 336–351), `popupDictionaryController.ts` `buildPopupPrefill` (lines 555–596), `toggleDefinition` (lines 734–743) | `useDictionaryPanel.ts` `buildPrefill` (lines 82–102), `sendToCard` (lines 220–224) |

## 3. Visual inventory by section

### 3.1 Header (2-row layout, word, IPA/reading, audio buttons, actions, status pill, frequency badge)

The popup header is rendered by `renderHeader` in `popupContent.ts` (lines 38–189) and styled by `popupDictionary.css` `.cell-header` (lines 159–420). It must be reproduced exactly in the integrated panel.

#### 3.1.1 Row 1: word + reading + audio, actions on the right

- Container: `.cell-header__row` — `display: flex; align-items: start; justify-content: space-between; gap: var(--space-1);` (base), `gap: var(--space-2)` at ≥480px (`popupDictionary.css` lines 173–178, 1498–1500).
- Main group: `.cell-header__main` — `display: flex; align-items: center; flex-wrap: wrap; gap: 0; min-width: 0; flex: 1 1 auto;` (lines 184–191).
  - Word row: `.cell-header__word-row` — `display: flex; align-items: center; box-sizing: border-box; min-width: 0;` (lines 193–199).
    - `.cell-header__word` — `font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: calc(var(--touch-target-mobile) * 0.6);` (lines 201–208). At ≥768px it switches to `line-height: calc(var(--touch-target-desktop) * 0.6)` (lines 1679–1682).
  - Reading row: `.cell-header__reading` — `display: flex; align-items: center; gap: var(--space-1); flex-shrink: 0; flex-basis: 100%; min-width: 0; height: calc(var(--touch-target-mobile) * 0.4); line-height: calc(var(--touch-target-mobile) * 0.4); overflow: visible;` (lines 222–233). At ≥768px `height`/`line-height` switch to `calc(var(--touch-target-desktop) * 0.4)` (lines 1686–1689).
    - `.cell-header__ipa` — `font-size: var(--font-size-xs); color: var(--color-text-muted); white-space: nowrap; flex-shrink: 0; line-height: calc(var(--touch-target-mobile) * 0.4);` (lines 210–216). Same 768px switch (lines 1683–1684). Reading text must be wrapped in `/.../` when `readingKind === 'ipa'` and the string is not already slashed — this logic exists in `popupContent.ts` lines 78–82 and in `DictionaryPanelView.tsx` `formatReading` lines 40–46.
    - `.cell-header__audio-group` — `display: flex; align-items: center; gap: var(--space-0-5); flex-shrink: 0;` (lines 236–241).
    - `.cell-header__audio` — `.icon-btn.icon-btn--xs` plus custom sizing: `width/height/min-width/min-height: calc(var(--touch-target-mobile) * 0.4); padding: 0; gap: var(--space-0-5);` (lines 243–250). The SVG inside is `width/height: calc(var(--touch-target-mobile) * 0.25)` (lines 252–255). At ≥768px the SVG size switches to `calc(var(--touch-target-desktop) * 0.25)` (lines 1707–1710). The two audio buttons use `ICON_CATALOG.audioWave.svg` (word audio) and `ICON_CATALOG.messageSquare.svg` (sentence audio), with `aria-label` "Play word audio" / "Play sentence audio" (`popupContent.ts` lines 92–122).
- Actions group: `.cell-header__actions` — `display: flex; align-items: center; gap: var(--space-1); flex-shrink: 0;` (lines 281–286), placed **after** the main group in the same row.
  - Send to Card: `.icon-btn.icon-btn--sm.icon-btn--outlined.cell-header__send` with `ICON_CATALOG.pencil.svg` (`popupContent.ts` lines 135–141). `aria-label`/`title` "Send to Card Creator".
  - Quick Add: `.icon-btn.icon-btn--sm.icon-btn--filled.cell-header__quick-add` with `ICON_CATALOG.zap.svg` (`popupContent.ts` lines 143–149). `aria-label`/`title` "Quick Add to Anki".

#### 3.1.2 Row 2: status pill + split frequency badge

- Container: `.cell-header__second` — `display: flex; align-items: center; gap: var(--space-1); overflow-x: auto; scrollbar-width: none;` (lines 262–271). It scrolls horizontally when the badges overflow.
- Status pill: `.cell-header__status` — `display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; min-width: 6em; height: var(--space-5); padding: 0 var(--space-2); border-radius: var(--radius-full); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); line-height: var(--leading-none); white-space: nowrap; cursor: pointer; border: var(--border-width-hairline) solid transparent;` (`popupDictionary.css` lines 300–321). It is a `<button>`, not a `.btn`, so it is exempt from the 44px `.btn` minimum-height override.
  - Modifiers (`popupDictionary.css` lines 328–346):
    - `.cell-header__status--unknown` → `background: var(--color-error-subtle); color: var(--color-error);`
    - `.cell-header__status--tracking` → `background: var(--color-warning-subtle); color: var(--color-warning);`
    - `.cell-header__status--known` → `background: var(--color-success-subtle); color: var(--color-success);`
    - `.cell-header__status--ignore` → `background: var(--color-surface-hover); color: var(--color-text-muted);`
  - At <480px the status pill grows to `height: var(--space-6); padding: 0 var(--space-2-5);` (`popupDictionary.css` lines 1637–1641).
  - On click it cycles to the next `WordStatus` using `nextStatus()` (`popupContent.ts` lines 161–165; `useDictionaryPanel.ts` already has `cycleStatus`).
- Frequency badge: `.cell-header__frequency` — `display: inline-flex; align-items: center; box-sizing: border-box; height: var(--space-5); border-radius: var(--radius-full); overflow: hidden; font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); line-height: var(--leading-none);` (`popupDictionary.css` lines 348–358). It is a split pill:
  - `.cell-header__frequency-source` — left half, `padding: var(--space-1) var(--space-2-5); background: var(--color-primary); color: var(--color-text-inverse);` (lines 360–364, default). Per band it uses the band's background/foreground tokens.
  - `.cell-header__frequency-rank` — right half, `padding: var(--space-1) var(--space-2-5); background: var(--color-primary-subtle); color: var(--color-primary);` (lines 366–370). Per band it uses `color-mix(in srgb, <band-fg> 12%, transparent)` for background and the band foreground for text.
  - Band modifiers (lines 372–420): `.cell-header__frequency--core`, `.cell-header__frequency--common`, `.cell-header__frequency--general`, `.cell-header__frequency--advanced`, `.cell-header__frequency--rare`. Each sets `background`/`color` on source and rank spans using `var(--color-token-freq-*-bg)` / `var(--color-token-freq-*-fg)`.
  - The band is computed from `rankToBand(result.frequency.rank)` (already used in `DictionaryPanelView.tsx` line 136).

### 3.2 Candidates

The popup candidate selector is `renderCandidateChips` in `popupContent.ts` (lines 306–334), styled at `popupDictionary.css` `.cell-candidates` / `.cell-chip` (lines 1185–1265).

- Container: `.cell-candidates` — final normal-flow block; no overlay or sticky positioning. Integrated copy uses transparent background so candidate references do not compete with definitions.
- Chips wrapper: `.cell-candidates__chips` — `display: flex; align-items: center; gap: var(--space-1); padding: 0 var(--space-2);`; at ≥480px use the popup spacing tiers. Add bottom padding at least equal to one rendered chip height.
- Scroll strip: `.cell-candidates__chips-scroll` — `flex: 1 1 auto; display: flex; gap: var(--space-2); overflow-x: auto; scrollbar-width: none; min-width: 0;`; hide webkit scrollbar (`::-webkit-scrollbar { display: none; }`).
- Chip: render only candidate name, with transparent background, no filled active/inactive treatment, `flex-shrink: 0`, ellipsis for overflow, and the popup's pill geometry. Active chip gets `aria-current="true"`, `color: var(--color-primary)`, and a 2px underline. Clicking a chip calls `panel.setActiveCandidate(idx)`.
- The integrated panel currently renders candidates in a wrapping flex of `Button` components (`DictionaryPanelView.tsx` lines 220–234, `.candidates` lines 132–136). Replace it with one horizontal final strip.

### 3.3 Definitions (checkboxes, POS, examples)

The popup definitions are rendered by `renderDefinitions` in `popupContent.ts` (lines 191–265) and styled at `popupDictionary.css` `.cell-def` (lines 422–547).

- Panel: `.cell-def` — `padding: 0 var(--space-2); flex: 1; min-height: 0; overflow-y: auto;` (lines 423–428). At ≥480px `padding: 0 var(--space-3);` (line 1514). Empty state `.cell-def__empty` — muted italic, padding `var(--space-1) 0`; at ≥480px `padding: var(--space-3) 0` (lines 430–434, 1565–1567).
- Item: `.cell-def__item` — `position: relative; border-radius: var(--radius-card); transition: background-color var(--duration-fast) var(--ease-in-out);` (lines 436–444). Hover: `background: var(--color-surface-hover);` (line 442–444).
- Checkbox gutter: `.cell-def__check` — `position: absolute; top: 0; left: 0; bottom: 0; width: var(--iconbutton-size-xs); cursor: pointer; display: flex; align-items: center; justify-content: center;` (lines 446–457). It is a `<label>` wrapping the hidden checkbox.
  - `.cell-def__check-dot` — `width: var(--space-1-5); height: var(--space-1-5); border-radius: var(--radius-full); background: var(--color-border);` (lines 459–466). Visible by default.
  - `.cell-def__check-box` — `width: var(--space-4); height: var(--space-4); border-radius: var(--radius-sm); border: var(--space-0-5) solid var(--color-primary); background: transparent; display: none;` (lines 468–478). Hidden by default.
  - `.cell-def__check-tick` — contains `ICON_CATALOG.check.svg`, hidden by default (lines 480–489).
  - `.cell-def__check-input` — native checkbox, `position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none;` (lines 521–527). `focus-visible + .cell-def__check-box` gets `outline: var(--space-0-5) solid var(--color-primary); outline-offset: var(--space-0-5);` (lines 529–532).
  - Hover unchecked: dot hides, empty checkbox border appears (lines 492–500).
  - Checked: `.cell-def__check--checked` on the label; box becomes `background: var(--color-primary); border-color: var(--color-primary);`, tick shows in `var(--color-text-inverse)` (lines 503–519).
- Text block: `.cell-def__text` — `padding: var(--space-1) 0 var(--space-1) var(--space-7);` (lines 534–536). At ≥480px: `padding: var(--space-2) 0 var(--space-2) calc(var(--space-7) + var(--space-1-5));` (lines 1517–1519).
  - The text is a **single** `<span>` containing `{pos} {text}` when `pos` exists (`popupContent.ts` line 244). There is **no separate POS badge**.
  - `.cell-def__pos` (italic muted) exists in CSS (lines 538–541) but is not used by the current popup renderer; it is a legacy hook. Do not render a separate POS badge if copying the popup exactly.
- Examples: `.cell-def__examples` — `margin-top: var(--space-0-5); font-size: var(--font-size-xs); color: var(--color-text-muted);` (lines 543–547). At ≥480px `margin-top: var(--space-1);` (lines 1520–1521). Each example is a `<div>` with a `• ` prefix (`popupContent.ts` line 254).

The integrated panel currently uses a `Badge` for POS and no checkbox. It must be replaced with the popup's dot/checkbox gutter and combined POS+text line.

### 3.4 Toolbar/Tabs

The popup toolbar is `renderToolbar` in `popupToolbar.ts` (lines 57–96) and styled at `popupDictionary.css` `.cell-toolbar` (lines 549–589).

- Container: `.cell-toolbar` — `display: flex; gap: var(--space-0-5); padding: 0 var(--space-2); align-items: center;` (lines 550–555). At ≥480px: `gap: var(--space-1); padding: 0 var(--space-3);` (lines 1510–1513).
- Tab button: `.cell-toolbar__tab` extends `.btn` + `.btn--primary` if active or `.btn--ghost` if inactive. It has `position: relative; flex-shrink: 0; border-radius: var(--radius-full);` (lines 561–565).
- Inner markup: icon SVG + `<span class="cell-toolbar__label cell-label">{label}</span>` (`popupToolbar.ts` lines 75). The `.cell-label` class is hidden by default (`display: none; font-size: var(--font-size-xs);` at `popupDictionary.css` lines 51–54) and shown at ≥480px (`display: inline;` at line 1483). This makes the toolbar a row of icon-only circles on narrow widths and pill-shaped icon+text buttons on wider widths.
- At <480px the global `.btn:has(.cell-label)` rule turns any `.btn` with a `.cell-label` child into a circle: `border-radius: var(--radius-full); padding: 0; width: var(--touch-target-mobile); height: var(--touch-target-mobile); gap: 0;` (`popupDictionary.css` lines 1610–1616).
- Badge: `.cell-toolbar__badge` — `position: absolute; top: calc(-1 * var(--space-0-5)); right: calc(-1 * var(--space-0-5)); min-width: var(--space-3); aspect-ratio: 1; padding: 0 var(--space-0-5); border-radius: var(--radius-full); background: var(--color-primary); color: var(--color-text-inverse); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); box-shadow: var(--shadow-focus-bg); z-index: var(--z-dropdown);` (lines 571–589). It appears when `selectionCounts[tab] > 0` (`popupToolbar.ts` lines 83–89).
- ARIA: each tab is a `<button>` with `aria-label={label}`, `aria-pressed={active}`, and `title={label}` (`popupToolbar.ts` lines 71–73). Clicking the active tab closes it (`activeTab === tab ? null : tab`), clicking an inactive tab opens it.

The integrated panel currently uses `src/shared/ui/Tabs` with `tabList`/`tabTrigger`. This must be replaced with the popup's custom icon-toggle toolbar.

### 3.5 Tab content panels (Audio, Image, Translate, Links)

The popup tab panels are rendered by `popupToolbar.ts`:

- `renderAudioPanel` (lines 98–282)
- `renderImagePanel` (lines 284–392)
- `renderTranslatePanel` (lines 394–537)
- `renderLinksPanel` (lines 539–588)

and styled in `popupDictionary.css`:

- `.cell-audio` (lines 591–742, responsive lines 1522–1537)
- `.cell-image` (lines 784–957, responsive lines 1543–1549)
- `.cell-translate` (lines 959–1083, responsive lines 1550–1564)
- `.cell-links` (lines 1083–1147, responsive lines 1568–1579)

The visual contract for each panel must be copied. The data-fetching behavior can reuse the same message types the popup controller uses (`FETCH_COMMUNITY_AUDIO`, `FETCH_IMAGES`, `TRANSLATE`, `TTS_FETCH_AUDIO`), but the skeletons, empty states, and selection affordances must match.

#### Audio

- `.cell-audio` — `padding: 0 var(--space-2); flex: 1 1 auto; overflow-y: auto; min-height: calc(...);` (lines 591–599). At ≥480px `padding: 0 var(--space-3);` (line 1524).
- Sub-tabs: `.cell-audio__subtabs` — `display: flex; gap: var(--space-2); padding: var(--space-0-5) 0 var(--space-1);` (lines 601–605). At ≥480px `gap: var(--space-3); padding: var(--space-1) 0 var(--space-2);` (lines 1530–1533).
- Sub-tab: `.cell-audio__subtab` — uppercase, letter-spacing `var(--tracking-wide)`, color muted, bottom border `space-0-5` transparent; active border primary, color text (lines 607–631).
- Item: `.cell-audio__item` — `display: flex; align-items: center; gap: var(--space-1-5); padding: var(--space-1) var(--space-2); border-radius: var(--radius-card);` (lines 633–639). At ≥480px `gap: var(--space-2-5); padding: var(--space-2) var(--space-2-5);` (lines 1526–1529). Hover `background: var(--color-surface-hover);` (line 644–646). Playing state `.cell-audio__item--playing` → `background: var(--color-primary-subtle);` (line 648–650). Sentence variant `.cell-audio__item--sentence .icon-btn svg` → `color: var(--color-primary);` (line 653–655).
- Play button: `.icon-btn.icon-btn--sm.icon-btn--outlined` with hover scale and color change (lines 660–676).
- Label: `.cell-audio__label` — flex column, clickable, `flex: 1; font-size: var(--font-size-xs);` (lines 679–689). At ≥480px `font-size: var(--font-size-xs);` (line 1594) and at ≥768px `font-size: var(--font-size-base);` (line 1719). Name `.cell-audio__label-name` and meta `.cell-audio__label-meta` (lines 691–705).
- Checkbox: `.cell-audio__check` — `width/height: var(--space-4); border-radius: var(--radius-sm); border: var(--space-0-5) solid var(--color-primary);` hidden unless checked; checked `background: var(--color-primary);` with white tick (lines 708–742).
- Empty: `.cell-audio__empty` — icon, title "No audio available", button "Use system TTS" (lines 744–754). At ≥480px padding grows (lines 1534–1537).
- Skeleton: `.cell-audio__skeleton` — two subtab placeholders + one row with play circle, two label lines, checkbox square (lines 1308–1353).

#### Image

- `.cell-image` — `padding: 0; display: flex; flex-direction: column; flex: 1 1 auto; min-height: calc(var(--space-1) * 2 + var(--space-20));` (lines 788–794).
- Strip: `.cell-image__strip` — horizontal scroll, `scroll-snap-type: x mandatory`, custom DS scrollbar, `gap: var(--space-1); padding: var(--space-1);` (lines 799–825).
- Card: `.cell-image__card` — `flex: 0 0 auto; width: calc((100% - var(--space-1) * 7) / 8); min-width: var(--popup-image-card-min-width-compact); aspect-ratio: 1 / 1;` at base (lines 830–837); at ≥480px `min-width: var(--popup-image-card-min-width-default);` (line 1544). Hover scale 1.03, active scale 0.92, selected primary-subtle border primary (lines 851–869).
- Thumb: `.cell-image__thumb` — `object-fit: cover; border-radius: var(--radius-none);` (lines 873–879).
- Check: `.cell-image__check` — absolute top-right, primary circle with white check (lines 881–902). At ≥480px grows to `width/height: var(--space-5)` with `top/right: var(--space-1);` (lines 1596–1601).
- Empty: `.cell-image__empty` — one-line "No images · Search Google →" with a link (lines 904–947).
- Skeleton: `.cell-image__skeleton` + `.cell-image__strip` with 8 rounded placeholders (lines 1355–1369).

#### Translate

- `.cell-translate` — `padding: 0 var(--space-2); flex: 1 1 auto; min-height: calc(...); overflow-y: auto;` (lines 960–967). At ≥480px `padding: var(--space-2) var(--space-3);` (line 1551).
- Block: `.cell-translate__block` — `display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-1); padding: var(--space-1) var(--space-2); border-radius: var(--radius-card); border: var(--border-width-hairline) solid var(--color-border); background: var(--color-surface); cursor: pointer;` (lines 970–982). At ≥480px `padding: var(--space-2) var(--space-3); gap: var(--space-2);` (lines 1553–1555). Selected: `background: var(--color-primary-subtle); border-color: var(--color-primary);` (lines 988–991).
- Text: `.cell-translate__text` flex column gap `var(--space-0-5)`.
  - `.cell-translate__target` — `font-size: var(--font-size-xs); color: var(--color-text-muted);` (lines 1005–1008). At ≥768px stays `font-size: var(--font-size-xs);` (line 1724).
  - `.cell-translate__native` — `font-size: var(--font-size-base); font-weight: var(--font-weight-medium); color: var(--color-text);` (lines 1010–1014). At ≥768px stays `font-size: var(--font-size-base);` (line 1721–1723).
- Checkbox: `.cell-translate__check` — same 16px pattern, hidden unless checked (lines 1017–1051).
- Empty: icon, title "No translation", button `Translate to {targetLang}` (lines 1053–1083). At ≥480px padding grows (lines 1557–1560).
- Skeleton: `.cell-translate__skeleton-block` + text lines + checkbox (lines 1371–1411).

#### Links

- `.cell-links` — `display: flex; flex-wrap: wrap; gap: var(--space-1); padding: var(--space-1) var(--space-2); min-height: 0; overflow-y: auto;` (lines 1083–1091). At ≥480px `gap: var(--space-1-5); padding: var(--space-2) var(--space-3);` (lines 1568–1571).
- Link item: `.cell-links__item` — `display: inline-flex; align-items: center; gap: var(--space-1); padding: var(--space-1) var(--space-2); border: var(--border-width-hairline) solid var(--color-border); border-radius: var(--radius-pill); background: var(--color-surface); color: var(--color-text); text-decoration: none; font-size: var(--font-size-xs);` (lines 1123–1135). At ≥768px `font-size: var(--font-size-base);` (line 1727–1729). Hover: `background: var(--color-surface-hover); border-color: var(--color-border-focus);` (lines 1137–1140). SVG size `var(--space-3-5)`.
- Empty: icon, title "No external links", button "Open settings" (lines 1093–1122). At ≥480px padding grows (lines 1572–1579).

### 3.6 Footer (remove or move to header)

The popup has **no footer**. Its two primary actions (`Send to Card` and `Quick Add`) live in the **header actions group** (`.cell-header__actions`, `popupContent.ts` lines 130–149). The integrated panel currently has a `.footer` block (`DictionaryPanelView.tsx` lines 282–300, `DictionaryPanelView.module.css` lines 271–278) containing only `Send to Card`.

- Delete the `.footer` JSX block and `.footer` CSS.
- Move `Send to Card` and add `Quick Add` to `.cell-header__actions` in Row 1 of the header.
- If `Quick Add` wiring is not ready, the button can be `disabled` with a tooltip; the icon (`zap`) and placement must still be present.

## 4. Component/structural changes

### 4.1 `DictionaryPanelView.tsx`

Reorganize the render output so it matches the popup's DOM order and class names:

1. **Search row** — keep one `SearchField` only; remove the adjacent Search `Button`, suppress the native search clear affordance so exactly one clear X remains, and trigger lookup after 350ms idle. Enter remains immediate lookup.
2. **Loading / error / empty states** — keep, but style them compactly (spinner/empty-state inside the panel, not a giant card).
3. **Active entry** (`.cell-active-entry` equivalent):
   - `.cell-header` (2 rows, actions included).
   - `.cell-materials` (toolbar slot + optional tab panel body).
   - `.cell-def` (definitions with checkboxes).
4. **Candidate chips** (`.cell-candidates`) rendered **after** the active entry, not before the definitions.

Recommended helpers (names are suggestions; keep them co-located in the same file unless they become reusable):

- `Header` — term, reading/IPA, audio buttons, actions, status, frequency.
- `DefinitionList` / `DefinitionItem` — checkbox gutter + text + examples.
- `CandidateChips` — horizontal scroll strip.
- `Toolbar` — four icon toggle buttons with badges.
- `AudioPanel`, `ImagePanel`, `TranslatePanel`, `LinksPanel` — restyled to match popup panels.

Use plain `<button>` elements with the global `.btn`/`.icon-btn` classes (or `Button`/`IconButton` from `src/shared/ui` if they can produce the exact same computed styles). Because the popup's toolbar and chips rely on `:has(.cell-label)` and custom sizes that assume direct children, the simplest exact implementation is to import or compose from `src/shared/styles/components.css` and apply the raw `.btn`/`.icon-btn` modifier classes.

### 4.2 `DictionaryPanelView.module.css`

- Remove the current card-heavy classes: `.header`, `.headerMain`, `.term`, `.reading`, `.headerBadges`, `.frequency`, `.candidates`, `.definitions`, `.definition`, `.definitionText`, `.definitionPos`, `.definitionBody`, `.examples`, `.tabs`, `.tabList`, `.tabTrigger`, `.tabContent`, `.tabPanel`, `.footer`.
- Replace them with the popup's BEM class names ported into the module: `.cell-header`, `.cell-header__row`, `.cell-header__main`, `.cell-header__word-row`, `.cell-header__word`, `.cell-header__reading`, `.cell-header__ipa`, `.cell-header__audio-group`, `.cell-header__audio`, `.cell-header__actions`, `.cell-header__second`, `.cell-header__status`, `.cell-header__frequency`, `.cell-candidates`, `.cell-chip`, `.cell-def`, `.cell-def__item`, `.cell-def__check`, `.cell-toolbar`, `.cell-toolbar__tab`, `.cell-toolbar__badge`, `.cell-audio`, `.cell-image`, `.cell-translate`, `.cell-links`, `.cell-materials`, `.cell-active-entry`.
- Keep `.dictionaryPanel`, `.searchRow`, `.loading`, `.error` for panel-specific chrome, but remove the global padding from `.dictionaryPanel` so the popup-style children control their own padding and the `container-type` queries behave identically.

### 4.3 `useDictionaryPanel.ts`

Add the missing selection state and action wiring without replacing the hook:

- `definitionSelection: Map<string, boolean>`.
- `toggleDefinition(id, selected)`.
- `selectedDefinitions` derived from `definitionSelection` (or `getSelectedDefinitions(result, selection)` exported from `popupContent.ts` if it can be imported in a React hook).
- Reset `definitionSelection` when `currentResult` changes or `setActiveCandidate` is called, initializing each `def.id` to `def.defaultSelected`.
- Change `buildPrefill` to use `selectedDefinitions` (fallback to all definitions if none selected), matching `popupDictionaryController.ts` `buildPopupPrefill` lines 560–565.
- Add `quickAdd` (or expose `onQuickAdd` callback) so the header `Quick Add` icon can fire the same prefill path.
- Update the hook return type to expose `definitionSelection`/`toggleDefinition`/`selectedDefinitions`/`quickAdd` to `DictionaryPanelView`.

## 5. CSS/styling changes (token for token, class mapping)

The following table maps the popup's BEM classes to the target module classes and the key token declarations that must be copied. Line numbers refer to `src/features/dictionaryPopup/ui/popupDictionary.css` unless stated otherwise.

### 5.1 Shell / scroll container

| Popup class | Target module class | Key declarations / tokens |
|---|---|---|
| `.cell-popup` (outer floating shell) | **not used** in integrated panel | The panel is not floating; do not copy fixed positioning, resize handle, shadow, or sheet handle. |
| `.cell-popup__content` | `.dictionaryPanel` | `flex: 1; min-height: 0; display: flex; flex-direction: column; gap: var(--space-1); overflow-y: auto;` (lines 115–123). |
| `.cell-popup` `container-type: inline-size` | `.dictionaryPanel` `container-type: inline-size` | Add `container-type: inline-size` to `.dictionaryPanel` (line 26). Remove horizontal padding from `.dictionaryPanel`; apply per-section padding to children. |

### 5.2 Header

| Popup class | Target module class | Key declarations / tokens |
|---|---|---|
| `.cell-header` | `.cell-header` | `padding: var(--space-2) var(--space-2) 0; display: flex; flex-direction: column; gap: var(--space-0-5);` (lines 161–169). At ≥480px: `padding: var(--space-3) var(--space-3) 0; gap: var(--space-1);` (lines 1488–1491). |
| `.cell-header__row` | `.cell-header__row` | `display: flex; align-items: start; justify-content: space-between; gap: var(--space-1);` (lines 173–178). At ≥480px `gap: var(--space-2);` (lines 1498–1500). |
| `.cell-header__main` | `.cell-header__main` | `display: flex; align-items: center; flex-wrap: wrap; gap: 0; min-width: 0; flex: 1 1 auto;` (lines 184–191). At ≥480px `gap: 0 var(--space-2);` (line 1502–1503). |
| `.cell-header__word-row` | `.cell-header__word-row` | `display: flex; align-items: center; box-sizing: border-box; min-width: 0;` (lines 193–199). |
| `.cell-header__word` | `.cell-header__word` | `font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: calc(var(--touch-target-mobile) * 0.6);` (lines 201–208). At ≥768px `line-height: calc(var(--touch-target-desktop) * 0.6);` (lines 1679–1682). |
| `.cell-header__reading` | `.cell-header__reading` | `display: flex; align-items: center; gap: var(--space-1); flex-shrink: 0; flex-basis: 100%; min-width: 0; height: calc(var(--touch-target-mobile) * 0.4); line-height: calc(var(--touch-target-mobile) * 0.4); overflow: visible;` (lines 222–233). At ≥768px `height`/`line-height` switch to `calc(var(--touch-target-desktop) * 0.4);` (lines 1686–1689). |
| `.cell-header__ipa` | `.cell-header__ipa` | `font-size: var(--font-size-xs); color: var(--color-text-muted); white-space: nowrap; flex-shrink: 0; line-height: calc(var(--touch-target-mobile) * 0.4);` (lines 210–216). At ≥768px `line-height: calc(var(--touch-target-desktop) * 0.4);` (lines 1683–1684). |
| `.cell-header__audio-group` | `.cell-header__audio-group` | `display: flex; align-items: center; gap: var(--space-0-5); flex-shrink: 0;` (lines 236–241). |
| `.cell-header__audio` | `.cell-header__audio` | `width/height/min-width/min-height: calc(var(--touch-target-mobile) * 0.4); padding: 0; gap: var(--space-0-5);` plus `.icon-btn.icon-btn--xs` (lines 243–250). At ≥768px audio button box stays `calc(var(--touch-target-desktop) * 0.4)` (lines 1703–1706). Inner SVG `width/height: calc(var(--touch-target-mobile) * 0.25)` at base, `calc(var(--touch-target-desktop) * 0.25)` at ≥768px (lines 252–255, 1707–1710). |
| `.cell-header__actions` | `.cell-header__actions` | `display: flex; align-items: center; gap: var(--space-1); flex-shrink: 0;` (lines 281–286). |
| `.cell-header__second` | `.cell-header__second` | `display: flex; align-items: center; gap: var(--space-1); overflow-x: auto; scrollbar-width: none;` (lines 262–271). At ≥480px `gap: var(--space-2);` (lines 1504–1506). |
| `.cell-header__status` | `.cell-header__status` | `display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; min-width: 6em; height: var(--space-5); padding: 0 var(--space-2); border-radius: var(--radius-full); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); line-height: var(--leading-none); white-space: nowrap; cursor: pointer; border: var(--border-width-hairline) solid transparent;` (lines 300–321). At <480px `height: var(--space-6); padding: 0 var(--space-2-5);` (lines 1637–1641). |
| `.cell-header__status--unknown` | `.cell-header__status--unknown` | `background: var(--color-error-subtle); color: var(--color-error);` (lines 328–331). |
| `.cell-header__status--tracking` | `.cell-header__status--tracking` | `background: var(--color-warning-subtle); color: var(--color-warning);` (lines 333–336). |
| `.cell-header__status--known` | `.cell-header__status--known` | `background: var(--color-success-subtle); color: var(--color-success);` (lines 338–341). |
| `.cell-header__status--ignore` | `.cell-header__status--ignore` | `background: var(--color-surface-hover); color: var(--color-text-muted);` (lines 343–346). |
| `.cell-header__badges` | `.cell-header__badges` | `display: flex; align-items: center; gap: var(--space-1); flex-shrink: 0;` (lines 274–279). At ≥480px `gap: var(--space-2);` (lines 1507–1509). |
| `.cell-header__frequency` | `.cell-header__frequency` | `display: inline-flex; align-items: center; box-sizing: border-box; height: var(--space-5); border-radius: var(--radius-full); overflow: hidden; font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); line-height: var(--leading-none);` (lines 348–358). |
| `.cell-header__frequency-source` | `.cell-header__frequency-source` | `padding: var(--space-1) var(--space-2-5);` (lines 360–364). Band modifiers change `background`/`color` (lines 372–420). |
| `.cell-header__frequency-rank` | `.cell-header__frequency-rank` | `padding: var(--space-1) var(--space-2-5);` (lines 366–370). Band modifiers change `background`/`color` using `color-mix(in srgb, <band-fg> 12%, transparent)` (lines 372–420). |
| `.cell-header__frequency--core` … `--rare` | same | copy all five band blocks from lines 372–420. |

### 5.3 Definitions

| Popup class | Target module class | Key declarations / tokens |
|---|---|---|
| `.cell-def` | `.cell-def` | `padding: 0 var(--space-2); flex: 1; min-height: 0; overflow-y: auto;` (lines 423–428). At ≥480px `padding: 0 var(--space-3);` (line 1514). |
| `.cell-def__empty` | `.cell-def__empty` | `color: var(--color-text-muted); font-style: italic; padding: var(--space-1) 0;` (lines 430–434). At ≥480px `padding: var(--space-3) 0;` (lines 1565–1567). |
| `.cell-def__item` | `.cell-def__item` | `position: relative; border-radius: var(--radius-card); transition: background-color var(--duration-fast) var(--ease-in-out);` (lines 436–444). Hover `background: var(--color-surface-hover);` (lines 442–444). |
| `.cell-def__check` | `.cell-def__check` | `position: absolute; top: 0; left: 0; bottom: 0; width: var(--iconbutton-size-xs); cursor: pointer; display: flex; align-items: center; justify-content: center;` (lines 446–457). |
| `.cell-def__check-dot` | `.cell-def__check-dot` | `width: var(--space-1-5); height: var(--space-1-5); border-radius: var(--radius-full); background: var(--color-border);` (lines 459–466). |
| `.cell-def__check-box` | `.cell-def__check-box` | `width: var(--space-4); height: var(--space-4); border-radius: var(--radius-sm); border: var(--space-0-5) solid var(--color-primary); background: transparent; display: none;` (lines 468–478). |
| `.cell-def__check-tick` | `.cell-def__check-tick` | contains `ICON_CATALOG.check.svg`; `width/height: var(--space-3-5);` (lines 480–489). |
| `.cell-def__check--checked` | `.cell-def__check--checked` | `.cell-def__check-box` → `display: flex; background: var(--color-primary); border-color: var(--color-primary);`; `.cell-def__check-tick` → `display: inline-block; color: var(--color-text-inverse);` (lines 503–519). |
| `.cell-def__check-input` | `.cell-def__check-input` | `position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none;` (lines 521–527). `focus-visible + .cell-def__check-box` → `outline: var(--space-0-5) solid var(--color-primary); outline-offset: var(--space-0-5);` (lines 529–532). |
| `.cell-def__text` | `.cell-def__text` | `padding: var(--space-1) 0 var(--space-1) var(--space-7);` (lines 534–536). At ≥480px `padding: var(--space-2) 0 var(--space-2) calc(var(--space-7) + var(--space-1-5));` (lines 1517–1519). |
| `.cell-def__examples` | `.cell-def__examples` | `margin-top: var(--space-0-5); font-size: var(--font-size-xs); color: var(--color-text-muted);` (lines 543–547). At ≥480px `margin-top: var(--space-1);` (lines 1520–1521). |

### 5.4 Toolbar and candidates

| Popup class | Target module class | Key declarations / tokens |
|---|---|---|
| `.cell-toolbar` | `.cell-toolbar` | `display: flex; gap: var(--space-0-5); padding: 0 var(--space-2); align-items: center;` (lines 550–555). At ≥480px `gap: var(--space-1); padding: 0 var(--space-3);` (lines 1510–1513). |
| `.cell-toolbar__tab` | `.cell-toolbar__tab` | `position: relative; flex-shrink: 0; border-radius: var(--radius-full);` plus `.btn` + `.btn--primary` or `.btn--ghost` (lines 561–565). |
| `.cell-toolbar__label` + `.cell-label` | `.cell-toolbar__label` / `.cell-label` | `.cell-label` → `display: none; font-size: var(--font-size-xs);` (lines 51–54). At ≥480px `.cell-label { display: inline; }` (line 1483). At <480px `.btn:has(.cell-label)` becomes circle (lines 1610–1616). |
| `.cell-toolbar__badge` | `.cell-toolbar__badge` | `position: absolute; top: calc(-1 * var(--space-0-5)); right: calc(-1 * var(--space-0-5)); min-width: var(--space-3); aspect-ratio: 1; padding: 0 var(--space-0-5); border-radius: var(--radius-full); background: var(--color-primary); color: var(--color-text-inverse); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); box-shadow: var(--shadow-focus-bg); z-index: var(--z-dropdown);` (lines 571–589). |
| `.cell-candidates` | `.cell-candidates` | Final normal-flow block; `flex: 0 0 auto; background: transparent;` plus bottom padding ≥ one chip height. |
| `.cell-candidates__chips` | `.cell-candidates__chips` | `display: flex; align-items: center; gap: var(--space-1); padding: 0 var(--space-2);`; at ≥480px use popup spacing tiers. |
| `.cell-candidates__chips-scroll` | `.cell-candidates__chips-scroll` | `flex: 1 1 auto; display: flex; gap: var(--space-2); overflow-x: auto; scrollbar-width: none; min-width: 0;` and hidden webkit scrollbar. |
| `.cell-chip` | `.cell-chip` | Candidate name only; transparent background; `flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; border-radius: var(--radius-full); white-space: nowrap;`; active = primary text + 2px underline, no filled state. |

### 5.5 Tab content panels

Copy the full blocks from `popupDictionary.css` into the module. The most important tokens per panel are:

| Panel | Container class | Key declarations / tokens |
|---|---|---|
| Audio | `.cell-audio` | `padding: 0 var(--space-2); flex: 1 1 auto; overflow-y: auto; min-height: calc(var(--space-0-5) + var(--space-4-5) + var(--space-1) + var(--space-1) * 2 + var(--touch-target-mobile));` (lines 591–599). At ≥480px `padding: 0 var(--space-3);` (line 1524). |
| Audio | `.cell-audio__subtabs` | `display: flex; gap: var(--space-2); padding: var(--space-0-5) 0 var(--space-1);` (lines 601–605). |
| Audio | `.cell-audio__subtab` | `font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); text-transform: uppercase; letter-spacing: var(--tracking-wide); color: var(--color-text-muted); border-bottom: var(--space-0-5) solid transparent; padding-bottom: var(--space-0-5);` (lines 607–620). Active: `color: var(--color-text); border-bottom-color: var(--color-primary);` (lines 628–631). |
| Audio | `.cell-audio__item` | `display: flex; align-items: center; gap: var(--space-1-5); padding: var(--space-1) var(--space-2); border-radius: var(--radius-card);` (lines 633–639). At ≥480px `gap: var(--space-2-5); padding: var(--space-2) var(--space-2-5);` (lines 1526–1529). |
| Audio | `.cell-audio__label` | `flex: 1; font-size: var(--font-size-xs);` (lines 679–689). At ≥768px `font-size: var(--font-size-base);` (line 1719). |
| Image | `.cell-image` | `padding: 0; display: flex; flex-direction: column; flex: 1 1 auto; min-height: calc(var(--space-1) * 2 + var(--space-20));` (lines 788–794). |
| Image | `.cell-image__strip` | `display: flex; flex-direction: row; gap: var(--space-1); overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; padding: var(--space-1);` (lines 799–807). |
| Image | `.cell-image__card` | `flex: 0 0 auto; width: calc((100% - var(--space-1) * 7) / 8); min-width: var(--popup-image-card-min-width-compact); aspect-ratio: 1 / 1;` (lines 830–837). At ≥480px `min-width: var(--popup-image-card-min-width-default);` (line 1544). |
| Translate | `.cell-translate` | `padding: 0 var(--space-2); flex: 1 1 auto; min-height: calc(...); overflow-y: auto;` (lines 960–967). At ≥480px `padding: var(--space-2) var(--space-3);` (line 1551). |
| Translate | `.cell-translate__block` | `display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-1); padding: var(--space-1) var(--space-2); border-radius: var(--radius-card); border: var(--border-width-hairline) solid var(--color-border); background: var(--color-surface); cursor: pointer;` (lines 970–982). Selected: `background: var(--color-primary-subtle); border-color: var(--color-primary);` (lines 988–991). |
| Links | `.cell-links` | `display: flex; flex-wrap: wrap; gap: var(--space-1); padding: var(--space-1) var(--space-2); min-height: 0; overflow-y: auto;` (lines 1083–1091). At ≥480px `gap: var(--space-1-5); padding: var(--space-2) var(--space-3);` (lines 1568–1571). |
| Links | `.cell-links__item` | `display: inline-flex; align-items: center; gap: var(--space-1); padding: var(--space-1) var(--space-2); border: var(--border-width-hairline) solid var(--color-border); border-radius: var(--radius-pill); background: var(--color-surface); color: var(--color-text); text-decoration: none; font-size: var(--font-size-xs);` (lines 1123–1135). At ≥768px `font-size: var(--font-size-base);` (line 1727–1729). |

For the full set of sub-element rules (empty states, skeletons, checkboxes, hover/active states), copy the corresponding blocks from `popupDictionary.css` lines 591–742, 762–957, 959–1083, 1083–1147 and their responsive overrides.

### 5.6 Shared button/icon classes

The popup uses `src/shared/styles/components.css` classes. Either import `components.css` globally into `DictionaryPanelView.tsx` or use CSS Modules `composes` so the following classes are available:

- `.btn` — base text button (height `var(--button-height)`, radius `var(--button-radius)`, font `var(--button-font-weight)` / `var(--button-font-size)`) (`components.css` lines 72–88).
- `.btn--primary` / `.btn--outline` / `.btn--ghost` — variants (`components.css` lines 93–103).
- `.btn--sm` — smaller height/padding/font (`components.css` line 108).
- `.icon-btn` / `.icon-btn--xs` / `.icon-btn--sm` / `.icon-btn--outlined` / `.icon-btn--filled` — icon-only buttons (`components.css` lines 13–67).

At container width <480px, `popupDictionary.css` overrides `.icon-btn--xs` and `.icon-btn--sm` to `min-width/height: var(--touch-target-mobile)` (lines 1627–1631) and `.btn` to `min-height/min-width: var(--touch-target-mobile)` (lines 1642–1645). These overrides must be reproduced in the module (or the global `popupDictionary.css` must be loaded; loading it globally is not recommended because it contains popup-only shell rules).

## 6. Responsive/container-query strategy

The popup is laid out with `container-type: inline-size` on `.cell-popup` and four `@container` tiers (`popupDictionary.css` lines 1444–1788). The integrated panel must replicate the same tiers so the dictionary view looks identical at the same effective width.

1. Set `container-type: inline-size` on `.dictionaryPanel`.
2. Remove the global `padding` from `.dictionaryPanel` so the container query width matches the popup's content width. Apply padding to `.searchRow`, `.cell-header`, `.cell-toolbar`, `.cell-def`, `.cell-candidates`, and tab panels exactly as the popup does.
3. Copy the `@container` blocks from `popupDictionary.css` lines 1448–1736 into `DictionaryPanelView.module.css`, renaming the selectors only where the module class name differs (they should be the same BEM class names). The tiers are:
   - **Compact (<380px)** — base rules are the default outside any query.
   - **Narrow (380px–479px)** — `@container (min-width: 380px) and (max-width: 479px)` (lines 1448–1479).
   - **Default (≥480px)** — `@container (min-width: 480px)` (lines 1482–1602). This is where `.cell-label` becomes visible and larger padding/touch targets apply.
   - **Wide (≥768px)** — `@container (min-width: 768px)` (lines 1674–1736). Desktop touch targets shrink to `--touch-target-desktop` and larger type sizes apply.
4. Copy the `<480px` button/icon touch-target overrides from lines 1610–1672.
5. Do **not** copy `.cell-popup--sheet`, `.cell-popup--popover`, `.cell-sheet-handle`, `.cell-popup__resize`, drag cursors, or fixed positioning — those are floating-popup only.
6. Add the reduced-motion block from lines 1780–1788 scoped to `.dictionaryPanel` and its children.

Because `DictionaryTab.module.css` already stacks the left/right panes at `max-width: 768px`, the dictionary panel will be full width on mobile and receive the narrow/default container queries automatically. On desktop, the left pane is roughly 50% of the 1280px max panel → ~640px, so the **Default** tier (≥480px) and **Wide** tier (≥768px) apply exactly as in a wide popup.

## 7. State management changes (definition selection, selected definitions)

### 7.1 `useDictionaryPanel.ts`

Add and expose the following:

- `definitionSelection: Map<string, boolean>` — tracks checkbox state per `DefinitionEntry.id`.
- `toggleDefinition(id: string, selected: boolean)` — updates the map.
- `selectedDefinitions: DefinitionEntry[]` — derived by `result.definitions.filter(def => selection.get(def.id) ?? def.defaultSelected)` (same as `getSelectedDefinitions` in `popupContent.ts` lines 345–351).
- `quickAdd: () => void` — builds the prefill using `selectedDefinitions` and invokes `props.onQuickAdd(prefill)` if provided; if not provided, disable the Quick Add button in the view.

Behavior:

- When `applyResult` sets `currentResult`, initialize `definitionSelection` from `result.definitions.map(def => [def.id, def.defaultSelected])` (same as `initDefinitionSelection` in `popupContent.ts` lines 336–343).
- When `setActiveCandidate` switches to a different candidate, re-initialize `definitionSelection` from that candidate's `definitions` `defaultSelected` values.
- `cycleStatus` should keep `currentResult.status` in sync (already done at `useDictionaryPanel.ts` lines 203–210).
- `sendToCard` should build the prefill with `selectedDefinitions` instead of all definitions. If the user unchecks every definition, fall back to all definitions (matching `popupDictionaryController.ts` `buildPopupPrefill` lines 560–565).

### 7.2 `DictionaryPanelView.tsx`

- Receive `definitionSelection`, `toggleDefinition`, `selectedDefinitions`, and `quickAdd` from the hook.
- Render each definition with a `<label class="cell-def__check ...">` and hidden `<input type="checkbox" checked={selection.get(def.id) ?? def.defaultSelected} onChange={...}>`.
- Wire the `Send to Card` header action to `panel.sendToCard()`.
- Wire the `Quick Add` header action to `panel.quickAdd()` (or disable it when `onQuickAdd` is not available).

### 7.3 `DictionaryPanelView` props (optional)

If `Quick Add` should be wired by the parent, add an optional prop:

- `onQuickAdd?: (prefill: PopupCardCreatorPrefill) => void;`

`useDictionaryPanel` can either receive this prop or build a default `quickAdd` that sends `MESSAGE_TYPES.QUICK_ADD` to the background with a `QuickAddPayload` (see `src/features/dictionaryPopup/schema.ts` lines 267–271 and `src/shared/config/messages.ts` line 67). Whichever path is chosen, the prefill must include the selected definitions, current translation, and context sentence.

## 8. Accessibility & interaction notes

- **Focus**: keep the existing `useEffect` that focuses the search input after panel open (`DictionaryPanelView.tsx` lines 117–134). Do not steal focus when a search completes.
- **Status pill**: render it as a real `<button>` (not a `Badge` inside a `Button`). Add a `title` showing the next status: `Click to cycle: {current} → {next}` (matching `popupContent.ts` lines 161–163).
- **Definition checkboxes**: use a `<label>` wrapping a visually hidden `<input type="checkbox">`. The hidden input must remain focusable, with `focus-visible` outlining the `.cell-def__check-box` (`.cell-def__check-input:focus-visible + .cell-def__check-box` in `popupDictionary.css` lines 529–532). On touch devices without hover, the dot remains the only visible affordance until checked; this matches the popup, but verify usability.
- **Toolbar tabs**: use `<button>` with `aria-pressed={active}`, `aria-label={label}`, and `title={label}`. The active tab is a toggle — clicking it again closes the panel.
- **Touch targets**: at container width <480px, ensure `.icon-btn--sm`/`--xs` and `.btn` meet 44×44px minimums through the popup's override rules (`popupDictionary.css` lines 1627–1645). The header audio buttons are intentionally smaller (`0.4 * touch-target`) and are exempt.
- **Reduced motion**: copy `@media (prefers-reduced-motion: reduce) { ... }` for the panel (lines 1780–1788).
- **Text selection**: the panel text should be selectable. The popup uses `user-select: text` on `.cell-popup` (`popupDictionary.css` lines 25, `popupShell.ts` lines 533–534). Apply `user-select: text` to `.dictionaryPanel` or its content.

## 9. Testing strategy

### Unit / integration tests

1. Update `src/features/dictionaryPopup/ui/useDictionaryPanel.test.ts`:
   - Assert `definitionSelection` is initialized from `defaultSelected`.
   - Assert `toggleDefinition` updates selection and `selectedDefinitions`.
   - Assert `sendToCard` prefill uses selected definitions; falls back to all definitions when none selected.
   - Assert `quickAdd` callback receives a prefill with selected definitions.
2. Add/revise `DictionaryPanelView` render tests (using the mocked hook or a stub):
   - Header has `.cell-header__actions` with two icon buttons (`pencil`, `zap`).
   - No `.footer` element is rendered.
   - Definitions have `.cell-def__check` labels and hidden checkboxes.
   - Candidate chips are in a horizontally scrolling `.cell-candidates__chips-scroll`.
   - Toolbar has four `.cell-toolbar__tab` buttons with `.cell-label` text hidden by default in a narrow container.

### Visual / manual tests

- Run `npm run typecheck`, `npm run test:unit`, `npm run build`.
- Open the integrated UniversalPanel on a test page and look up a word.
- Compare side-by-side with the floating popup at these effective widths: 320px, 375px, 414px, 480px, 640px (desktop left pane), 768px, 1024px, 1280px.
- Verify: 2-row header, status pill, split frequency badge, checkbox hover/checked states, candidate chip scroll, toolbar icon/label transitions, tab panel empty states.
- Use DevTools MCP to capture screenshots and confirm no visual drift from the popup.

### Responsive checks

- In a container <480px wide, toolbar labels must hide and buttons become circular.
- In a container ≥480px wide, toolbar labels must appear and buttons become pills.
- Header audio buttons remain small at all widths.
- Definition text padding expands at ≥480px.

## 10. Implementation phases (step by step, ordered by dependency)

1. **Inventory & token map** — confirm every class/token above is captured; decide how to load `.btn`/`.icon-btn` styles (global `components.css` import vs. CSS Modules `composes`).
2. **State layer** — update `useDictionaryPanel.ts` with `definitionSelection`, `toggleDefinition`, `selectedDefinitions`, `quickAdd`, and `sendToCard` prefill changes.
3. **Markup restructure** — rewrite `DictionaryPanelView.tsx` to remove the footer, reorder candidates after definitions, and create the 2-row header, definition checkboxes, and toolbar.
4. **Header styling** — copy `.cell-header` CSS and its responsive tiers; implement split frequency badge and status pill.
5. **Definitions styling** — copy `.cell-def` CSS with dot/checkbox/tick hover and checked states.
6. **Candidates styling** — copy `.cell-candidates` / `.cell-chip` CSS and horizontal scroll.
7. **Toolbar styling** — copy `.cell-toolbar` CSS, icon+label toggle, and badge.
8. **Tab panel styling** — copy `.cell-audio`, `.cell-image`, `.cell-translate`, `.cell-links` blocks and skeleton/empty/loaded states. Optionally wire data fetching to match the popup controller.
9. **Container queries** — add `container-type: inline-size` to `.dictionaryPanel`, remove global padding, and copy all `@container` tiers from `popupDictionary.css`.
10. **Polish & tests** — add reduced-motion, verify no hardcoded pixels, run build/typecheck/tests, manual DevTools comparison.

## 11. Acceptance criteria (specific, testable)

- [ ] `DictionaryPanelView.tsx` no longer renders a `.footer`; `Send to Card` and `Quick Add` icons are in `.cell-header__actions` in Row 1.
- [ ] Header has exactly two rows: Row 1 = word + reading + audio buttons + action icons; Row 2 = status pill + split frequency badge.
- [ ] The status pill is a `<button>` with `min-width: 6em`, `height: var(--space-5)`, and the four status background/foreground colors from `popupDictionary.css` lines 328–346.
- [ ] Frequency badge is a split pill with `.cell-header__frequency-source` and `.cell-header__frequency-rank`, colored per `core/common/general/advanced/rare` bands using `color-token-freq-*` tokens.
- [ ] Definitions use the popup's block DOM structure: one block `.cell-def__item`/`cellDefItem` row per definition, with a separate checkbox gutter and block text wrapper; no inline outer `<label>` that allows definitions to flow into each other.
- [ ] Definitions render with a left checkbox gutter. Unchecked = dot; hovered = empty checkbox border; checked = primary-filled checkbox with white tick.
- [ ] Each definition displays `pos` + `text` as one visual line/block matching popup typography, examples prefixed with `•`, and no separate POS badge.
- [ ] Candidate chips render in a horizontally scrolling strip at the end of the dictionary content (`overflow-x: auto`, hidden scrollbar), never inside or between definition rows.
- [ ] Candidate chips use transparent background in every state and render only the candidate name; active state uses `--color-primary` text plus a 2px underline, with no filled background.
- [ ] The candidate strip reserves at least one complete chip height below its final item so the last candidate can scroll fully into view without being covered or clipped.
- [ ] Toolbar has four icon buttons (`audioWave`, `image`, `languages`, `link`) directly below the header and before definitions, with hidden labels below 480px and pill labels at/above 480px.
- [ ] Active tab content panel styling matches the popup: audio sub-tabs and rows, image horizontal strip, translate block, links chips.
- [ ] `useDictionaryPanel` initializes `definitionSelection` from `defaultSelected`, exposes `toggleDefinition`, and `sendToCard`/`quickAdd` use selected definitions (fallback to all if none).
- [ ] `DictionaryPanelView.module.css` uses `container-type: inline-size` and replicates the popup's `@container` tiers (compact, narrow 380–479, default ≥480, wide ≥768).
- [ ] Search is one `SearchField` only: no adjacent Search button, no native browser search clear plus custom clear duplication, and one visible clear X.
- [ ] Typing triggers one debounced lookup after 350ms of inactivity; Enter triggers immediate lookup; empty/whitespace input does not dispatch lookup.
- [ ] `npm run typecheck`, `npm run test:unit`, and `npm run build` all pass.
- [ ] Manual DevTools side-by-side comparison shows the integrated panel identical to the floating popup at 320px, 375px, 414px, 480px, 640px, and 768px+ effective widths, including populated definitions and the final candidate visibility edge case.

## 12. Boundaries / out of scope

- Do **not** modify the floating popup implementation (`popupShell.ts`, `popupContent.ts`, `popupDictionary.css`, `popupToolbar.ts`, `popupDictionaryController.ts`) except to extract shared helpers such as `getSelectedDefinitions` if needed.
- Do **not** add drag, resize, pin, shadow DOM shell, sheet handle, or backdrop to the integrated panel.
- Do **not** change `DictionaryTab.module.css`, `UniversalPanel.tsx`, or `CardCreatorPanel.tsx` layout.
- Do **not** add new npm dependencies.
- Do **not** add multi-candidate stacked active entries unless the existing `candidates` array is expanded later; the integrated panel should match the popup's single active entry + candidate chips pattern.
- Full audio/image/translate data fetching is in scope **visually** (empty/skeleton/loaded states), but if backend handlers are missing, the panels may remain in their empty/skeleton states. The wire-up to `FETCH_COMMUNITY_AUDIO`, `FETCH_IMAGES`, `TRANSLATE`, and `TTS_FETCH_AUDIO` can be a follow-up if not already available.
- The search input row is panel-specific and sits above the popup-clone content. It has one visible clear X, no adjacent Search button, and uses a 350ms idle debounce.

## 13. Resolved decisions

1. **Fidelity target**: The popup's rendered DOM hierarchy and computed visual states are the source of truth. “100% copy” includes layout order, spacing, typography, colors, controls, hover/focus/selected states, responsive tiers, loading, empty, error, and populated definition states.
2. **Search**: Keep one search field as the integrated-panel-only affordance. Remove the adjacent Search button. Disable the native `type="search"` clear affordance or otherwise ensure only one visible X remains. Lookup after 350ms idle; Enter remains an immediate submit path.
3. **Dictionary order**: `Header → Toolbar/material slot → Definitions → Candidate strip`. Candidate strip is the final normal-flow block.
4. **Definitions**: Reproduce popup block structure, including one independent row per definition. Do not use an inline outer label or inline text wrapper that causes definitions to merge horizontally.
5. **Candidates**: Candidate strip is a low-emphasis reference control. Transparent background; candidate name only; active text uses primary color plus 2px underline; reserve bottom space equal to at least one chip height.
6. **Universal shell boundary**: UniversalPanel shell, Dictionary/Settings navigation, right Card Creator pane, backdrop, and close behavior remain integrated-panel behavior. They are not part of the floating popup visual clone.
7. **Verification**: Runtime verification must use Chrome DevTools with populated data, screenshots, bounding rectangles, computed styles, and the final-candidate scroll case. Source inspection alone is insufficient.
