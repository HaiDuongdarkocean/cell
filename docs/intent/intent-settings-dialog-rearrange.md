# Intent — Settings Dialog Rearrange (UI/UX Improvement)

> **Phase**: G0 Discovery
> **Status**: Confirmed (interviewed via section-by-section analysis)
> **Feasibility go/no-go**: ✅ GO — pure UI rearrange, no data model change, no API change, no content-script touch

## What user wants

Settings Dialog hiện tại có 5 sections (Media, Overlay, Shortcuts, Nav Cluster, Download) với layout "grouped cards" (Option 1) đã OK, **nhưng nội dung bên trong từng section sắp xếp không logic, lộn xộn**. User muốn rearrange fields trong từng section để:

1. **Tối giản** — không lãng space, không stacked dọc không cần thiết
2. **Đẹp mắt** — visual hierarchy rõ, related fields gần nhau
3. **Sắp xếp rõ ràng** — group by concern, pair related fields, dividers giữa groups

## Why now

Sau khi move Preferred format + Default quality từ Media Selection sang Download (commit trước), user nhận ra các section khác cũng cần rearrange tương tự. Đây là follow-up cleanup để thống nhất UX toàn dialog.

## Scope (5 sections, priority order)

### 🔴 High priority

**S2 — Subtitle Overlay (19 fields, lộn xộn nhất)**
- Pair Target/Native language (side-by-side, hiện stacked dọc)
- Pair Text color + BG color (cùng "color")
- Pair Text opacity + BG opacity (cùng "opacity")
- Pair Font size + Font family (cùng "font")
- Move Position (Y-offset) lên trên (hiện bị chôn cuối)
- Move Reset button vào panel (dễ tìm, hiện chôn cuối)

**S4 — Navigation Cluster (4 fields, BUG: thiếu Position)**
- Thêm Position select (`navClusterPosition` có trong settings type nhưng không expose trong UI)
- Group Enable + Position (behavior), sliders (visual)

### 🟡 Medium priority

**S5 — Download (6 fields, orphaned hint)**
- Move "Parallel conversion info" hint icon cạnh field "Parallel conversion" (hiện orphaned ở cuối)
- Thêm dividers giữa 3 nhóm: concurrency / format+quality / conversion / filename
- Indent Workers dưới parent Parallel conversion (dependency pattern đã có)

### 🟢 Low priority

**S1 — Media Selection (2 fields, đã clean sau move)**
- Indent language multiselect dưới Auto select toggle (visual hierarchy: child of toggle)

**S3 — Keyboard Shortcuts (5 fields, có thể compact hơn)**
- 2-column grid thay vì 5 rows dọc
- Pair prev/next (navigation), replay/toggle-overlay (actions)

## Out of scope

- ❌ Merge Target/Native (user đã confirm "không merge nữa" — ADR-013 giữ nguyên 2 layer độc lập)
- ❌ Thay đổi data model (Settings type giữ nguyên)
- ❌ Thay đổi content-script / overlay rendering
- ❌ Thay đổi atom components (Toggle, Slider, ShortcutInput, SearchableSelect, HintIcon — đã restyle xong)
- ❌ Thay đổi sidebar navigation

## Assumptions

1. `navClusterPosition` đã có trong `NavClusterSettings` type và persisted trong storage — chỉ cần expose UI control
2. CSS modules hiện tại đủ expressiveness cho pair/grid layouts (flexbox/grid)
3. Không cần ADR mới vì không có architecture decision (pure UI rearrange) — chỉ update `docs/design-system/design-system.md` nếu có pattern mới
4. Tests hiện tại (SettingsDialogShortcuts) sẽ cần update nếu thay đổi structure shortcuts section

## Constraints

- Browser-facing change → phải verify real Edge/Chrome (MCP) trước commit
- Không break existing tests (SettingsDialogShortcuts, SubtitleStylePanel, NavClusterSettingsPanel)
- Atomic commits: code ≠ docs (2 commit nếu touch cả 2)
- Ponytail: prefer CSS-only solution, không thêm dependency, không refactor không cần thiết

## Success criteria

- [ ] 5 sections rearrange theo đề xuất
- [ ] Nav Cluster có Position control (bug fix)
- [ ] Download hint không còn orphaned
- [ ] Visual hierarchy rõ (pair, indent, divider)
- [ ] TypeScript pass
- [ ] Build pass
- [ ] SettingsDialog tests pass
- [ ] Browser verify (MCP) — layout đúng đề xuất
