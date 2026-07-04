# Spec Review: Subtitle Time Offset (V1)

> **Model**: Opus 4.8 (or Kimi 2.7 if fallback)
> **Date**: 2026-07-04
> **Spec**: docs/specs/spec-subtitle-time-offset.md
> **Intent**: docs/intent/idea-subtitle-time-offset.md
> **Reviewer**: spec-reviewer skill (delegated subagent)

## Status

**APPROVED** (updated 2026-07-04 after all CRITICALs + HIGHs resolved)

- CRITICAL #1 (C2 lazy-window vs AD1) **RESOLVED** — anh approved drop C2. Spec + intent updated: lazy mode = apply all ngay (chưa persist), không window constraint. `OffsetState.anchorMs` + `isInLazyWindow()` removed. AD1-revised + perf note added (O(log n) per timeupdate, không O(n) rebuild).
- CRITICAL #2 (spec describes greenfield but code exists) **RESOLVED** — added "Implementation Status" section (verified bằng ls + grep): list 6 files đã có + 9 việc TODO G4. G2 plan input = section này.
- HIGH F4 (schema migration) **RESOLVED** — bump v2→v3, default `subtitleOffset: {}`, không rollback (additive, ponytail).
- HIGH T1 (test mapping) **RESOLVED** — added Verify column cho C1-C10.
- HIGH S3 (keyboard file) **RESOLVED** — chọn `subtitleShortcuts.ts` (verified exists, pure handler `handleShortcutKey`).

Spec ready for G2 plan. Remaining MEDIUM/LOW risks tracked in risk table (non-blocking).

## Checklist Results

| Section | Pass | Fail | NA | Items |
|---------|------|------|-----|-------|
| Feasibility (Tech Lead) | 2/4 | 2/4 | 0/4 | F1-F4 |
| Testability (QA) | 1/3 | 2/3 | 0/3 | T1-T3 |
| Scope (Product) | 2/3 | 1/3 | 0/3 | S1-S3 |
| **Total** | 5/10 | 5/10 | 0/10 | |

## Checklist Details

### Feasibility (Tech Lead)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| F1 | Dependencies have owner + timeline + fallback? | PASS | HIGH | All deps are existing in-repo files (`findCurrentLine`, `subtitleManagerPanel`, `subtitleDragPosition`, `settingsStore`, `subtitlePreference` precedent) — available now, no external dep. Fallback for parse failure = return null + toast (C7). |
| F2 | Architecture considerations section exists? | PASS | MEDIUM | "Project Structure" + "Architecture Decisions" (AD1-AD6) + "Boundaries" sections present, list files + data flow + decisions. |
| F3 | Technical constraints reviewed? | PASS | HIGH | MV3 content-script throttle (R13/AD4), `SrtCue` readonly (AD1), DOM factory pattern, `chrome.storage.local` via `settingsStore`, wall-clock vs setTimeout — all listed. |
| F4 | Rollback strategy for stateful changes? | FAIL | HIGH | Spec adds `Settings.subtitleOffset` (stateful schema change) + says "Ask first: Change Settings interface schema (schemaVersion bump)" but gives NO rollback/migration strategy. `settingsStore.ts` currently at `CURRENT_SCHEMA_VERSION = 2` with migrations 0→1, 1→2; spec doesn't specify the v2→v3 migration (default `{}` for `subtitleOffset`). No rollback if persisted bad offset corrupts overlay. Reset-to-0 is runtime revert, not storage rollback. |

### Testability (QA)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| T1 | Every acceptance criterion has concrete verify method? | FAIL | CRITICAL | C1-C10 have NO "Verify" column. "Testing Strategy" section lists generic categories (unit/E2E) but does NOT map C1→specific test. E.g. C2 (lazy window only) has no test because the behavior is unimplemented (see CRITICAL risk #1). C8 (visibilitychange) says "(hoặc mock wall-clock)" but no concrete test design. E2E says "Wait 2 phút" — not a viable automated test. |
| T2 | Edge cases ≥2 per user story? | PASS | HIGH | Intent lists P1-P8 (popular) + R1-R14 (rare) — well above 2/feature. Spec references intent edge cases implicitly via AD4/C2/C5/C6/C7/C8. |
| T3 | Error states defined? | FAIL | HIGH | C7 defines clamp reject + toast. But: parse failure path (null) → toast? R2 "lazy window gap im lặng fallback" → no error state in spec. Persist write failure (storage quota) → undefined. Load sub mới trong lazy (R5) → "cancel lazy + reset" stated in intent but spec C5 only says "reset 0, lazy cancel" without error/edge framing. |

### Scope (Product)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| S1 | Problem statement doesn't mention solution? | PASS | HIGH | Objective describes "dịch chuyển toàn bộ subtitle để khớp voice phim, UX try-before-buy" — problem + UX framing, not implementation. |
| S2 | Out-of-scope ≥3 tempting extensions? | PASS | HIGH | Intent "Out of scope" lists 6 (V3 STT, per-cue retime, bilingual split, undo/redo, history, progressive detect). Spec references intent. |
| S3 | Success metrics are measurable? | FAIL | CRITICAL | C1-C10 are testable conditions BUT C2 ("cue ngoài window giữ offset cũ") is NOT measurable as written because the mechanism to achieve it is undefined (see CRITICAL risk #1 — `findCurrentLine` cannot apply offset to "only some cues"). A criterion whose mechanism is infeasible is not measurable. |

## Risks

| # | Severity | Section | Question | Suggested Fix |
|---|----------|---------|----------|---------------|
| 1 | CRITICAL | F/T (AD1 vs C2) | **C2 lazy-window semantics contradict AD1.** AD1 chose "add `offsetMs` param to `findCurrentLine`" — verified in `src/features/subtitle/logic/subtitleSync.ts:13` (`offsetMs: number = 0`, applied as `effective = currentTime + offsetMs` over ALL cues). C2 requires "lazy mode chỉ apply offset cho cue trong `[anchor, anchor+300000]`, cue ngoài window giữ offset cũ (0)". A single `offsetMs` param applies ONE offset to ALL cues — it CANNOT apply offset to only in-window cues. `isInLazyWindow` helper exists (`subtitleOffset.ts:106`) but is never wired into `findCurrentLine` or any call site. This is an unresolved architectural contradiction. | Resolve explicitly: either (a) **Drop C2** — lazy mode applies offset to ALL cues (simplest, matches AD1's single-param; "try-before-buy" still works because user watches 5 min and can reset), or (b) **Replace AD1** — compute per-cue effective time at call sites: `findCurrentLine(cues, currentTime, cue => isInLazyWindow(cue.start, anchor) ? offsetMs : 0)` requiring a per-cue offset function param (breaks binary search invariant if offset differs per cue — needs careful design). Recommend (a) + update C2 to "lazy mode applies offset to all cues; window is a UX hint for the badge/timer only, not a render boundary". |
| 2 | CRITICAL | F/T (spec vs codebase) | **Spec describes a partially-implemented feature as if greenfield, leaving wiring contract ambiguous.** Verified: `subtitleOffset.ts` (logic, 142 lines), `subtitleOffsetPanel.ts` (DOM factory, 322 lines), `Settings.subtitleOffset?: Record<string, number>` (`types.ts:145`), `findCurrentLine(..., offsetMs=0)` param (`subtitleSync.ts:13`), and tests (`subtitleOffset.test.ts`, `subtitleOffsetPanel.test.ts`) ALREADY EXIST. BUT: (a) all 5 call sites still call `findCurrentLine(cues, currentTimeMs)` with NO 3rd arg (`subtitleOverlay.ts:165,166,191`; `navClusterActions.ts:28,31`) → offset never applied to render; (b) `contentScriptController.ts` has ZERO offset/OffsetController wiring (grep `Offset\|offset` → no matches); (c) no `subtitleOffsetBadge.ts` file; (d) no keyboard shortcut for `[` `]` `{` `}` `\`; (e) `subtitleParser.ts` has NO sort (R6 unimplemented); (f) no persist round-trip. Spec's "Project Structure" marks these as NEW/MODIFY but doesn't acknowledge the logic+panel+types are already done — so a G2 planner cannot tell what's left. | Add a "Implementation Status" section to spec listing: DONE (logic pure fns, panel DOM factory, Settings type, findCurrentLine param, unit tests for pure fns) vs TODO (wire offsetMs into 5 call sites, OffsetController in contentScriptController, badge, keyboard, persist save/load on commit, R6 sort, schema v2→v3 migration). Re-scope the G2 plan to TODO only. |
| 3 | HIGH | F4 / AD3 | **Schema migration + rollback undefined.** `settingsStore.ts` is at `CURRENT_SCHEMA_VERSION = 2` with migrations `0→1`, `1→2`. Adding `subtitleOffset` requires v2→v3 migration (default `{}`). Spec says "Ask first: schemaVersion bump" but doesn't specify the migration function or rollback. AD3 also self-contradicts: declares `Settings.subtitleOffset?: Record<string, number>` then says "Follow `subtitlePreference` pattern (`Record<string, Record<string, number>>`)" — verified `subtitlePreference` at `types.ts:139` is `Record<string, Record<string, number>>` (per-origin → per-lang → index), a DIFFERENT shape than `Record<string, number>` (per-URL → ms). The actual code chose `Record<string, number>` (correct — offset has no lang dimension) but the spec text "follow subtitlePreference pattern" is misleading. | (a) Specify v2→v3 migration: `2: (s) => ({ ...DEFAULT_SETTINGS, ...s, subtitleOffset: s.subtitleOffset ?? {}, schemaVersion: 3 })`. (b) Remove the contradictory "Follow subtitlePreference pattern (Record<string, Record<string, number>>)" clause from AD3 — state explicitly: "Deviation from subtitlePreference: offset has no per-language dimension, so shape is `Record<url, ms>` not `Record<url, Record<lang, ms>>`." (c) Define rollback: bad persist → reset `subtitleOffset[url] = 0` (runtime) + no storage-level undo needed (offset is user-tunable, not destructive). |
| 4 | HIGH | T1 / Testing | **Test coverage gaps for wiring + integration.** Existing tests cover pure functions only (`parseOffsetInput`, `clampOffsetMs`, `effectiveTime`, `isInLazyWindow`, `formatOffsetDisplay`, `shouldAutoCommit`, `INITIAL_OFFSET_STATE`). Spec claims "logic functions 100%, panel DOM 80%" but NO tests for: (a) `visibilitychange` handler firing auto-commit; (b) `timeupdate`-driven `shouldAutoCommit` check in controller; (c) bilingual same-offset behavior (target + native both shifted — `subtitleOverlay.ts:165,166`); (d) persist round-trip (save on commit → reload → `loadSettings` → apply all immediately, C4); (e) lazy-window-only application (C2 — untestable because unimplemented, see risk #1); (f) R5 load-sub-new cancels lazy; (g) R6 sort defensive. | Add to "Testing Strategy": unit tests for `shouldAutoCommit` with mocked `Date.now` (exists) + a controller-level integration test (jsdom + fake `video.timeupdate` event + fake `document.visibilitychange`) verifying: tune → wait 120s wall-clock → `timeupdate` fires → commit → `saveSettings` called with `subtitleOffset[url]`. Add persist round-trip test: `saveSettings({subtitleOffset: {url: 500}})` → `loadSettings()` → assert `subtitleOffset[url] === 500`. Add bilingual test: `findCurrentLine(target, t, 500)` and `findCurrentLine(native, t, 500)` both shift identically. |
| 5 | HIGH | S (R2 fallback) | **R2 "Lazy window gap im lặng" fallback missing from spec.** Intent R2: "Lazy window gap im lặng — fallback apply all ngay + toast." Spec C2 describes the window behavior but does NOT mention the fallback when the window mechanism fails/silent. Since risk #1 may drop C2 entirely, this may become moot — but if C2 stays, the fallback must be specified. | If C2 stays: add C2b "If lazy-window application encounters a gap (no cue in window), fallback: apply offset to all cues immediately + toast 'Đã áp dụng toàn bộ'." If C2 dropped (recommended): remove R2 from scope, note in "Not Doing". |
| 6 | HIGH | S (P4 clamp) | **P4 cue clamp `effectiveStart ≥ 0`, `effectiveEnd ≤ duration` missing from spec.** Intent P4: "Clamp `effectiveStart ≥ 0`, `effectiveEnd ≤ duration` (không mutate `SrtCue` gốc)." Spec's `effectiveTime` (`subtitleOffset.ts:94`) returns `currentTimeMs + offsetMs` with NO clamping. `findCurrentLine` doesn't clamp either. A large negative offset could push `effective` below 0; a large positive offset could exceed duration → `findCurrentLine` returns -1 (no cue) which is safe, but the intent explicitly required clamping. | Either (a) add clamp in `effectiveTime`: `return Math.max(0, Math.min(durationMs, currentTimeMs + offsetMs))` (requires passing `durationMs` — signature change), or (b) document in spec that clamp is N/A because `findCurrentLine` returning -1 (no cue) is the desired behavior for out-of-range effective time (sub simply hidden) — and update intent P4 to "handled by findCurrentLine returning -1, no explicit clamp needed". Recommend (b) — simpler, matches existing behavior. |
| 7 | MEDIUM | F (keyboard) | **Keyboard shortcut file choice ambiguous + no conflict check documented.** Spec: "MODIFY `subtitleShortcuts.ts` (if exists, else `navClusterKeyboard`)." Verified BOTH exist: `subtitleShortcuts.ts` (configurable `KeyboardShortcut[]` from settings, pattern-matches `s.key`) and `navClusterKeyboard.ts` (fixed keys: ArrowLeft/Right, r/R, `</>`, `,/.`). `[` `]` `{` `}` `\` are NOT bound in either. `subtitleShortcuts` is configurable (key from settings) — adding FIXED `[` `]` there doesn't fit its pattern; `navClusterKeyboard` is fixed-keyboard and a better fit, but it's nav-cluster-scoped. Spec's "if exists, else" branching is unclear. | Decide: create a new `subtitleOffsetKeyboard.ts` (fixed keys, mimic `navClusterKeyboard` pure-function pattern) OR add a fixed-key fast-path in `subtitleShortcuts`. Spec should name the file definitively, not "if exists, else". Confirm no conflict: `[` `]` `{` `}` `\` don't collide with existing `a/d/s/w/t` (subtitle panel) or ArrowLeft/Right/r/`</>`/`,/.` (nav cluster) — document this grep result in spec. |
| 8 | MEDIUM | T (C8) | **C8 visibilitychange wording incomplete.** C8 says "Tab sleep 2 phút → `visibilitychange` fire → check wall-clock → auto-commit." But if user stays on the video tab (never switches away), `visibilitychange` won't fire. AD4 says check on `timeupdate` (video playing) + `visibilitychange` (tab visible again) — so the timer IS covered during playback. But C8 only mentions the visibilitychange path, implying the stay-on-tab case is uncovered. Internally consistent (AD4 covers it) but C8 wording is misleading. | Update C8: "Tab sleep 2 phút → `visibilitychange` fire → check wall-clock → auto-commit. Tab stays active + video playing → `timeupdate` fires → same wall-clock check → auto-commit. Tab active + video PAUSED → no event fires → commit deferred until resume (acceptable, user is not watching)." |
| 9 | MEDIUM | F (R6 sort) | **R6 cue non-monotonic sort unimplemented.** Intent R6: "Cue non-monotonic — sort lúc parse (defensive, trong `subtitleParser.ts`)." Verified `subtitleParser.ts` (58 lines) has NO `.sort()` call — cues are returned in parser order. `findCurrentLine` binary search REQUIRES monotonic cues; non-monotonic input → wrong index. Spec mentions R6 in intent reference but doesn't list it as a modification to `subtitleParser.ts` in "Project Structure". | Add to "Project Structure": `subtitleParser.ts # MODIFY — sort cues by .start (defensive, R6)`. Or explicitly defer: "R6 deferred — all real-world SRT/VTT are monotonic; sort adds O(n log n) to every parse for a non-issue. Document as known limitation." Recommend the defer with `ponytail:` comment. |
| 10 | LOW | F (AD3 key) | **Persist key = full URL vs subtitlePreference key = origin.** `subtitlePreference` uses origin (`themoviebox.org`) as key; `subtitleOffset` uses `window.location.href` (full URL). Intent A4 flags "verify `Record<url, number>` serialize/deserialize không truncate URL dài (YouTube URL có query string dài)". Spec doesn't address A4's verification. Full URLs as storage keys can grow unbounded (per-video entry never evicted). | Add to "Boundaries / Ask first": "Per-URL persist grows unbounded — cap at N=200 most-recent URLs (LRU evict) OR accept unbounded (storage.local quota 10MB, ~50 bytes/entry → ~200k entries safe). Document choice." Verify A4 in G4 with a long-YouTube-URL round-trip test. |

## Open Questions

1. **[CRITICAL — must answer before G2]** C2 lazy-window: drop C2 (offset applies to all cues, window is UX-only) OR replace AD1 with per-cue effective-time computation (breaks binary search invariant, needs new design)? Recommend drop.
2. **[CRITICAL — must answer before G2]** Acknowledge partial implementation: confirm the G2 plan should cover ONLY the TODO items (wire 5 call sites, OffsetController in contentScriptController, badge, keyboard, persist save/load, schema v2→v3 migration) and NOT re-implement the existing logic/panel/types/tests?
3. **[HIGH]** Schema v2→v3 migration: confirm migration function shape + that `subtitleOffset` defaults to `{}` for existing users (no offset = current behavior)?
4. **[HIGH]** R2 fallback: if C2 stays, define the gap fallback (apply all + toast). If C2 dropped, confirm R2 is moot and removed from scope?
5. **[HIGH]** P4 clamp: confirm `findCurrentLine` returning -1 (sub hidden) for out-of-range effective time is acceptable — no explicit `effectiveStart ≥ 0` clamp needed?
6. **[MEDIUM]** Keyboard: confirm new `subtitleOffsetKeyboard.ts` file (fixed keys, mimic `navClusterKeyboard`) vs extending `subtitleShortcuts`?
7. **[MEDIUM]** R6 sort: implement defensive sort in `subtitleParser.ts` OR defer with `ponytail:` comment (real-world SRT/VTT monotonic)?
8. **[LOW]** Per-URL persist eviction: LRU cap at N=200 OR accept unbounded?

## Suggested Spec Updates

1. **Add "Implementation Status" section** (after "Project Structure"): enumerate DONE (logic pure fns `subtitleOffset.ts`, panel `subtitleOffsetPanel.ts`, `Settings.subtitleOffset` type, `findCurrentLine` `offsetMs` param, pure-fn unit tests) vs TODO (wire `offsetMs` into 5 call sites, `OffsetController` in `contentScriptController.ts`, `subtitleOffsetBadge.ts`, keyboard shortcuts, persist save/load on commit, schema v2→v3 migration). This is the single most important update — it unblocks G2.
2. **Resolve AD1 vs C2** (Architecture Decisions): pick one approach. If dropping C2: rewrite C2 as "Lazy mode applies offset to all cues; the `[anchor, anchor+300000]` window is a UX hint for the lazy badge/timer display only, not a render boundary. Try-before-buy works because user watches ~5 min and can reset." Remove `isInLazyWindow` from the render path (keep for badge display if useful).
3. **Fix AD3 contradiction** (Architecture Decisions): remove "Follow `subtitlePreference` pattern (`Record<string, Record<string, number>>`)" — replace with "Deviation from `subtitlePreference`: offset has no per-language dimension, so shape is `Record<string, number>` (per-URL → ms), not `Record<string, Record<string, number>>`."
4. **Add schema migration spec** (Boundaries / Ask first → make it explicit): specify v2→v3 migration function + default `{}`. Bump `CURRENT_SCHEMA_VERSION` to 3.
5. **Add "Verify" column to C1-C10** (Success criteria): map each criterion to a concrete test (unit test name / E2E step / browser-MCP screenshot). E.g. C1 → `subtitleSync.test.ts: findCurrentLine(cues, t, 500) returns index shifted by 500ms`; C8 → controller integration test with fake `visibilitychange` + mocked `Date.now`.
6. **Add missing test list** (Testing Strategy): visibilitychange handler, timeupdate-driven auto-commit, bilingual same-offset, persist round-trip, R5 load-sub-new cancels lazy.
7. **Name the keyboard file definitively** (Project Structure): replace "MODIFY `subtitleShortcuts.ts` (if exists, else `navClusterKeyboard`)" with a single choice + document the no-conflict grep result.
8. **Address R2 + P4 + R6 + A4** explicitly: either implement (add to Project Structure) or defer with rationale in "Not Doing".

## Decision

- [ ] **APPROVED** — proceed to G2 Plan
- [ ] **APPROVED_WITH_CONDITIONS** — answer open questions, then proceed to G2
- [x] **BLOCKED** — fix CRITICAL risks (#1 C2/AD1 contradiction, #2 implementation-status ambiguity), re-run spec-reviewer

---

## Appendix — Verification Evidence (grep results)

### AD1 call-site count (spec claims "5: 3 in subtitleOverlay.ts, 2 in navClusterActions.ts")
```
grep "findCurrentLine\(" src/
  src/features/subtitle/logic/subtitleSync.ts:13     → definition (offsetMs: number = 0) — param ALREADY EXISTS
  src/features/subtitle/ui/subtitleOverlay.ts:165    → findCurrentLine(this.cues, currentTimeMs)           — NO offsetMs arg
  src/features/subtitle/ui/subtitleOverlay.ts:166    → findCurrentLine(this.nativeCues, currentTimeMs)     — NO offsetMs arg
  src/features/subtitle/ui/subtitleOverlay.ts:191    → findCurrentLine(this.cues, currentTimeMs)           — NO offsetMs arg
  src/features/subtitle/ui/navClusterActions.ts:28   → findCurrentLine(targetCues, currentTimeMs)          — NO offsetMs arg
  src/features/subtitle/ui/navClusterActions.ts:31   → findCurrentLine(nativeCues, currentTimeMs)          — NO offsetMs arg
```
**Verdict**: Count CORRECT (5 call sites). But `offsetMs` param already added (default 0) — spec's AD1 "ADD offsetMs param" is already done; the TODO is wiring the 5 call sites to pass a non-zero offset.

### AD3 subtitlePreference precedent
```
src/entities/settings/types.ts:139  readonly subtitlePreference?: Record<string, Record<string, number>>;  — per-origin → per-lang → index
src/entities/settings/types.ts:145  readonly subtitleOffset?: Record<string, number>;                      — per-URL → ms (DIFFERENT shape)
```
**Verdict**: Spec AD3 self-contradiction confirmed. Actual code chose `Record<string, number>` (correct for offset).

### contentScriptController offset wiring
```
grep "Offset|offset" src/features/subtitle/ui/contentScriptController.ts → NO MATCHES
```
**Verdict**: OffsetController NOT wired. Spec AD2 "wire trong contentScriptController.ts" is TODO.

### subtitleParser R6 sort
```
grep "sort" src/features/subtitle/logic/subtitleParser.ts → NO MATCHES
```
**Verdict**: R6 defensive sort NOT implemented.

### Existing implementation files
```
src/features/subtitle/logic/subtitleOffset.ts        — EXISTS (142 lines, pure fns)
src/features/subtitle/ui/subtitleOffsetPanel.ts      — EXISTS (322 lines, DOM factory)
src/features/subtitle/ui/subtitleOffsetBadge.ts      — DOES NOT EXIST
tests/unit/features/subtitle/logic/subtitleOffset.test.ts       — EXISTS (pure-fn tests)
tests/unit/features/subtitle/ui/subtitleOffsetPanel.test.ts     — EXISTS
```

### Keyboard shortcuts
```
src/features/subtitle/ui/subtitleShortcuts.ts    — EXISTS (configurable KeyboardShortcut[] from settings)
src/features/subtitle/ui/navClusterKeyboard.ts   — EXISTS (fixed: ArrowLeft/Right, r/R, </>, ,/.)
```
`[` `]` `{` `}` `\` bound in NEITHER. No conflict, but spec's "if exists, else" is ambiguous.

### Mockup v2.2 vs spec states
```
mockup state labels: "1 · Chưa có subtitle" (disabled), "2 · Mặc định" (default),
                     "3 · Đang xem thử" (lazy-active), "4 · Đã lưu" (committed)
spec: "4 states: disabled / default / lazy-active / committed"
```
**Verdict**: ALIGNED. (Mockup file comment says "v2" / "Revision: v2.2" — consistent with spec's "v2.2 approved".)
