# Plan: Verify Predictive Viewport Tokenize (VDLT-Predict)

> Sử dụng subagents để xác minh acceptance criteria (AC) của từng task trong `tasks/todo.md` đã được đáp ứng bởi code, tests, và docs.

## Nguyên tắc verify

- Mỗi phase (A–D) được giao cho một `subagent_explore` đọc code, tests, spec, và ADR.
- Subagent trả về report ngắn theo mẫu: task, AC, evidence, verdict (PASS / PARTIAL / FAIL / NEEDS_MANUAL), ghi chú.
- Không được sửa code trong phase verify. Nếu phát hiện FAIL, ghi rõ root cause và đề xuất fix.
- Evidence hợp lệ: code lines, test lines, test run output, ADR/spec quotes.

## Phase A — Baseline overscan + prepare≠bind + cache bump

| Task | Acceptance Criteria | Verification | Evidence cần kiểm |
|------|---------------------|--------------|-------------------|
| A1 | `LOW_MEMORY_CACHE_CAPACITY=150`, `MID=300`, `BASE=500`; `BASE_OVERSCAN_ROOT_MARGIN_PX=600` | `grep` constants in `webTokenizeController.ts`; run `tokenizeCache` tests | `src/features/tokenize/controller/webTokenizeController.ts` lines 23–55 |
| A2 | `prepareBlock` scheduled at `PRIORITY_PREPARE`; `bindVisibleBlock` at `PRIORITY_VIEWPORT`; no re-tokenize when `block.tokens` set | `grep` scheduler usage; `grep` `prepareTokenBlock` guard; run tests | `webTokenizeController.ts` `observeBlock` onEnter, `textTokenizer.ts` `prepareTokenBlock` |
| A3 | `unbindTokenBlock` keeps `block.tokens` and `block.isBound=false`; rebind no re-tokenize | `grep` test expectations; `grep` `unbindTokenBlock` implementation | `src/features/tokenize/ui/tokenSpanRenderer.test.ts` line 51–65, `tokenSpanRenderer.ts` |

## Phase B — Direction-aware overscan + soft unbind behind

| Task | Acceptance Criteria | Verification | Evidence cần kiểm |
|------|---------------------|--------------|-------------------|
| B1 | `resolveScrollPredictMargin` returns `{rootMargin, direction}`; deep ahead / shallow behind; hysteresis ≥16px; min floors 600/150; `none` isotropic; valid CSS | run `scrollDirection.test.ts`; check function branches | `src/features/tokenize/logic/scrollDirection.ts`, `scrollDirection.test.ts` |
| B2 | passive `scroll` listener on `window`; rAF coalescing; listener added on enable, removed on disable/destroy | `grep` `addEventListener('scroll'` and `requestAnimationFrame` in controller; check destroy path | `webTokenizeController.ts` lines 145–203, 425–428 |
| B3 | direction change recreates `ViewportTracker`; re-observes connected blocks; visible set intact | run `webTokenizeController.test.ts` line 763; check `recreateViewportWithMargin` | `webTokenizeController.ts` lines 172–183 |

## Phase C — Cold-start viewport-first

| Task | Acceptance Criteria | Verification | Evidence cần kiểm |
|------|---------------------|--------------|-------------------|
| C1 | `setActive(true)` binds viewport blocks immediately; no wait for `HYDRATION_QUIET_MS` | run `webTokenizeController.test.ts` line 690; check `setActive` calls `bindViewportNow` before `scanAndObserveBlocks` | `webTokenizeController.ts` lines 400–420 |
| C2 | persisted enable waits `window.load` but binds viewport immediately after (or instantly if `readyState==='complete'`); offscan bulk capped by `HYDRATION_QUIET_MS`/`MAX_ACTIVATION_DELAY_MS` | run `webTokenizeController.test.ts` line 715; check `handleLoad`/`activate` | `webTokenizeController.ts` lines 585–620 |

## Phase D — Verify + docs

| Task | Acceptance Criteria | Verification | Evidence cần kiểm |
|------|---------------------|--------------|-------------------|
| D1 | non-regression: mutation fast path, cache eviction, viewportTracker already-intersecting, characterData/removedNodes — all tests green; no new console errors | run full `npm run test:unit`; run `npm run typecheck`; run `npm run build` | test output, build output, `webTokenizeController.test.ts` mutation tests |
| D2 | `docs/2-architechture-system.md` tokenize section reflects prepare-ahead + direction margin + cold-start + cache tiers | read tokenize section in wiki; compare with code constants | `docs/2-architechture-system.md` line 53 |
| D3 | ADR-058 exists, records WHY, and is listed in `docs/0-wiki.md` | `ls docs/adr/058*`; read ADR; grep wiki | `docs/adr/058-predictive-viewport-tokenize.md`, `docs/0-wiki.md` |

## Đầu ra

- Mỗi phase subagent gửi report: `verdict`, `confidence` (low/medium/high), `evidence` (file lines), `notes`.
- Tổng hợp thành bảng cuối cùng, cập nhật `tasks/todo.md` với trạng thái verify.

## Kết quả tổng hợp

| Phase | AC | Subagent verdict | Sau fix / manual | Evidence chính | Ghi chú |
|-------|----|------------------|------------------|----------------|---------|
| A | A1 | PASS | PASS | `webTokenizeController.ts:29-31, 32-40, 47` | constants tiered 150/300/500, overscan 600px |
| A | A2 | PARTIAL | PASS | `webTokenizeController.ts:304-311`, `textTokenizer.ts:40`, `textTokenizer.test.ts:145-173` | đã thêm test `prepareTokenBlock` không re-tokenize |
| A | A3 | PASS | PASS | `tokenSpanRenderer.test.ts:51-65`, `tokenSpanRenderer.ts:146-171` | soft-unbind preserves tokens |
| B | B1 | PASS | PASS | `scrollDirection.ts:44-95`, `scrollDirection.test.ts` | asymmetric margin, hysteresis, min floors, CSS |
| B | B2 | PASS | PASS | `webTokenizeController.ts:186-203, 409, 419, 860-867` | passive scroll listener + rAF + cleanup |
| B | B3 | PASS | PASS | `webTokenizeController.ts:172-183`, `webTokenizeController.test.ts:763-800` | recreate + re-observe on direction change |
| C | C1 | PASS | PASS | `webTokenizeController.ts:402-416`, `webTokenizeController.test.ts:690-713` | `bindViewportNow()` before `scanAndObserveBlocks` |
| C | C2 | PASS | PASS | `webTokenizeController.ts:585-627`, `webTokenizeController.test.ts:715-758` | viewport bind immediately after `load` |
| D | D1 | NEEDS_MANUAL | PASS (automation) | `npm run typecheck` 0, `npm run test:unit -- --testPathPatterns tokenize` 109/109, `npm run build` success | manual real-article/fullscreen vẫn cần test Chrome profile |
| D | D2 | PASS | PASS | `docs/2-architechture-system.md:53` | all tech details documented |
| D | D3 | PASS | PASS | `docs/adr/058-predictive-viewport-tokenize.md`, `docs/0-wiki.md:70` | ADR + wiki listing |

### Commands manual đã chạy

- `npm run typecheck` ✓
- `npm run test:unit -- --testPathPatterns tokenize` (109 tests passed) ✓
- `npm run build` ✓

### Action items còn lại

1. **Manual browser test**: load a long article with tokenize enabled, scroll up/down, confirm no plain-text flashes and reverse-scroll rebind is instant. Requires a real Chrome profile (not dev `/test` page).
