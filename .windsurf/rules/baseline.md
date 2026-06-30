# Project Baseline (Windsurf)

> Cross-tool source of truth is `AGENTS.md`. This file is the Windsurf-specific reminder.

## Mandatory pre-flight

1. Identify phase 0-7 → invoke `/software-production-workflow`.
2. Read `docs/2-architechture-system.md` before touching code.
3. Grep `docs/knowledge/` for related keywords before writing new logic.
4. Browser-facing changes MUST be verified in real Chrome/Edge (MCP DevTools or Playwright) before commit.

## Quality gates

- `npm run test:unit`
- `npx tsc --noEmit`
- `npm run lint`
- Atomic commits: code ≠ docs.

## Update protocol

- Add/remove/rename `src/` files → update `docs/2-architechture-system.md` (3 places: tree, dependency table, function index).
- Add/remove docs → update `docs/0-wiki.md`.
- Reusable insight → `docs/knowledge/<principle>.md`.
- Architecture decision → `docs/adr/<decision>.md`.
