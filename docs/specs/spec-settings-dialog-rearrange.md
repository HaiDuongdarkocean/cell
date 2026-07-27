# Spec — Settings Dialog Rearrange (UI/UX Improvement)

> **Phase**: G1 Spec
> **Input**: `docs/intent/intent-settings-dialog-rearrange.md` + `docs/mockups/mockup-settings-rearrange.html`
> **Output**: What to build — functional + non-functional + acceptance criteria

## Reference

- Mockup: `docs/mockups/mockup-settings-rearrange.html` (v2 — pair/indent/divider)
- Intent: `docs/intent/intent-settings-dialog-rearrange.md`
- Prior art: `docs/specs/spec-settings-controls-restyle.md` (atoms — Toggle/Slider/ShortcutInput/SubtitlePreview/SearchableSelect/HintIcon)
- ADR-013: 2 overlay layer độc lập (giữ nguyên — không merge)
- ADR-018: Nav cluster controller contract (settings schema v2 flat keys — `navClusterPosition` đã có trong type)

## Functional Requirements

### F1 — Media Selection: indent child field

**Current**: Auto select toggle + language multiselect stacked, no visual hierarchy.
**Required**: Language multiselect indented dưới Auto select toggle (child visual hierarchy).

- CSS class `.childField`: `margin-left: var(--space-lg); padding-left: var(--space-md); border-left: 2px solid var(--color-border-subtle);`
- Apply cho language multiselect field khi `settings.autoSelectEnabled === true`
- Conditional render giữ nguyên (chỉ hiện khi toggle ON)

### F2 — Subtitle Overlay: pair related fields + move Position/Reset up

**Current**: 19 fields stacked dọc, Position + Reset bị chôn cuối.
**Required**: Pair related fields side-by-side, move Position lên trên, Reset button trong panel.

#### F2.1 — Pair Target/Native language
- 2 SearchableSelect side-by-side trong `.pairRow` (grid 2 cols)
- Disable logic giữ nguyên (disabled khi `subtitleOverlayAutoLoad === false`)

#### F2.2 — Pair Text color + BG color
- 2 color inputs side-by-side trong `.pairRow`

#### F2.3 — Pair Text opacity + BG opacity
- 2 sliders side-by-side trong `.pairRow`

#### F2.4 — Pair Font size + Font family
- Slider (font size) + Select (font family) side-by-side trong `.pairRow`

#### F2.5 — Pair Horizontal align + Text shadow
- Đã có `.fieldRow` (current) — giữ nguyên, chỉ ensure styling consistent với `.pairRow` mới

#### F2.6 — Move Position (Y-offset) lên trên
- Hiện Position bị chôn cuối (sau Font family)
- Move lên trước Reset button (sau align/shadow pair)

#### F2.7 — Move Reset button vào panel (justify-end)
- Hiện Reset bị chôn cuối
- Move lên cuối panel, `justify-content: flex-end`
- Reset confirm dialog giữ nguyên

#### F2.8 — Dividers giữa groups
- Divider sau Overlay auto-load toggle
- Divider sau Target/Native language pair
- Divider trước Appearance tabs (optional — quyết định khi implement)

### F3 — Keyboard Shortcuts: 2-column grid

**Current**: 5 rows dọc, mỗi row 1 char input.
**Required**: 2-column grid, pair related actions.

- CSS class `.shortcutGrid`: `display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);`
- 5 fields trong grid:
  - Row 1: Previous cue | Next cue (navigation pair)
  - Row 2: Replay cue | Toggle overlay (action pair)
  - Row 3: Toggle panel (single, left column)
- Mỗi field giữ `.shortcutField` (horizontal: label + input space-between)
- `keyboard-cue` class giữ nguyên trên mỗi input

### F4 — Navigation Cluster: add Position control + group behavior/visual

**Current**: 4 fields (Enable + 3 sliders), thiếu Position control (BUG).
**Required**: Thêm Position select, group Enable+Position (behavior), sliders (visual).

#### F4.1 — Add Position select (BUG FIX)
- `navClusterPosition` đã có trong `NavClusterSettings` type (ADR-018)
- Expose CustomSelect với options: bottom-right, bottom-left, top-right, top-left
- Default: bottom-right
- onChange: `updateNavCluster({ position: val })`

#### F4.2 — Group behavior + visual with divider
- Behavior group: Enable cluster + Position
- Divider
- Visual group: Button size + BG opacity + Button opacity

### F5 — Download: dividers + hint next to field + Workers indent

**Current**: 6 fields stacked, hint orphaned ở cuối, Workers không indent.
**Required**: Dividers giữa groups, hint icon cạnh Parallel conversion, Workers indent.

#### F5.1 — Dividers giữa 4 groups
- Group 1 (concurrency): Downloads at once
- Divider
- Group 2 (format+quality): Preferred format + Default quality (pair)
- Divider
- Group 3 (conversion): Convert to MP4 + Parallel conversion + Workers (conditional)
- Divider
- Group 4 (filename): Filename source

#### F5.2 — Move hint icon cạnh Parallel conversion
- Hiện "Parallel conversion info" hint orphaned ở cuối section
- Move hint icon (`HintIcon`) vào label của "Parallel conversion" field
- Xóa orphaned hint field cuối section

#### F5.3 — Indent Workers dưới Parallel conversion
- Apply `.childField` cho Workers field
- Conditional render giữ nguyên (chỉ hiện khi `parallelConversion === 'manual'`)

#### F5.4 — Pair Preferred format + Default quality
- 2 CustomSelect side-by-side trong `.pairRow` (đã move từ Media section)

## Non-Functional Requirements

### NF1 — No data model change
- `Settings` type giữ nguyên
- `NavClusterSettings` type giữ nguyên (đã có `position` field)
- Không thêm migration

### NF2 — No content-script change
- Overlay rendering giữ nguyên (ADR-013)
- Nav cluster controller giữ nguyên (ADR-018)
- Chỉ UI layer thay đổi

### NF3 — No new dependency
- CSS-only solution (flexbox/grid)
- Không thêm library

### NF4 — Accessibility preserved
- Label htmlFor giữ nguyên
- aria-label giữ nguyên
- Keyboard navigation giữ nguyên
- HintIcon aria-label giữ nguyên

### NF5 — Tests preserved
- SettingsDialogShortcuts tests: update nếu structure thay đổi (shortcutGrid)
- SubtitleStylePanel tests: giữ nguyên (pair layout chỉ CSS)
- NavClusterSettingsPanel tests: update nếu thêm Position control
- Other tests: không affected

## Acceptance Criteria

### C1 — Media Selection
- [ ] Language multiselect indented dưới Auto select toggle (`.childField`)
- [ ] Conditional render giữ nguyên (chỉ hiện khi toggle ON)

### C2 — Subtitle Overlay
- [ ] Target/Native language side-by-side (`.pairRow`)
- [ ] Text color + BG color side-by-side
- [ ] Text opacity + BG opacity side-by-side
- [ ] Font size + Font family side-by-side
- [ ] Position (Y-offset) không bị chôn cuối (move lên trước Reset)
- [ ] Reset button trong panel, justify-end
- [ ] Dividers giữa groups

### C3 — Keyboard Shortcuts
- [ ] 5 fields trong 2-column grid (`.shortcutGrid`)
- [ ] Previous/Next pair row 1
- [ ] Replay/Toggle-overlay pair row 2
- [ ] Toggle panel row 3 (left column)
- [ ] `keyboard-cue` class trên mỗi input

### C4 — Navigation Cluster
- [ ] Position select hiện trong panel (BUG FIX)
- [ ] Position select onChange gọi `updateNavCluster({ position: val })`
- [ ] Behavior group (Enable + Position) + divider + Visual group (3 sliders)

### C5 — Download
- [ ] Dividers giữa 4 groups
- [ ] Hint icon cạnh "Parallel conversion" label (không orphaned)
- [ ] Workers indent (`.childField`) dưới Parallel conversion
- [ ] Preferred format + Default quality side-by-side (`.pairRow`)

### C6 — Cross-cutting
- [ ] TypeScript pass (`npx tsc --noEmit`)
- [ ] Build pass (`npm run build`)
- [ ] SettingsDialog tests pass
- [ ] Browser verify (Edge MCP) — layout đúng mockup v2

## Out of Scope

- Merge Target/Native (user confirmed "không merge nữa")
- Thay đổi atoms (Toggle/Slider/ShortcutInput/SearchableSelect/HintIcon/SubtitlePreview)
- Thay đổi sidebar navigation
- Thay đổi content-script / overlay rendering
- Thay đổi data model

## Risks

| Risk | Mitigation |
|---|---|
| SubtitleStylePanel tests break do pair layout | Tests dùng `getByLabelText` — không phụ thuộc layout, chỉ cần label còn tồn tại |
| NavClusterSettingsPanel tests break do thêm Position | Update test để query Position select |
| `.pairRow` grid break trên narrow width (480px popup) | Mockup verify trên 480px trước implement |
| Color input width trong pair row quá narrow | Min-width 120px per field, verify mockup |
