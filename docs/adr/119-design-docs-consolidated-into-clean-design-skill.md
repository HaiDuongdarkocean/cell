# ADR 119 — Design canon docs consolidated into `clean-design` skill

Date: 2026-10 | Status: accepted

## Context

Design canon sống rải ở 4 nguồn (`DESIGN_RATIONALE.md`, `STANDARD.md`, `DESIGN.md`, `AUDIT-CHECKLIST.md` + guides HTML) — trùng lặp, khó tra, agent phải đọc nhiều file trước khi design. User yêu cầu một nguồn duy nhất.

## Decision

Hợp nhất toàn bộ tri thức design vào skill `.agents/skills/clean-design/`:

- `knowledge/why/philosophy.md` ← DESIGN_RATIONALE (T-laws, L-laws, consequence triad nguồn)
- `knowledge/foundations/*` ← STANDARD (color, typography, spacing, shape, motion, icons, responsive)
- `knowledge/method/*` ← workflow B0–B7 (mới) + DESIGN §2–6
- `knowledge/ops/audit.md` ← AUDIT-CHECKLIST + STANDARD §13 + DESIGN §7
- `knowledge/ops/lifecycle.md` ← DESIGN §8–10 + README mechanics
- `knowledge/examples/` ← worked example

**Xóa nguồn:** `docs/design-system/{DESIGN.md, DESIGN_RATIONALE.md, AUDIT-CHECKLIST.md, guides/*}` và `src/shared/styles/STANDARD.md`.

**Giữ nguyên:** `tokens.json` (runtime SSOT), `MIGRATION.md`, `ROADMAP.md` (kèm superseded note), `PATTERN_CATALOG.md`, `COMPONENT_INVENTORY.*`, `src/shared/styles/README.md` (đã repoint).

## Alternatives rejected

- Giữ docs + skill mỏng trỏ về docs → 2 nguồn, drift tiếp tục.
- Đánh DEPRECATED thay vì xóa → file chết vẫn được grep, nhầm nguồn.
- Xóa cả MIGRATION/ROADMAP/PATTERN_CATALOG → mất record vận hành và catalog pattern không thuộc skill scope.

## Consequences

- Mọi tham chiếu canon giờ trỏ `.agents/skills/clean-design/knowledge/`; live surfaces (skills, README, knowledge-base, learning atoms) đã repoint. Record lịch sử (ADR/specs/plans/audits/intents) giữ nguyên — refs trong đó là dead-link có chủ đích, đọc qua superseded note ở ROADMAP.
- `tokens.json` vẫn thắng ở tầng giá trị; `philosophy.md` thắng ở tầng nguyên lý.
- Revert được bằng `git revert` commit này (docs nằm trong history).
