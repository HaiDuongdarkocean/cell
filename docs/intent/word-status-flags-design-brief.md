# Design Brief: word-status-flags

> Spec: `docs/specs/word-status-flags.md` · Mockup: `src/entrypoints/mockup-word-status-flags/` (serve `npm run dev` → `/src/entrypoints/mockup-word-status-flags/index.html`)

## Function audit

| Function | Class | Why |
|---|---|---|
| Cycle base status (unknown/known/ignore) | must-have | REQ-2/REQ-3 — primary pointer path to change knowledge level |
| Toggle tracking flag | must-have | REQ-3 — key 4 + pointer equivalent (badge) for touch persona |
| Display learning flag | must-have | REQ-4 — read-only, system-managed |
| View SRS card state | must-have | REQ-2 — existing surface, no new UI |
| Distinguish 3 not-known branches on tokens | must-have | REQ-6 — gradient capsule |
| i+1 gap marking + freq pill | must-have | REQ-5 — existing behavior kept |
| Auto-tracking on lookup | must-have | REQ-7 — unchanged |

Primary job: **đổi mức-biết nhanh, không lẫn engagement state** — status control là 1 primary job.

## Journey map

| # | Step | User action | System response | UI location |
|---|---|---|---|---|
| 1 | See a sentence | read tokenized text | gap word shows capsule + freq pill if i+1 | subtitle/web tokenize |
| 2 | Judge the gap | look at pill colors + freq | capsule gradient tells branch (unknown/tracking/learning) | token |
| 3 | Open popup | click word | popup shows pill + flag badge + SRS icon | CandidateView header |
| 4 | Change knowledge | click pill / press key | base cycles 3 states; flag preserved while unknown | status row / keys |
| 5 | Track | click badge / press 4 | tracking toggles on unknown-family word | badge |
| 6 | Learn | create SRS card | flag → learning automatically, badge shows layers icon | SRS engine |

Edge cases: no-card learning badge (read-only), ignore word with card (ignore wins), offline Anki (stale flag until next sync).

## SRS card button (new element, all concepts)

State-aware icon button trong `cellHeaderActions` (vị trí user đã annotate "view srs"):

| State | Visual | Action |
|---|---|---|
| no card | dashed-border ghost, tertiary icon | click → create card → word = `unknown+learning` |
| has card | `chip-status-learning` fill | click → open SRS card view (read-only); remove card → word → `unknown` |
| base ≠ unknown | disabled | thẻ chỉ tồn tại trên nhánh chưa-biết |

## Concepts (mockup — built from real components)

Mockup mounts production code: `Real` = `CandidateView` nguyên vẹn; concepts = real `StatusRow`/`StatusPill` (extracted vào `StatusRow.tsx`) + real `Button`/`Icon`/`Menu` + real CSS-module classes; `.mk*` styles chỉ cho phần tử mới (flag badge, segmented, SRS button states).

| | IA mental model | Popup control | Token capsule |
|---|---|---|---|
| **Real** | 5-status cycle | pill cycles all 5 | solid per status |
| **A · Flag badge** | status pill + engagement pin | flag icon button trái pill (eye=tracking toggle, layers=learning read-only); pill cycles 3 | smooth gradient `flag → unknown` |
| **B · Segmented** | split button | `[base | ⚑]` — left cycles base, right toggles flag | two-tone hard split `flag 50% | unknown 50%` |
| **C · Status menu** | status picker | pill `base · flag ▾` opens real `Menu`: 3 base radio + tracking toggle + learning disabled row | stacked `flag top / unknown bottom` |

Concepts differ in **control IA** (adjacent badge vs joined segment vs menu picker) và **capsule treatment** (blend / split / stack). Gradient luôn đọc `flag → unknown` — màu engagement phủ lên nền chưa-biết.

## Dials

| | A | B | C |
|---|---|---|---|
| DESIGN_VARIANCE | 3 | 5 | 6 |
| MOTION_INTENSITY | 2 | 2 | 3 (menu open) |
| VISUAL_DENSITY | 5 | 4 | 4 |

## Decision (user approved)

**B control + A capsule** — user chọn mix:

- Popup control theo **Concept B**: segmented `[base | flag]` — nửa trái pill cycle `unknown → known → ignore`, nửa phải là flag segment hiển thị/toggle tracking (icon eye) hoặc learning (icon layers, read-only).
- Token capsule theo **Concept A**: gradient mượt `flag → unknown` (tracking → unknown, learning → unknown), ngang 90deg.

### Feedback của user đã ghi nhận (bắt buộc giữ)

1. **Baseline phải là component thật** — replica `.mkPopup` đầu tiên bị loại vì baseline sai làm mọi concept sai; `Real` giờ mount `CandidateView` production nguyên vẹn, concepts dựng từ `StatusRow`/`StatusPill`/`Button`/`Icon`/`Menu` thật.
2. **SRS icon button** phải design riêng, state-aware (ghost → tạo thẻ / fill learning → xem thẻ / disabled khi base ≠ unknown).
3. **Chiều gradient** luôn `flag → unknown` — màu tracking/learning phủ lên nền chưa-biết, KHÔNG phải `unknown → flag`.
4. **Gradient phải thật sự hai màu** — production status rules ship `html body … !important`; mọi override phải out-specify (`html body` prefix + class kèm thêm) nếu không capsule chỉ hiện một màu solid.

## Recommendation history

~~Concept A~~ — concept A từng được đề xuất vì khớp sketch; user chọn B cho control vì flag pill nằm liền trong status control rõ ràng hơn badge rời, và chọn A cho capsule vì gradient mượt đọc "flag lớp trên unknown" tự nhiên nhất. C bị loại (menu nặng cho 1 toggle).
