# Implementation Plan: Align src components to Design System showcase

## Overview

Component CSS trong `src/` đã lỗi thời so với `docs/design-system/design-system-showcase/` (source of truth). Task này update token system + từng component CSS cho khớp DS, song song token+component trong mỗi phase. Component nào DS không cover được → báo cáo cuối.

## Drift phát hiện (evidence-based)

### Token drift (theme.css vs showcase.html)

| Token | src hiện tại | DS quy định | File |
|-------|-------------|-------------|------|
| `--radius-md` | 8px | **18px** (pill) | theme.css:105 |
| `--radius-lg` | 12px | **10px** (card) | theme.css:106 |
| `--radius-xl` | missing | **12px** (dialog) | — |
| `--radius-2xl` | missing | **24px** | — |
| `--shadow-sm` | `0 1px 2px rgba(...)` | **none** (DS không có) | theme.css:110 |
| `--shadow-md` | `0 4px 12px rgba(...)` | **none** | theme.css:111 |
| `--shadow-lg` | missing | **none** | — |
| `--color-primary-active` | missing | dark #2563eb / light #1e40af | — |
| `--color-success-subtle` | missing | dark rgba(16,185,129,0.15) / light rgba(5,150,105,0.1) | — |
| `--color-warning-subtle` | light 0.1 (OK) | dark missing | — |
| `--color-error-subtle` | light 0.08 | DS: light **0.1** | theme.css:49 |
| `--leading-snug` | missing | 1.375 | — |

### Component drift (grep evidence)

| Loại | Số file | Vi phạm | DS chuẩn |
|------|---------|---------|----------|
| Focus via box-shadow | ~20 | `box-shadow: 0 0 0 2px...` | `outline: 2px solid var(--color-primary); outline-offset: 2px` |
| Elevation shadow | ~13 | `box-shadow: var(--shadow-md)` hoặc hardcoded | `none` + hairline border |
| Hardcoded border-radius | 19 | `border-radius: 8px` / `6px` / `12px` | `var(--radius-md/lg/xl)` |
| Hardcoded color fallback | ~174 | `var(--token, #fallback)` | fallback phải khớp DS value hoặc bỏ |

## Architecture Decisions

- **Token + component song song**: mỗi phase sửa token liên quan + component dùng token đó, verify xong mới phase tiếp.
- **Focus ring = outline, không box-shadow**: DS P2 quy định `outline: 2px solid var(--color-primary); outline-offset: 2px`. Box-shadow focus ring bị thay vì outline.
- **Elevation = none + border**: DS P1 quy định flat, hairline 1px border. Mọi `box-shadow` elevation → `none`.
- **Fallback color**: giữ `var(--token, fallback)` nhưng fallback phải khớp DS value. Không bỏ fallback (defensive cho trường hợp token chưa load).
- **50% border-radius**: legitimate cho circular (avatar, toggle knob, slider thumb) → `var(--radius-full)`, không phải drift.
- **2px border-radius**: legitimate cho slider track (sub-element) → giữ, không phải drift.

## Task List

### Phase 1: Token foundation + core form components
- [ ] Task 1: Fix theme.css tokens (radius, shadow, missing colors)
- [ ] Task 2: Button.module.css — radius var, focus outline, remove box-shadow
- [ ] Task 3: Input + Textarea — focus outline, radius var

### Checkpoint 1
- [ ] `npm run test:unit` pass
- [ ] `npm run typecheck` pass
- [ ] Button/Input/Textarea render đúng radius 18px, focus outline

### Phase 2: Rest of shared/ui form components
- [ ] Task 4: Select + SearchableSelect — focus outline, shadow none
- [ ] Task 5: Checkbox + Radio + Toggle — focus outline
- [ ] Task 6: Slider + ShortcutInput — shadow none, focus outline

### Checkpoint 2
- [ ] `npm run test:unit` pass

### Phase 3: shared/ui display/container components
- [ ] Task 7: Card — shadow none, radius var
- [ ] Task 8: Dialog + Drawer + BottomSheet — shadow none, radius var
- [ ] Task 9: Accordion + Tabs + NavItem + ListItem — focus outline
- [ ] Task 10: Badge + Alert + Tooltip + Header + HintIcon — shadow none, radius var
- [ ] Task 11: Progress + Spinner + Skeleton + EmptyState + Sidebar — shadow none

### Checkpoint 3
- [ ] `npm run test:unit` pass
- [ ] `npm run typecheck` pass

### Phase 4: Feature components part 1 (cardCreator + dictionary)
- [ ] Task 12: CardCreatorDialog + FieldRow + MediaList + PreviewBlock
- [ ] Task 13: DeleteConfirmModal + Dropzone + ImportProgress + ResourceCard + ResourcesPanel

### Checkpoint 4
- [ ] `npm run test:unit` pass

### Phase 5: Feature components part 2 (settings + theme + popup + options + sidepanel)
- [ ] Task 14: SettingsDialog + MultiSelect + CardCreatorSettingsPanel + NavClusterSettingsPanel
- [ ] Task 15: SubtitleBlockSettingsPanel + SubtitlePreview + SubtitleStylePanel
- [ ] Task 16: ThemePanel + ColorCustomization + ContrastBadges + ModeCards + ThemeImportExport + ThemePreview
- [ ] Task 17: App.redesigned + SelectionBar + Header + DownloadCard + MediaEmpty + SubtitleCard + VideoCard
- [ ] Task 18: OptionsApp + SidebarItem + sidepanel App + CueList

### Checkpoint 5
- [ ] `npm run test:unit` pass
- [ ] `npm run typecheck` pass
- [ ] `npm run lint` pass

### Phase 6: Final audit + report
- [ ] Task 19: Token audit — grep hardcode color/shadow/radius → MISSING = 0
- [ ] Task 20: Browser verify (dark + light) — mở showcase.html + extension popup
- [ ] Task 21: Báo cáo component src mà DS không cover được

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Radius 8→18px break visual button/input | High | Verify browser sau Phase 1, nếu quá tròn → discuss với Anh yêu |
| Focus outline thay box-shadow có thể bị cắt bởi overflow:hidden | Med | Test trên component có overflow:hidden (Dialog, Select menu) |
| Shadow none làm Dialog/Drawer mất depth | Med | Thêm hairline border 1px var(--color-border) thay shadow |
| Test snapshot CSS có thể fail | Low | Update snapshot nếu visual change intentional |

## Open Questions
- None (intent confirmed via interview-me)
