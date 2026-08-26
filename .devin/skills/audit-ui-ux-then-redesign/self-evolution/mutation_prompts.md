# Mutation Prompts

Use these to generate candidate improvements to `SKILL.md` when `RUNBOOK.md` has 5+ entries.

1. The agent is over-auditing P2/P3 findings and missing the P0. → Tighten Part 6 of `AUDIT.md` and add a "so what?" check to each finding.
2. The 3 dials are being guessed, not derived. → Add a worksheet that maps evidence to dial values.
3. The brief is not implementable. → Strengthen the Technical Feasibility gate in `BRIEF-TEMPLATE.md` and Step 5 of `SKILL.md`.
4. The agent asks too many questions. → Compress `ELICIT.md` and add a "3-question max" rule before defaulting.
5. The agent is copying references 1:1. → Add an anti-pattern: "Do not replicate a reference; translate its principle into the current system."
6. The agent misses landing-page-specific tells. → Expand Part 4 of `AUDIT.md` or create `LANDING.md`.
7. The agent proposes motion on high-frequency interactions. → Add a frequency check to `SKILL.md` Step 5.
8. The agent reports "missing color/border" without first verifying the token exists. → Add a `tokens.css`/`tokens.json` lookup step in `AUDIT.md` before any component visual diagnosis.
9. The agent misses nested borders in a card/gallery wrapper. → Add a "border count" check in `AUDIT.md`: if a component container has >1 visible border, convert the inner ones to spacing or background.
10. The agent wraps a broken shared component in custom wrappers instead of fixing the component. → Add a "root-cause before wrapper" step in `SKILL.md` Step 4: verify the design-system primitive exists and is correctly tokenized before adding new markup.
