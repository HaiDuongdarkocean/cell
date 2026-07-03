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

### In (cite spec F1-F5, A1-A8)
- 4 atom/components: `Toggle`, `Slider`, `ShortcutInput` (shared/ui) + `SubtitlePreview` (features/settings/ui)
- 4 restyle spots: 3 toggles, 3 sliders, 5 shortcut inputs, 1 preview box
- Unit tests cho 4 atoms
- Integration: swap controls trong SettingsDialog + NavClusterSettingsPanel
- Browser verify (Edge MCP): dark + light mode, a11y, visual

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
| M5 | Integrate Toggle (3 spots) | F5.1, A1, A8 | data-testid preserved |
| M6 | Integrate Slider (3 spots) | F5.2, A2, A8 | snap logic preserved |
| M7 | Integrate ShortcutInput (5 spots) | F5.3, A3, A8 | data-testid preserved |
| M8 | Integrate SubtitlePreview | F5.4, A4 | realtime style apply |
| M9 | Verify: test:unit + tsc + lint + build | NF4, A6 | all pass |
| M10 | Browser verify (Edge MCP) | NF2, NF3, A5, A7 | dark + light + a11y |

## Risk Mitigation (cite spec Risks)

| Risk | Mitigation | M |
|---|---|---|
| Snap logic button size break | Slider atom chỉ emit value, snap ở parent `NavClusterSettingsPanel` | M2, M6 |
| SubtitlePreview style apply sai | Test render với mock `OverlayStyleConfig`, assert style props | M4 |
| Toggle a11y regression | Test assert `aria-pressed` reflect checked | M1 |
| Dark mode token sai | Browser verify Edge MCP dark + light, assert computed color | M10 |
| data-testid regression | Test assert data-testid preserved sau integration | M5-M7 |

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
| Add 4 atom/component files | `docs/2-architechture-system.md` (tree + dependency + function index) | `ls` |
| Add spec/plan | `docs/0-wiki.md` | read lại mục lục |
