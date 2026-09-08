# Discover — Output Document Spec

> **The Discover output is the truth map of the system: what exists, who uses it, where it hurts. Every later stage reads from it — a weak output makes the whole cycle verify the wrong things.**

## Internal pipeline (ASCII)

```text
                 ┌──────────────────────────────────────────────┐
                 │  ENTRY RULE: reprompt input → user confirms   │
                 └──────────────────────┬───────────────────────┘
                                        ▼
        ┌────────┐   ┌───────────┐   ┌──────────────┐   ┌─────────────┐
        │ D1     │──▶│ D2        │──▶│ D3           │──▶│ D4          │
        │ Intake │   │ Inventory │   │ Environment  │   │ State       │
        │ confirm│   │ all       │   │ app + mock   │   │ coverage    │
        │        │   │ surfaces  │   │ data states  │   │ ×viewports  │
        └────────┘   └───────────┘   └──────────────┘   └─────────────┘
             │                                             │
             │        ┌───────────┐   ┌──────────────┐     │
             │        │ D5        │──▶│ D6           │◀────┘
             └───────▶│ Journey   │   │ Finding      │
                      │ probe     │   │ extraction   │
                      │ entry→exit│   │ ID+sev+effort│
                      └───────────┘   └──────────────┘
                                             │
                                             ▼
                                   ┌──────────────────┐
                                   │ D7               │
                                   │ Assemble report  │
                                   │ + EXIT GATE      │
                                   └────────┬─────────┘
                                            │
                                  ┌─────────┴─────────┐
                                  ▼                   ▼
                              GATE PASS           GATE FAIL
                                  │                   │
                                  ▼                   ▼
                          → Stage 2           fix ONLY the step
                          (Journey Audit)     that produced it
                                              (see edge table)
```

## Edge cases & regression map

```text
Gate fail / edge                     → regress to step
─────────────────────────────────────────────────────────
E1 screen won't render (no backend)  → D3 mock it; else → Limitations
E2 no baseline standard exists       → STOP → D1 reprompt (no truth to judge against)
E3 new surface found mid-audit       → D2 add → D4 cover only it
E4 data state can't be simulated     → D3 fixture; else → Limitations
E5 evidence conflicts (img vs DOM)   → D4 re-measure, record both
E6 observation violates no rule      → Open questions, NOT findings log
E7 area not applicable               → scorecard = N/A (0 is a false claim)
Gate: screen missing evidence        → D4 that screen only
Gate: finding missing sev/effort     → D6
Gate: scorecard incomplete           → D7
Gate: limitations empty              → D3/D4
Gate: intake unconfirmed             → D1 (hard stop)
```

Each step writes its own artifact (`state/D1`…`D7`) so a failed gate re-runs only the broken step — never the whole pipeline.

## Closed-loop folder — where evidence lives

**Everything one audit session produces stays inside one folder. Delete the folder, delete the trace. Parallel audits never collide.**

```text
loop/<audit-name>/
├── intake.md                  ← input reprompted + user-approved (D1)
├── scope.md                   ← screen list to audit (D2 inventory)
├── evidence/
│   ├── screens/               ← shot per screen × data-state × viewport (D4)
│   ├── journeys/              ← shot per journey step, proves real runs (D5)
│   ├── dom/                   ← measurements: scrollWidth, heights, overflow scan (D4)
│   ├── console/               ← console errors/warnings (D3–D5)
│   └── a11y/                  ← keyboard/focus/axe evidence (D4–D5)
├── findings.md                ← ID | screen | →evidence link | rule | sev | effort (D6)
├── scorecard.md               ← 0–10 per area — Refine baseline (D7)
├── limitations.md             ← uncovered spots + why (E1/E4)
├── open-questions.md          ← observations matching no rule (E6)
├── report.md                  ← final output: exec summary + scorecard + findings + gate (D7)
└── fix-log.md                 ← every gate-fail → which step regressed, what was patched
```

**Closed-loop rule:** every claim in `report.md` must link to a file inside `loop/<audit-name>/`. No link = opinion, not evidence.

## Standard structure

```markdown
# NN — Discover Output

## 1. Exec Summary (≤1 page)
Context | Total findings | Severity breakdown | Top 3 risks

## 2. Scope & Method
Audit target | Data states covered | Tools | Limitations (what was NOT covered)

## 3. Scorecard (0–10 per area)
Navigation | Consistency | Responsive | States coverage | A11y
→ Baseline. Refine measures delta on this table.

## 4. Findings Log — each row drops into a backlog untranslated
| ID | Screen | Evidence | Rule/heuristic violated | Severity | Effort | Owner |

## 5. Inventory & Journey Map
Screen tree + user goals + entry/exit per journey

## 6. Exit Gate (pass/fail)
□ Every screen has evidence  □ Every finding has ID+severity+effort
□ Scorecard has baseline scores  □ Limitations written down
```

## Principles

- **Evidence over opinion.** A finding without measurable proof is not written down.
- **Every finding = one backlog item.** Enough ID/screen/severity/effort for Plan to use directly.
- **Severity ≠ discovery order.** Rate by impact on user goals, not by when it was spotted.
- **Scorecard exists to measure delta.** Refine only means something against a baseline.
- **Limitations are output too.** "Not covered" tells Refine where to hunt gaps.
- **Exec summary stands alone.** Decision-makers read one page; implementers read the log.
- **Sources to benchmark:** NN/g heuristic-evaluation workbook; Orbix 7-deliverable audit; severity scale Critical/High/Medium/Low; effort S(<1h)/M(1–4h)/L(>4h).
