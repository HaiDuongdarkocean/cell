# Intent: Quản lý Đường nóng tra cứu (Lookup Hot Path)

Source: internal-audit (backlog #15) · Mode: `all` — autonomous, conservative inferences recorded as accepted risks

## Business Case

Lookup popup là đường nóng nhất của persona promise (<3s phản hồi). Hiện mỗi lookup còn ~1 chuỗi IDB gets tuần tự per candidate + per-request context rebuild — chậm hơn mức cần thiết trên data đã local. Item này là pure performance trên đường nóng — không thêm surface.

## Stakeholders

- Immersionist tra từ bằng hover/click trong subtitle + web — cảm nhận trực tiếp độ trễ popup.
- OCR lookup path (tokenize scan) — tần suất lookup cao, cùng orchestrator.

## Needs

- Popup kết quả giữ nguyên nội dung + thứ tự, chỉ nhanh hơn.
- IDB reads batch/parallel per request thay vì tuần tự per candidate.
- Context (settings + resource context) reuse giữa các lookups, invalidate khi resources/settings đổi.

## Audit claims — re-verified

- `handlers/lookup.ts` gọi `lookupOrchestratorMulti(request, {}, signal)` — deps trống, confirm.
- Claim "phrase-index blob đọc lại mỗi hover ≤300ms/resource" — **STALE**: T23 đã có module-level `phraseIndexCache` + `probeCache` trong `lookupOrchestrator.ts`; index deserialize 1 lần/resource. Waste thật: `assembleLookupResult` tuần tự per candidate (mỗi cái `findDictionaryByTerm`+`findFrequencyByTerm`+`getWordStatus` riêng → ~18 sequential gets cho 6 candidates), lemma-miss path `for await` từng candidate, `loadSettings`+`buildResourceContext` rebuild mỗi lookup, không có per-request memo (cùng term query lại dưới variant `lookupTerm`/`surfaceTerm`/`effectiveTerm`).

## Scope

In:
- Batch `Promise.all` fan-out cho candidate assembly trong `lookupOrchestratorMulti` — thứ tự kết quả giữ nguyên (deterministic, first-hit ordering bảo toàn).
- Parallelize lemma-candidate probe ở miss path.
- Per-request memo cho `findDictionaryByTerm`/`findFrequencyByTerm`/`getWordStatus` keyed `langCode|term`.
- Cache `loadSettings`+`buildResourceContext` per `langCode` sau invalidation seam có sẵn (`subscribeResourceChanges` + settings change); `handler/lookup.ts` truyền deps đã cache thay `{}` nơi contract cho phép.

Out:
- Ranking/merge semantics, plugin contract, abort/cancel, `requestRemoteCheck` side-effect.
- `LookupResult` content/shape.
- `phraseIndexCache`/`probeCache` (đã đúng — T23); chỉ extend invalidation nếu thật sự cần.

## Workflow

- SPECIFY: spec + spec-reviewer gate.
- uiSurface=no → skip DESIGN → DELIVER: build + gates + verify trên Chromium thật (popup latency path exercised end-to-end, không đổi UX).

## Journey

### AS-IS
1. User hover/click một từ → `LOOKUP_REQUEST` vào background.
2. Handler chạy orchestrator với `deps={}` → load settings + build resource context mới → assemble từng candidate tuần tự, mỗi candidate 3 IDB gets riêng; miss path thêm vòng lemma tuần tự.
3. Popup render sau khi toàn bộ vòng tuần tự xong — chậm tỉ lệ số candidates.

### TO-BE
1. User hover/click một từ → handler truyền deps đã cache (settings + resourceContext reuse qua invalidation seam).
2. Orchestrator batch toàn bộ IDB reads của candidates trong 1 round `Promise.all`; lemma probe song song; cùng term không query hai lần trong một request (memo).
3. Popup render sớm hơn với kết quả byte-identical — latency drop measurable qua số IDB gets per lookup.

## Stories

- S1: As an immersionist, I want lookup nhanh hơn trên cùng dữ liệu local so that hover mượt theo persona <3s — done when một lookup nhiều candidates chỉ phát ~1 batched round IDB gets per store thay vì sequential per candidate.
- S2: As a maintainer, I want kết quả lookup byte-identical sau refactor so that không regression ngầm — done when fixture tests hiện có pass không sửa expectation.
- S3: As a maintainer, I want context cache invalidate đúng khi resources/settings đổi so that không stale lookup — done when test chứng minh invalidate path.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Parallel assembly đổi thứ tự/nội dung result | internal | Wrong candidate wins — regression im lặng | Ordering contract trong spec + fixture tests làm oracle; assemble order deterministic theo index, không theo resolve order |
| Context cache stale khi settings/resources đổi | internal | Lookup lệch cấu hình mới | Reuse `subscribeResourceChanges` + settings-change seam; test invalidate |
| Memo giữ stale trong request kéo dài | internal | Trạng thái word đổi giữa request → popup hiển thị cũ | Memo scope = 1 request, hủy khi request xong/abort |

## Decision

go — pure performance trên đường nóng, audit-verified, không UI surface; S-size.

## Draft Acceptance Criteria

- AC1: lookup N candidates phát ≤ 1 `Promise.all` round IDB gets per store (dict/freq/status) — observable bằng instrumented test.
- AC2: lemma-miss path probe các candidates song song; kết quả = first hit theo candidate order.
- AC3: cùng `langCode|term` trong một request không query IDB 2 lần.
- AC4: kết quả `LookupResult[]` (order + fields) byte-identical với baseline tuần tự — fixture tests pass không đổi expectation.
- AC5: đổi resource/settings → lookup kế dùng context mới (invalidate test).
- AC6: abort signal vẫn hủy giữa chừng đúng như hiện tại.
