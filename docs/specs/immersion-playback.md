# Spec — Immersion Playback

> Intent: `docs/intent/immersion-playback.md` (8-field frame đã confirm 2026-09-17).
> Backlog: `immersion-playback` · Cost M · Value ★5 · Infra: videoTokenMap, studyModePlaybackController, statusKeyControls.

## 1. Phạm vi

Thêm "vocabulary-aware playback" vào Study Modes — KHÔNG tạo feature mới. Ba khả năng:

1. **Pause-on-unknown**: cue chứa ≥1 từ đáng học → pause tự động (đầu hoặc cuối cue).
2. **Skip-to-next-unknown**: hotkey seek tới cue kế tiếp có từ đáng học.
3. **Dictionary popup on auto-pause**: tùy chọn mở popup tới từ unknown đầu tiên + rule đóng.

Condensed playback (`skipNoDialogue` JUMP/NX) đã tồn tại trong `advanced` — giữ nguyên, chỉ thống nhất UI.

## 2. Data model

`src/entities/studyMode/types.ts` — mở rộng `StudyModeAdvancedSettings`:

```ts
export type PauseOnUnknownPoint = 'OFF' | 'START' | 'END';
export type UnknownLevel = 'core' | 'common' | 'general' | 'advanced';

interface StudyModeAdvancedSettings {
  skipNoDialogue: 'OFF' | '2X' | '4X' | '6X' | '8X' | 'JUMP';  // existing
  removeBracketed: boolean;                                    // existing
  pauseOnUnknown: PauseOnUnknownPoint;    // default 'OFF'
  unknownLevel: UnknownLevel;             // default 'advanced'
  popupOnAutoPause: boolean;              // default false
  popupCloseOnResume: boolean;            // default true
}
```

- Giữ `version: 1` — `sanitizeAdvanced` đã fill defaults khi field thiếu; bump version = wipe `customModes` của user (không chấp nhận). Legacy `unknownScope` (FREQ_LIST/ALL) migrate → `'advanced'`.
- "Đáng học" = token `status ∈ {unknown, tracking}` **và** rank tần suất ≤ ngưỡng của level đã chọn (`loadFrequencyBandOptions().thresholds`: core≤3k, common≤5k, general≤10k, advanced≤20k). Rank lấy từ entry trong **enabled frequency resource** (`resourcePriority`) — entry của resource disabled không tính; token không có entry nào trong enabled resource → không bao giờ pause.
- **Fallback**: khi không có enabled frequency resource nào (`resourcePriority` rỗng — user chưa import list), level không thể gate → mọi token đáng học đều pause (graceful, giữ feature dùng được).

## 3. Kiến trúc

```
videoTokenMap (đã có: per-cue tokens + status + freqBand)
        │
        ▼ inject predicate
SubtitleStudyModeController.applyStudyMode(mode, advanced, cues, offset, getPauseTarget)
        │
        ▼
StudyModePlaybackController — pure, thêm hook:
  enterCue: nếu predicate(cueIndex) trả term ≠ null:
    pauseOnUnknown=START → pause ngay (như step.pause='start')
    pauseOnUnknown=END   → cue end pause (như step.pause='end', continue→nextCue)
```

- **Probe type**: `type UnknownCueProbe = (cueIndex: number) => UnknownCueHit | null` — trả `{term, offset}` của token đầu tiên đáng học, `null` nếu không có.
- **Unknown map (không phụ thuộc videoTokenMap ±window)**: khi `pauseOnUnknown !== 'OFF'` hoặc có binding `next-unknown-cue`, composition root resolve toàn bộ cue list 1 lần qua `resolveCueListTokenMetadata` (đã có — bulk tokenize+status+freq), giữ `Map<cueIndex, firstPausableTerm>` in-memory; cập nhật incremental khi `onWordStatusChanged`. videoTokenMap chỉ phục vụ render — không reuse cho probe.
- **Ưu tiên**: step.pause của mode thắng predicate (dictation/cloze không bị unknown-pause đè). Rule: chỉ apply khi step hiện tại `pause === 'none'`; nếu step đã pause sẵn thì không cộng dồn.
- **Popup**: khi action `pause` sinh ra *bởi unknown rule* → emit thêm `{ type: 'autoPause', term, cueIndex, termOffset }` (PlaybackAction mới; `termOffset` = UTF-16 offset của token trong `cue.text`, BẮT BUỘC — worker lookup derive token từ `cursorOffset` trong `contextSentence`, offset 0 = từ đầu cue). Composition root (subtitle feature) **mô phỏng đúng click path**: tìm token span trong target line (`data-cell-start === termOffset`, fallback `textContent === term`) rồi `handleLookup(request, id, span.getBoundingClientRect(), span)` — anchor + highlight trên span y hệt manual click. **Business rule: auto-popup chỉ hoạt động khi media bật subtitle tokenize** (`isSubtitleTokenizeEnabledForUrl` — composition root track flag từ `syncSubtitleTokenize`); tokenize tắt → pause vẫn xảy ra nhưng popup không mở. `popupCloseOnResume` → đóng popup khi `continue()` phát `play`. studyModes KHÔNG import dictionaryPopup — chỉ emit action, layer sạch. `UnknownCueHit{term,offset}` sống ở `entities/studyMode` (contract chung, không cần cross-feature edge).
- **Vocabulary navigation**: `findNext`/`findPrev` scan `Map` đã resolve (O(n)); ShortcutAction `'next-unknown-cue'` + `'prev-unknown-cue'` trong `entities/settings`, default key `'x'` / `'z'` + dispatch trong `contentScriptKeyboard` → seek tới `cues[i].start`. Không wrap ở biên (hết cue → no-op).

## 4. UI (progressive disclosure)

- `StudyModesTab.tsx` (advanced section hiện có của skipNoDialogue) thêm: Pause on unknown (OFF/START/END), Unknown level (core/common/general/advanced → label Top 3k/5k/10k/20k — chỉ hiện khi pauseOnUnknown≠OFF), Popup on auto-pause (toggle), Close popup on resume (toggle, chỉ hiện khi popupOnAutoPause).
- Overlay/NavCluster: KHÔNG thêm control/badge/toast nào (requirement từ intent).
- i18n: key mới trong `en.json`/`vi.json` theo convention `studyModes.*` hiện hữu.

## 5. Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| A1 | pauseOnUnknown=END, level=advanced | cue có 1 từ unknown rank ≤20k trong enabled resource | pause tại cue.end; `continue()` → nextCue |
| A2 | pauseOnUnknown=END | cue toàn known, hoặc unknown rank > level cap, hoặc không có entry enabled | không pause |
| A3 | pauseOnUnknown=START | enter cue có từ đáng học | pause ngay khi enter |
| A4 | level=common (cap 5k) | cue chỉ có unknown rank 15k | không pause (rank vượt level) |
| A5 | mode dictation (step.pause='end' sẵn) | cue có unknown | chỉ pause 1 lần theo step, không double-pause |
| A6 | popupOnAutoPause=true + tokenize bật | unknown-pause xảy ra | popup mở anchor đúng token span; resume → đóng nếu closeOnResume |
| A6b | popupOnAutoPause=true + tokenize TẮT | unknown-pause xảy ra | pause vẫn xảy ra, popup KHÔNG mở |
| A7 | — | bấm `x` / `z` | seek tới cue kế/trước có từ đáng học; hết → no-op, không wrap |
| A8 | resolver chưa build | cue chưa có token data | không pause (fail-open, không block playback) |
| A9 | migrate v1 state / legacy unknownScope | storage cũ | defaults fill (level='advanced'), không crash, không reset mode |

## 6. Test plan

- Unit: `studyModePlaybackController.test.ts` thêm cases A1–A5, A8 (inject probe stub); `migrateStudyModeState.test.ts` A9; probe selector unit test trên token fixtures.
- Không đụng manifest → không cần real-Chrome bắt buộc; smoke sau cùng nếu wiring content-script đổi đáng kể.

## 7. Not doing

- Không comprehension %, stats, mining auto-trigger, per-site profile, indicator overlay.
