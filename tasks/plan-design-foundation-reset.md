# Plan — Design Foundation Reset (2026-09-08)

> Goal anh: design system có cơ sở lý thuyết rõ (DESIGN_RATIONALE.md làm tầng WHY), dark mode về canvas trung tính kiểu YouTube, loại Liquid Glass hoàn toàn.
> Đã xong trước plan này: xóa 4 doc glass, scrub DESIGN.md/STANDARD.md/ROADMAP.md, tạo DESIGN_RATIONALE.md.

## Phạm vi & AC

### Phase A — Dark mode về canvas trung tính (L-CANVAS / L-HOST)
- [ ] `tokens.json` base `core.dark`: bg `#0F0F0F`, surface `#212121`, border `#303030`, text `#F1F1F1`, textSecondary `#AAAAAA`
- [ ] 4 preset `core.dark`: canvas chung (cùng giá trị trên); giữ accent `primary` riêng từng preset
- [ ] `derived.dark` base: bỏ `color-mix(primary)` khỏi background-elevated/muted, surface-elevated/hover/pressed, border-subtle/emphasized → luminance ladder thuần
- [ ] `tokens.ts` line ~152: `primary-subtle` dark alpha 0.15 → 0.12
- [ ] Preset `derived.dark`: `primary-subtle` alpha 0.16–0.18 → 0.12; `primary-foreground`/soft về `#0F0F0F`
- [ ] Regen `node scripts/generate-tokens.js`
- [ ] MIGRATION note (tạo `docs/design-system/MIGRATION.md` nếu chưa có) — token semantics change
- [ ] AC: theme tests pass, tsc pass, build pass

### Phase B — Xóa Liquid Glass khỏi code (1124 refs)
- [ ] Inventory consumers `src/` (loại `data/extension/uBOLite` third-party)
- [ ] Slice 1: xóa `Button variant='glass'` + `material='liquid'` + `ButtonGlassFilter.ts`
- [ ] Slice 2: migrate component CSS dùng `--color-glass-*`/`--color-liquid-*`/`--shadow-liquid-*` sang solid tokens
- [ ] Slice 3: xóa families khỏi `tokens.json` + regen + cập nhật MIGRATION.md (breaking)
- [ ] Slice 4: showcase pages glass → bỏ hoặc thay
- [ ] AC: grep `--color-glass-|--color-liquid-|--color-button-liquid-|--shadow-liquid` trong `src/` = 0 (trừ MIGRATION note)

### Phase C — Supersede note lên docs lịch sử dính glass
- [ ] ~20 files (briefs/specs/ADR/wiki/mockups) prepended note chuẩn

### Phase R — Refine
- [ ] Changelog DESIGN_RATIONALE.md; learning extraction nếu có nguyên lý tái dùng

## Dependencies
A trước B (B phải regen tokens.css; A chạm cùng file) → C song song được → R cuối.
