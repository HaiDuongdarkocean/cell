# Intent — `pre-watch-primer`

> Backlog: #8 · Cost: M · Value: ★★★★ · Source: migaku+internal-audit · Status: confirmed frame (autonomous — zero-questions pipeline)

## Pain (raw)

"Vào video mới dồn từ lạ → bỏ cuộc; preview top từ high-freq unknown trước khi xem"

## 8-field frame

1. **Who**: Cell user học qua comprehensible input — xem streaming (split-view subtitle panel) hoặc local player, đã bật subtitle tokenize.
2. **Problem**: vào video mới, từ lạ dồn dập theo cue — user không biết "phải gánh bao nhiêu từ" hay "từ nào đáng học trước" → bỏ cuộc. Coverage badge nói *bao nhiêu* (42 new) nhưng không nói *là những từ nào*.
3. **Current workaround**: lướt CueList săn underline đỏ — chậm, không ranking; hoặc tra từng từ khi đang xem → gián đoạn input.
4. **Trigger**: ngay sau khi video + cues load — trước khi bấm play / trong lúc video pause — user mở subtitle panel.
5. **Desired outcome**: một danh sách "Words" trong cùng panel — top từ unknown/tracking của video này, sort theo frequency rank (high-freq trước), kèm số lần xuất hiện + band; click → dictionary popup (đã có status cycle); nút seek → nhảy tới cue đầu tiên chứa từ đó. Mark known trong popup → từ biến mất khỏi list live.
6. **Success metric**: với tokenize bật + cues đã load, tab Words hiển thị đúng tập từ unknown/tracking, rank order khớp frequency list; mark known → row biến mất không cần reload; hoạt động giống nhau trên streaming split-view và local player.
7. **Constraints**: reuse `lastGood` resolution của SubtitlePanel (tokenMap + rankByTerm + thresholds) — zero fetch path mới; không bật primer khi `panelBlurred` (ngược mục đích blur); zh → suppressed như scoreSuppressed; side panel (chrome.sidePanel) không đủ context → out.
8. **Out of scope**: per-card primer trong LibraryView (badge `newTerms` đã preview số lượng); batch mark-known / export list; SRS pre-seeding từ primer; primer khi tokenize tắt; chrome.sidePanel tab.

## Assumptions (accepted risks)

- "Learnable" = status `unknown` + `tracking` — cùng semantics `firstPausableToken` (unknownCueMap) thay vì chỉ unknown.
- Rank order: rank asc → count desc → term asc; rank `null` (không có freq entry / freqUnfiltered) xếp sau cùng, sort theo count — theo lesson `frequency-band-very-low-coverage` (không drop term thiếu freq).
- Local player chưa truyền `tokenize` cho SubtitlePanels → wire `{langCode, onTokenClick}` qua `useSubtitleActions` (webTextCtrl đã tồn tại) — side effect có chủ đích: token coloring + heat bars + FAB filter cũng activate trên local player (consistent với streaming).
- Surface = Tabs trong SubtitlePanel (`Subtitles | Words | Playlist`), không strip/panel mới — Tabs đã là primitive sẵn có.
