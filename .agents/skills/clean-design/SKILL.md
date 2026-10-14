---
name: clean-design
description: Design or fix UI by running the B0–B7 decision workflow — goal, content, consequence, anatomy, spec, prototype, behavior, audit — where every value traces to tokens.json or a documented law. Use when creating, redesigning, specifying, or auditing screens, components, dialogs, or layouts. Not for code-level token/M3 audits (→ design-system-guardian) or multi-concept pipeline mockups (→ pipeline-design).
---

# Clean Design

**"Đẹp" ở đây = đo được.** Mỗi quyết định design trả lời được "vì sao" bằng một nguồn: token, component đo được, hoặc luật đã ghi. Không có con số "vì nhìn đẹp".

## Định lý bất biến

> **Spacing là quan hệ.** Proximity là cơ chế hierarchy đầu tiên — phân tầng bằng khoảng trắng trước, viền/màu/trang trí sau.
> Ladder bắt buộc đọc được: `atom-internal < component-internal < same-group < between-groups < section < page frame`.
> Con số ngoài → trong phải lớn hơn con số trong → ngoài. Không đọc được ladder từ con số = design chưa xong.

→ Toàn bộ luật WHY: `knowledge/why/philosophy.md`.

## Hai mode

| Mode | Khi nào | Đường đi |
|---|---|---|
| **CREATE** | UI mới / redesign | B0→B7 tuần tự; spec sheet ra trước code |
| **FIX** | UI "xấu" / lệch chuẩn | Chạy `knowledge/ops/audit.md` trên UI hiện tại → mỗi dòng fail trỏ về đúng bước B bị phá → quay lại bước đó, sửa ở gốc |

## Workflow B0–B7

| # | Bước | Trọng số | Actions | Guard (pass để đi tiếp) | Loop-back |
|---|---|---|---|---|---|
| B0 | **Goal** | 25% | Viết goal của user bằng 1 câu (journey scope, không phải UI scope) | Câu goal nói được user *đạt được gì*, không chứa tên component | Nói không ra → hỏi user |
| B1 | **Content** | 15% | Inventory: slot, loại content, worst-case length, states (empty/error/loading), localization | Mọi slot có content + worst case; KHÔNG chọn layout trước bước này | Content thiếu → hỏi user; thấy goal sai → B0 |
| B2 | **Consequence** | 13% | Consequence Triad cho mỗi action (irreversibility/risk/attention 0–3) → component class + variant | Mỗi action có score + variant tương xứng (bảng `method/behavior.md`) | Không score được → đọc lại content |
| B3 | **Anatomy** | 12% | Phân rã anatomy → map từng atom vào `src/shared/ui/`; theo composition ladder tokens→components→layouts→pages | Mọi atom map được component, hoặc có justification theo `ops/lifecycle.md` | Component thiếu → contribution contract, không ad-hoc |
| B4 | **Spec** | 12% | Spec sheet: Q1–Q4 cho từng atom, gán token, ghi provenance | Mọi con số có source (token / measured / decision+law) | Số không truy nguồn → bỏ hoặc ghi decision |
| B5 | **Prototype** | 10% | Build trong `design-system-showcase`, verify 320/768/1280, light+dark | Tick được ☐ trong spec sheet | Fail giá trị → B4; fail ý nghĩa/variant → B2 |
| B6 | **Behavior** | 7% | Đủ states (rest/hover/focus/pressed/disabled/loading/error/empty), keyboard, a11y contract | Không state nào "tàng hình" | Thiếu → sửa component, không vá feature |
| B7 | **Audit + ghi lại** | 6% | Audit commands + checklist `ops/audit.md`; distill rule mới vào knowledge file | 0 violation + mọi tick ☐ | Violation → về bước sở hữu nó |

Trọng số = chỉ dẫn phân bổ effort, không phải luật. B0–B1 ở journey scope; B2 trở đi per-surface.

## Q1–Q4 — thiết kế một atom

Mỗi atom trong anatomy đi qua đúng 4 câu hỏi, theo thứ tự:

1. **Concept?** — hình thức của space: inset / inset-squish / inset-stretch / stack / inline / grid (`foundations/spacing.md`)
2. **Quan hệ?** — nó gần ai, xa ai → tier nào trong ladder
3. **Kích thước?** — height ladder / target size (tách visual size khỏi hit size)
4. **Token?** — map vào scale trong `tokens.json`, không hardcode

Atom không trả lời được Q2 = chưa hiểu quan hệ → quay B1.

## Lookup chain — con số lấy từ đâu (bắt buộc theo thứ tự)

```
① tokens.json (component-token layer: dialog.padding, button.*, size-element-*)
② Component code thật — đo trong *.module.css → ghi "measured"
③ Decision ladder trong knowledge/ → ghi "decision: <luật>"
```

Con số không qua được chuỗi này = không được vào spec.

## Golden guards — vi phạm = fail, không đàm phán

- Không M3 token (`--md-sys-*`), không glass/blur/backdrop-filter (đã loại 2026-09-08).
- Không hardcode hex/px/radius/z-index — mọi giá trị qua `tokens.json` (thiếu → thêm vào đó).
- Không ad-hoc component — mọi element map `src/shared/ui/*`; thiếu → `ops/lifecycle.md` contract.
- Close/dismiss luôn `variant="ghost"` — close không phải primary action.
- 1 primary action tối đa mỗi view (L-SCARCITY).
- Border chỉ khi mang thông tin (outline variant, state, affordance, separator, a11y mode) — còn lại tonal (L-BORDER).
- Gap trên parent flex/grid, không sibling margin chains.
- Content-driven: anatomy + token sau khi content inventory xong — không design rồi nhét chữ.

## Knowledge menu

Đọc file đúng lúc, không đọc hết:

| File | Đọc khi |
|---|---|
| `knowledge/why/philosophy.md` | Cần biện minh quyết định; bị challenge "vì sao" |
| `knowledge/method/content.md` | B0–B1: goal + content inventory |
| `knowledge/method/anatomy.md` | B3: phân rã + map component |
| `knowledge/method/spec-sheet.md` | B4: viết spec đo được |
| `knowledge/method/behavior.md` | B2+B6: triad, variant, states, a11y |
| `knowledge/foundations/{color,typography,spacing,shape,motion,icons,responsive}.md` | B4: gán token theo family |
| `knowledge/ops/audit.md` | B7 + mode FIX: rubric + audit commands |
| `knowledge/ops/lifecycle.md` | Thêm/sửa public component, token, pattern |
| `knowledge/examples/delete-account-journey.md` | Cần worked example đầy đủ |

Giá trị số luôn tra `src/shared/styles/tokens.json` — skill chỉ ghi *khi nào dùng*, không copy giá trị. Xung đột skill vs tokens.json → tokens.json thắng, báo user sửa skill.

## Verification

- [ ] Spec sheet tồn tại trước code; mọi con số có provenance
- [ ] Ladder đọc được từ con số (outer > inner)
- [ ] Audit commands trong `ops/audit.md` = 0 violation
- [ ] Verify 320 + 1280, light + dark, zoom 200%
- [ ] Mọi state trong B6 hiển thị được
- [ ] Rule mới học được → ghi vào đúng knowledge file (skill là living doc — cập nhật tay)

## Router boomerang

Task đổi hoặc không rõ skill nào? → `using-agent-skills`. Code-level audit trước merge → `design-system-guardian`. Concept mockup trong pipeline → `pipeline-design`. Implement sau spec → `pipeline-deliver` / `source-driven-development`.
