# Context Engineering — patterns & templates

## Rules file skeleton

```markdown
# Project: [Name]

## Tech Stack
- React 18, TypeScript 5, Vite
- Node.js 22, Express, PostgreSQL, Prisma

## Commands
- Build: `npm run build` · Test: `npm test` · Lint: `npm run lint --fix`
- Dev: `npm run dev` · Type check: `npx tsc --noEmit`

## Code Conventions
- Functional components with hooks; named exports
- Colocate tests: `Button.tsx` → `Button.test.tsx`
- Error boundaries at route level

## Boundaries
- Never commit .env or secrets
- No new dependencies without bundle-size check
- Ask before modifying database schema
- Run tests before committing

## Patterns
[One short example of a well-written component in your style]
```

Equivalent files per tool: `AGENTS.md` · `.cursorrules` · `.windsurfrules` · `.github/copilot-instructions.md`.

## Packing strategies

### Brain dump (session start)

```text
PROJECT CONTEXT:
- We're building [X] using [tech stack]
- The relevant spec section is: [excerpt]
- Key constraints: [list]
- Files involved: [list with brief descriptions]
- Related patterns: [pointer to an example file]
- Known gotchas: [list]
```

### Selective include (per task)

```text
TASK: Add email validation to the registration endpoint

RELEVANT FILES:
- src/routes/auth.ts (endpoint to modify)
- src/lib/validation.ts (existing utilities)
- tests/routes/auth.test.ts (tests to extend)

PATTERN TO FOLLOW:
- phone validation in src/lib/validation.ts:45-60

CONSTRAINT:
- Use the existing ValidationError class, not raw errors
```

### Hierarchical summary (large projects)

```markdown
## Authentication (src/auth/)
Handles registration, login, password reset.
Key files: auth.routes.ts, auth.service.ts, auth.middleware.ts
Pattern: all routes use authMiddleware, errors use AuthError class
```

Load only the relevant section per task.

## MCP integrations

| MCP server | Provides |
|---|---|
| Context7 | Library docs on demand |
| Chrome DevTools | Live DOM, console, network |
| PostgreSQL | Schema + query results |
| Filesystem | File access/search |
| GitHub | Issues, PRs, repo context |

## Confusion management examples

**Conflict:**

```text
CONFUSION:
The spec calls for REST endpoints, but the existing codebase uses GraphQL
for user queries (src/graphql/user.ts).

Options:
A) Follow the spec — add REST endpoint, potentially deprecate GraphQL later
B) Follow existing patterns — use GraphQL, update the spec
C) Ask — this seems like an intentional decision I shouldn't override

→ Which approach should I take?
```

**Missing requirement:**

```text
MISSING REQUIREMENT:
The spec defines task creation but doesn't specify what happens
when a user creates a task with a duplicate title.

Options:
A) Allow duplicates (simplest)
B) Reject with validation error (strictest)
C) Append a suffix like "Task (2)" (most user-friendly)

→ Which behavior do you want?
```

**Inline planning:**

```text
PLAN:
1. Add Zod schema for task creation — validates title + description
2. Wire schema into POST /api/tasks route handler
3. Add test for validation error response
→ Executing unless you redirect.
```
