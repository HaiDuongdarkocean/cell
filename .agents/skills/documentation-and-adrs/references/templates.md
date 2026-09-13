# Documentation — ADR & doc templates

## Standard ADR

```markdown
# ADR-001: Use PostgreSQL for primary database

## Status
Accepted | Superseded by ADR-XXX | Deprecated

## Date
2025-01-15

## Context
We need a primary database for the task management application. Key requirements:
- Relational data model (users, tasks, teams with relationships)
- ACID transactions for task state changes
- Support for full-text search on task content
- Managed hosting available (for small team, limited ops capacity)

## Decision
Use PostgreSQL with Prisma ORM.

## Alternatives Considered

### MongoDB
- Pros: Flexible schema, easy to start with
- Cons: Our data is inherently relational; would need to manage relationships manually
- Rejected: Relational data in a document store leads to complex joins or data duplication

### SQLite
- Pros: Zero configuration, embedded, fast for reads
- Cons: Limited concurrent write support, no managed hosting for production
- Rejected: Not suitable for multi-user web application in production

## Consequences
- Prisma provides type-safe database access and migration management
- We can use PostgreSQL's full-text search instead of adding Elasticsearch
- Team needs PostgreSQL knowledge (standard skill, low risk)
- Hosting on managed service (Supabase, Neon, or RDS)
```

## Debt payback ADR

For significant debt remediation (extracting a large controller, replacing a dependency, raising module coverage):

```markdown
# ADR-XXX: Pay down [debt item] in [module]

## Status
Proposed

## Date
2025-06-22

## Context
- Audit item: #[N] in [audit file or date]
- Debt type: [Testing | Architectural | Dependency | Code quality | Process]
- Current state: [file size, coverage, score, risk]
- Trigger: [feature blocked, flaky tests, bundle size, etc.]

## Decision
[What strategy: Strangler Fig / Branch by Abstraction / Boy Scout / dedicated test sprint]

## Alternatives Considered
### [Alternative 1]
- Pros: ...
- Cons: ...
- Rejected because: ...

## Temporary Abstractions
- [Abstraction name] introduced in [file]; will be removed when [condition].
- Tracking issue: [ticket or task].

## Consequences
- [Expected state after: file size, coverage, score]
- [Risks and rollback plan]
- [When the old implementation will be deleted]
```

## Inline examples

```typescript
// GOOD: explains non-obvious intent
// Rate limit uses a sliding window — reset counter at window boundary,
// not on a fixed schedule, to prevent burst attacks at window edges
if (now - windowStart > WINDOW_SIZE_MS) {
  counter = 0;
  windowStart = now;
}

/**
 * IMPORTANT: This function must be called before the first render.
 * If called after hydration, it causes a flash of unstyled content
 * because the theme context isn't available during SSR.
 *
 * See ADR-003 for the full design rationale.
 */
export function initializeTheme(theme: Theme): void { /* ... */ }
```

## TSDoc for public functions

```typescript
/**
 * Creates a new task.
 *
 * @param input - Task creation data (title required, description optional)
 * @returns The created task with server-generated ID and timestamps
 * @throws {ValidationError} If title is empty or exceeds 200 characters
 * @throws {AuthenticationError} If the user is not authenticated
 *
 * @example
 * const task = await createTask({ title: 'Buy groceries' });
 */
export async function createTask(input: CreateTaskInput): Promise<Task> { /* ... */ }
```

## OpenAPI fragment

```yaml
paths:
  /api/tasks:
    post:
      summary: Create a task
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateTaskInput'
      responses:
        '201':
          description: Task created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Task'
        '422':
          description: Validation error
```

## README skeleton

```markdown
# Project Name

One-paragraph description of what this project does.

## Quick Start
1. Clone the repo
2. Install dependencies: `npm install`
3. Set up environment: `cp .env.example .env`
4. Run the dev server: `npm run dev`

## Commands
| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm test` | Run tests |
| `npm run build` | Production build |

## Architecture
Brief overview + link to ADRs.

## Contributing
Standards + PR process.
```

## Changelog format

```markdown
# Changelog

## [1.2.0] - 2025-01-20
### Added
- Task sharing: users can share tasks with team members (#123)

### Fixed
- Duplicate tasks appearing when rapidly clicking create button (#125)

### Changed
- Task list now loads 50 items per page (was 20) for better UX (#126)
```
