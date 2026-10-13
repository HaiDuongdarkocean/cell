# Component Mapping: word-status-flags

> Concept: **B control + A capsule — user approved** · Spec: `docs/specs/word-status-flags.md`
> Mockup mounts production: Real = CandidateView; concepts = real StatusRow/StatusPill + `Button`/`Icon`/`Menu` + CandidateView.module.css classes.

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Status row (pill + freq + stars) — StatusRow.tsx | — | reuse — prop `statusControl` giữ cho các nhu cầu sau; segmented control render in-place | — | — |
| Segmented status control — nửa trái cycle base | `Button` | create — pill split 2 segment; trái = StatusPill cycle 3 base | `--chip-status-unknown-bg`, `--chip-status-unknown-fg`, `--chip-status-known-bg`, `--chip-status-known-fg`, `--chip-status-ignore-bg`, `--chip-status-ignore-fg` | — |
| Flag segment — nửa phải pill | `Button` | create — tracking: toggle onClick (key-4 semantics); learning: read-only disabled; none: ẩn hoặc ghost | `--chip-status-tracking-bg`, `--chip-status-tracking-fg`, `--chip-status-learning-bg`, `--chip-status-learning-fg`, `--size-element-sm` | `eye`, `layers` |
| SRS card button — SrsButton mới trong `TihokaHeaderActions` | `Button` | create — `shape="circle"` `size="md"`, state-aware: ghost (dashed) → tạo thẻ; fill → view thẻ; disabled khi base ≠ unknown | `--chip-status-learning-bg`, `--chip-status-learning-fg`, `--color-text-tertiary` | `layers` |
| Token status capsule gradient — .js-Tihoka-token-status trong tokenSpanCss (cả 2 builder) | — | extend — tracking/learning rules đổi `background` sang `linear-gradient(90deg, flag → unknown)` (Concept A smooth) | `--color-token-status-unknown`, `--color-token-status-tracking`, `--color-token-status-learning` | — |
| i+1 frequency pill — .js-Tihoka-token freq band classes | — | reuse — không đổi | `--color-token-freq-core-bg`, `--color-token-freq-core-fg` | — |
| Key hints / tooltips | — | extend — sửa `dict.status.cycle` (3 base), thêm flag segment title + key legend mới (1/2/3/4) | — | — |

Notes:

- BASE_CYCLE chuyển `['unknown','tracking','learning','known','ignore']` → `['unknown','known','ignore']` — StatusPill/nextStatus reuse nguyên.
- Flag segment click = key-4 semantics (`unknown ↔ unknown+tracking`, no-op on `learning`); learning branch render disabled.
- SRS button là nguồn duy nhất của learning trong popup: ghost-click → tạo thẻ → flag=learning; hasCard-click → view/xóa thẻ → flag=none.
- Gradient Concept A áp trên cả 2 builder (`buildTokenSpanCss` light-DOM + `buildTokenSpanCssForShadow`) — cùng rule `linear-gradient(90deg, flag → unknown)`; phải giữ specificity `html body … !important` ngang hàng rule production hiện tại.
- `Menu`/`MenuItem` (concept C) loại khỏi decision — không implement.
- Extraction StatusRow/StatusPill đã land (pure refactor, 22/22 CandidateView tests pass).
