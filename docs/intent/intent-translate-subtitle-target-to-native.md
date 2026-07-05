# Intent — Translate Subtitle Target → Native (Background Prefill)

> Output của `interview-me` (Giai đoạn 0 — Discovery). Confirmed by user.
> Revision 2026-07-05 r1: strategy đổi từ lazy sliding-window → background sequential prefill (đơn giản hơn, kết quả tốt hơn cho video dài 4h).
> Revision 2026-07-05 r2: tính năng CHUNG cho mọi site có subtitle (không chỉ YouTube). Shortcut move sang Keyboard Shortcuts tab (Card 3) trong SettingsDialog.
> Revision 2026-07-05 r3: ShortcutInput mở rộng support combo — tất cả shortcut input cùng width (pill radius-full, min-width = combo dài nhất), single-char pill + combo pill align. Combo = pill chứa key chips nằm ngang, key chính solid bg primary, modifier subtle bg.

## Outcome
Dịch subtitle từ ngôn ngữ **target** (gốc video, vd en) sang ngôn ngữ **native** (tiếng mẹ đẻ, vd vi) hiển thị song song trên player, **real-time khi xem** — khi site **không** cung cấp track native. Áp dụng cho **mọi site** extension đã support detect subtitle (YouTube, và các site khác qua `detectSubtitle`).

## User
Anh yêu (người học ngôn ngữ) — xem video tiếng Anh (hoặc ngôn ngữ khác) trên **bất kỳ site nào** muốn có song ngữ Anh–Việt mà site không cung cấp track Việt. **Kim chỉ nam: user vào và học thôi, không quan tâm setting.**

## Why now
Extension đã có bilingual overlay infrastructure (ADR-013/014: 2 overlay div độc lập, `loadBilingualCues(targetCues, nativeCues)`, target/native style, SPA nav clear). Chỉ thiếu nguồn `nativeCues` khi YouTube không có track native → dịch lấy từ target.

## Source
Dùng **subtitle track có sẵn từ site** (fetch qua infrastructure đã có — `detectSubtitle` general, không chỉ YouTube). KHÔNG tự transcribe audio.

## Translation provider
**Google Translate unofficial endpoint** (`translate.google.com/translate_a/single?client=gtx&...`):
- Miễn phí 100%, không cần API key
- ~100+ ngôn ngữ hỗ trợ
- CORS bypass qua MV3 background service worker (extension đã có `host_permissions: <all_urls>`)
- Risk chấp nhận: unofficial endpoint, Google có thể rate-limit/block bất cứ lúc nào (mitigate: sequential 1.5s gap + exponential backoff)

## Strategy — Background Sequential Prefill (đơn giản, không over-engineer)

```
1. START (video 'play' event + autoTranslate ON + no native track)
   → dịch từ cue 0, chunk 1500 chars, sequential, 1.5s gap/request
   → cache mỗi cue (Map<cueIndex, translatedText>)
   → feed loadBilingualCues(targetCues, translatedCues) mỗi chunk xong

2. SEEK
   → cache.has(seekIdx)? hiện ngay (instant)
   : dịch chunk [seekIdx, +1500 chars], resume sequential từ đó

3. GUARD 1: start trên 'play' event, không phải video load
   → user mở video không xem = 0 request

4. GUARD 2: pause queue khi tab hidden, resume khi visible
   → user switch tab 30 phút = không waste requests

5. SPA nav → clear cache + cancel queue (reuse pattern đã có)
```

### Vì sao background prefill thay vì sliding-window
- Subtitle 4h = ~6000 cues = ~300KB text = ~200 chunks × 1.5s = **5-10 phút dịch hết ở background**
- Sau 5-10 phút: **seek bất kỳ đâu = instant** (cache hit toàn video)
- Code đơn giản hơn sliding-window (~60 dòng vs ~200 dòng, 3 bước vs 6 modules)
- Memory 300KB = 0.03% RAM, không cần LRU trim
- Main thread: 0ms (translate async, overlay sync đã có O(log n))
- Network: ~400 requests trong 10 phút đầu, còn 3h50m = 0 request → Google OK

### Tham số hardcode (0 setting, đúng kim chỉ nam)
- `CHAR_BUDGET = 1500` (an toàn dưới Google GET limit ~2000)
- `MIN_REQUEST_GAP_MS = 1500` (Google unofficial an toàn)
- `MAX_RETRIES = 3` + exponential backoff 1s → 2s → 4s → give up + toast

## Success
Xem video tiếng Anh, overlay song ngữ Anh–Việt xuất hiện mượt. 5-10 phút đầu catch up, sau đó seek instant toàn video. Máy không nặng, Google không rate-limit dù video 4h.

## Constraints (confirmed decisions)
1. **Miễn phí 100%, không API key** — dùng Google unofficial endpoint (`client=gtx`).
2. **Background sequential prefill** — dịch hết từ cue 0 ở background, KHÔNG sliding-window theo playback.
3. **0 setting cho translation params** — chunk size, gap, budget hardcode. User chỉ thấy 1 toggle on/off.
4. **Source = subtitle track có sẵn từ site** (general, mọi site — không chỉ YouTube) — KHÔNG transcribe audio.
5. **Real-time khi xem** — KHÔNG download kèm subtitle đã dịch.
6. **Privacy**: subtitle là dữ liệu công khai của video, gửi qua Google Translate OK.
7. **Integration**: translated cues là `SrtCue[]` feed vào `loadBilingualCues(targetCues, translatedCues)` — reuse path ADR-013/014 đã có.
8. **Guard**: start trên 'play' event + pause khi tab hidden (không waste requests).
9. **Ctrl+Shift+T** shortcut toggle tạm thời — đặt trong **Keyboard Shortcuts tab** (Card 3 SettingsDialog). **Mở rộng ShortcutInput** support combo (hiện tại single-char `maxLength=1`) → capture keydown combo (Ctrl+Shift+Key). **Tất cả shortcut input cùng width** (pill radius-full, min-width = combo pill dài nhất) — single-char pill (←/→/R/O/P) align combo pill (Ctrl+Shift+T). Combo = pill chứa key chips nằm ngang, key chính (T) solid bg primary, modifier (Ctrl/Shift) subtle bg. Focus ring trên pill (focus-within). Thêm 'toggle-translate' vào `SHORTCUT_ACTION_ORDER` + `SHORTCUT_ACTION_LABELS`. Layout: label trái, pill phải, flex row space-between (mimic `.shortcutField` đã có). KHÔNG đặt trong section Subtitle Overlay.

## Out of scope
- Tự transcribe audio khi YouTube không có subtitle (feature khác, sau).
- Dịch UI text / metadata video (chỉ subtitle).
- Download kèm subtitle đã dịch (chỉ real-time xem).
- Cloud API trả phí (DeepL, OpenAI, Google official Translation API).
- Smart-merge timestamp (translated giữ timing target).
- Dịch sang nhiều native language cùng lúc (single native, đã có trong settings).
- Chunk size / window size configurable (hardcode, 0 setting).
- LRU trim cache (300KB full = 0.03% RAM, không cần).
- Sliding-window / idle prefetch / debounce (over-engineer, bỏ).

## Existing context (codebase)
- `src/features/detection/logic/subtitleDetector.ts` — `detectSubtitle` (general, mọi site — không chỉ YouTube).
- `src/features/subtitle/service/subtitleService.ts` — `findSubtitlesForOverlay` trả `{ target, native }` (native=null khi site không có track native → đây là gap feature này lấp).
- `src/features/subtitle/ui/subtitleOverlay.ts` — `SubtitleOverlayController.loadBilingualCues(targetCues, nativeCues)` (ADR-013/014, integration point).
- `src/features/subtitle/logic/subtitleAutoLoad.ts` — auto-load flow, SPA nav clear.
- `src/entities/settings/types.ts` — `subtitleOverlayTargetLanguage` + `subtitleOverlayNativeLanguage` (đã có, reuse). Cần thêm `subtitleOverlayAutoTranslate: boolean`.
- `src/features/settings/ui/SettingsDialog.tsx` — Card 3 "Keyboard Shortcuts" (dùng `ShortcutInput` + `SHORTCUT_ACTION_ORDER` + `SHORTCUT_ACTION_LABELS`). Shortcut translate mới thêm vào đây, KHÔNG thêm vào section Subtitle Overlay. **Cần mở rộng ShortcutInput** support combo (hiện tại single-char `maxLength=1`).
- `src/shared/ui/ShortcutInput.tsx` — atom single-char (`maxLength=1`, 40px box), cần mở rộng support combo (Ctrl+Shift+Key). **Tất cả shortcut input cùng width** = pill radius-full, min-width = combo pill dài nhất. Single-char pill center text, combo pill chứa key chips nằm ngang (key chính solid bg primary, modifier subtle bg). Layout `.shortcutField` = flex row space-between, label trái + pill phải, grid 1-column `.shortcutGrid`.
- `src/entrypoints/background/index.ts` — MV3 service worker (CORS bypass point cho Google Translate request).
- `public/manifest.json` — `host_permissions: <all_urls>` (đã có, không cần thêm permission).

## Open questions (G1 spec cần resolve)
- Fallback khi Google rate-limit: hide native overlay + toast "translation temporarily unavailable" hay retry silent? → G1 (em đề xuất toast + retry, target overlay không ảnh hưởng).
- Toggle default ON hay OFF? → G1 (em đề xuất OFF default, user opt-in để tránh surprise requests).
- Cache key: cueIndex (per-session, clear on SPA nav) vs cueText hash (cross-video)? → G3 ADR (em đề xuất cueIndex per-session — đơn giản, privacy-safe, không persist).
