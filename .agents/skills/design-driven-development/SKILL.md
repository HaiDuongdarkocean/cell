---
name: design-driven-development
description: Designs and implements UI in two phases separated by a hard contract. Phase 1 produces a UI-Contract (placement, flow, tokens, vibe, acceptance tests) the user approves. Phase 2 implements that contract as code with full state coverage, accessibility, and browser-verified evidence. Use for new UI from a function list, or redesign of an existing screen. Triggers on "design this UI", "redesign this screen", "build UI from functions", "make a UI contract", "implement this UI".
---

# UI Design + Implement

Two phases, hard contract boundary. Phase 1 → UI-Contract (user approves). Phase 2 → code per contract. Contract is single source of truth: Phase 2 does NOT change placement/vibe/IA without returning to Phase 1.

```
brief ─→ Phase 1 (with user) ─→ UI-Contract.md + mockup ─→ [APPROVAL GATE]
                                                              │
                                                              ▼
                              Phase 2 (code) ─→ src/ + evidence/ ─→ reviewer
```

## When to Use
- Function list / spec / API needs to become a UI.
- Existing screen needs redesign (audit first, then new contract).
- User wants a UI contract before any code.

**Triggers**: "design this UI", "redesign this screen", "build UI from functions", "make a UI contract", "implement this UI".

## Input → Output
- **In**: function spec or existing screen path + codebase access + user availability (Phase 1 needs back-and-forth).
- **Out**: `UI-Contract.md` (Phase 1) + production code + `evidence/<screen>/` (Phase 2, passed to ui-ux-reviewer).

## Phase 1 — Design

14 steps. Read `checklists/design-checklist.md` for audit + AT definitions. Read `checklists/anti-slop-checklist.md` for the ban list.

| # | Step | Output | Key rule |
|---|---|---|---|
| 1 | Read brief, infer intent | one line: "Reading this as `<page kind>` for `<audience>`, `<vibe>` language, leaning `<aesthetic>`." | Ambiguous audience/vibe → ask ONE question. No guessing, no multi-question dump. |
| 2 | Set 3 dials | `VARIANCE/MOTION/DENSITY` 1-10, one-line reason each | Baseline `8/6/4`. Settings `4/3/5`, dashboards `5/3/7`, landing `8/7/4`. |
| 3 | Audit existing (redesign only) | 8-axis findings in `audit:` | Run `design-checklist.md` audit section. |
| 4 | Functions → placement matrix | one row per function | Fields: element, zone (primary/secondary/tertiary), priority (above-fold/below-fold/on-demand), affordance (one sentence), steps_to_complete (flag if >3). |
| 5 | Optimize task flows | step sequence per task | Max 3 steps entry→done. >7 choices → group/nest (Hick+Miller). Jakob's Law: don't invent novel patterns. Show progress for multi-step. |
| 6 | Information architecture | nav type + grouping + labels | 2-4=tabs, 5-12=sidebar, >12=command menu. Group by user mental model. User's vocabulary, not codebase's. |
| 7 | Visual hierarchy | where eye goes 1st/2nd/3rd | F-pattern (text), Z-pattern (simple), layer-cake (headings). Gestalt proximity + similarity. |
| 8 | Pick ONE aesthetic | selected + rejected (1-line reason each) | minimalist-ui / high-end-visual-design / industrial-brutalist-ui. Commit for whole screen. No mixing. |
| 9 | Define tokens | color/font/space/shape/motion | No freeform hex in components. Ban Inter default. No pure #000/#fff. No `linear`/`ease-in-out`. |
| 10 | State coverage | per-component state table | loading=skeleton, empty=composed, error=inline, hover/active/focus/disabled. Focus 2px ring 3:1 (WCAG 2.4.13). |
| 11 | Anti-slop rules | copy active bans into `anti_slop:` | Read `anti-slop-checklist.md`. Implementer must not violate. |
| 12 | Acceptance tests | AT1-AT7 in contract | Defined in `design-checklist.md`. Reviewer runs them in Phase 2. |
| 13 | Mockup | `mockups/<screen>.html` | Show desktop + mobile side by side. Apply tokens + font. |
| 14 | User approval | approval gate | No approval → no Phase 2. Mockup may change intent → update intent before G3. |

## Phase 2 — Implement (code)

Read contract from disk (don't trust memory). Read `checklists/implement-checklist.md`.

| # | Step | Key rule |
|---|---|---|
| 15 | Read contract + detect stack | Use existing stack (CSS Modules/Tailwind/etc). No stack swap without asking. |
| 16 | Build components per placement matrix | Every function row → matching component at correct zone + priority. Implement ALL states (loading skeleton, empty composed, error inline, hover/active/focus/disabled). |
| 17 | Apply tokens via CSS variables | No freeform hex. Grep `#` in component files → must be 0. |
| 18 | Accessibility (WCAG 2.2) | Contrast 4.5:1 body, 3:1 large. Focus 2px 3:1. Target 44px. ARIA tablist/tab/tabpanel with aria-controls + aria-labelledby. Keyboard: arrow keys in tablist, Tab to panel, Home/End. Skip link. |
| 19 | Capture evidence via MCP `edge-devtools`/`chrome-devtools` | desktop 1440x900, mobile 375x812, active/empty/error state screenshots, console log (0 errors), a11y report (0 violations), flow simulation per task, code diff. Save to `evidence/<screen>/`. |
| 20 | Quality gates | `npm run test:unit` + `npx tsc --noEmit` + `npm run lint` all pass. Browser verify (stop-the-line) before commit. |
| 21 | Hand off | Pass `UI-Contract.md` + evidence to ui-ux-reviewer. Await PASS or severity-rated FAIL list. Fix → re-capture → re-submit. Max 3 rounds → escalate anh. |

## Definition of Done

**Contract compliance** (from code): every function has a component, every token via CSS var, every state implemented, zero anti-slop violations, ARIA matches a11y section.

**UX acceptance** (from evidence): first-glance passes, every flow ≤3 steps, zero AI tells, a11y 0 violations, console 0 errors, mobile single-column no horizontal scroll.

> Do NOT change placement, vibe, or IA during Phase 2 without returning to Phase 1. The contract is the boundary.
