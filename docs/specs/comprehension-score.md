# Spec — Comprehension Score (Quản lý Độ hiểu)

> Intent: `docs/intent/comprehension-score.md` (8-field frame confirmed 2026-09-17).
> Backlog `#2` · Cost M · Value ★5 · Infra: tokenize × wordStatus, frequencyClient (không bắt buộc — score chỉ cần status).
> Backlog row: `docs/ideas/product-backlog.md` #2 `comprehension-score`.

## 1. Phạm vi

**User story**: As a language learner, I want a difficulty score on every tokenized surface, so that I know content is "vừa sức" before investing watch/reading time — không còn xem thử vài phút rồi đoán.

Hiển thị **độ hiểu (coverage score)** của content đang tokenize — một chỉ số glanceable trên màn hình trả lời "media/text này vừa sức hay quá khó TRƯỚC khi consume". Không tạo pipeline mới — aggregate data `wordStatus` hệ thống đã fetch sẵn.

**Baseline rule**: `getWordStatuses` trả map rỗng (failure, hoặc 0 terms) → KHÔNG hiện score (fail-open). Store trả mọi term kèm default `'unknown'` nên map rỗng chỉ xảy ra khi fail — all-unknown thật vẫn hiện score thật (0% là honest signal, không phải bug).

**Language guards**:
- `langCode` normalize về base 2-char trước mọi message call (`'zh-hans'→'zh'`) — schemas yêu cầu `z.string().length(2)` (`dictionarySchemas.ts`), variant sẽ fail validation → all-unknown.
- **zh-family (zh/zh-hans/zh-hant) → suppress score v1**: `segmentFMM` chạy với `hasTerm:()=>false` → single-char tokens, trong khi wordStatus lưu theo headword đa-ký-tự → score structurally ~0%. Honest hơn fake score. Upgrade path: `segmentFMM` với `hasTerm` probe backed by dictionary/marked-terms.

Hai loại content (dứt khoát chỉ 2):
- **media**: subtitle cues của video đang load (`useCuesStore.targetCues`) — streaming pages + local player.
- **text**: văn bản được tokenize — web page (webTokenizeController) + reader book.

Page có cả hai (YouTube: video + page text) → **toggle pill 2 icon**, media = default. Display-only v1: pill không mở word list, không click-through.

## 2. Data model & formula

`src/entities/comprehension/types.ts` (contract chung, không cross-feature edge):

```ts
export type ComprehensionKind = 'media' | 'text';
export type ComprehensionBand = 'comfortable' | 'stretch' | 'hard';

export interface ComprehensionStats {
  kind: ComprehensionKind;
  totalTokens: number;      // non-separator tokens (running words)
  knownTokens: number;      // status 'known' + 'ignore'
  trackingTokens: number;   // status 'tracking'
  unknownTokens: number;    // status 'unknown'
  coverage: number;         // 0–100, 1 decimal
  band: ComprehensionBand;
  newTerms: number;         // unique terms status unknown|tracking
}
```

**Formula** (research-backed, detail: intent doc):

```
coverage = (known + ignore + 0.5·tracking) / totalTokens × 100
```

- `known`/`ignore` = 1.0 · `tracking` = 0.5 (partial knowledge giúp comprehension — Schmitt et al. 2011 linear relationship) · `unknown` = 0.
- Đếm **running tokens** (mọi occurrence) — đúng định nghĩa coverage của Hu & Nation (2000): "% running words known". Separators excluded; **pure-numeric tokens** (`2024`, `3,000`, `50%`) cũng excluded — research đếm từ vựng, không đếm số.

**Fetch discipline** (hard constraint từ message schema):
- `terms` cap **1000/request** + term length ≤200 chars (`dictionarySchemas.ts:173,200`) → source phải **chunk ≤1000** + filter term >200 trước khi gửi (convention `videoTokenPreloader` chunkSize=100).
- `getWordStatuses`/`getFrequencyEntries` fail → trả **empty Map** (không throw) → empty-map = failure signal cho fail-open.

**Bands** (media = listening ngưỡng thấp hơn text = reading — van Zeeland & Schmitt 2013 vs Laufer & Ravenhorst-Kalovski 2010 / Nation 2006):

| Band | media | text | Label (en/vi) |
|---|---|---|---|
| `comfortable` | ≥ 95 | ≥ 98 | Comfortable / Thoải mái |
| `stretch` (i+1) | 90 – <95 | 95 – <98 | Just right / Vừa sức |
| `hard` | < 90 | < 95 | Too hard / Quá khó |

## 3. Kiến trúc

```
┌─ pure core ────────────────────────────────────────────────┐
│ src/features/tokenize/logic/comprehensionScore.ts          │
│  computeStats(tokens, kind) → ComprehensionStats           │
│  createScoreTracker(tokens, statuses) → {                  │
│    stats(kind), applyStatus(term,status) → stats | null }  │
│   (giữ Map<term,{count,status}> → update O(1))             │
└────────────────────────────────────────────────────────────┘
        ▲ media source            ▲ text source
        │                         │
  useCuesStore.targetCues   webTokenizeCtrl blocks / reader paragraphs
   tokenize cue.text          prepareTokenBlock / tokenizeTextBlock
   + getWordStatuses           + getWordStatuses (1 batched call)
        │                         │
        └────────► ComprehensionPill (src/features/tokenize/ui/) ◄┘
                   + chips: SubtitlePanel header, reader header
```

**Score sources:**

- **Media**: subscribe `useCuesStore` (đã là zustand `subscribeWithSelector`). Khi `targetCues` thay đổi non-empty → `createTokenList(cue.text, langCode)` per cue → collect unique terms → 1 `getWordStatuses(langCode, terms)` → tracker. langCode = `settings.subtitleOverlayTargetLanguage` (cùng lang tokenize dùng). Chạy khi cues tồn tại — KHÔNG cần subtitle tokenize bật (score là stats, không phải display; không DOM writes — chỉ O(n) tokenize + 1 batched lookup).
- **Text trên web page**: CHỈ khi `isTokenizeEnabledForUrl(loadTokenizeSettings(), url)` — respect "đừng đụng page của tôi" + bound cost. `blocks` của controller là private → `getBlocks()` exposes the scanned list; score đọc CHỈ tokens đã prepare (`b.tokens` — set bởi viewport/overscan VDLT path), KHÔNG trigger tokenize mới (score path không được tokenize whole page). Coverage theo prepared set tại thời điểm recompute — `unprepared` count nằm trong signature nên prepare sau đó (scroll) trigger recompute qua notify throttle 400ms. Source lấy tokens → chunk terms → `getWordStatuses` → tracker. Recompute debounced (trailing 400ms + max-delay 1500ms) khi MutationObserver thêm block mới hoặc blocks được prepare thêm. `getAllTokens()` (prepare-all helper) vẫn public cho non-score consumers nhưng score path không dùng.
- **Reader**: book mở → `tokenizeTextBlock` mọi paragraph → collect terms → chunked `getWordStatuses` → tracker. Book lớn → compute chunked (yield giữa paragraphs); nếu measure >3s trên 1GB RAM → sample-first rồi refine. Wire `onStatusChange` cho DictionaryPanelView trong reader → `emitWordStatusChanged` để chip update live same-context (reader không có cross-tab relay).

**Race guard (status đổi giữa chừng resolve)**: subscribe `onWordStatusChanged` TRƯỚC khi await `getWordStatuses`; events đến trong lúc await → buffer; sau khi tracker built → replay buffer lên tracker. Cùng pattern `statusVersionCounter` của webTokenizeController nhưng đơn giản hơn (1 tracker, không per-block).

**Failure**: `getWordStatuses` reject/timeout → fail-open: không pill/chip, `console.warn` 1 lần. Không retry loop (score là nhạy cảm-không-critical).
- **CueList reuse path (SubtitlePanel chip)**: CueList đã resolve `tokenMap` cho render — thêm optional prop `onTokensResolved?: (map: CueListTokenMap) => void`, SubtitlePanel derive stats bằng `computeStats` → chip ở `styles.header`. Không thêm lookup nào.

**Live update**: mọi tracker subscribe `onWordStatusChanged` (đã có event bus) → `applyStatus` O(1) → republish stats. Cross-tab sync đi qua `wordStatusCrossTab` hiện hữu (nếu nó đã emit `onWordStatusChanged` trong tab nhận thì free; nếu không — accepted risk, score mới đúng sau reload. Verify ở plan).

**Pill (floating, web pages + local player page)**:
- `mountComprehensionPill` — shadow-DOM mount giống `mountOrbitalBadge`, `position: fixed` top-right edge, `var(--z-overlay-top)`. V1: fixed position (không drag — accepted simplification, upgrade path: reuse `useOrbitalSnap`/`badgeCollapse`).
- Nội dung: `[icon] 92%` + band color token; khi cả media+text stats tồn tại → pill có 2 segment icon, active = media default, tap segment = đổi hiển thị (display-mode switch, không phải click-through).
- Không stats → không mount pill (không hiện rỗng).
- Local player page mount cùng pill (extension page, fixed OK) — cover glanceable khi panel đóng.

**State bus per surface**: mỗi context 1 `comprehensionStore` nhỏ (zustand hoặc plain subscribe pattern theo `tokenizeStateStore`): `{ media?: ComprehensionStats, text?: ComprehensionStats, active: 'media'|'text' }`. Pill/chip subscribe.

## 4. UI

- `ComprehensionBadge` (presentational, `src/features/tokenize/ui/`): props `{ stats: ComprehensionStats, kind, size? }` — render `icon + coverage% + band`. Band → color token (thoải mái/vừa sức/quá khó — dùng status palette hiện hữu, KHÔNG hardcode màu — check `tokens.json`/`tokenSpanCss` status colors trước khi chọn).
- `ComprehensionPill` = badge + media/text toggle segment (chỉ render toggle khi cả hai stats có).
- Mount points:
  - Web page: floating pill cạnh OrbitalBadge zone (top-right edge default; không che NavCluster — NavCluster ở video, pill ở viewport edge).
  - `SubtitlePanel` header (`styles.header`, cạnh title) — chip media score khi có.
  - Reader `App.tsx` header — chip text score cạnh `readerStats`.
  - Local player: floating pill (glanceable khi panel đóng) + SubtitlePanel chip tự có khi mở.
- i18n: keys `comprehension.*` trong `en.json`/`vi.json` — band labels, aria-label ("Comprehension 92% — just right").
- Icon: check `ICON_CATALOG` trước (media → captions/play icon hiện có; text → fileText/book). Không icon phù hợp → `design-svg` skill.

## 5. Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| A1 | episode 1000 tokens, 950 known | cues load | pill hiện "95.0%" band `comfortable` (media) |
| A2 | media coverage 93% | — | band `stretch` |
| A3 | media coverage 89.9% | — | band `hard` |
| A4 | text coverage 96% | reader/web | band `stretch` (không phải comfortable — text ≥98 mới comfortable) |
| A5 | token status unknown→known | `onWordStatusChanged` fire | coverage tăng đúng delta, không refetch toàn bộ |
| A6 | tracking=10/100 tokens | — | coverage cộng 0.5×10=5 |
| A7 | YouTube page: cues loaded + tokenize on | — | pill 2 icon, media default, tap text icon → text score |
| A8 | tokenize off cho URL | page load | không text score (media vẫn có nếu cues tồn tại) |
| A9 | không cues, không tokenize | — | không pill |
| A10 | cue set đổi (đổi video/episode) | targetCues thay | stats rebuild 1 lần, 1 batched lookup |
| A11 | `zh` cues | — | status match case-sensitive đúng convention tokenListMetadata |
| A12 | 1500-cue episode (~10k tokens) | cues load | first score <3s trên máy 1GB (1 batched status call) |
| A13 | reader book mở | — | header chip coverage đúng vs manual count trên fixture |
| A14 | `ignore` status | — | tính known |
| A15 | `getWordStatuses` reject | cues load | không pill, console.warn, không crash |
| A16 | status đổi giữa lúc resolve | mark known trong await window | tracker phản ánh status MỚI (buffered replay) — không bị snapshot cũ đè |
| A17 | statusMap rỗng (chưa mark từ nào) | cues/text resolve | score suppressed — không hiện 0% Quá khó |

## 6. Test plan

- Unit `comprehensionScore.test.ts`: A1–A6, A11, A14 + edge (empty tokens → stats null/zero-guard; tất cả separator; 100% → comfortable; boundary 95.0/98.0 exact).
- Tracker test: `applyStatus` cập nhật đúng + trả stats mới chỉ khi đổi.
- Component test `ComprehensionBadge`/`Pill`: render %, band label, toggle media/text, hidden khi no stats.
- Wiring: mock `getWordStatuses`/`cuesStore` — verify 1 batched call per cue-set change.
- Không đụng manifest → real-Chrome smoke theo `testing-extension-browser` khi wiring content-script xong (pill mount + toggle trên mock-youtube).

## 7. Boundaries & DoD

- Always: `npm run typecheck && npm run lint && npm run test:unit && npm run build` trước commit; named export; không comment; reuse `src/shared/ui/` + tokens.
- Ask first: manifest change, dependency mới (KHÔNG cần), settings schema change (KHÔNG cần v1).
- Never: fake `shipped` khi gate đỏ; click-through word list (đó là #3).
- DoD: A1–A14 pass · gates xanh · `docs/2-architechture-system.md` updated · spec link vào backlog row.

## 8. Success criteria

- User nhìn pill biết content vừa sức hay không **trước khi xem** — không cần xem thử vài phút.
- Đo đúng trên mọi tokenized surface; media/text rõ ràng; không visual noise.

## 9. Alternatives considered

- **Score trong UniversalPanel / SubtitlePanel-only** thay vì floating pill: rejected — panel đóng = không glanceable, vi phạm "xuất hiện trên màn hình mà có thể xem được".
- **Reuse `resolveCueListTokenMetadata` cho media score** (trả status + freqBand): rejected — score chỉ cần status; fetch thêm frequency là waste. Lean pass `createTokenList` + `getWordStatuses` đủ. (CueList chip path vẫn reuse tokenMap đã-resolve — free.)
- **Hoist `tokenMap` state lên SubtitlePanel** thay vì callback prop: rejected — CueList owns lifecycle + overrides ref; hoist = refactor lớn hơn, diff nhiều hơn. `onTokensResolved` callback = smallest diff.
- **4-band scale** (thêm "easy/boring" trên comfortable): rejected — 3 band đủ decision-making; Krashen i+1 chỉ cần biết "vừa sức" hay không.
- **Unique-lemma coverage** thay running tokens: rejected — chệch research definition; running = đúng coverage metric.

## 10. Open questions / accepted risks

- `tracking` = 0.5: documented assumption (Schmitt 2011 partial knowledge). Nếu feel sai → flip 1 constant.
- Pill v1 không draggable — fixed top-right. Collision với OrbitalBadge (default right-center): khác vùng dọc; nếu user kéo badge lên top → overlap possible. Accepted; upgrade path snap-to-edge.
- Text score scan toàn page 1 lần khi tokenize on — page cực lớn có thể chậm; mitigation: chạy sau activation + không block UI. Cap N block nếu measure thấy >3s.
- Media score chạy kể cả khi subtitle tokenize off (cues vẫn load) — by design: score là stats không phải token display.
- zh-family suppressed v1 (xem §1 language guards) — mất feature cho Chinese content cho tới khi segmenter có dictionary probe.
- Lemma/surface mismatch: statuses key theo headword (`went` token vs `go` marked) — system ceiling hiện hữu của mọi status path, score inherit.
- Cross-tab: relay chỉ start ở content-script → reader/local-player/sidepanel score đúng on-open + same-context events; không live cross-context v1.
- Sidepanel SubtitlePanel chip: compute từ CueList tokenMap (same-context events update được); cross-context đến sidepanel không đến được v1.
- ~~Cross-tab wordStatus update~~ → RESOLVED: `startWordStatusCrossTabRelay` (`content-script.ts:33`) emit `onWordStatusChanged` trong tab nhận → cross-tab refresh free.
- ~~langCode detection~~ → RESOLVED: toàn bộ subtitle pipeline (unknownCueResolver, trigger, lookup) dùng `settings.subtitleOverlayTargetLanguage` (`contentScriptController.ts:177,218,319`) — score follow cùng convention, không cần detection riêng.

## Elicitation revision log

- r0 2026-09-17: draft từ confirmed 8-field frame + inquiry research (Nation/Laufer/van Zeeland-Schmitt/Schmitt 2011/Krashen) + doubt-driven fresh-context review.
- r1 2026-09-17: spec-review-stakeholder APPROVE WITH CHANGES → thêm baseline rule (A17), race guard (A16), failure fail-open (A15), Alternatives section, user story, reader perf note, langCode open question.
- r2 2026-09-17: doubt-driven fresh-context review reconcile → chunk ≤1000 terms + term ≤200 chars (schema cap), langCode normalize 2-char, zh-family suppress v1 (segmenter granularity), numeric-token exclusion, `getAllTokens()` controller API cho text path, relay coverage gaps documented, cross-tab + langCode open questions resolved.
