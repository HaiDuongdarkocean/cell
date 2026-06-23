# Chrome Extension Baseline Rules

## UI/UX
- Always apply when designing ui/ux for the system [reference-ui_ux_system.md](reference-ui_ux_system.md)

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
- `/spec` - Write PRD before code
- `/plan` - Break down into tasks
- `/build` - Incremental implementation
- `/test` - TDD workflow
- `/review` - Code review
- `/security` - Security hardening
- `/source-driven-development` - Source-cited implementation
