# Settings tab v2 — inventory → style extraction → redesign plan

Date: 2026-10-12. Method: runtime DOM/computed inventory (`tmp/settings-tab-redesign/inventory/sections.json`), screenshot review, dict-popup style extraction, Anh's expert-review findings.

## 1. Overview inventory — 13 sections, ~115 interactive controls

| Section | Controls | Body chars | Dominant elements | Density verdict |
|---|---|---|---|---|
| general | 2 | 189 | 1 pill Select (487×40, r:9999), 1 toggle | Thin — merge candidate |
| languageProfile | 8 | 210 | radio cards 451×55 r:8, kebab 32×32, link buttons | OK |
| resources | 24 | 543 | dropzone 487×98 r:8, dragHandle 28, nameButton r:4, tag pills 78×40 r:9999, toggles, band inputs 120×30 | **Heaviest** |
| media | 1 | 120 | MultiSelect only | Thin |
| block | 5 | 428 | 5 toggles | OK — hint text long |
| dictionaryPopup | 30 | 561 | 3 segmented groups (32h r:8) + tabs + list | Heavy but structured |
| wordBadge | 4 | 125 | select + 2 sliders | OK |
| audio | 15 | 262 | 5 segs pill r:9999 h22, 5 source chips pill h26, primary btn, detail card | OK |
| localPlayer | 2 | 208 | 2 toggles | **Thin — merge candidate** |
| download | 6 | 268 | 6 pill Selects full-width | Row-heavy |
| shortcuts | 15 | 424 | shortcutPills 32×32 r:6 | Compact ✓ |
| theme | 4 | 41 | 3 cards 154×71 r:8 + select | Lightest |
| sync | 4 | 485 | 2 toggles + input + btn + privacy block | Text-heavy |

**Shape families found (4, inconsistent):**
- `r:9999px` pill — Select triggers, Buttons, audio segments/chips, band inputs
- `r:8px` (radius-md) — dictPopup segments, profile/theme cards, dropzone
- `r:6px` (radius-sm) — shortcutPill; `r:4px` — nameButton
- toggle track `r:12/20` — own family

**Shape mismatch (Anh):** Select trigger is a *pill* but its menu is `radius-md` *rectangle* — trigger/menu shape language disagrees. Trigger must share the menu's radius.

## 2. Dictionary-popup design language (target style)

From `dict-open.png` + `DictionaryPanelView.module.css` + DS overview "Quiet Confidence" (calm, single indigo accent, restrained, 4px grid, concentric radius):

- **Chips**: `radius-pill`, **compact height** (~20-24px), often two-tone label|value pairs (`wordfreq|1,234`)
- **Icon actions**: circular 36px icon buttons on toolbar
- **Surfaces**: `surface-elevated` + `border-subtle` hairline, `radius-card`; state via bg ladder elevated→hover→pressed, **no border reliance**
- **Hierarchy**: big bold headword → muted meta → content bullets → related-words pill container
- **Accent**: indigo only for primary action + links; status colors only in chips

## 3. Findings → decisions (Anh's review + evidence)

### IA / grouping
1. **Dissolve `general`** — "Interface language" → `theme` section (rename **Appearance**); "Show dictionary popup" toggle → `dictionaryPopup` section. 13→12 sections.
2. **Merge `localPlayer` → `download`**? Both playback/file-ish — but localPlayer = subtitle matching for local video files, download = web video downloads. Keep separate; localPlayer only 2 toggles → merge into `media` instead (media = "auto-select media" 1 control — same domain: media sources). `media` + `localPlayer` → **Media** section (3 rows).
3. Result: **11 sections** — Appearance, Language profiles, Resources, Media, Subtitles, Dictionary popup, Word badge, Audio, Downloads, Shortcuts, Sync.

### Card-per-section
Sections today are hairline-separated, no breathing room → each section becomes a card: `surface`/`surface-elevated` + `radius-card` + `space-4` gap between cards. (Decide: card bg `surface-elevated` on `--color-background` body, or `surface` on field-tinted body — pick via mockup.)

### Component fixes (root, shared)
4. **SearchableSelect → combobox** (3-click→2): click trigger opens list **with search already focused**, select-on-pick, focus restore on close. Shape: trigger + menu same `radius-md` family (or both pill — pick one).
5. **Select trigger shape**: `r:9999` pill → `radius-md` to match its menu (or menu→pill; standard = trigger matches menu radius).
6. **Profile card**: white bg wraps card+kebab row (`.item:has()` paints selected surface over whole row incl. kebab). Fix at component: kebab **inside** the card surface (card = bg + content + kebab), so highlight/menu live on the card, not the row.
7. **Resource tag chips**: 78×40 pill too tall → chip spec ~`space-6`(24px) height, `radius-pill`, `font-size-xs` — dict-popup chip grammar.
8. **Toggle thumb**: inset `space-0-5`(2px) → `space-1`(4px); thumb white-on-gray unchecked needs stronger contrast → thumb = `surface-elevated` w/ border or stronger `toggle-dot-shadow`.
9. **Resources header**: title + desc duplicated vs section header → drop inner header.

### Declutter / progressive disclosure
10. Rarely-used → collapse: `sync` privacy paragraph → HintIcon; advanced profile form fields already behind disclosure ✓; dict-popup Links/Sounds sub-panels stay (already sectioned).
11. Copy cut list: remaining section descriptions that restate titles; "Change" banner copy.

## 4. Execution order

1. Card sections + spacing (visual foundation)
2. IA merge (general→dissolve, localPlayer→media) + copy cuts
3. Component fixes: SearchableSelect combobox, Select shape, profile card, chips, toggle
4. Verify: shots 320/600/840 light+dark, axe, env sweep, cross-grade
5. Gates + commit per slice
