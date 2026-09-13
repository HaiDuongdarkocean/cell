# Git Workflow — detail reference

## Trunk-based development

```text
main ──●──●──●──●──●──●──●──●──●──  (always deployable)
        ╲      ╱  ╲    ╱
         ●──●─╱    ●──╱    ← short-lived feature branches (1-3 days)
```

Release branches are acceptable for stabilizing a release while main moves forward. Teams on gitflow can adapt — commit discipline matters more than the branching model.

## The save point pattern

```text
Make a change → test passes? → commit → continue
              → test fails?  → revert to last commit → investigate
```

## Debt payback commits

Each debt slice gets a `debt:` commit carrying the audit context:

```text
debt(subtitle): extract sync state from contentScriptController

- Moves playback state transitions into useSubtitlePlaybackState.
- Characterization test for legacy output included.
- Before: contentScriptController.ts 1951 lines.
- After: contentScriptController.ts 1780 lines; new hook 220 lines.
- Audit item: #2, score 3.80.
```

## Change summaries

After any modification, provide:

```text
CHANGES MADE:
- src/routes/tasks.ts: Added validation middleware to POST endpoint
- src/lib/validation.ts: Added TaskCreateSchema using Zod

THINGS I DIDN'T TOUCH (intentionally):
- src/routes/auth.ts: Has similar validation gap but out of scope

POTENTIAL CONCERNS:
- The Zod schema is strict — rejects extra fields. Confirm desired.
- Added zod as a dependency (72KB gzipped) — already in package.json
```

The "DIDN'T TOUCH" section proves scope discipline.

## Git hooks (lint-staged example)

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

## Git for debugging

```bash
git bisect start && git bisect bad HEAD && git bisect good <known-good>
git log --oneline -20
git diff HEAD~5..HEAD -- src/
git blame src/services/task.ts
git log --grep="validation" --oneline
```

## Changelog format

```markdown
## [1.4.0] - 2025-06-12
### Added
- Bulk task import via CSV
### Fixed
- Timezone drift in recurring task due dates
### Deprecated
- `GET /v1/tasks/all` — use the paginated `GET /v1/tasks` (removal in 2.0)
```

## Common rationalizations

| Rationalization | Reality |
|---|---|
| "I'll commit when the feature is done" | One giant commit is unreviewable and unrevertable. |
| "The message doesn't matter" | Messages are documentation for future agents too. |
| "I'll squash it all later" | Squashing destroys the development narrative. |
| "Branches add overhead" | Long-lived branches are the problem, not branches. |
| "I'll split this change later" | Split before submitting, not after. |
| "I don't need a .gitignore" | Until `.env` with production secrets gets committed. |
| "Just a small fix, bump the patch" | A behavior change consumers relied on is a major. |
| "Changelog is just the commit log" | Commits are for you; the changelog is for consumers. |
| "Write the changelog at release time" | Impact reconstructed from memory is half missing. |
