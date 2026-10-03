# Review — `session-recap` DESIGN (all-mode, vision-reader ×2 rounds)

Artifacts: `docs/intent/session-recap-design-brief.md` · `docs/intent/session-recap-component-mapping.md` · `src/entrypoints/mockup-session-recap/` (worktree) · screenshots `tmp/session-recap/` (gitignored)

Variant decided: **Session ledger** — hero Card cho phiên gần nhất + ListItem rows phiên trước; tab `recap` (icon `clock`, label `panel.tab.recap`) giữa Playlist và Settings.

## Gate checks

- `node scripts/check-design-brief.mjs session-recap` → `VERDICT: PASS` (19 tokens, 13 components validated against tokens.json + src/shared/ui/)
- Mockup renders production components: Card, Chip, Badge, ListItem, SectionHeader, EmptyState, Alert, Button, Spinner, Text, Heading, Timestamp, Icon
- Coverage: mobile 360px + desktop 520px × dark + light; states populated/loading/empty/error; all 4 chip-status colors; live + derived badges; nav fit (6th tab, clock icon, `Tổng kết` label vi)

## Vision round 1 — FAIL → fixes applied

| Finding | Fix |
|---|---|
| Loading state không có shot | Thêm `loading.png` + label "Đang tải recap…" |
| Tracking/Ignore chips absent | mockData hero thêm đủ 4 status groups |
| Derived badge không visible | Session 3 render expanded row với `derived` badge |
| EmptyState `bordered` dashed → non-solid | Bỏ `bordered` prop |
| Label "Recap" Anh giữa nav Việt | Đổi → "Tổng kết" |
| Coverage band "comfortable" untranslated | mockData band → "thoải mái" (i18n key `recap.band.*` khi ship) |
| "Đã mark (6)" ≠ số chip hiển thị | Per-status `more` → `+N` chip trong từng status row |
| Live badge cùng xanh với known | `Badge variant="warning"` — tách khỏi green family |
| Desktop panel hẹp | panel--desktop 440→520px |

## Vision round 2 — PASS (3 P2 residual)

| P2 | Disposition |
|---|---|
| Loading bare spinner | FIXED — thêm Text "Đang tải recap…" |
| `+N` overflow chip neutral trong status row | FIXED — chip mang status-tint class |
| Ignore chips low-contrast ở light theme | ACCEPTED — `--chip-status-ignore-*` là shared status token đã ship (Vocabulary dùng cùng); không vá riêng cho recap, nếu cần nâng contrast thì sửa token ở system level (out of scope) |

## Ship notes (cho DELIVER)

- Component map đầy đủ reuse, không `create` nào — RecapTab xây trên shared/ui.
- Status chip = feature class dùng `--chip-status-<s>-bg/fg` (như vocabulary) — KHÔNG Chip color prop (colors: success/error/primary/warning/muted).
- Term chip = `Chip as="button"`; tap → `openDictionaryLookup(term)`.
- Tab wiring 5 touch-points: `UniversalPanelTab` union, sidebar TABS (`UniversalPanel.tsx:50`), bottom TABS (`UniversalPanelBottomNav.tsx:29`), `recapPanel` render prop, 2 persisted whitelists (`UniversalPanelController.ts:56`, `mountUniversalPanel.ts:65`).
- Loading state kèm label text (a11y), live badge = warning variant.

VERDICT: PASS
