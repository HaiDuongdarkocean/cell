# Spec — Adaptive Subtitles (r1)

Intent: `docs/intent/adaptive-subtitles.md`. Backlog #9. r1: fixes từ stakeholder review (1 blocker + 6 majors + minors — từng item ghi rõ dưới đây).

## 1. Feature

Preset study mode mới `adaptive`: visibility của subtitle được quyết định lại **tại mỗi cue boundary** theo độ khó của cue đang active — thay vì một `SubtitleVisibility` cố định.

| Cue band | strange count | Visibility |
|---|---|---|
| `easy` | 0 | `'none'` — ẩn cả hai, buộc nghe |
| `i1` | 1–2 | `'target'` — chỉ target sub |
| `dense` | ≥3 | `'both'` — target + native translation |
| probe `null` | metadata chưa sẵn | `'both'` — fallback an toàn |

"Learnable"/strange = `CueDifficulty.strange` — token `unknown`|`tracking` có rank ≤ threshold của `unknownLevel` (rank null/unlisted skip khi `!freqUnfiltered`) — đúng định nghĩa `cueHeatBand`/`cueDifficultyMap` của cue heat (#5) + FAB i+1 (#4).

**Band-gating note (M3)**: cue chỉ chứa từ hiếm hơn `unknownLevel` → `easy` → sub ẩn. Đây là *cùng* ngưỡng user đã chọn cho pauseOnUnknown + heat + FAB — adaptive giữ consistent: "từ ngoài band = từ user chấp nhận không biết". Knob được expose khi adaptive active (§2).

## 2. UX

- Mode `Adaptive` xuất hiện trong preset list như các mode khác (`StudyModeActionBar`/`StudyModesTab` render `PRESETS` tự động — zero UI plumbing).
- Preset entry: `{ id: 'adaptive', type: 'preset', icon: 'gauge', title: 'Adaptive', description: 'Subtitles follow cue difficulty — hidden when easy, native added when dense.', steps: [{ subtitle: 'adaptive', pause: 'none', repeat: 1, speed: 1, after: 'continue' }] }`, đặt ngay sau `normal`. (Icon `gauge` — `slidersHorizontal` đã là default icon của custom modes ở `studyModeStore.ts:81`.)
- Custom modes: `'adaptive'` thêm vào `SUBTITLE_OPTIONS` trong `StepEditor` → compose được (vd: adaptive + pause-end).
- `CueStrip` render `step.subtitle` raw; `formatStepSummary.SUBTITLE_LABELS` (exhaustive `Record`) += `adaptive: 'adaptive'` — bắt buộc cho typecheck.
- **Level control (M3)**: `AdvancedSection` (`StudyModesTab`) hiện `unknownLevel` chips khi `pauseOnUnknown !== 'OFF'` **hoặc active mode dùng adaptive** (`modeUsesAdaptive` prop — parent có `activeMode` qua `findActiveMode(store)`). Cùng một knob drive cả pause lẫn band.
- **Panel blur (M2 — quyết định tường minh)**: giữ semantics uniform hiện có — `practiceMode==='off' && (targetHidden || nativeHidden)` → `setPanelBlurred(true)`. Tức adaptive `none` **và** `i1` đều blur panel (mọi partial-hidden). Hệ quả có chủ đích:
  - Blur ngăn đọc trộm cue tiếp theo trong panel — functional, không phải cosmetic.
  - `panelBlurred` gate cue-strip/Words tab/force-reset `activeTab` → khi adaptive active, Words tab gần như luôn locked. Đây là *cùng* hành vi mode `listen` hôm nay — adaptive là active-listening mode; user muốn browse words thì tắt mode.
  - `.blurOverlay` là conditional mount, **không** CSS transition — flicker per-boundary là inherent của feature (per-cue quyết định là core value), không cố giấu.
- Manual hide/show giữa chừng: hành xử giống mọi mode — user action thắng tới boundary kế, `enterCue` re-resolve. Tắt mode → `studyBaseline` restore.
- Mode→mode switch (adaptive→listen): `studyBaseline` chỉ restore khi tắt hẳn — visibility cuối của adaptive giữ tới `setSubtitle` đầu tiên của mode mới (hành vi chung của mọi mode switch, document không đổi).

## 3. Kiến trúc

### 3.1 Types (`entities/studyMode/types.ts`)

```ts
export type AdaptiveCueBand = 'easy' | 'i1' | 'dense';
export type CueBandProbe = (cueIndex: number) => AdaptiveCueBand | null;

export interface StudyStep {
  subtitle: SubtitleVisibility | 'adaptive';
  // ... unchanged
}
```

`AdaptiveCueBand` trùng cấu trúc `CueHeatBand` — định nghĩa riêng trong entities vì entities không import features (arch guard); `CueHeatBand` assignable qua structural typing.

`PlaybackAction { type:'setSubtitle' }` giữ `subtitle: SubtitleVisibility` — emitted action luôn concrete; `'adaptive'` chỉ là step-level sentinel.

### 3.2 Persistence (`features/studyModes/lib/migrateStudyModeState.ts`) — **B1**

`SUBTITLE_VALUES += 'adaptive'` (line 5). Không có fix → custom mode chứa step adaptive bị `isValidStep` filter **drop nguyên mode** sau reload, và `applyStudyModeState` reset `activeModeId` về `'normal'` nếu mode bị drop đang active — silent data loss. Migrate chạy ở cả side panel lẫn content script. (Downgrade note: version cũ vẫn drop custom mode chứa adaptive — accepted, document.)

### 3.3 Resolution (`features/studyModes/lib/studyModePlaybackController.ts`)

- Field `bandProbe: CueBandProbe | null` + `setBandProbe()` (mirror `setProbe` — cached field, forward vào playback mới).
- Pure helper export `resolveStepSubtitle(subtitle: StudyStep['subtitle'], cueIndex: number, probe: CueBandProbe | null): SubtitleVisibility`:
  - `subtitle !== 'adaptive'` → trả nguyên.
  - `'adaptive'` → `probe?.(cueIndex)` → `easy→'none' | i1→'target' | dense→'both' | null→'both'`.
- Gọi helper tại **đúng 2 emit sites** `setSubtitle`: `applyStepEntry` (:197) và `reapplyStep` (:295), dùng `this.activeCueIndex`. (`enterCue`→`applyStepEntry` chạy per cue boundary; gated `targetIndex >= 0` nên probe không bị gọi -1.)

### 3.4 Wiring — enumerate đủ (M4)

- `SubtitleStudyModeController`: cached `bandProbe` field + `setBandProbe()` + **re-forward trong `applyStudyMode`** (`this.playback?.setBandProbe(this.bandProbe)` — mirror `setProbe` ở :27/:53; playback controller mới mỗi mode switch, không forward = bandProbe mất mỗi switch → adaptive silently luôn 'both').
- `ReactSubtitleController.setBandProbe(probe)` pass-through → `studyMode.setBandProbe` (cạnh `setUnknownCueProbe`).
- `contentScriptController.syncUnknownResolver` — **3 wire sites**, mirror `probe`:
  - `currentMode: StudyMode | null` field cạnh `currentAdvanced`; `wantsResolver = pauseOnUnknown !== 'OFF' || currentMode?.steps.some(s => s.subtitle === 'adaptive')`.
  - Early-return destroy nhánh (:181): `setBandProbe(null)`.
  - Same-key nhánh (:186): `setBandProbe(unknownResolver.bandProbe)`.
  - Post-create nhánh (:202): `setBandProbe(resolver.bandProbe)`.
  - `subscribeToStudyMode` callback: update `currentMode` trước `void syncUnknownResolver()`.
- Resolver key giữ nguyên (không phụ thuộc mode) — probe mới nhất luôn re-wire.

### 3.5 Band source (`features/subtitle/logic/unknownCueMap.ts`)

`UnknownCueResolver` += `readonly bandProbe: CueBandProbe`.

- `rankByTerm`: **materialized `ReadonlyMap<string, number|null>`** (không phải closure) — `new Map(terms.map(t => [t, bestRank(t, freq)]))`, đúng signature `cueDifficultyMap(tokenMap, rankByTerm, thresholds, level, freqUnfiltered)` (`cueDifficulty.ts:32-38`; spec r0 sai thứ tự args — M1).
- `bandMap = cueDifficultyMap(tokenMap, rankByTerm, freq.thresholds, level, freq.unfiltered)`; `bandProbe = (i) => { const d = bandMap.get(i); return d ? cueHeatBand(d) : null; }`.
- `applyStatus` rebuild cả `unknownMap` lẫn `bandMap` (live update).
- `destroy()` clear `bandMap`.
- `freq.unfiltered` (chưa import freq list / metadata fail): mọi learnable token đếm vào strange → bands vẫn tính đúng semantic (easy = 0 từ lạ). Probe-null chỉ xảy ra trước khi resolver resolve xong hoặc không có resolver.
- zh hoạt động (`createTokenList` zh đã dùng cho pauseOnUnknown).

### 3.6 Lifecycle

- Resolver async: `bandProbe` null tới khi load xong → `'both'` (y hệt Normal).
- Cue-set đổi: resolver rebuild qua key sẵn có → probe re-wire.
- Word status đổi giữa cue: `bandMap` rebuild ngay, áp dụng boundary kế.
- SPA nav / cues cleared: resolver destroy → probe null → `'both'`.
- Pre-existing gaps (không fix trong scope này): resolver async không re-check `wantsResolver` sau await (:197); thresholds không nằm trong resolver key → band settings đổi cần cue-set change mới rebuild. Adaptive chỉ làm chúng dễ gặp hơn — note, revisit sau smoke.

### 3.7 Composability (đã-verified)

- `pauseOnUnknown` + adaptive: độc lập — `probe` pause, `bandProbe` visibility, cùng resolver.
- `practiceModeFromStudyModeId('adaptive')` → `'off'` (dictation/cloze only).
- `setSubtitle` → `applySubtitleHidden` → runtime `styleController.setHidden` + engine `updateSettings({visible})` — **không ghi persisted style** (lesson `persisted-style-must-not-carry-runtime-visibility` honored).
- `passThrough` chỉ 'normal'+OFF → adaptive luôn có state machine.
- Step 'adaptive' giữa custom chain (vd listen-check style): resolve theo `activeCueIndex` lúc step entry — "reveal" step trên easy cue = reveal trống, consistent với semantic.

## 4. Phạm vi

| Surface | Adaptive? |
|---|---|
| Streaming overlay (content script) | ✅ |
| Side panel | ✅ — mode picker chung; state machine chạy ở content script |
| Local player | ❌ — không có study-mode stack (established product state) |

## 5. Edge cases

| Case | Behavior |
|---|---|
| Probe `null` (resolver chưa load, không có resolver, cue index không có trong map) | `'both'` — an toàn, không stranding |
| `freq.unfiltered` (chưa import freq / metadata fetch fail) | Bands vẫn tính — mọi learnable đếm; sub **có thể** ẩn (cues all-known → easy). Intent đã reconcile: "không mất sub" áp cho probe-null, không áp cho unfiltered |
| Cue chỉ chứa từ ngoài `unknownLevel` | `easy` → ẩn — consistent với FAB/heat (M3, knob exposed §2) |
| Cue index -1 (gap/silence) | `enterCue` gated `targetIndex >= 0` — probe không gọi -1 |
| Tất cả words known | Mọi cue `easy` → `none` — đúng pain |
| Mark-known giữa cue | `bandMap` rebuild ngay; apply boundary kế (mọi cue chứa term, không chỉ cue hiện tại) |
| Mode→mode switch | Visibility cuối giữ tới emit đầu của mode mới (hành vi chung) |
| Manual 'w' toggle giữa adaptive | Thắng tới boundary kế |
| Custom mode với adaptive step → reload | Survive nhờ B1 fix; version cũ drop (accepted) |
| `reapplyStep` | Resolve lại theo cue hiện tại — band mới nhất |

## 6. Acceptance criteria

1. Preset `adaptive` trong mode list, chọn được, persist qua reload (STUDY_MODES storage).
2. Cue 0 strange → sub ẩn; ≥3 → both; 1–2 → target — per boundary.
3. Adaptive bật khi resolver chưa load → 'both' tới khi probe sẵn.
4. Tắt adaptive → baseline restore; switch sang listen → 'none' từ boundary kế.
5. Mark-known term → **mọi** cue chứa term đó re-band ở boundary kế (không chỉ active cue).
6. Adaptive + pauseOnUnknown=START: pause đúng trên cue có pausable token.
7. Custom mode chứa step adaptive: lưu → reload → mode còn nguyên, chạy đúng (B1 regression).
8. Manual hide/show giữa cue giữ tới boundary kế rồi adaptive re-resolve.
9. Adaptive active + panel blur: `none`/`i1` → `panelBlurred` true (uniform semantics, §2).
10. `unknownLevel` chips hiển thị khi adaptive active kể cả `pauseOnUnknown='OFF'`.

## 7. Test plan

- `resolveStepSubtitle` pure: static passthrough, adaptive × {easy,i1,dense,null}, cueIndex truyền đúng.
- `studyModePlaybackController.test.ts`: adaptive preset — enterCue easy → `setSubtitle:'none'`; chuỗi easy→dense→i1; `setBandProbe(null)` → 'both'; `reapplyStep` resolve; probe null giữa mode → 'both'.
- `subtitleStudyModeController.test.ts`: `setBandProbe` cached + re-forward qua `applyStudyMode` (M4 regression — switch mode không mất probe).
- `unknownCueMap.test.ts`: `bandProbe` band đúng; `applyStatus` rebuild `bandMap`; destroy → null; `unfiltered` bands.
- `migrateStudyModeState` test: custom mode step adaptive survive round-trip (B1).
- `contentScriptController` tests: resolver created khi adaptive-only (`pauseOnUnknown=OFF`); 3 wire sites; destroy → `setBandProbe(null)`.
- `reactSubtitleController`: `setBandProbe` pass-through.
- `StepEditor`: 'adaptive' trong options; `formatStepSummary` label.
- `StudyModesTab`: level chips visible khi adaptive-only.
- Real Chrome smoke (`tmp/adaptive-subtitles/smoke.mjs`): mock stream → bật adaptive → mark all-known → cue easy sub ẩn; leave unknowns → dense both; switch normal → baseline.

## 8. Touched files (đầy đủ)

- `src/entities/studyMode/types.ts` — union + `AdaptiveCueBand` + `CueBandProbe`.
- `src/entities/studyMode/constants.ts` — preset `adaptive` (icon `gauge`).
- `src/features/studyModes/lib/studyModePlaybackController.ts` — `bandProbe` + `resolveStepSubtitle` + 2 emit sites.
- `src/features/studyModes/lib/subtitleStudyModeController.ts` — cached field + `setBandProbe` + forward.
- `src/features/studyModes/lib/migrateStudyModeState.ts` — `SUBTITLE_VALUES` (B1).
- `src/features/studyModes/lib/formatStepSummary.ts` — `SUBTITLE_LABELS.adaptive`.
- `src/features/studyModes/ui/StepEditor.tsx` — `SUBTITLE_OPTIONS`.
- `src/features/studyModes/ui/StudyModesTab.tsx` — `modeUsesAdaptive` → `AdvancedSection`.
- `src/features/subtitle/logic/unknownCueMap.ts` — `bandProbe` trên resolver.
- `src/features/subtitle/ui/reactSubtitleController.ts` — `setBandProbe` pass-through.
- `src/features/subtitle/ui/contentScriptController.ts` — `currentMode` + `wantsResolver` + 3 wire sites.

## 9. Docs

- `docs/2-architechture-system.md`: preset `adaptive`, `CueBandProbe`/`resolveStepSubtitle`, `bandProbe` trên resolver, `SUBTITLE_VALUES` row.
- `docs/0-wiki.md`: changelog + file-tree.
- `docs/ideas/product-backlog.md`: #9 → specced → planned → in-progress → shipped(hash).
