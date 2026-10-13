# Design Brief — session-recap

> Spec: `docs/specs/session-recap.md` · Mode: all (single justified variant) · ui_surface: yes

## Function audit

| Function | Feature (surface) | REQ |
|---|---|---|
| Cho learner đọc lại phiên | Tab `recap` trong universal panel: hero card phiên mới nhất + list phiên trước | REQ-3 |
| Tổng hợp phiên (data) | — không có element UI riêng, data đổ vào card/list | REQ-1, REQ-2 |
| Cho learner tra lại từ | Term chip (as button) trong hero card → `openDictionaryLookup` | REQ-4 |
| Báo trạng thái data | Badges `live`/`derived`; field ẩn khi không có data; empty/error/loading states | REQ-2, REQ-3 |

No new nav pattern, no new surface — một tab thêm vào bottom nav/sidebar hiện có. Visual asset mới duy nhất: hero card của phiên.

## Variant decision — "Session ledger"

Một cột cuộn: **hero card phiên gần nhất** (đầy đủ metrics) + **list phiên trước** (một dòng compact mỗi phiên). Justify: tab là read-back surface, hierarchy = recency — người dùng mở tab chủ yếu để xem phiên vừa kết thúc; phiên cũ chỉ cần scannable. Alternatives đã cân: calendar/heatmap (over-scoped, intent out), per-metric columns (chia tách "một phiên" thành silo — sai mental model).

## Layout — Recap tab (mobile panel ~360px; desktop sidebar rộng hơn tự giãn)

```
┌─ Recap ─────────────────────────────────────┐
│ Phiên gần nhất                    [● live]  │
│ ┌─────────────────────────────────────────┐ │
│ │ 47 phút                          68% ▲  │ │  ← duration hero + coverage chip (nếu có)
│ │ AniOne — S1E3 · 14:32                   │ │  ← source + timestamp
│ │ Đã tra (12)                             │ │
│ │ [食べる] [面白い] [頑張る] [+9]         │ │  ← term chips → dictionary
│ │ Đã mark (6)                    [derived]│ │
│ │ Learning  [食べる] [頑張る]              │ │
│ │ Known     [猫] [犬] [学校] [+1]         │ │  ← chips tô màu chip-status-*
│ └─────────────────────────────────────────┘ │
│ Phiên trước                                 │
│ [▶] AniOne S1E3          22 ph · tra 8 · mark 3 │
│ [▶] crunchyroll.com      61 ph · tra 20 · mark 7│
│ [▶] AniOne S1E2          25 ph · mark 5         │
└─────────────────────────────────────────────┘
```

States: loading (Spinner), empty (EmptyState: "xem video với Tihoka subtitles để có recap"), error (Alert + retry). Fields ẩn khi không có data — không hiển thị "0".

## Interaction

- Term chip tap → `openDictionaryLookup(term)` (tab switch + prefill) — REQ-4
- Session row expand: tap một row trong list → mở rộng thành mini-card giống hero (details on demand, không điều hướng)
- Badges `live` (phiên đang ghi) / `derived` (status suy ra từ wordStatusStore) — không interactive, Tooltip/aria-label giải thích

## i18n

Keys `panel.tab.recap`, `recap.*` (latest, previous, lookups, marked, live, derived, coverage, minutes, empty title/body, error/retry) — en+vi.
