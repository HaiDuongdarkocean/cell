# Intent — Immersion Playback (Quản lý Immersion Playback)

> Confirmed statement of intent cho nhóm playback-aware-vocabulary bên trong Study Modes.
> Backlog item: `immersion-playback` (docs/ideas/product-backlog.md #1).
> Source: asbplayer (condensed/auto-pause), Migaku (pause-on-unknown), internal gap.
> Confirmed: 2026-09-17 qua elicitation interview (2 rounds).

## 1. Outcome

Study Modes hiểu được "từ nào chưa biết". Video tự pause khi cue chứa từ đáng học, tự lướt qua đoạn không-sub, và mở dictionary popup đúng lúc — thay vì người dùng phải pause/tra/replay thủ công theo tâm trạng.

## 2. User

- Immersion learner đã dùng wordStatus (unknown/tracking/known/ignore) và frequency list.
- Xem video có sub trên site bất kỳ, muốn density cao mà không phá flow.
- Persona 5–80 tuổi → advanced options phải ẩn khỏi mặt định.

## 3. Why now

- Hiện tại: pause thủ công, để trôi, hoặc replay — không có flow cố định, từ chưa biết lọt mất.
- Infra đã đủ: `skipNoDialogue` (JUMP/NX) đã là condensed playback; `PausePoint` per step đã có; `wordStatusStore` + `frequencyClient` + tokenizer đã ship. Delta nhỏ, value lớn — đây là core feature mà cả asbplayer lẫn Migaku dùng làm điểm bán.

## 4. Success

- Bật pause-on-unknown (mặc định trong advanced settings của mode): cue chứa ≥1 từ `unknown`/`tracking` thuộc **active frequency list** → video pause **cuối cue** (default, tùy chọn đầu cue).
- Cue chỉ chứa từ known hoặc unknown ngoài freq list (từ hiếm) → không pause.
- `skipNoDialogue` JUMP / NX đã hoạt động — không rebuild, chỉ giữ.
- Hotkey "skip to next unknown" → seek tới cue kế tiếp có từ đáng pause.
- Tùy chọn: khi auto-pause, tự mở dictionary popup tới từ unknown đầu tiên; tùy chọn khi nào popup đóng (resume / manual).
- Không indicator/toast/badge trên màn hình — state chỉ hiện ở nơi toggle.

## 5. Constraint

- Sống **bên trong** `studyModes` feature (preset steps + advanced settings), không tạo feature mới.
- Controller (`studyModePlaybackController`) giữ pure — inject predicate `cueNeedsPause(cue)`, không import store trực tiếp.
- Tokenize async (ja cần tokenizer) → unknown-map phải precompute/incremental, không block timeupdate.
- MV3, 0 dependency mới; O(n) tuyến tính theo số cue.
- Progressive disclosure: options mới vào Advanced/settings, không thêm control lên overlay mặc định.

## 6. Out of scope

- Comprehension % / stats UI (backlog #2 `comprehension-score`).
- Mining auto-trigger, auto-add card.
- Thay đổi dictionary lookup logic (chỉ reuse popup mở sẵn).
- Per-site default profiles (để backlog #9 settings-profiles).

## 7. Data model (delta)

```ts
// StudyModeAdvancedSettings +:
pauseOnUnknown: 'OFF' | 'START' | 'END';   // default 'OFF'
pauseUnknownScope: 'FREQ_LIST' | 'ALL';    // default 'FREQ_LIST'
popupOnAutoPause: boolean;                 // default false
popupCloseOnResume: boolean;               // default true

// Injection vào controller:
type CueUnknownPredicate = (cue: SrtCue, index: number) => boolean;
```

## 8. Acceptance seeds

1. Mode Normal + pauseOnUnknown=END: cue "I have a pen" với "pen" unknown-trong-freq-list → pause lúc `cue.end`; cue toàn known → chạy qua.
2. pauseUnknownScope=ALL → mọi từ unknown đều pause.
3. Hotkey skip-next-unknown → seek tới cue đầu tiên phía sau có từ đáng pause.
4. popupOnAutoPause=true → pause xong popup dictionary mở tới từ unknown; resume → popup đóng (nếu closeOnResume).
5. Mode đang dictation/cloze → pause-on-unknown không đánh nhau (step pause của mode vẫn thắng).
