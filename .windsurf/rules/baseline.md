---
description: "Chrome extension baseline rules"
trigger: always_on
---

# Chrome Extension Baseline Rules

## UI/UX
- Always apply when designing ui/ux for the system [docs/reference-ui_ux_system.md](reference-ui_ux_system.md)

## Knowledge Base
- Always refer to the knowledge base for the system [docs/reference-knowledge_base.md](reference-knowledge_base.md)
- For chrome-devtools MCP usage (live debug on Chrome/Edge), refer to [docs/knowleadge/reference-chrome-devtools-mcp.md](../../docs/knowleadge/reference-chrome-devtools-mcp.md)

## Architecture Map
- Always read [docs/architechture-system.md](../../docs/architechture-system.md) first to know file structure, dependencies, and impact radius
- Update it whenever: adding/removing/renaming files, changing imports, or modifying data flows
- Use the "Update protocol" section at the bottom of that file for guidance

## Test-Driven Development
When implementing logic, fixing bugs, or changing behavior:
- Write a failing test first (RED)
- Write minimal code to make it pass (GREEN)
- Refactor while tests remain green (REFACTOR)
- For bug fixes, reproduce with a test before fixing (Prove-It Pattern)
- Follow the test pyramid: 80% unit, 15% integration, 5% E2E
- Prefer real implementations over mocks
- Test state, not interactions
- Use DAMP over DRY in tests
- **REFACTOR phase rule**: REFACTOR is a conscious decision, not automatic. After GREEN, ask "Is there anything to improve that does NOT change behavior?" If no → skip, commit, move on. Use the **5-axis review from `code-review-and-quality` skill** (correctness, readability, architecture, security, performance) — do NOT invent your own checklist. Ponytail alignment: REFACTOR must not add abstractions/boilerplate/complexity, only remove problems. Mark deliberate simplifications with `// ponytail:` comments.

Invoke `/test` for full TDD workflow.

## Code Review and Quality
Before merging any change:
- Review across 5 axes: correctness, readability, architecture, security, performance
- Keep changes small (~100 lines, max ~300)
- Separate refactoring from feature work
- Write clear commit messages (imperative, standalone first line)
- Check for edge cases, error paths, and test coverage
- Verify naming, control flow, and module boundaries
- Ensure no security vulnerabilities (input validation, no secrets in code)
- Check for performance issues (N+1 queries, unbounded loops)

Invoke `/review` for full code review workflow.

## Source-Driven Development
When writing framework-specific code:
- Detect exact versions from dependency files (package.json, etc.)
- Fetch official documentation for the feature being implemented
- Follow documented patterns, not memory
- Cite sources with full URLs in code comments
- Never cite Stack Overflow or blog posts as primary sources
- Flag unverified patterns explicitly
- Surface conflicts between docs and existing code

For Chrome extensions, always cite:
- https://developer.chrome.com/docs/extensions/reference/
- https://developer.chrome.com/docs/extensions/mv3/

Invoke `/source-driven-development` for full source-driven workflow.

## Quick Reference
- `/spec` - Write PRD before code → invokes **spec-driven-development** skill
- `/plan` - Break down into tasks → invokes **planning-and-task-breakdown** skill
- `/build` - Incremental implementation → invokes **incremental-implementation** skill
- `/test` - TDD workflow → invokes **test-driven-development** skill
- `/review` - Code review → invokes **code-review-and-quality** skill
- `/security` - Security hardening → invokes **security-and-hardening** skill
- `/source-driven-development` - Source-cited implementation → invokes **source-driven-development** skill

See `AGENTS.md` → Skill Orchestration for full skill hierarchy and synergies.

## called
- always call me "Anh yêu", xưng là "em"
