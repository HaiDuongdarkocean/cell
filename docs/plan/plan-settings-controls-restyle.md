# Plan: Settings Controls Restyle

> **Giai đoạn**: G2 Planning (output planning-and-task-breakdown high-level)
> **Status**: Draft — auto-proceed
> **Date**: 2026-07-04
> **Spec source**: `docs/specs/spec-settings-controls-restyle.md`
> **Intent source**: `docs/intent/intent-settings-controls-restyle.md`
> **Mockup source**: `docs/mockups/mockup-settings-grouped.html`

## Approach

**Bottom-up**: build 4 atoms/components trước (testable độc lập) → integrate vào SettingsDialog + NavClusterSettingsPanel (preserve data-testid + handlers). Mỗi atom = 1 commit atomic (code + test + 2-arch update).

### Why bottom-up
- Atoms reusable, testable độc lập (unit test không cần parent context)
- Integration step chỉ là "swap IconButton → Toggle", "swap native range → Slider" — minimal diff, dễ review
- Nếu atom fail test → fix ngay, không chạm parent

## Scope

### In (cite spec F1-F7, A1-A10)
- 6 atom/components: `Toggle`, `Slider`, `ShortcutInput`, `SearchableSelect`, `HintIcon` (shared/ui) + `SubtitlePreview` (features/settings/ui)
- 6 restyle spots: 3 toggles, 3 sliders, 5 shortcut inputs, 1 preview box, 2 searchable selects, 6 hint icons
- Unit tests cho 6 atoms
- Integration: swap controls trong SettingsDialog + NavClusterSettingsPanel + SubtitleStylePanel
- Browser verify (Edge MCP): dark + light mode, a11y, visual, boundary detection

### Out (cite spec "Out of Scope")
- Không thêm/sửa setting key
- Không đổi storage schema
- Không đổi SubtitleStylePanel/MultiSelect/CustomSelect/IconButton

## Milestones (high-level — task breakdown chi tiết ở G4)

| M | Deliverable | Spec ref | Verify |
|---|---|---|---|
| M1 | `Toggle` atom + test | F1, A1 | unit test pass |
| M2 | `Slider` atom + test | F2, A2 | unit test pass |
| M3 | `ShortcutInput` atom + test | F3, A3 | unit test pass |
| M4 | `SubtitlePreview` component + test | F4, A4 | unit test pass |
| M5 | `SearchableSelect` atom + test | F5, A5 | unit test pass |
| M6 | `HintIcon` atom + test | F6, A6 | unit test pass |
| M7 | Integrate Toggle (3 spots) | F7.1, A1, A10 | data-testid preserved |
| M8 | Integrate Slider (3 spots) | F7.2, A2, A10 | snap logic preserved |
| M9 | Integrate ShortcutInput (5 spots) | F7.3, A3, A10 | data-testid preserved |
| M10 | Integrate SubtitlePreview | F7.4, A4 | realtime style apply |
| M11 | Integrate SearchableSelect (2 spots) | F7.5, A5, A10 | language selects |
| M12 | Integrate HintIcon (6 spots) | F7.6, A6, A10 | hint popovers |
| M13 | Update 2-arch (add 6 files) | update protocol | ls verify |
| M14 | Verify: test:unit + tsc + lint + build | NF4, A8 | all pass |
| M15 | Browser verify (Edge MCP) | NF2, NF3, NF7, A7, A9 | dark + light + a11y + boundary |

## Risk Mitigation (cite spec Risks)

| Risk | Mitigation | M |
|---|---|---|
| Snap logic button size break | Slider atom chỉ emit value, snap ở parent `NavClusterSettingsPanel` | M2, M8 |
| SubtitlePreview style apply sai | Test render với mock `OverlayStyleConfig`, assert style props | M4 |
| Toggle a11y regression | Test assert `aria-pressed` reflect checked | M1 |
| SearchableSelect filter logic bug | Reuse MultiSelect filter function (proven), test filter case-insensitive | M5 |
| HintIcon boundary detection fail | Test getBoundingClientRect logic, verify flip-top/align-right/align-center classes | M6 |
| Dark mode token sai | Browser verify Edge MCP dark + light, assert computed color cho tất cả atoms | M15 |
| data-testid regression | Test assert data-testid preserved sau integration | M7-M12 |

## Tech Decisions

- **No ADR** — UI implementation detail, không phải architecture decision. ADR-013 (overlay style) + ADR-018 (nav cluster) đã cover.
- **CSS Modules** — colocate `.module.css` với `.tsx`, tokens từ `theme.css`.
- **Native elements** — `<button>` cho toggle, `<input type="range">` cho slider, `<input type="text">` cho shortcut. Ponytail rung 4 (native platform).
- **No new dep** — ponytail rung 5.

## Commands

```bash
Test unit:   npm run test:unit
Typecheck:   npx tsc --noEmit
Lint:        npm run lint
Build:       npm run build
```

## Update Protocol

| Change | File | Verify |
|---|---|---|
| Add 6 atom/component files | `docs/2-architechture-system.md` (tree + dependency + function index) | `ls` |
| Add spec/plan | `docs/0-wiki.md` | read lại mục lục |
