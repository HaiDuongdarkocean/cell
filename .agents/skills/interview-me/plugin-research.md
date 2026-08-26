# Plugin: Research Elicitation

> Load after domain scoping finds existing specs, knowledge atoms, or competitor patterns. Don't ask what you can research.

## When to Load

- Step 1 domain scoping found specs/ADRs related to idea → Document Analysis
- Step 1 found matching knowledge atoms in learning-and-apply → Data Mining
- Step 1 found NO related Cell content → Benchmarking (search competitors)

Run all three that apply. Each fills a different frame field.

## Document Analysis

**Read existing docs before asking the user.**

1. Grep `docs/specs/`, `docs/intent/`, `docs/reviews/`, `docs/adr/` for idea keywords
2. Read matching files
3. Present findings: "Em thấy đã có [X]. Idea của anh mở rộng từ đây hay khác?"
4. If user confirms extension → pre-fill Evidence field from existing spec
5. If user says different → continue elicitation

**Guard:** At least 1 relevant doc found and presented before asking the user.

**Loop back:** If no docs found, skip to Data Mining.

## Data Mining

**Check knowledge atoms before asking about known patterns.**

1. Grep `.agents/skills/learning-and-apply/index.json` for idea keywords
2. Read matching `experience/<id>.json` and `knowledge/<topic>.json`
3. Check `cases[].bad` against the idea
4. If bad pattern matches → warn user: "Em thấy đã gặp case tương tự, root cause là [Z]"
5. Fill Constraint field with known bad patterns

**Guard:** If atoms exist for this domain, at least 1 bad pattern checked against idea.

**Loop back:** If no atoms found, skip to Benchmarking.

## Benchmarking

**Search competitors when Cell has nothing related.**

1. `web_search "[feature] chrome extension"`
2. Identify 2-3 competitor extensions
3. `webfetch` competitor pages → extract feature list + UX pattern
4. Present: "Em thấy [competitor] làm [pattern]. Anh muốn tương tự hay khác?"
5. Fill Scope field with competitor parity baseline

**Guard:** At least 2 competitors researched before suggesting patterns.

**Loop back:** If competitors don't exist, this is a novel feature — continue elicitation without benchmark.

## Output

| Technique | Frame field filled |
|---|---|
| Document Analysis | Evidence (existing specs) |
| Data Mining | Constraint (known bad patterns) |
| Benchmarking | Scope (competitor parity) |

Present research findings to user before continuing interview. User confirms or corrects.

## Anti-patterns

| Anti-pattern | Why it fails |
|---|---|
| Ask user about existing spec | Waste — read the spec, don't ask |
| Ignore knowledge atoms | Repeat known mistakes |
| Suggest pattern without competitor research | Reinvent wheel |
| Skip research, go straight to interview | Miss existing knowledge |
| Present 10 findings at once | Overwhelm — present top 3 relevant |

## Verification

- [ ] Document Analysis ran if specs/ADRs found in Step 1
- [ ] Data Mining ran if knowledge atoms found
- [ ] Benchmarking ran if no Cell content found
- [ ] Research findings presented to user before asking
- [ ] Frame fields updated from research
- [ ] User confirmed or corrected research findings
