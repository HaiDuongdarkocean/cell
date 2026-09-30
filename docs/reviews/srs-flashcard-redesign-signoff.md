# Signoff — SRS Flashcard Redesign

Item `srs-flashcard-redesign`, stage `deliver` → ship signoff.

## Checklist cuối

- [x] Verify PASS (fresh, independent-criteria): `docs/reviews/srs-flashcard-redesign-verify.md`
- [x] typecheck PASS · lint PASS · test:unit 639 suites/7626 tests PASS · build PASS
- [x] Design brief lint PASS (45 tokens / 10 components / 1 icon — mọi `var(--*)` và `<Name/>` truy về được token + shared component)
- [x] E2E real-Chromium: `extension-ocean-srs.spec.ts` 4/4 PASS
- [x] Screenshot evidence: `tmp/srs-flashcard-redesign/01-front.png`, `02-back.png`, `03-translation.png`, `04-edit.png` (4 trạng thái — vượt yêu cầu 1)
- [x] AC-1..10 + design AC đủ bằng chứng trong verify doc
- [x] i18n đầy đủ en + vi; không hardcode copy trong JSX mới
- [x] A11y: icon-button đủ aria-label, dots `aria-current`, toggle states dùng `aria-labels`, notes landmark, editor `id`/`htmlFor`, media `aria-hidden`
- [x] Không dep mới; không entity/store shape change; i18n key append-only
- [x] `npm run snapshot:tokens` không cần (không đổi tokens.json); lint fail nếu thiếu
- [x] Working tree chỉ chứa thay đổi thuộc item; unrelated dirty files (studyModes stepper) không bị đụng
- [x] Wiki changelog + `docs/2-architechture-system.md` cập nhật (srs-study entrypoint row)
- [x] Plan `tasks/plan-srs-flashcard-redesign.md` S1-S4 complete

## Deferred (đã ghi trong spec + review, không block)

- M3 spelling mismatch diff — batch sau.
- `border.default` primitive chưa có — dùng `derived.*.border`.

VERDICT: SIGN_OFF

Ready to ship.
