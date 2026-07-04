# Spec: Subtitle Time Offset (V1)

> G1 spec. Input: `docs/intent/idea-subtitle-time-offset.md` + `docs/mockups/mockup-subtitle-time-offset.html` (v2.2 approved).
> Cite mockup: §F1 render như mockup state 1-4 (`docs/mockups/mockup-subtitle-time-offset.html`).

## Objective

Cho phép user dịch chuyển toàn bộ subtitle (theo time) để khớp voice phim, với UX try-before-buy: bấm offset → apply all ngay (lazy mode = chưa persist) → 2 phút không action → auto-commit + persist per-URL.

> **Lazy semantics (revised 2026-07-04, drop C2)**: Lazy mode = offset đã apply all ngay nhưng **chưa persist**. Không có "5-phút window" constraint (C2 đã drop — xem AD1-revised). User xem overlay dịch có khớp không, 2 phút không action → commit + persist. Reset = về 0 (vẫn lazy, chưa persist). Badge "Xem thử · 1:23" đếm ngược 2 phút (timer auto-commit), không phải 5 phút window.

**User stories**:
- US1: User thấy sub chạy trước voice → bấm `+0.5s` → sub dịch muộn → khớp (apply all ngay, chưa persist).
- US2: User tune 3-4 lần trong 2 phút → mỗi bấm reset timer → ngừng 2 phút → auto commit + persist.
- US3: User mở lại phim hôm sau → offset tự load (persist per-URL, mode=committed).
- US4: User load sub mới → offset reset về 0 (sub mới = baseline mới).

**Success criteria** (testable — Verify column resolved 2026-07-04):

| ID | Criterion | Verify |
|---|---|---|
| C1 | Bấm `+0.5s` → overlay hiển thị cue dịch 500ms (effective time = `currentTime + 500ms`, apply all ngay). | Unit `subtitleSync.test.ts`: `findCurrentLine(cues, t, 500)` trả về cue có `start <= t+500 <= end`. Browser verify: screenshot overlay trước/sau bấm. |
| C2 | ~~Lazy window~~ **DROPPED** — xem AD1-revised. | N/A |
| C3 | 2 phút wall-clock không action với 6 control → auto-commit + persist `settingsStore.subtitleOffset[url]`. | Unit `subtitleOffset.test.ts`: `shouldAutoCommit(state, nowMs)` — `lastActionAt` + 120000 → true; < 120000 → false. Integration: mock wall-clock + verify `saveSettings` called với đúng URL key. |
| C4 | Mở lại cùng URL → offset tự load apply all ngay (mode=committed, không lazy). | Integration: persist `{url: 500}` → reload controller → verify `OffsetState.valueMs === 500 && mode === 'committed'`. Browser verify: reload page, screenshot overlay. |
| C5 | Load sub mới → offset reset 0, lazy cancel. | Unit: state machine transition `loadNewSub()` → `{valueMs:0, mode:'committed', lastActionAt:0}`. Integration: load sub trong lazy → verify reset. |
| C6 | Reset button → `value=0`, vẫn lazy, timer reset. | Unit: `resetAction(state)` → `{valueMs:0, mode:'lazy', lastActionAt: now}`. Panel test: click reset → display "0s", badge vẫn hiện. |
| C7 | Clamp `[-60, 60]` giây — input `70` → reject + toast. | Unit `parseOffsetInput("70")` → null; `parseOffsetInput("-0.5")` → -500. Panel test: input "70" + submit → toast error, value không đổi. |
| C8 | Tab sleep 2 phút → `visibilitychange` fire → check wall-clock → auto-commit. | Unit: `shouldAutoCommit` với `nowMs - lastActionAt > 120000` → true. Integration: mock `visibilitychange` event + advance `Date.now` → verify commit. (Không E2E wait 2 phút — mock wall-clock.) |
| C9 | Bấm "Áp dụng" → button flash "✓ Đã lưu" 1.5s (không break layout). | Panel test: click apply → button text "✓ Đã lưu", 1500ms sau revert. Browser verify: screenshot, verify layout không break. |
| C10 | Press feedback `scale(0.94)` trên stepper buttons. | Browser verify only (CSS `:active` — không testable trong jsdom). Screenshot `:active` state. |

## Tech Stack

- React 19 (popup) / DOM factory (content-script overlay — mimic `subtitleManagerPanel`)
- Zustand 5 (popup state) / closure state (content-script — mimic `subtitleDragPosition`)
- TypeScript 6 strict, `readonly` fields
- Chrome MV3 `chrome.storage.local` (via `settingsStore`)
- Jest 30 (unit), Playwright (E2E)

## Commands

```
Build:            npm run build
Typecheck:        npm run typecheck
Test unit:        npm run test:unit
Test single:      npx jest --selectProjects unit --testPathPatterns=offset
Lint:             npm run lint
Browser verify:   edge-devtools MCP (load unpacked, screenshot overlay)
```

## Project Structure

```
src/features/subtitle/
  logic/
    subtitleSync.ts          # findCurrentLine — ADD offsetMs param (or apply at call site)
    subtitleOffset.ts        # NEW — offset state machine (lazy/committed), parser, clamp
  ui/
    subtitleOffsetPanel.ts   # NEW — DOM factory panel (mimic subtitleManagerPanel)
    subtitleOffsetBadge.ts   # NEW — lazy badge trên overlay (DOM factory)
    subtitleOverlay.ts       # MODIFY — inject offset vào findCurrentLine call
    navClusterActions.ts     # MODIFY — inject offset vào findCurrentLine call
    contentScriptController.ts # MODIFY — wire OffsetController
    subtitleShortcuts.ts     # MODIFY — add [ ] { } \ shortcuts (verified exists 2026-07-04, pure handler map key→action)
src/entities/settings/types.ts # MODIFY — add subtitleOffset?: Record<string, number>
src/shared/lib/storage/settingsStore.ts # no change (generic saveSettings)
tests/unit/subtitle/
  subtitleOffset.test.ts     # NEW — state machine, parser, clamp, lazy timer logic
  subtitleOffsetPanel.test.ts # NEW — panel render, disabled state, flash
docs/specs/spec-subtitle-time-offset.md # THIS FILE
docs/mockups/mockup-subtitle-time-offset.html # mockup v2.2 (approved)
docs/mockups/icon-svg/offset-*.svg # 4 icon files (kept for reference, not used in V1 — text-only buttons)
```

## Implementation Status (verified 2026-07-04)

> Spec trước đây mô tả feature như greenfield. Thực tế một phần đã tồn tại (logic + panel + type + tests). Section này list delta chính xác cho G2 plan. Verify bằng `ls` + `grep` — không tin memory.

### Đã tồn tại (không code lại, chỉ cleanup/wire)

| File | Có sẵn | Cần làm ở G4 |
|---|---|---|
| `src/features/subtitle/logic/subtitleOffset.ts` | `OffsetState`, `parseOffsetInput`, `clampOffsetMs`, `effectiveTime`, `formatOffsetDisplay`, `shouldAutoCommit`, `INITIAL_OFFSET_STATE`, `AUTO_COMMIT_MS` | **Cleanup**: xóa `anchorMs` field, `isInLazyWindow()`, `LAZY_WINDOW_MS` (C2 dropped). Update JSDoc comment "lazy = apply window" → "lazy = apply all, chưa persist". |
| `src/features/subtitle/ui/subtitleOffsetPanel.ts` | Panel DOM factory (26 offset references) | Verify render khớp mockup v2.2 (browser verify), wire vào controller |
| `src/entities/settings/types.ts:145` | `readonly subtitleOffset?: Record<string, number>` | Đã đúng type — không đổi |
| `src/features/subtitle/logic/subtitleSync.ts:13` | `findCurrentLine(lines, currentTime, offsetMs=0)` — param đã có | Không đổi signature |
| `tests/unit/features/subtitle/logic/subtitleOffset.test.ts` | Pure-fn tests đã có | **Cleanup**: xóa test cho `isInLazyWindow`, `anchorMs`. Thêm test `shouldAutoCommit` edge cases. |
| `tests/unit/features/subtitle/ui/subtitleOffsetPanel.test.ts` | Panel render tests đã có | Verify coverage 4 state + flash + disabled |

### Chưa có (TODO G4 — code mới)

| File / việc | Mô tả |
|---|---|
| Wire 5 call sites `findCurrentLine` | `subtitleOverlay.ts:165,166,191` + `navClusterActions.ts:28,31` — truyền `offsetController.valueMs` thay vì default 0 |
| `contentScriptController.ts` wire `OffsetController` | Hiện ZERO offset wiring (verified grep). Tạo controller theo `NavClusterController` pattern, instantiate sau `SubtitleOverlayController`. |
| `subtitleOffsetBadge.ts` (lazy badge) | DOM factory pill "Xem thử · MM:SS" + dot pulse, click = reset |
| Keyboard shortcuts `[` `]` `{` `}` `\` | Add vào `subtitleShortcuts.ts` (verified exists 2026-07-04 — pure handler `handleShortcutKey` map key→action dựa `KeyboardShortcut[]` config). Cần add default bindings `[`→`offsetMinus0.5`, `]`→`offsetPlus0.5`, `{`→`offsetMinus2`, `}`→`offsetPlus2`, `\`→`offsetReset` vào shortcuts config + wire action handler. |
| Persist round-trip | `settingsStore.saveSettings({ subtitleOffset: { [url]: valueMs } })` khi commit; load khi init controller |
| Schema migration v2→v3 | `settingsStore.ts` đang `CURRENT_SCHEMA_VERSION = 2`. Thêm migration 2→3 default `subtitleOffset: {}`. (HIGH risk — xem review F4) |
| R6 cue sort defensive | `subtitleParser.ts` — verify sort đã có chưa, nếu chưa thì add |
| `visibilitychange` + `timeupdate` handler | Wall-clock auto-commit check (AD4) |
| Bilingual same-offset verify | Test cả target + native dùng cùng `offsetMs` (AD6) |

### G2 plan input

G2 plan phải cite section này thay vì "Project Structure" (cột NEW/MODIFY không chính xác). Delta = cleanup (xóa C2 artifacts) + wire (5 call sites + controller) + bổ sung (badge, keyboard, persist, migration, handlers, tests mới).



Mimic `subtitleManagerPanel.ts` (DOM factory) + `subtitleDragPosition.ts` (closure state):

```typescript
// src/features/subtitle/logic/subtitleOffset.ts
export interface OffsetState {
  readonly valueMs: number;        // current offset (ms) — UI convert sang giây
  readonly mode: 'lazy' | 'committed';
  readonly lastActionAt: number;   // Date.now() lúc action gần nhất (wall-clock) — for 2-phút auto-commit timer
}

/** Parse user input (giây) → ms. Accept: "0.7", "1.5", "-0.5". Reject: "abc". */
export function parseOffsetInput(input: string): number | null {
  const n = parseFloat(input);
  if (Number.isNaN(n)) return null;
  return clampOffsetMs(n * 1000);
}

/** Clamp ±60s. Return null if out of range. */
export function clampOffsetMs(ms: number): number | null {
  if (ms < -60000 || ms > 60000) return null;
  return Math.round(ms);
}

/** Apply offset to currentTime for findCurrentLine. */
export function effectiveTime(currentTimeMs: number, offsetMs: number): number {
  return currentTimeMs + offsetMs;  // +offset = sub muộn hơn = search time tăng
}

// NOTE: isInLazyWindow() đã xóa (C2 dropped 2026-07-04) — lazy mode không còn window constraint.
```

**Conventions**:
- Named exports, no default export.
- `readonly` fields trong interface.
- Pure functions cho logic (testable, no side effects).
- DOM factory: `cssText` inline, `var(--token)`, `aria-*`, `data-testid`.
- Colocate test: `subtitleOffset.ts` → `subtitleOffset.test.ts`.

## Testing Strategy

**Unit** (`tests/unit/subtitle/`, `npm run test:unit`):
- `subtitleOffset.test.ts`: parser, clamp, effectiveTime, isInLazyWindow, state machine transitions (lazy→committed, reset, accumulate).
- `subtitleOffsetPanel.test.ts`: panel render 4 state (disabled/default/lazy/committed), button click, flash, disabled hint.
- `subtitleSync.test.ts` (modify existing): `findCurrentLine` với offset ±5000ms.

**Integration**: không cần (offset pure logic, không network).

**E2E / Browser verify** (edge-devtools MCP, before commit):
- Load unpacked extension → mở video test → import sub → bấm `+0.5s` → screenshot overlay → verify cue dịch.
- Wait 2 phút (hoặc mock wall-clock) → verify auto-commit + persist.
- Reload page → verify offset tự load.

**Coverage**: logic functions 100%, panel DOM 80% (render + click, skip visual).

## Boundaries

**Always do**:
- Run `npm run test:unit` + `npx tsc --noEmit` + `npm run lint` before commit.
- Apply offset at **search level** (`currentTimeMs + offsetMs`), không mutate `SrtCue` (readonly contract).
- Use wall-clock (`Date.now()`) + `visibilitychange`/`timeupdate` cho lazy timer, không `setTimeout`.
- Mimic `subtitleManagerPanel` DOM factory pattern (cssText inline, var(--token)).
- Persist per-URL (follow `subtitlePreference` precedent `Record<string, number>`).
- Update `docs/2-architechture-system.md` 3 chỗ (tree, dependency table, function index) khi add/rename file.

**Ask first**:
- Add new dependency (check bundle size).
- Modify `manifest.json`.
- Change `Settings` interface schema (schemaVersion bump).

**Never do**:
- Mutate `SrtCue` (readonly).
- Use `setTimeout` cho lazy timer (MV3 throttle kill).
- Commit without browser verify (content-script UI change).
- Add progressive drift detect/warn (out of scope V1).

## UI Reference

- **Mockup**: `docs/mockups/mockup-subtitle-time-offset.html` (v2.2, approved 2026-07-04) — single source of truth UI (CSS, layout, state, interaction, token).
- **Success criteria**: G4 render khớp mockup — browser verify (edge-devtools MCP screenshot) so sánh real render vs mockup trước commit.
- **Token source**: `theme.css` / `themeTokens.ts` (không invent token mới).
- **4 states**: disabled / default / lazy-active / committed (xem mockup state cells).

## Architecture Decisions
### AD1 — Apply offset at search level (add `offsetMs` param to `findCurrentLine`)
`SrtCue` readonly → không mutate. Apply `currentTimeMs + offsetMs` tại 5 call sites của `findCurrentLine` (3 trong `subtitleOverlay.ts`, 2 trong `navClusterActions.ts`). Hoặc add param `offsetMs` vào `findCurrentLine` signature (cleaner, 1 chỗ). **Chọn: add param** — 1 signature change, 5 call sites update, không logic trùng.

> **AD1-revised (2026-07-04, drop C2)**: `offsetMs` param **đã tồn tại** trong `findCurrentLine` (default 0, verify `src/features/subtitle/logic/subtitleSync.ts:13`). TODO G4 = wire 5 call sites truyền `offsetController.valueMs` thay vì default 0. Không per-cue effective, không `effectiveCues[]` clone. **Performance**: mỗi `timeupdate` = binary search O(log n) (~11 ops cho 2000 cues), offset chỉ là 1 gán biến khi user bấm. Không O(n) rebuild. Lazy mode apply all ngay (chưa persist), không window constraint.

### AD2 — Separate OffsetController, follow NavClusterController pattern
Không modify `subtitleManagerPanel` (separation of concerns). Tạo `subtitleOffsetPanel.ts` riêng + wire trong `contentScriptController.ts` sau `SubtitleOverlayController` (giống `NavClusterController`).

### AD3 — Persist per-URL, follow subtitlePreference precedent
`Settings.subtitleOffset?: Record<string, number>` — key = `window.location.href` (full URL), value = offsetMs. **Type**: `Record<string, number>` (per-URL → offsetMs), KHÔNG phải `Record<string, Record<string, number>>` như `subtitlePreference` (per-URL → per-trackId → value) — offset là 1 con số per-URL, không per-track. Note: spec trước đây ghi "follow `subtitlePreference` pattern (`Record<string, Record<string, number>>`)" là **sai** — đã corrected 2026-07-04.

**Schema migration (resolved 2026-07-04)**: `settingsStore.ts` đang `CURRENT_SCHEMA_VERSION = 2`. Bump → 3, thêm migration 2→3 default `subtitleOffset: {}` (additive). **Không rollback strategy** — schema additive, field optional, reset-to-0 (runtime) đủ cho user-facing revert. Ponytail: không over-engineer rollback cho field không destructive.

### AD4 — Lazy timer: wall-clock + event-driven
State: `lastActionAt: number` (Date.now()). Check trên `timeupdate` (video playing) + `visibilitychange` (tab visible lại). Khi `Date.now() - lastActionAt > 120000` → commit. Không `setTimeout` (R13). **Lazy mode apply all ngay** (không window constraint — C2 dropped), chỉ đánh dấu "chưa persist" + badge "Xem thử · MM:SS" đếm ngược 2 phút.

### AD5 — UI đơn vị giây, internal ms
UI hiển thị giây (`+0.7s`, input suffix `s`). Internal `valueMs` (ms, khớp `SrtCue`). Convert ở boundary: `parseOffsetInput` (giây→ms), `formatOffsetDisplay` (ms→giây).

### AD6 — Bilingual: 1 offset chung
Cả target + native dùng cùng `offsetMs`. 90% case 2 sub cùng nguồn drift giống nhau. Phase 2 tách nếu cần.

## Open Questions

- ~~C2 lazy window~~ — RESOLVED 2026-07-04: dropped (xem AD1-revised).
- ~~CRITICAL #2 Implementation Status~~ — RESOLVED 2026-07-04: added "Implementation Status" section (verified bằng ls + grep).
- ~~HIGH F4 schema migration~~ — RESOLVED 2026-07-04: bump v2→v3, default `subtitleOffset: {}`, không rollback (additive, ponytail).
- ~~HIGH T1 test mapping~~ — RESOLVED 2026-07-04: added Verify column cho C1-C10.
- ~~HIGH S3 keyboard file~~ — RESOLVED 2026-07-04: chọn `subtitleShortcuts.ts` (verified exists, pure handler).

Spec ready for G2 plan.
