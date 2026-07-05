# ADR-021: Translate Subtitle Target → Native (Background Sequential Prefill)

> Date: 2026-07-05
> Status: Accepted
> Phase: G3 — Architecture Decision Record
> Spec: `docs/specs/spec-translate-subtitle-target-to-native.md`
> Intent: `docs/intent/intent-translate-subtitle-target-to-native.md`

## Context

Extension đã có bilingual overlay (ADR-013/014: 2 overlay div, `loadBilingualCues(targetCues, nativeCues)`). Gap: khi site không có track native → không có `nativeCues` → overlay chỉ hiện target. Cần dịch target → native để lấp gap.

**Problem**: Dịch subtitle real-time khi xem, video dài 4h, miễn phí 100% (Google unofficial), không lag main thread, không rate-limit Google.

## Decision

### D1: Background Sequential Prefill (không sliding-window)

Dịch hết từ cue 0 ở background khi video 'play', không dịch theo playback position.

**Why**: Subtitle 4h = ~6000 cues = ~300KB text = ~200 chunks × 1.5s = 5-10 phút dịch hết. Sau đó seek instant toàn video (cache hit). Đơn giản hơn sliding-window (~60 dòng vs ~200 dòng).

**Rejected: Sliding-window** — dịch theo playback, seek xa re-dịch (lag 2s), cần LRU trim (over-engineer 300KB = 0.03% RAM).

**Rejected: Batch upfront** — dịch nguyên file 1 request → Google GET limit ~2000 chars, fail.

### D2: Google Translate unofficial endpoint (`client=gtx`)

```
GET https://translate.google.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=<text>
```

- Miễn phí 100%, không API key, ~100+ ngôn ngữ
- CORS bypass qua MV3 background service worker (`host_permissions: <all_urls>` đã có)
- Risk: unofficial, Google có thể rate-limit/block → mitigate D4

**Rejected: Cloud API trả phí** (DeepL, OpenAI, Google official) — out of scope (spec).

**Rejected: Browser built-in translator** — không programmable, không control quality.

### D3: Hardcode params (0 setting)

```ts
const CHAR_BUDGET = 1500;        // an toàn dưới Google GET ~2000
const MIN_REQUEST_GAP_MS = 1500; // Google unofficial an toàn
const MAX_RETRIES = 3;           // backoff 1s → 2s → 4s → give up
```

**Why**: Kim chỉ nam "user vào và học thôi, không quan tâm setting". Chunk size là implementation detail.

**Rejected: Chunk size configurable** — over-engineer, user không nên quan tâm.

### D4: Sequential queue + exponential backoff

- Sequential (không parallel) — Google block parallel requests
- 1.5s gap giữa requests
- 429/empty → backoff 1s → 2s → 4s → give up + toast (F7)
- Target overlay không ảnh hưởng (graceful degradation)

### D5: Cache per-session in-memory (Map<cueIndex, string>)

- Key: `cueIndex` (per-video, per-session)
- Clear on SPA nav (reuse pattern `subtitleAutoLoad.ts`)
- Không persist chrome.storage (privacy — không lưu subtitle user xem)
- 300KB worst case 4h video = 0.03% RAM, không trim

**Rejected: cueText hash cross-video** — privacy concern (cross-video tracking), phức tạp hơn, lợi ích nhỏ.

**Rejected: Persist chrome.storage** — privacy, storage grow vô hạn.

### D6: Guards (không waste requests)

1. **Start trên 'play' event** (không phải video load) — user mở video không xem = 0 request
2. **Pause khi tab hidden** (`visibilitychange`) — user switch tab 30 phút = không waste

### D7: ShortcutInput mở rộng support combo

- Hiện tại: single-char `maxLength=1`, 40px box
- Mở rộng: capture keydown combo (Ctrl+Shift+Key), store as `{ctrl, shift, alt, key}`
- **Backward compat**: 5 shortcut cũ → `{ctrl:false, shift:false, alt:false, key:'R'}`
- **Tất cả shortcut input cùng width** = pill radius-full, min-width = combo pill dài nhất
- Combo = pill chứa key chips nằm ngang, key chính solid bg primary, modifier subtle bg
- Layout mimic `.shortcutField` (flex row space-between, label trái + pill phải)

### D8: Integration — reuse loadBilingualCues (0 thay đổi overlay)

```
translatedCues: SrtCue[] = targetCues.map((c, i) => ({ ...c, text: cache.get(i) ?? '' }))
loadBilingualCues(targetCues, translatedCues)
```

- Translated cues giữ timing target, thay text
- Overlay sync O(log n) đã có (ADR-013), không đổi
- Trigger khi `findSubtitlesForOverlay` trả `native=null` + `autoTranslate ON`

## Consequences

### Positive
- 0 new dependency (fetch + URLSearchParams + JSON.parse stdlib)
- 0 new permission (host_permissions đã có)
- 0 thay đổi overlay code (reuse ADR-013/014)
- ~60 dòng prefill controller + ~30 dòng service + ~20 dòng chunker
- Seek instant sau 5-10 phút (cache hit toàn video)
- Main thread < 2ms (translate async, overlay sync đã có)

### Negative
- Google unofficial có thể block bất cứ lúc nào → toast + retry (D4)
- 5-10 phút đầu tiên seek xa = lag ~2s (catch up chunk mới) — acceptable
- User mở video 4h rồi đóng không xem = 0 request (guard D6), nhưng play 10s rồi đóng = ~7 requests waste — acceptable

### Neutral
- ShortcutInput atom thay đổi (affects 5 shortcut cũ) — backward compat, test tất cả pass

## Alternatives Considered

| Alternative | Why rejected |
|---|---|
| Sliding-window prefetch | Over-engineer, seek xa lag, LRU trim không cần |
| Batch upfront (1 request) | Google GET limit ~2000 chars, fail |
| Cloud API trả phí | Out of scope (spec) |
| Browser built-in translator | Không programmable |
| Chunk size configurable | Over-engineer, user không quan tâm |
| cueText hash cache cross-video | Privacy concern, phức tạp |
| Persist chrome.storage | Privacy, storage grow |
| Parallel requests | Google block parallel |

## References

- Spec: `docs/specs/spec-translate-subtitle-target-to-native.md`
- Intent: `docs/intent/intent-translate-subtitle-target-to-native.md`
- Mockup: `docs/mockups/mockup-translate-subtitle-target-to-native.html` (v6)
- ADR-013: Subtitle appearance manager (2 overlay div)
- ADR-014: Subtitle selector multi-match (findSubtitlesForOverlay)
- ADR-016: FSD screaming architecture (new feature `src/features/translate/`)
- ADR-003: Background ↔ content-script messaging (tabId filter)
