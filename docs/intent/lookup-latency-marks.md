# Intent: Quản lý Số đo độ trễ (Lookup Latency Marks)

Source: internal-audit (backlog #18) · Mode: `all` — autonomous, conservative inferences recorded as accepted risks

> ui_surface: no

## Business Case

Persona contract là "phản hồi <3s" nhưng repo không đo hover→popup hay tab→audio ở bất kỳ đâu — #15 và #16 đã tối ưu hai đường nóng này **mù** (không instrumentation chứng minh cải thiện). Item này lắp số đo dev-only để: (a) chứng minh/kiểm lại claim <3s bằng dữ liệu thật, (b) bắt regression latency trong tương lai. Không đổi hành vi user-facing — pure observability trên đường nóng.

## Stakeholders

- Maintainer/agent tối ưu lookup + audio path — cần số đo trước/sau để quyết định.
- Immersionist — gián tiếp hưởng regression được bắt sớm.

## Audit claims — re-verified

- "Không đo hover→popup / tab→audio" — **CONFIRMED**: zero `performance.mark`/`performance.measure` trong `src/`; `lookupLogStore` là dev-only ring buffer nhưng chỉ ghi `timestamp` + phrase traces, không timing breakdown.
- `isDevMode` precedent sẵn (`import.meta.env.DEV || MODE === 'development'`) — production tree-shake sạch (`saveLookupLog` caller-gated).
- Trigger points đã pin: LOOKUP_REQUEST dispatch ở `popupLifecycle.ts` (~:502) + prefetch ở `lookupCache.ts`; response arrival ở `.then` trong `popupLifecycle`; audio path `fetchAudio` start → `setAudioItems` trong `useDictionaryToolbar.ts`; render commit đo qua effect sau mount/`requestAnimationFrame`.

## Needs

- Đo đủ 4 điểm trên 2 đường nóng: pointer-dispatch → request → response → popup render commit; audio-tab-click → items applied → render commit.
- Quan sát được **không cần dev server**: `performance.mark`/`measure` (User Timing — hiện trong DevTools Performance timeline + `getEntriesByType` từ console của cùng context) + `console.debug` summary khi `isDevMode`.
- Zero cost ở production: mọi instrumentation gate `isDevMode`, tree-shake được.
- Request-scoped: marks mang `requestId` để correlate mỗi hover (mark name phải unique per request, cleanup `performance.clearMarks` sau measure để không phình buffer).

## Scope

In:
- `performance.mark` + `performance.measure` pairs tại: lookup dispatch (`popupLifecycle`/`lookupCache`), LOOKUP_REQUEST response, popup first-content render (popup mount + `requestAnimationFrame` commit), `fetchAudio` start, `setAudioItems` applied + audio row render commit.
- Naming convention `Tihoka:lookup:*` / `Tihoka:audio:*` + `requestId` suffix; dev console summary (`console.debug` hoặc `console.table` khi isDevMode).
- Unit test cho helper mark/measure (jsdom `performance` API) + verify marks gated khi không dev.

Out:
- Reporting/persist latency sang storage/Drive (ring buffer là follow-up nếu cần — giờ marks + console đủ cho DevTools workflow).
- `performance.mark` ở background SW (SW timeline không giống content-script render latency; nếu cần SW-side breakdown thì log `durationMs` vào lookupLog entry — out of v1).
- Threshold alerting / telemetry production.
- Đo các path ngoài lookup/audio (OCR, sync, download).

## Workflow

- SPECIFY: spec + spec-reviewer gate.
- uiSurface=no → skip DESIGN → DELIVER: build + gates + verify marks xuất hiện trong `performance.getEntriesByType('measure')` trên Chromium thật.

## Journey

### AS-IS
1. Agent tối ưu lookup/audio → không có số đo nào trong `src/` để biết latency thật.
2. Không chứng minh được persona <3s và không biết bottleneck còn lại nằm ở dispatch, message round-trip, hay render.
3. Regression latency trôi qua CI mà không ai biết.

### TO-BE
1. Dev mở DevTools → Performance/User Timing thấy `Tihoka:lookup:pointer→request`, `request→response`, `dispatch→render`, `Tihoka:audio:click→items` cho mỗi interaction.
2. `console.debug` in ra breakdown ms ngay khi lookup xong (dev only).
3. Agent so sánh numbers trước/sau khi optimize tiếp.

## Stories

- S1: As a maintainer, I want per-lookup timing breakdown in DevTools so that tôi chứng minh được persona <3s — done when một hover lookup tạo đủ marks + measure có duration ms.
- S2: As a maintainer, I want audio-tab latency measured so that tab→audio <3s kiểm chứng được — done when click audio tab tạo `Tihoka:audio:*` measures.
- S3: As a maintainer, I want zero production overhead so that users không trả cost — done when production build không gọi performance.mark (isDevMode gate + tree-shake verified by grep/unit).

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Isolated-world `performance` khác page realm → marks không thấy trong DevTools page | technical | DevTools workflow hỏng | Verify trên Chromium thật trong gates; fallback: `console.debug` luôn hiện |
| Marks buffer phình khi user hover nhiều | internal | Memory nhỏ | `performance.clearMarks`/`clearMeasures` sau mỗi measure (sau khi measure đã tính duration) |
| Mark trong `lookupCache` prefetch noise với user lookup | internal | Số liệu lẫn | Chỉ mark primary dispatch path (`popupLifecycle`), prefetch gắn tag riêng hoặc bỏ |
| Instrumentation vào hot path làm chậm thêm | internal | Vài µs/mark | performance.mark rẻ; dev-only gate |

## Decision

go — observability thuần, claim verified (zero timing instrumentation), precedent `isDevMode` + dev-only store sẵn, S-size.

## Draft Acceptance Criteria

- AC1: Một lookup thật (hover/click) tạo đủ measures `Tihoka:lookup:*` với duration ≥0 — kiểm được qua `performance.getEntriesByType('measure')` trong cùng context.
- AC2: Audio tab fetch tạo `Tihoka:audio:*` measures (click→applied, applied→render).
- AC3: Production code path không gọi `performance.mark` — tất cả instrumentation sau `isDevMode` gate (unit test spy + grep).
- AC4: Marks/measures cleanup sau khi đo (buffer không tích lũy).
- AC5: Gates: typecheck + lint + unit + build + cycles clean; real-Chromium verify marks tồn tại trong performance timeline.
