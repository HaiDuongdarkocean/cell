# `all`-mode vision verification

> Load at step 6 of the autonomous variant — after brief + mapping + mockup exist and `check-design-brief.mjs` passes. The `vision-reader` subagent is the fresh-context proxy for a human's eyes; it judges, it does not design.

## Screenshot capture

```bash
npm run dev          # serve the mockup entrypoint
# URL convention: http://localhost:5173/src/entrypoints/mockup-<slug>/index.html
```

Playwright (persistent Chromium, `testing-extension-browser` conventions — `browser_preview` proxy is unreliable on Windows, use the dev URL directly):

- Mobile ≤420px + Desktop ≥960px
- Light + Dark (`data-theme`/`data-preset` switcher in the shell)
- The variant AND the real production panel, same viewport — comparison is the point

Save shots to `tmp/<slug>-design/`.

## vision-reader prompt template

```
Read <screenshot.png> for mockup variant "<concept name>" of feature <slug>.

Design intent (from docs/intent/<slug>-design-brief.md):
- IA mental model: <...>
- Visual archetype: <...>
- Primary job: <...>

Compare against <real-panel.png> (shipped UI).

Judge design-system faithfulness ONLY — do not redesign:
1. Surfaces: solid/filled, no glass/blur, token-plausible colors
2. Shape: corner radii consistent with the system's quiet-confidence language
   (small radius on lists/menus — the FAB failure was "too round")
3. Typography rhythm matches sibling panels
4. Touch targets ≥44px; spacing not cramped at 375px
5. States visible: hover/focus/pressed/disabled/empty/error where applicable
6. Deviations vs the shipped panel — list each with severity (P0 breaks job /
   P1 noticeable / P2 polish)

Output:
VERDICT: PASS | FAIL
<then the deviation table>
```

## Rules

- `vision-reader` is a **soft signal** — the best available no-human proxy; the
  human can still veto later via the review report. It is not proof of good
  design, only evidence of non-broken design.
- FAIL → fix → re-run `check-design-brief.mjs` → re-screenshot → re-judge.
  Bounded by `loops` cap 3 (`transition --to analyze` count).
- Write the report to `docs/reviews/<slug>-design.md` ending `VERDICT: PASS|FAIL`
  — the transition parses the last matching line.
- Screenshots are scratch: `tmp/<slug>-design/`, gitignored, delete when done.
