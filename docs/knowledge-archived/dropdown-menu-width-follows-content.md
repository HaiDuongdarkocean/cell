# Dropdown menu width locked to trigger clips long options

> **Principle**: [Dropdown width follows content, alignment configurable by trigger position](principles.md#dropdown-width-follows-content-alignment-configurable-by-trigger-position)

## Problem
Card Creator field-map `Select` (chọn Anki field mapping) nằm bên phải row (label trái, select phải). Menu dropdown dùng `left: 0; right: 0` → width locked bằng trigger width. Trigger rất hẹp (auto width theo text "None"/field name ~40-80px) → options dài (e.g. "Sentence", "SentenceTranslation", "TargetWord") bị clip, user không nhìn thấy full text.

Cùng bug khi menu mở sang phải tràn ra ngoài card (select bên phải row → menu extend phải vượt card boundary).

## Root causes
`Select.module.css` `.menu`:
```css
.menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;          /* ← locks width to trigger width, clips long options */
  ...
}
```
`left: 0; right: 0` = menu width = trigger width. Narrow trigger → narrow menu → long options ellipsised/clip.

Select dùng chung cho 3 vị trí:
- Note type (cột trái pairRow) — menu mở phải OK
- Deck (cột phải pairRow) — menu mở phải tràn card
- Field-map (bên phải FieldRow) — menu mở phải tràn card + narrow trigger clip options

## Fix
1. **Width follows content** — bỏ `right: 0`, dùng `width: max-content` + `min-width: 100%` (không ngắn hơn trigger) + `max-width: 320px` (guard item quá dài).
2. **Alignment configurable** — thêm prop `menuAlign: 'left' | 'right'` (default `'left'`):
   - `'left'`: `left: 0` (menu mở phải, edge trái menu = edge trái trigger)
   - `'right'`: `right: 0; left: auto` (menu mở trái, edge phải menu = edge phải trigger)
3. FieldRow select (bên phải row) truyền `menuAlign="right"` → menu mở trái, không tràn card.

`Select.module.css`:
```css
.menu { width: max-content; min-width: 100%; max-width: 320px; ... }
.menuAlignLeft { left: 0; }
.menuAlignRight { right: 0; left: auto; }
```

## Key insight
Dropdown menu width phải theo content (max-content + min/max guard), không theo trigger — trigger width là UI constraint, content width là readability constraint. Alignment phải configurable theo vị trí trigger trong container: trigger bên trái → menu mở phải (`left: 0`), trigger bên phải → menu mở trái (`right: 0`) để không tràn container. Hardcode `left: 0; right: 0` assume trigger luôn bên trái + content luôn ngắn hơn trigger — sai cho cả 2 assumption.

## Verification
- `Select.test.tsx` — 2 test mới: default `menuAlignLeft` class, `menuAlign="right"` → `menuAlignRight` class. (jsdom không compute external CSS module styles, nên width/maxWidth verify bằng MCP browser.)
- 2218 test pass, typecheck pass, build pass.
- Field-row select menu giờ mở trái (right edge menu = right edge trigger), width theo content, không tràn card.
