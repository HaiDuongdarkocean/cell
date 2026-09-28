# Design brief — durable-job-registry · job surface

> Spec: `docs/specs/durable-job-registry.md` · Mockup: `src/entrypoints/mockup-durable-job-registry/` · Decision question: **where does durable job truth surface in Settings UI?**

## Design Read

One line: job state must be findable without remembering where it was started — the user's complaint was "mở ra sẽ không còn thấy nó nữa".

## Function audit

| Function | Class | Why |
|---|---|---|
| Show live progress of a running job | must-have | REQ-2/REQ-3 — reopen rebuild |
| Show terminal state (done/failed/interrupted) until dismissed | must-have | REQ-3/REQ-7 — persisted rows |
| Offer retry on retryable kinds | must-have | REQ-8 |
| Offer dismiss on terminal rows | must-have | REQ-7 |
| Hint re-import for non-retryable interrupted import | must-have | REQ-8 alt flow |
| Show which section/kind a job belongs to | must-have | kinds span Resources + Audio |
| Aggregate view across kinds | nice-to-have | one glance for "is anything running" |
| Cancel running jobs | remove | spec non-goal |

Primary job: **user reopens Settings and immediately knows what ran/is running/needs attention.**

## Journey map (job-visibility lens)

| # | Step | User action | System response | UI location |
|---|---|---|---|---|
| 1 | Start import/voice-download/index | click/drop | job row appears immediately | owning section |
| 2 | Close panel mid-run | close | job continues; nothing lost | — |
| 3 | Reopen Settings | open | rows rebuilt from `JOB_LIST` | wherever jobs surface |
| 4 | See interrupted row | read | reason + retry/dismiss or re-import hint | job row |
| 5 | Dismiss/done browsing | click | row removed everywhere | job row |
| Edge | Two surfaces open | watch | identical state via JOB_EVENT | both |
| Edge | Browser restart | reopen | interrupted honest rows (session wiped) | job row |

Moments of uncertainty: "did my import finish while I was away?", "is this row still live?"

## Dials (baseline)

- DESIGN_VARIANCE: 3 (stay inside existing Settings cards + shared components)
- MOTION_INTENSITY: 2 (progress bars + status change only, prefers-reduced-motion respected)
- VISUAL_DENSITY: 6 (compact rows, persona 5–80)

## Three concepts

### Concept A — Inline rows ("công việc nằm cạnh thứ nó tạo ra")
- **IA mental model:** each section owns its jobs — Resources card lists import/delete rows, Audio card lists voice/index rows. No aggregation point.
- **Visual archetype:** solid editorial — today's `ImportJob` row language extended with `interrupted`/`failed`/`done` states.
- **Non-digital reference:** ghi chú viết lề sách — chú thích nằm ngay cạnh trang nó nói về.
- **Material / surface:** filled row card `--input-bg` inside the section card; interrupted/failed get `--warning`/`--error` border.
- **Typography treatment:** file label sm/medium; meta line xs secondary; error line xs warning.
- **Motion signature:** progress bar fills; status flips are instant (aria-live announces).
- **UX flow:** drop file → row appears in Resources card → close panel → reopen → same rows rebuilt; interrupted row carries reason + dismiss (+ retry when retryable).
- **UI structure:** job list block above the dropzone inside each owning card.
- **3 dials:** VARIANCE 2 · MOTION 2 · DENSITY 6
- **Why it fits:** smallest diff on `ResourcesPanel`'s existing ImportJob rows; zero new navigation concepts; every job is adjacent to its retry input (re-import needs the same dropzone).
- **Risk:** user must remember which section holds the job; no at-a-glance "is anything running anywhere".

### Concept B — Activity center ("nhật ký hoạt động")
- **IA mental model:** a single ledger — one "Hoạt động" card at the top of Settings lists every job of every kind, newest state first.
- **Visual archetype:** dashboard feed — kind icon + label + status badge rows in one card.
- **Non-digital reference:** sổ cái của cửa hàng — mọi biến động ghi một nơi, lật ra là thấy.
- **Material / surface:** solid card, feed rows separated by hairline borders; kind icon chip per row.
- **Typography treatment:** label sm/medium + status pill badge (primary=running, success=done, error=failed, warning=interrupted); meta line xs.
- **Motion signature:** rows reorder to top on activation; progress fills inline.
- **UX flow:** any start → feed row in the Activity card → reopen → scroll to top, everything visible at once.
- **UI structure:** Activity card pinned first in the settings column; owning sections show no job state.
- **3 dials:** VARIANCE 5 · MOTION 3 · DENSITY 5
- **Why it fits:** one lookup point — kills "job thuộc section nào?" entirely; matches the generic-registry story (one registry, one feed).
- **Risk:** detached from the retry input (re-import means navigating back to Resources anyway); new top-level card adds visual weight to a settings page that is mostly quiet.

### Concept C — Hybrid ("inline + chấm hoạt động")
- **IA mental model:** jobs live in their sections like A, but a persistent activity chip in the settings sidebar reports "N đang chạy" and expands a compact cross-kind mini-feed.
- **Visual archetype:** command deck — status chip + peek panel.
- **Non-digital reference:** đồng hồ báo trên bảng điều khiển — máy vẫn chạy ở từng phòng, nhưng một đèn tổng biết đang có máy hoạt động.
- **Material / surface:** rounded `--color-primary-subtle` chip in sidebar; peek card with thin `--primary` left accent; rows reuse mini-row language.
- **Typography treatment:** chip sm; mini rows sm label + xs badge + xs meta.
- **Motion signature:** chip count updates; peek expands inline (respects reduced-motion).
- **UX flow:** like A, plus: open Settings → chip shows 2 running → click → mini feed → jump to owning section; section rows themselves are the full interactive surface (retry/dismiss).
- **UI structure:** sidebar nav + activity chip; section cards keep their own job rows; peek card floats above the active section.
- **3 dials:** VARIANCE 4 · MOTION 3 · DENSITY 6
- **Why it fits:** answers the actual complaint (open → instantly know something is running) without moving retry/dismiss away from the owning section; smallest navigation addition.
- **Risk:** two surfaces showing the same jobs must stay in sync (they do — same `JOB_LIST` source); slightly more UI code than A.

## Responsive

| Width | A | B | C |
|---|---|---|---|
| 320px | rows stack, actions wrap | feed rows full-width, actions below label | sidebar collapses to top row, chip right-aligned |
| 768px | as 320 | as 320 | sidebar horizontal scroll nav |
| 1280px+ | two-col cards optional | feed single col max 960px | sidebar 200px + main |

## States (all concepts)

default / running (bar) / uploading (bar) / done (check + dismiss) / failed (error + retry + dismiss) / interrupted (warning + retry-if-retryable + dismiss + reason) / empty (no rows → nothing rendered)

## Audit-fit

- No Liquid Glass anywhere — solid filled surfaces only.
- All interactive controls ≥44px touch (Buttons already sm-compliant or row padding compensates — verified in mapping).
- aria-live="polite" on every job row → NFR-6 a11y.
- i18n: all labels through `t()` en/vi at ship; mockup uses vi directly.
