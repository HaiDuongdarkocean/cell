# Ops — Audit rubric (mode FIX + B7)

> Thay thế `docs/design-system/AUDIT-CHECKLIST.md`. Rubric cấp hệ thống cho mọi screen/component/surface.
> Mỗi axis cite canonical instance (repo) + authority ngoài (Nielsen, WCAG 2.2, M3, HIG).

## 0. Audit order & evidence rules

Audit **đúng thứ tự** — lỗi layout kéo theo mọi thứ phía sau:

```
tokens → surfaces → layout/spacing → shape → color/emphasis → type →
states → layout-integrity-under-interaction → a11y → motion → edge cases →
screen heuristics → cross-screen diff
```

Evidence rules cho mọi finding:
- `expected vs actual` bằng giá trị, không tính từ ("border #303030 trên #2D2D2D", không "border mờ").
- Kèm pixel evidence (screenshot/computed-style probe), cả 2 theme khi axis là màu/surface.
- Severity: **2** block task/phá a11y · **1** inconsistency thấy được · **0** nit. Deviation có lý do ghi rõ = quyết định, không phải defect.
- Reproduce trên browser thật trước khi file (AGENTS.md).

**Finding format:** `[severity] [axis #] screen/component — expected vs actual + evidence`

## 1. Tokens & surface grammar

- [ ] Token-only — zero hardcoded hex/px/radius trong component CSS.
- [ ] Mỗi surface phân biệt với lớp dưới **cả 2 theme** — dark dựa vào tint + shadow *thật*.
- [ ] Không nested surface khi hierarchy không đòi (card trong card trong menu = noise).
- [ ] Shadow/border dùng semantic token; shadow 6%-alpha trên dark = vô hình = defect.
- [ ] Cùng role → cùng token (field, elevated menu, selected row = 1 recipe mỗi loại).
- [ ] **Elevation chỉ đi lên** — child sáng hơn/bằng+shadow, không tối hơn parent.
- [ ] **Borderless là grammar mặc định** — `surface-popover` + shadow thật; border chỉ fallback.
- [ ] **Dark shadow resolve được** — `popover/modal/floating` ≥30–50% black, optional inset ring.
- [ ] **Nested interactive ≥1 tonal step** — field bg = menu bg → vô hình; dùng `field-solid`.
- [ ] **Rows không chìm dưới card** — pending/empty rows trên elevated card dùng `color-field`+dashed `color-border` (placeholder) hoặc hairline `color-divider` (persistent).

## 2. Layout, spacing rhythm & alignment

- [ ] 1 rhythm per container — gap/padding/margin cùng token family, không lone 11px.
- [ ] **Edge alignment** — inner column inset cùng edge với option rows dưới.
- [ ] Related gần hơn unrelated — section > item > inline gaps.
- [ ] **R-TIER-READABLE** — dãy gap đo thật kèm ratio: tier liền kề ≥1.5×; bước quá nhỏ (12 vs 16) mắt không tách được = defect dù token đúng.
- [ ] **R-UNIFORM rows** — ∀ row trong 1 group cùng offsetHeight; description làm row cao hơn sibling → chuyển thành `hint`/group description, không nhét trong row.
- [ ] **R-UNIFORM rail** — ∀ control cùng cột rail cùng height (ladder 40) + `min-width` floor chung; strip/control lọt thỏm so sibling = defect.
- [ ] **R-HEADING-EARN** — group label với 1 item, hoặc label paraphrase row title/section title → bỏ label.
- [ ] **R-GROUP-SEPARATION** — `rowGaps[]` giữa mọi cặp row liền kề chỉ được có 2 giá trị (within-group, between-group); orphan unlabeled group tạo giá trị thứ 3 = defect → fold vào group kề hoặc nâng section.
- [ ] Even vertical rhythm — header→control→list→footer 1 interval, không per-section ngẫu hứng.
- [ ] Grid/inset nhất quán mọi width (narrow, zoom 200%, mobile sheet).
- [ ] **Coupled-pair gaps = recipe cố định** — trigger↔menu, label↔field, group-label↔list = 1 token mỗi cặp, mọi nơi.

## 3. Shape

- [ ] 1 radius family per component — container `md` → items `sm` → field `pill`.
- [ ] Shape nói đúng vai trò: pill = field/chip, rounded-rect = panel/menu/row.

## 4. Color & emphasis (focal hierarchy)

- [ ] **1 focal point mỗi view state** — squint test: thứ pop đầu = thứ user act tiếp.
- [ ] Emphasis budget: ≤1 focus ring + ≤1 accent surface cùng lúc.
- [ ] **Nested focusable — element sâu nhất giữ ring** — parent trigger release (2 ring chồng = defect).
- [ ] Hierarchy: selected/primary > interactive > decoration — chrome trang trí không mang accent.
- [ ] Selected = `primary-subtle` fill + `text-accent-strong` + check — recipe có sẵn, đừng chế thêm.
- [ ] Accent chỉ cho state thật — không decoration.
- [ ] Secondary content = `text-secondary`; status qua icon+text, không màu một mình.
- [ ] **R-COLOR-FAMILY** — controls cùng rail/panel cùng fill recipe (đo computedStyle bg — cùng lightness bucket ±5%); trộn `field-solid` với `surface-hover` trên 1 cột = phối màu lỗi.
- [ ] **Selected đo được** — selected segment/thumb khác biệt rõ với track (đo bg-contrast hoặc recipe canon `primary-subtle`+`accent-strong`); white-on-near-white không có shadow = điểm nhấn yếu.

## 5. Typography

- [ ] Size chỉ từ type scale; dense rows = `font-size-sm`, body = `base`/`md`.
- [ ] Hierarchy nhất quán — label/value/hint/caption mỗi vai 1 recipe.
- [ ] Weight phân biệt; size hiếm khi nhảy trong 1 component.
- [ ] **R-TYPO-PAIR** — cặp heading/item khác vai phải khác ≥2 kênh (size·weight·color); group heading **thắng** items ≥2 kênh UP (`md/semibold/primary` trên `sm/medium/primary`). Heading nhỏ/nhạt hơn items = đảo vai trò = defect.
- [ ] **Heading semantics** — group heading = `<Heading>` level = section-level+1, không phải Text `label`/`secondary`.

## 6. States & feedback

- [ ] Đủ 9 states: rest/hover/focus-visible/pressed/selected/disabled/loading/error/empty.
- [ ] 1 state = 1 tín hiệu (focus=ring, hover=wash, pressed=pressed/ripple).
- [ ] Mọi action sinh feedback trong frame (Nielsen #1).
- [ ] Disabled có cue ngoài màu (opacity).
- [ ] Open-state không giả focus khi không gì được focus.

## 7. Layout integrity under interaction

- [ ] Press/hover/ripple không đổi geometry — `overflow: clip`, `flex-shrink:0` trên rows.
- [ ] Overlay paint order — wash/ripple **dưới** text (`isolation` + `z-index:-1`).
- [ ] Long content có strategy (ellipsis/wrap) — không overflow đẩy sibling.

## 8. Interaction & accessibility

- [ ] Semantics thật: `<button>`/`<input>`/`<a>`; roles đúng; chip toggle = `aria-pressed`; label = span; nav = a.
- [ ] Keyboard đầy đủ: open/arrow/Enter/Escape-topmost/focus-restore/scroll-into-view.
- [ ] Focus visible + không bị sticky chrome che (2.4.11).
- [ ] Target ≥24 CSS px (2.5.8 AA); primary controls 40–44px.
- [ ] Contrast ≥4.5:1 text, ≥3:1 large + focus indicator — cả 2 theme.
- [ ] Touch equivalent cho hover-only; guard `hover:hover`.
- [ ] Status change announced (live region) khi không focus-driven.

## 9. Motion

- [ ] Chỉ transform/opacity/color; duration từ token; direction khớp intent.
- [ ] `prefers-reduced-motion` honored; không thông tin chỉ-qua-animation.

## 10. Content, copy & edge cases

- [ ] Empty state có nội dung, không màn trắng.
- [ ] Empty-value option render label (`''` ≠ vô hình — "None" vẫn hiện).
- [ ] Long/short/narrow/zoom-200% verified; truncation có strategy.
- [ ] Copy plain language; jargon có HintIcon; error nói chuyện gì + sửa thế nào (Nielsen #9).
- [ ] Destructive/hard-to-reverse confirm trước (Nielsen #5); Escape/undo cho modal flows (#3).

## 11. Screen-level heuristics (Nielsen, pass 2)

- [ ] #1 Status visible — user luôn biết hệ thống vừa làm gì.
- [ ] #4 Consistency — cùng action = cùng control = cùng vị trí.
- [ ] #6 Recognition > recall — labeled hơn icon-only.
- [ ] #7 Efficiency — accelerator cho dense flows.
- [ ] #8 Aesthetic & minimal — mọi element earn chỗ đứng; xóa trước khi trang trí.
- [ ] Response <3s, không jank.

## 12. Cross-screen consistency

- [ ] Screenshot target **cạnh canonical sibling** (cùng theme/zoom): khác family = defect.
- [ ] Sibling component 1 grammar — `Select`/`SearchableSelect`, `Menu`/`Popover menu` không diverge.
- [ ] Không palette/surface/shape mới cục bộ — shade mới là token decision.

## Canonical instances

| Role | Instance |
|---|---|
| Field/search | dictionary popup searchWrap (`surface-elevated`+`border-subtle`+pill) |
| Elevated menu | `Menu`/`Popover` menu variant + `SearchableSelect` menu |
| Flat option row | `MenuItem` (`surface-hover` wash, `font-size-sm`) |
| Selected row | `primary-subtle` + `text-accent-strong` + check |
| Toggle chip | `Chip as="button"` + `aria-pressed` |
| Focus signal | `shadow-focus` |
| Touch target | `--touch-target` 40px |
| Ripple | `spawnRipple` (`overflow:clip`) |

## Audit commands (chạy trước merge — phải = 0)

```bash
# M3 tokens
grep -rn 'md-sys-color' src/ --include="*.css" --include="*.tsx" --include="*.ts" | grep -v "\.test\."

# Hardcoded hex (ngoài tokens.css)
grep -rn '#[0-9a-fA-F]\{3,8\}' src/ --include="*.css" --include="*.module.css" | grep -v tokens.css | grep -v "\.test\."

# Hardcoded px ngoài scale
grep -rn 'padding:\|margin:\|gap:\|width:\|height:\|border-radius:\|font-size:' src/ --include="*.module.css" | grep -v 'var(' | grep -v '0px' | head -50

# Inline SVG
grep -rn '<svg' src/ --include="*.tsx" | grep -v src/shared/icons | grep -v Icon.tsx

# Hardcoded z-index
grep -rn 'z-index:' src/ --include="*.css" --include="*.module.css" | grep -v 'var(--z-' | grep -v tokens

# CSS audit script + health report
node scripts/check-design-system-css.mjs
node scripts/generate-design-system-health-report.mjs
```

## Runtime contrast probe (paste vào evaluate/devtools — đo thật, không đoán)

```js
const _lin = v => { v/=255; return v <= 0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
const _parse = s => {
  let m = s.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?/);
  if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]];
  m = s.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?/);
  if (m) return [+m[1]*255, +m[2]*255, +m[3]*255, m[4] == null ? 1 : +m[4]];
  return null;
};
// composite lên nền thật của parent (walk up tới opaque)
const _bg = el => {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const c = _parse(getComputedStyle(n).backgroundColor);
    if (c && c[3] === 1) return c.slice(0, 3);
    if (c && c[3] > 0) { /* composite lên lớp dưới */ const under = _bg(n.parentElement); return c.slice(0,3).map((v,i)=> c[3]*v + (1-c[3])*under[i]); }
  }
  return [255, 255, 255];
};
const L = c => 0.2126*_lin(c[0]) + 0.7152*_lin(c[1]) + 0.0722*_lin(c[2]);
const C = (a, b) => { const [x,y] = [L(a),L(b)].sort((p,q)=>q-p); return +((x+0.05)/(y+0.05)).toFixed(2); };

// usage: C(_bg(el).map(...)→ fg vs nền) — đo text/fg vs bg, fill vs parent fill
// harmony check: |L(fill₁) − L(fill₂)| ≤ 0.05 cho cùng rail
```
