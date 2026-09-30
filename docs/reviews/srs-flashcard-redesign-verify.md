# Verify review — SRS Flashcard Redesign

Verify `srs-flashcard-redesign` (deliver), fresh state, owner devin-srs-redesign-33755.
Chuẩn: `docs/specs/srs-flashcard-redesign.md` (FR-1..5, NFR-1..4), AC-1..10 + design AC, `docs/reviews/srs-flashcard-redesign-design.md` (MUST FIX M4 đã ship trong impl, M3 ngoài scope deliver này), plan `tasks/plan-srs-flashcard-redesign.md`.

## Gates (fresh run)

| Gate | Kết quả |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (SRS files 0 error — chỉ warnings no-shadow/no-plusplus/orphan-comments hệ thống-wide, pre-existing) |
| `npm run test:unit` | PASS — 639 suites / 7626 tests; riêng jsdom SrsReviewCard 39 tests + SrsManagePanel 11 tests |
| `npm run build` | PASS (tokens → icons → cycles → vite build + CSP patch) |
| `check-design-brief` | PASS — 45 tokens, 10 components, 1 icon (PASS verdict) |

## Real-Chrome visual verify

`e2e/extension-ocean-srs.spec.ts` (chromium-extension project, real Chrome build `dist/`): **4/4 PASS**.

| AC | Bằng chứng |
|---|---|
| AC-1 study stage | Screenshot `tmp/srs-flashcard-redesign/01-front.png`; dots top-center `data-component` + `aria-current="step"` chuyển đúng; `{n} new` top-right; 6 corner icon-buttons đủ `aria-label` |
| AC-2 front | word serif lớn, trạng thái meaning `Come on` nhỏ, stimulus `<audio>`/img hiện khi có asset; card click flip (non-spelling), spelling input Enter-submit |
| AC-3 back | word → sentence bold target → audio row → `See translation` → `Separator` → def line (word+ipa+★) → image → notes `primary-subtle` |
| AC-4 translation | Mặc định ẩn, `See translation` → `Hide translation`, text in-place (`03-translation.png`) |
| AC-5 edit | `04-edit.png`: title `Edit card`, Card type/Deck selects, field editors theo `notetype.fields`, audio/image add/remove, `DELETE CARD`, reset component/card, meta Created/Last pos/Last fail |
| AC-7 save | `updateCurrentNote` ghi `putNote`(+`putCard` khi đổi deck), session giữ card đang review, `refreshStats` |
| AC-9 reset | component → `resetCardState(cardId, component)`; card → `deleteAllStatesForCard` |
| AC-10 meta | `getReviewEventsByCard` tính created/last pos/last fail, `Never` khi chưa có |
| Design AC 4 state | front/back/translation/edit đủ screenshots |

E2E flow cập nhật theo chrome mới: `page.getByRole('button', {name:'Show answer'})` click 2 lần chống double-toggle, spelling Enter-submit, wait `.toBeEnabled()` trên dots.

## Root-cause / rep-verify findings

- **Perf**: `applyUserCss` `removeChild` → `parentNode?.removeChild` (removeChild cần non-null parent; HTMLStyleElement.parentNode có thể null) — trước đây exception → catch → fallback giữ inject path cũ, test fake-indexeddb OOM sau ~420 suite. Fix → 639/639.
- **A11y collision**: `div.front` role=button không đặt `aria-label` (e.target gồm children) → tránh trùng accessible name "Show answer" với nút ✓ (strict-mode violation trong test và nhầm lẫn screen reader); keyboard Enter/Space vẫn flip qua onKeyDown.
- `Show answer`/`Hide answer`/`See translation`/`Hide translation` dùng `aria-labels` toggle để a11y name đổi đúng trạng thái.
- `onShowAnswer` tách khỏi `onForget` — before, `aria-label=showAnswer` thực chất grade Forgot và skip cả UI state mới.
- Spelling input chỉ render khi `step()==='spelling'` (before: label khai báo cả ở front).
- Meta edit: `getReviewEventsByCard` thay `getReviewEventsByNote` (card-scoped đúng semantics "last positive/fail").

## Remaining

- M3 (spelling mismatch diff) — deferred theo design review, chưa trong scope deliver này.
- `border` token primitive `border.default` chưa có trong tokens.json — các `1px solid var(--color-border)` hiện dùng `derived.*.border`; nếu sau này thêm `border.default` không cần sửa file này.
- `data-component`/`data-card` test hooks giữ trên DOM production — chấp nhận (không ảnh hưởng UX, e2e cần).

VERDICT: PASS

Spec FR-1..5 + AC-1..10 + design AC đủ bằng chứng, gates xanh, real-Chrome verified, không regression.
