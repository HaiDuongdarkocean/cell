# AI Bridge — 100 acceptance criteria + stress-test design

Spec của reliability contract cho AI feature (explain / breakdown / translate).
Mỗi AC có: requirement, test method, guard timeout, trạng thái hiện tại.

Test methods: **unit** (jest), **live** (playwright verify.mjs), **stress**
(stress.mjs power-user runner), **probe** (DOM audit script trên provider thật).

Legend trạng thái: ✅ done · 🟡 partial · 🔴 missing

---

## A. Correctness — prompt → answer (15)

| # | AC | Method | Guard | St |
|---|---|---|---|---|
| A01 | Prompt chứa đúng word + context sentence của selection hiện tại | unit | — | ✅ |
| A02 | Answer hiển thị = assistant message cuối, KHÔNG phải user prompt (echo guard normalize whitespace) | unit + probe | — | ✅ |
| A03 | Mỗi AI_STREAM partial có askId của ask đang chạy | unit | — | ✅ |
| A04 | Partial text luôn ≤ final text (final authoritative overwrite) | live | 60s | ✅ |
| A05 | Translate tab luôn dịch về ngôn ngữ mẹ đẻ (google tl + AI [TARGET_LANG]) | unit | — | ✅ |
| A06 | Explain/breakdown tôn trọng pick native/target | unit + live | — | ✅ |
| A07 | Reopen cùng word → cached answer <500ms, không refetch | live | 4s | ✅ |
| A08 | Retry bypass cache → ask mới chạy thật | live | 90s | ✅ |
| A09 | Breakdown format `#N` parse thành chunk/meaning/explanation | unit | — | ✅ |
| A10 | Breakdown <2 chunk hợp lệ → fallback text thường, không gãy | unit | — | ✅ |
| A11 | Source label sau khi xong = provider đã trả lời | live | — | ✅ |
| A12 | Không answer sau timeout → error state + retry, không thinking vĩnh viễn | live | 120s | ✅ |
| A13 | Answer rỗng/whitespace → coi như noAnswer | unit | — | ✅ |
| A14 | DOM mismatch (composer/unit missing) → domError, không crash | unit + probe | — | ✅ |
| A15 | AI output append vào note Anki, giữ nội dung có sẵn | unit | — | 🟡 |

## B. Reliability — never hang (25)

| # | AC | Method | Guard | St |
|---|---|---|---|---|
| B01 | AI_ASK popup-side resolve/error ≤120s mọi trường hợp | unit + live | 125s | ✅ |
| B02 | Provider-side ask ≤90s per attempt | live | 95s | ✅ |
| B03 | SW chain single-provider — không còn failover walk | unit | — | ✅ |
| B04 | SW reload giữa ask → popup timeout → error (không treo) | stress | 130s | ✅ |
| B05 | Extension reload giữa thinking → popup kế mở sạch | live | — | ✅ |
| B06 | Provider tab crash/đóng giữa ask → error ≤90s | stress | 95s | 🟡 |
| B07 | Provider tab discarded → recreate hoặc skip | unit | — | ✅ |
| B08 | Provider busy → grace retry 1 lần (cancel unwind), rồi error | unit | — | ✅ |
| B09 | Cancel trong lúc setup (composer/tab wait) → abortedAskIds abort sớm | unit | — | ✅ |
| B10 | Cancel trong lúc streaming → click Stop + resolve 'cancelled' | live | 10s | ✅ |
| B11 | Cancel đúng lúc settle → response bị gen-guard loại | unit | — | ✅ |
| B12 | Retry khi thinking → cancel + ask mới tức thì | live | 90s | ✅ |
| B13 | Đổi provider khi thinking → cancel + hỏi provider mới | live | 90s | ✅ |
| B14 | Retry spam → coalesce: abort current + chạy đúng ask cuối, không storm | stress + SW log | 120s | ✅ |
| B15 | Provider flap → pending last-wins, pick cuối chạy 1 lần | stress + SW log | 120s | ✅ |
| B16 | AI_CANCEL scope theo askId — stale cancel không giết ask mới | unit + stress | — | ✅ |
| B17 | Đóng/mở popup nhanh ×5 → mỗi popup sạch | stress | 30s | ✅ |
| B18 | AI_STREAM askId lạ → SW drop im | unit | — | ✅ |
| B19 | AI_STREAM sau final → listener đã gỡ, không update | unit | — | ✅ |
| B20 | Stream của provider cũ sau khi đổi source → bị suppress | unit | — | ✅ |
| B21 | N ask đồng thời → coalescing queue, không reject ask hợp lệ | stress + SW log | — | ✅ |
| B22 | loginRequired → focus tab login đúng 1 lần + error state | live | 30s | ✅ |
| B23 | Login wall → composer wait cap 30s | live | 35s | ✅ |
| B24 | Send button không bao giờ hiện → domError sớm ≤8s | unit + live | 10s | ✅ |
| B25 | Error của ask trước không sót sang ask sau | unit | — | ✅ |
| B26 | Provider nuốt prompt (rate-limit, không turn mới) → domError ≤15s | stress | 20s | ✅ |

## C. UI consistency — 3 tab đồng bộ (20)

| # | AC | Method | Guard | St |
|---|---|---|---|---|
| C01 | Thinking indicator giống nhau cả 3 tab (icon + "Thinking…") | live | — | ✅ |
| C02 | Streaming text + caret giống nhau cả 3 tab | live | — | 🟡 |
| C03 | Error view + retry giống nhau cả 3 tab | live | — | 🟡 |
| C04 | Translate tab stream AI partial realtime (không đợi batch) | live | 60s | ✅ |
| C05 | Translate answer đi vào card field sau khi xong | unit + live | — | 🟡 |
| C06 | Source menu mở được khi thinking (mọi tab) | live | — | ✅ |
| C07 | Retry bấm được khi thinking (mọi tab) | live | — | ✅ |
| C08 | Label "Asking X…" trong lúc hỏi | live | — | ✅ |
| C09 | Pick provider trong menu ghi ngay vào settings | live | — | ✅ |
| C10 | Pick persist qua popup kế (reopen giữ provider) | live | 5s | ✅ |
| C11 | Translate engine pick (google/ai) persist | live | 5s | ✅ |
| C12 | Language pick persist (ai/breakdown) | live | 5s | ✅ |
| C13 | Translate menu KHÔNG có lang section | live | — | ✅ |
| C14 | Menu nổi trên popup card (z-order đúng) | live | — | ✅ |
| C15 | Chunk checkbox ở đầu hàng, gap 8px | live | — | ✅ |
| C16 | Chunk tick → vào field Definitions của card | unit | — | ✅ |
| C17 | Empty state translate: nút "Translate to {native}" | live | — | ✅ |
| C18 | Esc đóng menu, click ngoài đóng menu | live | — | ✅ |
| C19 | Cached reopen không flash thinking | live | 1s | ✅ |
| C20 | Caret biến mất khi answer final | live | — | ✅ |

## D. Power-user stress (15)

| # | AC | Method | Guard | St |
|---|---|---|---|---|
| D01 | Retry spam ×10 giữa stream → final answer nguyên vẹn | stress | 90s | 🟡 |
| D02 | Đổi provider ×5 giữa stream → pick cuối thắng, không stale text | stress | 90s | 🟡 |
| D03 | Select 10 word liên tiếp → popup cuối settle đúng word | stress | 120s | 🟡 |
| D04 | Đóng popup ×5 giữa thinking → provider Stop thật | stress | 30s | 🟡 |
| D05 | Switch tab ai↔breakdown↔translate giữa stream → state nhất quán | stress | 90s | 🟡 |
| D06 | Mất mạng giữa ask → error, không treo | stress | 120s | 🟡 |
| D07 | Network 3G chậm → stream vẫn render, không false timeout | stress | 120s | 🟡 |
| D08 | Provider trả error page → error, không phải "answer" | probe | — | 🟡 |
| D09 | Xóa conversation giữa 2 ask → baseline neo lại đúng | stress | 90s | 🟡 |
| D10 | Provider tab navigate sang convo khác → ask mới neo unit mới | stress | 90s | 🟡 |
| D11 | Nhiều convo trong 1 tab → luôn lấy turn mới nhất | probe | — | ✅ |
| D12 | DOM virtualization (DeepSeek) → scrollIntoView giữ mutation | unit | — | ✅ |
| D13 | Answer về khi popup đã đóng → popup kế không bị ghost state | stress | 30s | 🟡 |
| D14 | Send card giữa stream → snapshot hoặc error rõ, không corrupt | unit | — | 🟡 |
| D15 | Tab cycle nhanh 10 lần → mọi feature ask nhất quán | stress | 120s | 🟡 |

## E. Guards & invariants (15)

| # | AC | Method | Guard | St |
|---|---|---|---|---|
| E01 | Mọi AI_STREAM mang askId | unit | — | ✅ |
| E02 | Stale askId bị suppress popup-side (gen guard) | unit | — | ✅ |
| E03 | Generation counter chặn double state write | unit | — | ✅ |
| E04 | Mỗi provider tối đa 1 tab tái dùng | live | — | ✅ |
| E05 | Provider tab tạo `active:false` | live | — | ✅ |
| E06 | Focus provider tab CHỈ khi loginRequired | live | — | ✅ |
| E07 | Ask bình thường không bao giờ đổi focus | live | — | ✅ |
| E08 | Timeout xếp lớp: composer 15s < submit 8s < ask 90s < client 120s | unit | — | ✅ |
| E09 | sendTabMessage fail → classify error, không nuốt | unit | — | ✅ |
| E10 | Verify suite có global deadline — exit kể cả khi treo | stress | 10m | ✅ |
| E11 | Mỗi stress step có budget riêng, vượt → fail step chứ không kẹt | stress | per-step | ✅ |
| E12 | Unit test không gọi mạng thật (runtime mock) | unit | — | ✅ |
| E13 | Suite chạy lặp lại deterministic | unit | — | ✅ |
| E14 | Probe DOM live định kỳ phát hiện selector drift | probe | 60s | 🟡 |
| E15 | Mọi error path có user-facing state (không dead-end im lặng) | unit | — | ✅ |

## F. Data integrity (10)

| # | AC | Method | Guard | St |
|---|---|---|---|---|
| F01 | providerPicks schema optional, validate được | unit | — | ✅ |
| F02 | persistAiCfg fresh-read → pick popup khác không bị ghi đè | unit | — | ✅ |
| F03 | Cache key = feature + provider + prompt | unit | — | ✅ |
| F04 | Cache scope tab-session (không leak cross-site) | unit | — | ✅ |
| F05 | answers[] dedup theo feature | unit | — | ✅ |
| F06 | Chunk selection reset khi đổi word | unit | — | ✅ |
| F07 | ai.reset → clear state + cancel in-flight | unit | — | ✅ |
| F08 | ISO code → tên ngôn ngữ hiển thị ("vi" → "Vietnamese") | unit | — | ✅ |
| F09 | Google translate luôn `tl = native`, không theo lang pick | unit | — | ✅ |
| F10 | Append note Anki giữ format + nội dung cũ | unit | — | 🟡 |

---

## Stress runner design (`tmp/ai-bridge-verify/stress.mjs`)

Guard framework — runner tự nó không bao giờ treo:

```
global deadline   → process.exit(2) sau 10 phút bất kể trạng thái
step budget       → mỗi step race với timeout riêng (mặc định 30s)
invariant poll    → mỗi 2s kiểm: ≤1 provider tab/provider, ≤1 ask in-flight,
                    popup không ở thinking quá budget
evidence          → dump SW __tabEvents + DOM state vào log mỗi fail
```

Scenarios đã implement (`tmp/ai-bridge-verify/stress.mjs`, attach CDP):

1. `retry-spam` — retry 6× trong thinking; assert answer cuối nguyên vẹn.
   Đã bắt bug thật: FORCE-take storm → chuyển sang coalescing queue.
2. `provider-flap` — gemini↔chatgpt giữa thinking; assert pick cuối thắng.
3. `popup-churn` — 5× đóng/mở; assert mỗi popup sạch.
4. `dom-probe` — audit selector live trên tab đang mở (drift detection).

Roadmap: `sw-kill`, `tab-kill`, `word-sprint`, `offline-mid-ask`.

## Known provider-side limits (không phải bug)

- ChatGPT rate-limit sau nhiều submit liên tiếp trong vài phút → prompt bị
  nuốt → `__noturn__` domError sau 15s (fail-fast, không treo).
- `data-testid="send-button"` đã drift — submit dựa `aria-label="Send"`.
- Gemini/DeepSeek/Claude adapter chưa được verify live đủ — selector có
  thể drift theo release của từng site; `dom-probe` là công cụ phát hiện.

Mỗi scenario = hàm nhận `{page, sw, check, step}` — step wrapper log
`[STEP name ok/fail t=Xms]` và ghi evidence trước khi throw.
