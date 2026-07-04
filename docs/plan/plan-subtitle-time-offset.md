# Implementation Plan: Subtitle Time Offset (V1)

> G2 plan. Input: `docs/specs/spec-subtitle-time-offset.md` (revised 2026-07-04) + `docs/mockups/mockup-subtitle-time-offset.html` (v2.2 approved) + `docs/reviews/review-subtitle-time-offset.md` (APPROVED).
> Task breakdown chi tiết chạy ở G4 đầu (sau Spec+Plan+ADR). Đây là implementation plan high-level: approach, risk mitigation, milestones.
> **Delta approach**: phần lớn code đã tồn tại (logic, panel, type, tests) — plan tập trung cleanup C2 artifacts + wire call sites + bổ sung badge/keyboard/persist/migration.

## Overview

Build V1 Manual Offset Management — 6 control (4 button ±0.5s/±2s, input giây, reset) + lazy try-before-buy (**apply all ngay, chưa persist** — C2 dropped, không window constraint; timer 2 phút wall-clock, auto-commit + persist per-URL). Apply offset at search level (`currentTimeMs + offsetMs`), không mutate `SrtCue`. Separate `OffsetController` follow `NavClusterController` pattern.

**Lazy semantics (revised)**: bấm offset → apply all ngay (overlay dịch, mode=lazy, badge "Xem thử · MM:SS" đếm ngược 2 phút). 2 phút không action với 6 control → auto-commit + persist. Reset = value=0 (vẫn lazy, timer reset). Load sub mới → cancel lazy + reset.

## Architecture Decisions (cite spec AD1-AD6)

- **AD1-revised**: offset at search level — `offsetMs` param **đã tồn tại** trong `findCurrentLine` (default 0). TODO G4 = wire 5 call sites truyền `offsetController.valueMs`. Không per-cue effective (C2 dropped). Perf: O(log n) per timeupdate, không O(n) rebuild.
- **AD2**: separate `OffsetController` + `subtitleOffsetPanel.ts` (đã có) + `subtitleOffsetBadge.ts` (chưa có), wire trong `contentScriptController.ts` sau `SubtitleOverlayController`.
- **AD3**: persist `Settings.subtitleOffset?: Record<string, number>` (URL → ms) — type `Record<string, number>`, KHÔNG nested như `subtitlePreference`. Schema migration v2→v3, default `{}`, không rollback (additive).
- **AD4**: lazy timer wall-clock (`Date.now()` + `lastActionAt`) + check trên `timeupdate`/`visibilitychange`, không `setTimeout`. Lazy = apply all, chưa persist.
- **AD5**: UI giây, internal ms, convert ở boundary (`parseOffsetInput`, `formatOffsetDisplay`).
- **AD6**: bilingual 1 offset chung.

## Implementation Status (cite spec section cùng tên — verified 2026-07-04)

### Đã có (cleanup + wire, không code lại)
- `subtitleOffset.ts` — `OffsetState`, `parseOffsetInput`, `clampOffsetMs`, `effectiveTime`, `formatOffsetDisplay`, `shouldAutoCommit`, `INITIAL_OFFSET_STATE`, `AUTO_COMMIT_MS`. **Cleanup**: xóa `anchorMs`, `isInLazyWindow`, `LAZY_WINDOW_MS` (C2 artifacts).
- `subtitleOffsetPanel.ts` — panel DOM factory (26 offset refs). **Wire** vào controller + browser verify mockup.
- `entities/settings/types.ts:145` — `subtitleOffset?: Record<string, number>` (đúng type).
- `subtitleSync.ts:13` — `findCurrentLine(lines, currentTime, offsetMs=0)` param đã có.
- `tests/.../subtitleOffset.test.ts` + `subtitleOffsetPanel.test.ts` — đã có. **Cleanup**: xóa test `isInLazyWindow`/`anchorMs`, thêm `shouldAutoCommit` edge cases.

### Chưa có (code mới ở G4)
- Wire 5 call sites `findCurrentLine` (`subtitleOverlay.ts:165,166,191` + `navClusterActions.ts:28,31`).
- `contentScriptController.ts` wire `OffsetController` (hiện ZERO offset wiring).
- `subtitleOffsetBadge.ts` (lazy badge DOM factory).
- Keyboard `[` `]` `{` `}` `\` vào `subtitleShortcuts.ts` (verified exists, pure handler `handleShortcutKey`).
- Persist round-trip + schema migration v2→v3.
- R6 cue sort defensive (`subtitleParser.ts` — verify đã có chưa).
- `visibilitychange` + `timeupdate` handler (wall-clock auto-commit).
- Bilingual same-offset test.

## Task List (high-level — detailed breakdown at G4)

### Phase 1: Cleanup C2 artifacts (logic + tests)

- [ ] **Task 1: Cleanup `subtitleOffset.ts` — drop C2**
  - Xóa `anchorMs` field khỏi `OffsetState` + `INITIAL_OFFSET_STATE`.
  - Xóa `isInLazyWindow()` function + `LAZY_WINDOW_MS` const.
  - Update JSDoc: "lazy = apply window" → "lazy = apply all, chưa persist".
  - Update `subtitleOffset.test.ts`: xóa test `isInLazyWindow`/`anchorMs`, thêm `shouldAutoCommit` edge cases (boundary 120000ms, mode=committed → false).
  - Acceptance: `npm run test:unit -- --testPathPatterns=subtitleOffset` pass, không còn `anchorMs`/`isInLazyWindow` reference.
  - Verify: `grep -r "anchorMs\|isInLazyWindow\|LAZY_WINDOW_MS" src/ tests/` → 0 match.
  - Dependencies: None.
  - Files: `subtitleOffset.ts`, `subtitleOffset.test.ts` (S).

### Checkpoint 1: Cleanup
- [ ] `npm run test:unit` pass
- [ ] `npx tsc --noEmit` pass
- [ ] `npm run lint` pass
- [ ] 0 C2 artifact reference

### Phase 2: Wire findCurrentLine call sites

- [ ] **Task 2: Wire 5 call sites truyền `offsetMs`**
  - `subtitleOverlay.ts:165,166,191` — pass `offsetController.valueMs` (cần reference tới controller — wire ở Phase 4).
  - `navClusterActions.ts:28,31` — same.
  - TDD: modify `subtitleSync.test.ts` add offset cases ±5000ms (verify binary search invariant giữ).
  - Acceptance: existing tests pass + new offset tests pass.
  - Verify: `npm run test:unit -- --testPathPatterns=subtitleSync`.
  - Dependencies: Task 1 (controller reference — nhưng call site wire thực tế cần Phase 4).
  - Files: `subtitleOverlay.ts`, `navClusterActions.ts`, `subtitleSync.test.ts` (M).
  - **Note**: call sites cần `offsetController` reference — wire thực tế ở Task 6 (Phase 4). Task 2 chỉ prepare signature + test.

### Checkpoint 2: findCurrentLine offset
- [ ] Offset tests pass (binary search invariant giữ với ±5000ms)
- [ ] Call sites sẵn sàng nhận offsetController (chưa wire thực tế)

### Phase 3: Settings + schema migration

- [ ] **Task 3: Schema migration v2→v3 + persist round-trip**
  - `settingsStore.ts`: bump `CURRENT_SCHEMA_VERSION` 2→3, add migration 2→3 default `subtitleOffset: {}`.
  - TDD: test migration 2→3 (input v2 settings không có `subtitleOffset` → output v3 có `subtitleOffset: {}`).
  - Test persist round-trip: `saveSettings({subtitleOffset: {[url]: 500}})` → `loadSettings().subtitleOffset[url] === 500` (URL dài YouTube query string).
  - Acceptance: migration test pass, round-trip OK, existing settings load OK (không break).
  - Verify: `npm run test:unit -- --testPathPatterns=settings`.
  - Dependencies: None (type đã có sẵn).
  - Files: `settingsStore.ts`, `settingsStore.test.ts` (M).

### Checkpoint 3: Settings
- [ ] Migration v2→v3 pass
- [ ] Persist round-trip OK (URL dài không truncate)
- [ ] Existing settings load OK

### Phase 4: UI — badge (panel đã có, chỉ verify + wire)

- [ ] **Task 4: Browser verify `subtitleOffsetPanel.ts` khớp mockup v2.2**
  - Panel đã có — chỉ verify render 4 state (disabled/default/lazy-active/committed) khớp mockup.
  - Press feedback `:active scale(0.94)`, apply flash "✓ Đã lưu" 1.5s.
  - edge-devtools MCP: load unpacked extension, mở video, import sub, mở panel, screenshot 4 states, so sánh mockup.
  - Acceptance: 4 states render khớp mockup, press feedback + flash OK.
  - Verify: edge-devtools MCP screenshot vs mockup.
  - Dependencies: None (panel đã có).
  - Files: `subtitleOffsetPanel.ts` (S — có thể cần CSS tweak).

- [ ] **Task 5: `subtitleOffsetBadge.ts` — lazy badge** (cite mockup `.lazy-badge`)
  - DOM factory, pill top-right overlay, pulse dot, timer "MM:SS" đếm ngược 2 phút (update mỗi giây).
  - Click badge = reset (hủy xem thử → value=0, lazy cancel).
  - `role="status"`, `aria-label` dynamic "Đang xem thử, còn 1 phút 23 giây, bấm để hủy".
  - TDD: `subtitleOffsetBadge.test.ts` render + timer + click.
  - Acceptance: badge render khớp mockup, timer đếm ngược, click reset.
  - Verify: `npm run test:unit -- --testPathPatterns=subtitleOffsetBadge` + browser verify.
  - Dependencies: None.
  - Files: `subtitleOffsetBadge.ts`, `subtitleOffsetBadge.test.ts` (M).

### Checkpoint 4: UI components
- [ ] Panel 4 states khớp mockup (browser verify)
- [ ] Badge render + timer + click reset OK
- [ ] Press feedback + apply flash OK

### Phase 5: Wire — OffsetController + contentScriptController + keyboard

- [ ] **Task 6: `OffsetController` — orchestrate state + UI + persist**
  - Class/closure: hold `OffsetState`, wire panel events → state transitions → `findCurrentLine` offset (via callback hoặc shared ref).
  - Lazy timer: wall-clock `lastActionAt` + check trên `timeupdate`/`visibilitychange` → `shouldAutoCommit` → commit + persist + flash.
  - Auto-commit: 2 phút không action → persist `subtitleOffset[url] = valueMs` + mode=committed + hide badge.
  - Reset: `value=0`, lazy mode, timer reset.
  - Load sub mới → cancel lazy + reset offset.
  - Bilingual: 1 offset chung (target + native cùng `offsetMs`).
  - TDD: `offsetController.test.ts` state transitions + timer logic (mock `Date.now`, mock `visibilitychange`).
  - Acceptance: C1, C3, C4, C5, C6, C8 pass (spec Verify column).
  - Verify: `npm run test:unit -- --testPathPatterns=offsetController`.
  - Dependencies: Task 1, 3, 5.
  - Files: `offsetController.ts` (hoặc closure trong contentScriptController), `offsetController.test.ts` (L — có thể break thành 2 task ở G4).

- [ ] **Task 7: Wire vào `contentScriptController.ts` + keyboard**
  - Instantiate `OffsetController` sau `SubtitleOverlayController`, trước `NavClusterController`.
  - Pass `video`, `container`, `cues` reference.
  - Wire 5 call sites `findCurrentLine` truyền `offsetController.valueMs` (hoặc callback).
  - Keyboard: add bindings `[`→`offsetMinus0.5`, `]`→`offsetPlus0.5`, `{`→`offsetMinus2`, `}`→`offsetPlus2`, `\`→`offsetReset` vào `subtitleShortcuts.ts` config + wire action handler.
  - Guard: chỉ fire khi focus trong overlay/panel (không global — tránh conflict YouTube shortcut).
  - Acceptance: C2 (N/A dropped), C7, C9, C10 pass. Offset hoạt động end-to-end.
  - Verify: edge-devtools MCP — load video, import sub, bấm offset, screenshot, mock wall-clock 2 phút, verify commit + persist + reload page verify tự load.
  - Dependencies: Task 6.
  - Files: `contentScriptController.ts`, `subtitleShortcuts.ts`, `subtitleOverlay.ts`, `navClusterActions.ts` (L — break ở G4).

### Checkpoint 5: Wire end-to-end
- [ ] C1-C10 (spec Verify column) all pass
- [ ] Browser verify: offset hoạt động real video, 4 states, lazy flow, persist, reload
- [ ] Keyboard shortcut không conflict site host
- [ ] Bilingual same-offset OK

### Phase 6: Polish + docs

- [ ] **Task 8: Update `docs/2-architechture-system.md`** (3 chỗ: tree, dependency table, function index)
  - Add `subtitleOffsetBadge.ts`, `offsetController.ts` (nếu file riêng).
  - Update dependency table (offset → findCurrentLine, settings, subtitleShortcuts).
  - Verify: `ls` confirm file exist.
  - Dependencies: Task 7.
  - Files: `docs/2-architechture-system.md` (S).

- [ ] **Task 9: ADR-019 (offset design)** — `docs/adr/019-subtitle-time-offset.md`
  - WHY: offset at search level (not cue), separate controller, wall-clock timer, UI giây/internal ms, C2 dropped (perf), schema v2→v3 additive.
  - Cite spec AD1-AD6 + review CRITICAL resolutions.
  - Dependencies: Task 7.
  - Files: `docs/adr/019-subtitle-time-offset.md` (S).

### Checkpoint 6: Complete
- [ ] `npm run test:unit` + `npx tsc --noEmit` + `npm run lint` pass
- [ ] Browser verify final (all 4 states + lazy flow + persist + reload + keyboard)
- [ ] Docs updated (architecture + ADR)
- [ ] Ready for G5 testing + G6 release

## Risks and Mitigations

| Risk | Impact | Mitigation | Phase |
|---|---|---|---|
| C2 artifact cleanup miss → stale reference break build | High | Task 1 grep verify 0 match `anchorMs\|isInLazyWindow\|LAZY_WINDOW_MS` | P1 |
| Wall-clock timer không fire khi tab sleep lâu > 2 phút | High | Task 6 test mock `Date.now` + `visibilitychange` — verify commit chạy khi tab visible lại (C8) | P5 |
| Mockup CSS không render đúng trong content-script (CSP, shadow DOM) | High | Task 4 browser verify sớm — nếu CSP block, fallback inline style | P4 |
| `findCurrentLine` offset break binary search (non-monotonic effective time) | Med | Task 2 TDD — offset đồng đều giữ monotonic, test ±5000ms | P2 |
| Schema migration v2→v3 break existing settings | Med | Task 3 test migration với real v2 settings snapshot, default `{}` additive | P3 |
| Persist URL dài truncate trong `chrome.storage.local` | Low | Task 3 test round-trip với YouTube URL dài (query string) | P3 |
| Keyboard `[` `]` `{` `}` `\` conflict site host (YouTube shortcut) | Med | Task 7 guard `e.target` — chỉ fire khi focus trong overlay/panel, không global | P5 |
| Bilingual 2 track drift khác nhau (target ≠ native) | Low | AD6 — V1 1 offset chung, Phase 2 tách nếu cần | P5 |
| Panel đã có nhưng drift vs mockup v2.2 (code cũ hơn mockup) | Med | Task 4 browser verify + CSS tweak nếu cần | P4 |

## Open Questions

- (không còn — spec đã resolve全部, review APPROVED 2026-07-04)

## G4 Task Breakdown Notes (cho G4 đầu)

- Task 6 (OffsetController) có thể break thành: 6a state machine wire, 6b lazy timer, 6c auto-commit + persist, 6d load sub reset.
- Task 7 (wire) có thể break thành: 7a controller instantiate, 7b call site wire (5 sites), 7c keyboard bindings, 7d browser verify.
- Ưu tiên vertical slice: cleanup → wire call sites → controller → persist → badge → keyboard → browser verify.
