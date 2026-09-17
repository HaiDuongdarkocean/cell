# Intent — Cue Recommend FAB (Quản lý Cue đề xuất)

> Confirmed statement of intent cho FAB lọc cue theo độ khó trong SubtitlePanel.
> Backlog item: `cue-recommend-fab` (docs/ideas/product-backlog.md #4).
> Source: user. Confirmed: 2026-09-17 qua elicitation interview (1 round, 4 câu).
> Inquiry: `/inquiry-creativity` sinh mode list + edge cases (theo yêu cầu của Anh).
> Scope: product hoàn chỉnh ship được — không MVP (AGENTS.md mandate 2026-09-17).

## 1. Outcome

Khi đang xem video với subtitle panel, user mở FAB góc phải dưới panel → chọn chế độ lọc (i+1 là headline) → CueList chỉ còn các cue match → seek trực tiếp tới cue đáng học, thay vì đọc lướt cả list hoặc để cue vàng trôi qua.

## 2. User

- Immersion learner đã dùng wordStatus (unknown/tracking/known/ignore) + frequency list.
- Xem trên mọi surface có SubtitlePanel: Player Mode, Split View, local player.
- Persona 5–80 tuổi → FAB glanceable, menu tự giải thích bằng label + count, keyboard/screen-reader dùng được.

## 3. Why now

- Hiện tại: đọc lướt subtitle list nhìn underline unknown để đoán cue nào "vừa sức" — hoặc bỏ qua, từ đáng học trôi mất.
- Infra đủ: `CueList` đã resolve `CueListTokenMap` (per-cue tokens có `status` + `frequencyBand`) và expose qua `onTokensResolved` → đếm từ lạ per cue = O(n) trên data có sẵn, zero extra fetch. Migaku "Export 1T" + asbplayer auto-pause-on-unknown validate pattern.

## 4. Success

- FAB circle bottom-right trong `cueListWrap` của mọi SubtitlePanel, luôn hiện khi có data để compute (kể cả 0 match — badge "0").
- Badge trên FAB = số cue i+1 hiện tại (headline metric).
- Click FAB → menu liệt kê modes kèm count per mode: Tất cả / i+1 (1–2 lạ) / Có từ lạ (≥1) / Toàn quen (0 lạ) / Khó (≥3 lạ) / Đang học (≥1 tracking). Active mode được đánh dấu.
- Chọn mode → CueList filter tương ứng; "Tất cả" → tắt filter.
- "Từ lạ" = token `unknown`/`tracking` qua freq gate — cùng semantics `unknownCueMap`; freq list tắt → đếm mọi unknown/tracking (unfiltered fallback).
- Click cue trong filtered list → seek như thường; current-cue highlight hoạt động trong filtered set.
- Live: mark từ → counts + list update ngay (`onWordStatusChanged` đã chạy trong CueList).
- Mode đã chọn persist qua reload/đổi surface (storage key riêng, convention `splitViewPct`) — product expectation, không phải session-only.
- i18n đầy đủ en/vi; a11y: aria-labels, `role=menu`, keyboard nav, focus trap đúng chuẩn shared/ui.

## 5. Constraint

- Reuse `tokenMap` qua `onTokensResolved` — KHÔNG fetch status/frequency thêm.
- Filter = predicate prop trên CueList, không đụng render pipeline; CueList giữ là sole scroll container.
- `tokenize` off / langCode zh-family (suppress như comprehension-score) / `practiceMode !== 'off'` → không data → FAB không render.
- MV3, 0 dependency mới; O(n) tokens memoized; component từ `src/shared/ui/`, icon từ `ICON_CATALOG`.
- Menu dùng primitive hiện hữu (`Popover`/menu pattern của repo) — không hand-roll nếu đã có.

## 6. Out of scope

- Playback integration: auto-jump/auto-loop tới cue match (backlog #10 `dense-cue-replay` + studyModes).
- Per-site/per-language defaults cho mode.
- Click-through tới word list từ cue (vocabulary-browser #3 đã ship riêng).

## 7. Data model (delta)

```ts
type CueFilterMode = 'all' | 'i1' | 'hasUnknown' | 'allKnown' | 'dense' | 'tracking';

interface CueDifficulty {
  strangeCount: number;   // unknown + tracking, freq-gated
  trackingCount: number;  // tracking-only subset
}

// pure: cueDifficultyMap(tokenMap) → Map<number, CueDifficulty>
// pure: cueMatchesMode(diff, mode) → boolean
// CueList += prop cueFilter?: (cueIndex: number) => boolean
// STORAGE_KEYS += CUE_FILTER_MODE
```

## 8. Acceptance seeds

1. Episode có 12 cue với 1–2 từ lạ → FAB badge "12"; chọn i+1 → list còn đúng 12 cue.
2. Mark 1 từ unknown→known trong cue 1-lạ → cue rời filter, counts update live.
3. Tokenize off → không FAB. zh cues → không FAB. Practice mode → không FAB.
4. Mode "Toàn quen" 0 match → EmptyState trong list, menu hiện count 0.
5. Đổi video (cues reload) → filter giữ nguyên, counts derive lại; reload page → mode persist.
6. Click cue trong filtered list → seek đúng timestamp.
7. Mở menu bằng keyboard, navigate arrows, Esc đóng, focus trả về FAB.
