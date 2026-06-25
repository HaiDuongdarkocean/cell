# Project Knowledge

## Tech Stack
- **Runtime**: Chrome Extension MV3 (manifest v3)
- **UI**: React 19, Zustand 5, TypeScript 6
- **Build**: Vite 8 + @crxjs/vite-plugin
- **Transmuxing**: mux.js 6 (TS → fMP4)
- **Testing**: Jest 30 (unit + integration), Playwright (E2E)
- **Linting**: ESLint 9 + Prettier 3
- **Platform**: Windows (PowerShell) — no bash heredoc, use temp file + `git commit -F`

## Commands
```
Build:            npm run build
Typecheck:        npm run typecheck
Test (all):       npm test                  # unit + integration (~29s)
Test unit only:   npm run test:unit         # ~3s, day-to-day (alias: test:fast)
Test integration: npm run test:integration  # real m3u8 download + transmux
Test watch:       npm run test:watch        # unit only
Coverage:         npm run test:coverage
Lint:             npm run lint
Lint fix:         npm run lint:fix
E2E:              npm run test:e2e
```

Note: `npm test -- --testPathPattern=` is deprecated in jest 30; use `--testPathPatterns=`.

## Jest Projects (unit + integration split)
- **unit**: `tests/unit/**`, `tests/components/**`, `tests/utils/**`, `src/**` — `*.test.ts(x)`. ~3s, no network.
- **integration**: `tests/integration/**` — `*.integration.test.ts`. Uses `globalSetup` to download m3u8 + TS segments ONCE, cache to `.cache/` (gitignored).
- Run single: `npm run test:unit` / `npm run test:integration`, or `npx jest --selectProjects unit`.

## Code Conventions
- Functional components with hooks (no class components)
- Named exports (no default exports)
- Colocate tests: `Button.tsx` → `Button.test.tsx`
- Pure functions for logic (testable, no side effects)
- TypeScript strict mode — no `any` without justification
- Chrome API calls cite official docs: https://developer.chrome.com/docs/extensions/reference/
- Ponytail ladder: YAGNI → reuse codebase → stdlib → native → installed dep → one-liner → minimal

## Boundaries
- Never commit `.env` files or secrets
- Never add dependencies without checking bundle size
- Never modify `manifest.json` without testing in real Chrome
- Always run `npm run typecheck` + `npm run test:unit` before commit
- Separate refactoring from feature work (2 separate commits)

## Level 2 Reference Docs (load per session, NOT always-on)
- [docs/learned-bugfixes.md](docs/learned-bugfixes.md) — Bug fix history (auto-download, tab-scoping, Edge leak)
- [docs/architecture-auto-select.md](docs/architecture-auto-select.md) — Auto-Select & Auto-Download feature architecture
- [docs/reference-knowledge_base.md](docs/reference-knowledge_base.md) — E2E Debugging with Chrome DevTools MCP
- [docs/knowleadge/reference-chrome-devtools-mcp.md](docs/knowleadge/reference-chrome-devtools-mcp.md) — chrome-devtools MCP config
- [docs/architechture-system.md](docs/architechture-system.md) — File structure, dependencies, impact radius (update on file changes)
- [docs/spec-subtitle-overlay.md](docs/spec-subtitle-overlay.md) — Subtitle overlay feature spec

---

## Skill Orchestration

### Always-on Rules
- `.windsurf/rules/baseline.md` — Windsurf-specific (UI/UX, knowledge base, architecture map, slash commands)
- `.windsurf/rules/ponytail.md` — Lazy senior dev ladder (YAGNI → reuse → stdlib → minimal)
- `AGENTS.md` (this file) — Cross-tool project knowledge + skill hierarchy

### Skill Hierarchy (compact — invoke skill for full workflow)

| Phase | Skill | When |
|---|---|---|
| 1. Clarify | interview-me | Request underspecified |
| 2. Spec | spec-driven-development | New feature, no spec exists |
| 3. Plan | planning-and-task-breakdown | Spec exists, need task breakdown |
| 4. Architecture | system-architecture-design / cto-persona | New project, major feature, tech strategy |
| 5. Implement | incremental-implementation / source-driven-development / frontend-ui-engineering / doubt-driven-development / ponytail.md | >1 file, framework code, UI, high stakes, always-on minimal |
| 6. Test | test-driven-development / browser-testing-with-devtools | Logic/bug/behavior, browser code |
| 7. Review | code-review-and-quality / doubt-driven-development | Before merge, correctness-critical |
| 8. Git | git-workflow-and-versioning | Any code change |
| 9. Security | security-and-hardening | User input, auth, data, external |
| 10. Performance | performance-optimization | Perf requirements, regressions |
| 11. Docs | documentation-and-adrs | Architecture decisions, API changes |
| 12. Deploy | shipping-and-launch / ci-cd-and-automation | Production deploy, pipelines |
| 13. Monitor | observability-and-instrumentation | Production features, issues |
| 14. Debug | debugging-and-error-recovery | Tests fail, builds break |
| 15. Refactor | code-simplification | Clarity without behavior change |
| 16. Deprecate | deprecation-and-migration | Removing old systems |
| 17. Ideate | idea-refine | Vague idea, stress-test assumptions |
| 18. Meta | using-agent-skills / devin-for-terminal / context-engineering / api-and-interface-design | Skill discovery, docs lookup, context setup, API design |

### TDD REFACTOR Rule
Conscious decision, not automatic. After GREEN, ask "Anything to improve without changing behavior?" If no → skip, commit, move on. Use **5-axis review from `code-review-and-quality` skill** (correctness, readability, architecture, security, performance) — do NOT invent your own checklist. Ponytail: REFACTOR removes problems, never adds abstractions. Mark deliberate simplifications with `// ponytail:` comments.

### Skill Synergies
- **TDD + Minimalism + Review**: `test-driven-development` + `ponytail.md` + `code-review-and-quality`
- **Chrome Extension Safety**: `baseline.md` + `source-driven-development` + `browser-testing-with-devtools`
- **Architecture + Incremental**: `system-architecture-design` + `incremental-implementation` + `planning-and-task-breakdown`
- **Correctness + Doubt**: `doubt-driven-development` + `test-driven-development` + `browser-testing-with-devtools`
- **Performance + Measurement**: `performance-optimization` + `observability-and-instrumentation`
- **Security + Validation**: `security-and-hardening` + `doubt-driven-development`

### Architecture Sync Rule
When adding/removing/renaming files: update `docs/architechture-system.md` before commit.

### Context Engineering Strategy
- Pro-active: compact context at start of new task, not reactive at 80%
- Strategy: only load relevant files for current task (grep/glob first, not entire src/)
- Activate `/context-engineering` if context window reaches 80% capacity

### Communication
- always call me "Anh yêu", xưng là "em"

### Git Commit Rules
- **Atomic commits**: each commit does one logical thing
- **Separate refactoring from feature work**: refactor commit ≠ feature commit
- **Format**: `<type>: <description>` — types: feat, fix, refactor, test, docs, chore
- **Body explains why, not what**
- **Pre-commit**: check staged diff, no secrets, run tests + lint + typecheck
- **Change Summaries after modification**:
  ```
  CHANGES MADE:
  - file: what changed
  THINGS I DIDN'T TOUCH:
  - file: why not
  POTENTIAL CONCERNS:
  - concern
  ```
