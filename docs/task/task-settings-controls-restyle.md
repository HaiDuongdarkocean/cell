# Task: Settings Controls Restyle

> **Giai đoạn**: G4 Implementation (task breakdown chi tiết)
> **Date**: 2026-07-04
> **Plan source**: `docs/plan/plan-settings-controls-restyle.md`
> **Spec source**: `docs/specs/spec-settings-controls-restyle.md`

## Tasks (atomic commits)

### T1: Toggle atom + test (M1, spec F1, A1)
- [ ] `src/shared/ui/Toggle.tsx` — switch pill 32×18px, thumb slide, aria-pressed
- [ ] `src/shared/ui/Toggle.module.css` — pill bg, thumb translateX, focus-visible
- [ ] `src/shared/ui/Toggle.test.tsx` — render, click toggle, aria-pressed, focus
- [ ] Verify: `npm run test:unit -- --testPathPatterns=Toggle`

### T2: Slider atom + test (M2, spec F2, A2)
- [ ] `src/shared/ui/Slider.tsx` — styled range, emit value
- [ ] `src/shared/ui/Slider.module.css` — 4px track, 14px thumb primary + white border
- [ ] `src/shared/ui/Slider.test.tsx` — render, change value, aria-label, focus
- [ ] Verify: `npm run test:unit -- --testPathPatterns=Slider`

### T3: ShortcutInput atom + test (M3, spec F3, A3)
- [ ] `src/shared/ui/ShortcutInput.tsx` — uppercase + center + maxLength 1 + normalize
- [ ] `src/shared/ui/ShortcutInput.module.css` — semibold + center + radius-sm
- [ ] `src/shared/ui/ShortcutInput.test.tsx` — render, type char, normalize lowercase
- [ ] Verify: `npm run test:unit -- --testPathPatterns=ShortcutInput`

### T4: SubtitlePreview component + test (M4, spec F4, A4)
- [ ] `src/features/settings/ui/SubtitlePreview.tsx` — black bg + apply OverlayStyleConfig
- [ ] `src/features/settings/ui/SubtitlePreview.module.css` — black bg + white text + center
- [ ] `src/features/settings/ui/SubtitlePreview.test.tsx` — render, apply style props
- [ ] Verify: `npm run test:unit -- --testPathPatterns=SubtitlePreview`

### T5: Integrate Toggle (M5, spec F5.1, A1, A8)
- [ ] `SettingsDialog.tsx`: 2 toggles (auto-select, overlay auto-load) → Toggle atom
- [ ] `NavClusterSettingsPanel.tsx`: 1 toggle (enable) → Toggle atom
- [ ] Preserve data-testid `nav-cluster-enabled-toggle`
- [ ] Verify: existing SettingsDialogShortcuts test still pass

### T6: Integrate Slider (M6, spec F5.2, A2, A8)
- [ ] `NavClusterSettingsPanel.tsx`: 3 sliders → Slider atom
- [ ] Preserve snap logic (button size 40/48/56) ở parent
- [ ] Preserve data-testid `nav-cluster-button-size/bg-opacity/button-opacity`
- [ ] Verify: NavClusterSettingsPanel test still pass

### T7: Integrate ShortcutInput (M7, spec F5.3, A3, A8)
- [ ] `SettingsDialog.tsx`: 5 shortcut inputs → ShortcutInput atom
- [ ] Preserve data-testid `shortcut-*`
- [ ] Verify: SettingsDialogShortcuts test still pass

### T8: Integrate SubtitlePreview (M8, spec F5.4, A4)
- [ ] `SettingsDialog.tsx`: add SubtitlePreview trong appearance field (above SubtitleStylePanel)
- [ ] Pass current style + role (target/native) từ styleTab state
- [ ] Verify: visual

### T9: Update 2-arch (M9, update protocol)
- [ ] `docs/2-architechture-system.md`: add 4 files (tree + dependency + function index)
- [ ] Verify: `ls` 4 files exist

### T10: Final verify (M9-M10, spec NF4, A6, A7)
- [ ] `npm run test:unit` — all pass
- [ ] `npx tsc --noEmit` — pass
- [ ] `npm run lint` — no new errors
- [ ] `npm run build` — pass
- [ ] Browser verify (Edge MCP): dark + light, 3 toggle + 3 slider + 5 shortcut + 1 preview, a11y
