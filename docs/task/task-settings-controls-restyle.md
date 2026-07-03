# Task: Settings Controls Restyle

> **Giai đoạn**: G4 Implementation (task breakdown chi tiết)
> **Date**: 2026-07-04
> **Plan source**: `docs/plan/plan-settings-controls-restyle.md`
> **Spec source**: `docs/specs/spec-settings-controls-restyle.md`

## Tasks (atomic commits)

### T1: Toggle atom + test (M1, spec F1, A1)
- [ ] `src/shared/ui/Toggle.tsx` — switch pill 32×18px, thumb slide, aria-pressed, light/dark tokens
- [ ] `src/shared/ui/Toggle.module.css` — pill bg (--color-border/--color-primary), thumb translateX, focus-visible
- [ ] `src/shared/ui/Toggle.test.tsx` — render, click toggle, aria-pressed, focus, light/dark mode
- [ ] Verify: `npm run test:unit -- --testPathPatterns=Toggle`

### T2: Slider atom + test (M2, spec F2, A2)
- [ ] `src/shared/ui/Slider.tsx` — styled range, emit value
- [ ] `src/shared/ui/Slider.module.css` — 4px track, 14px thumb --color-primary + white border, light/dark tokens
- [ ] `src/shared/ui/Slider.test.tsx` — render, change value, aria-label, focus
- [ ] Verify: `npm run test:unit -- --testPathPatterns=Slider`

### T3: ShortcutInput atom + test (M3, spec F3, A3)
- [ ] `src/shared/ui/ShortcutInput.tsx` — uppercase + center + maxLength 1 + normalize
- [ ] `src/shared/ui/ShortcutInput.module.css` — semibold + center + radius-sm, light/dark tokens
- [ ] `src/shared/ui/ShortcutInput.test.tsx` — render, type char, normalize lowercase
- [ ] Verify: `npm run test:unit -- --testPathPatterns=ShortcutInput`

### T4: SubtitlePreview component + test (M4, spec F4, A4)
- [ ] `src/features/settings/ui/SubtitlePreview.tsx` — black bg + apply OverlayStyleConfig
- [ ] `src/features/settings/ui/SubtitlePreview.module.css` — black bg + white text + center
- [ ] `src/features/settings/ui/SubtitlePreview.test.tsx` — render, apply style props
- [ ] Verify: `npm run test:unit -- --testPathPatterns=SubtitlePreview`

### T5: SearchableSelect atom + test (M5, spec F5, A5)
- [ ] `src/shared/ui/SearchableSelect.tsx` — single-select dropdown + embedded search, filter case-insensitive, arrow key nav, check mark
- [ ] `src/shared/ui/SearchableSelect.module.css` — trigger/menu/search styling, light/dark tokens (--color-surface, --color-border, --color-primary-subtle)
- [ ] `src/shared/ui/SearchableSelect.test.tsx` — render, open menu, type filter, arrow nav, select, close, empty state
- [ ] Verify: `npm run test:unit -- --testPathPatterns=SearchableSelect`

### T6: HintIcon atom + test (M6, spec F6, A6)
- [ ] `src/shared/ui/HintIcon.tsx` — info-circle button + floating popover, boundary detection (getBoundingClientRect), click outside dismiss, Esc dismiss
- [ ] `src/shared/ui/HintIcon.module.css` — icon (--color-text-muted/--color-primary), popover (--color-surface-hover, --color-border, --color-text), flip-top/align-right/align-center variants, light/dark tokens
- [ ] `src/shared/ui/HintIcon.test.tsx` — render, click toggle, boundary detection classes, click outside dismiss, Esc dismiss, a11y
- [ ] Verify: `npm run test:unit -- --testPathPatterns=HintIcon`

### T7: Integrate Toggle (M7, spec F7.1, A1, A10)
- [ ] `SettingsDialog.tsx`: 2 toggles (auto-select, overlay auto-load) → Toggle atom
- [ ] `NavClusterSettingsPanel.tsx`: 1 toggle (enable) → Toggle atom
- [ ] Preserve data-testid `nav-cluster-enabled-toggle`
- [ ] Verify: existing SettingsDialogShortcuts test still pass

### T8: Integrate Slider (M8, spec F7.2, A2, A10)
- [ ] `NavClusterSettingsPanel.tsx`: 3 sliders → Slider atom
- [ ] Preserve snap logic (button size 40/48/56) ở parent
- [ ] Preserve data-testid `nav-cluster-button-size/bg-opacity/button-opacity`
- [ ] Verify: NavClusterSettingsPanel test still pass

### T9: Integrate ShortcutInput (M9, spec F7.3, A3, A10)
- [ ] `SettingsDialog.tsx`: 5 shortcut inputs → ShortcutInput atom
- [ ] Preserve data-testid `shortcut-*`
- [ ] Verify: SettingsDialogShortcuts test still pass

### T10: Integrate SubtitlePreview (M10, spec F7.4, A4)
- [ ] `SettingsDialog.tsx`: add SubtitlePreview trong appearance field (above SubtitleStylePanel)
- [ ] Pass current style + role (target/native) từ styleTab state
- [ ] Verify: visual

### T11: Integrate SearchableSelect (M11, spec F7.5, A5, A10)
- [ ] `SettingsDialog.tsx`: 2 language selects (overlay target/native) → SearchableSelect atom
- [ ] Preserve onChange handlers + settings keys
- [ ] Verify: visual + filter works

### T12: Integrate HintIcon (M12, spec F7.6, A6, A10)
- [ ] `SettingsDialog.tsx`: 4 hint locations → HintIcon atom (replace `<p class="asHint">` / `<p class="hint">`)
- [ ] `SubtitleStylePanel.tsx`: 2 hint locations → HintIcon atom
- [ ] Verify: visual + boundary detection + click outside dismiss

### T13: Update 2-arch (M13, update protocol)
- [ ] `docs/2-architechture-system.md`: add 6 files (tree + dependency + function index)
- [ ] Verify: `ls` 6 files exist

### T14: Final verify (M14, spec NF4, A8)
- [ ] `npm run test:unit` — all pass
- [ ] `npx tsc --noEmit` — pass
- [ ] `npm run lint` — no new errors
- [ ] `npm run build` — pass

### T15: Browser verify (M15, spec NF2, NF3, NF7, A7, A9)
- [ ] Edge MCP: open settings popup, toggle dark/light mode
- [ ] Verify: 3 toggle + 3 slider + 5 shortcut + 1 preview + 2 searchable-select + 6 hint-icon render đúng
- [ ] Verify: light/dark mode tokens correct (assert computed color)
- [ ] Verify: a11y (keyboard nav, focus-visible, aria attributes)
- [ ] Verify: HintIcon boundary detection (resize window, test edge cases)
