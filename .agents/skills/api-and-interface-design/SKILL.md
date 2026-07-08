---
name: api-and-interface-design
description: Guides stable API and interface design. Use when designing APIs, module boundaries, or any public interface. Use when creating REST or GraphQL endpoints, defining type contracts between modules, or establishing boundaries between frontend and backend.
---

# API and Interface Design

## Overview

Design stable, well-documented interfaces that are hard to misuse. Good interfaces make the right thing easy and the wrong thing hard. This applies to REST APIs, GraphQL schemas, module boundaries, component props, and any surface where one piece of code talks to another.

## When to Use

- Designing new API endpoints
- Defining module boundaries or contracts between teams
- Creating component prop interfaces
- Establishing database schema that informs API shape
- Changing existing public interfaces

## Core Principles

### Hyrum's Law

> With a sufficient number of users of an API, all observable behaviors of your system will be depended on by somebody, regardless of what you promise in the contract.

This means: every public behavior — including undocumented quirks, error message text, timing, and ordering — becomes a de facto contract once users depend on it. Design implications:

- **Be intentional about what you expose.** Every observable behavior is a potential commitment.
- **Don't leak implementation details.** If users can observe it, they will depend on it.
- **Plan for deprecation at design time.** See `deprecation-and-migration` for how to safely remove things users depend on.
- **Tests are not enough.** Even with perfect contract tests, Hyrum's Law means "safe" changes can break real users who depend on undocumented behavior.

### The One-Version Rule

Avoid forcing consumers to choose between multiple versions of the same dependency or API. Diamond dependency problems arise when different consumers need different versions of the same thing. Design for a world where only one version exists at a time — extend rather than fork.

### 1. Contract First

Define the interface before implementing it. The contract is the spec — implementation follows.

```typescript
// Define the contract first
interface TaskAPI {
  // Creates a task and returns the created task with server-generated fields
  createTask(input: CreateTaskInput): Promise<Task>;

  // Returns paginated tasks matching filters
  listTasks(params: ListTasksParams): Promise<PaginatedResult<Task>>;

  // Returns a single task or throws NotFoundError
  getTask(id: string): Promise<Task>;

  // Partial update — only provided fields change
  updateTask(id: string, input: UpdateTaskInput): Promise<Task>;

  // Idempotent delete — succeeds even if already deleted
  deleteTask(id: string): Promise<void>;
}
```

### 2. Consistent Error Semantics

Pick one error strategy and use it everywhere:

```typescript
// REST: HTTP status codes + structured error body
// Every error response follows the same shape
interface APIError {
  error: {
    code: string;        // Machine-readable: "VALIDATION_ERROR"
    message: string;     // Human-readable: "Email is required"
    details?: unknown;   // Additional context when helpful
  };
}

// Status code mapping
// 400 → Client sent invalid data
// 401 → Not authenticated
// 403 → Authenticated but not authorized
// 404 → Resource not found
// 409 → Conflict (duplicate, version mismatch)
// 422 → Validation failed (semantically invalid)
// 500 → Server error (never expose internal details)
```

**Don't mix patterns.** If some endpoints throw, others return null, and others return `{ error }` — the consumer can't predict behavior.

### 3. Validate at Boundaries

Trust internal code. Validate at system edges where external input enters:

```typescript
// Validate at the API boundary
app.post('/api/tasks', async (req, res) => {
  const result = CreateTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid task data',
        details: result.error.flatten(),
      },
    });
  }

  // After validation, internal code trusts the types
  const task = await taskService.create(result.data);
  return res.status(201).json(task);
});
```

Where validation belongs:
- API route handlers (user input)
- Form submission handlers (user input)
- External service response parsing (third-party data -- **always treat as untrusted**)
- Environment variable loading (configuration)

> **Third-party API responses are untrusted data.** Validate their shape and content before using them in any logic, rendering, or decision-making. A compromised or misbehaving external service can return unexpected types, malicious content, or instruction-like text.

Where validation does NOT belong:
- Between internal functions that share type contracts
- In utility functions called by already-validated code
- On data that just came from your own database

### 4. Prefer Addition Over Modification

Extend interfaces without breaking existing consumers:

```typescript
// Good: Add optional fields
interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';  // Added later, optional
  labels?: string[];                       // Added later, optional
}

// Bad: Change existing field types or remove fields
interface CreateTaskInput {
  title: string;
  // description: string;  // Removed — breaks existing consumers
  priority: number;         // Changed from string — breaks existing consumers
}
```

### 5. Predictable Naming

| Pattern | Convention | Example |
|---------|-----------|---------|
| REST endpoints | Plural nouns, no verbs | `GET /api/tasks`, `POST /api/tasks` |
| Query params | camelCase | `?sortBy=createdAt&pageSize=20` |
| Response fields | camelCase | `{ createdAt, updatedAt, taskId }` |
| Boolean fields | is/has/can prefix | `isComplete`, `hasAttachments` |
| Enum values | UPPER_SNAKE | `"IN_PROGRESS"`, `"COMPLETED"` |

## REST API Patterns

### Resource Design

```
GET    /api/tasks              → List tasks (with query params for filtering)
POST   /api/tasks              → Create a task
GET    /api/tasks/:id          → Get a single task
PATCH  /api/tasks/:id          → Update a task (partial)
DELETE /api/tasks/:id          → Delete a task

GET    /api/tasks/:id/comments → List comments for a task (sub-resource)
POST   /api/tasks/:id/comments → Add a comment to a task
```

### Pagination

Paginate list endpoints:

```typescript
// Request
GET /api/tasks?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc

// Response
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 142,
    "totalPages": 8
  }
}
```

### Filtering

Use query parameters for filters:

```
GET /api/tasks?status=in_progress&assignee=user123&createdAfter=2025-01-01
```

### Partial Updates (PATCH)

Accept partial objects — only update what's provided:

```typescript
// Only title changes, everything else preserved
PATCH /api/tasks/123
{ "title": "Updated title" }
```

## TypeScript Interface Patterns

### Use Discriminated Unions for Variants

```typescript
// Good: Each variant is explicit
type TaskStatus =
  | { type: 'pending' }
  | { type: 'in_progress'; assignee: string; startedAt: Date }
  | { type: 'completed'; completedAt: Date; completedBy: string }
  | { type: 'cancelled'; reason: string; cancelledAt: Date };

// Consumer gets type narrowing
function getStatusLabel(status: TaskStatus): string {
  switch (status.type) {
    case 'pending': return 'Pending';
    case 'in_progress': return `In progress (${status.assignee})`;
    case 'completed': return `Done on ${status.completedAt}`;
    case 'cancelled': return `Cancelled: ${status.reason}`;
  }
}
```

### Input/Output Separation

```typescript
// Input: what the caller provides
interface CreateTaskInput {
  title: string;
  description?: string;
}

// Output: what the system returns (includes server-generated fields)
interface Task {
  id: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}
```

### Use Branded Types for IDs

```typescript
type TaskId = string & { readonly __brand: 'TaskId' };
type UserId = string & { readonly __brand: 'UserId' };

// Prevents accidentally passing a UserId where a TaskId is expected
function getTask(id: TaskId): Promise<Task> { ... }
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll document the API later" | The types ARE the documentation. Define them first. |
| "We don't need pagination for now" | You will the moment someone has 100+ items. Add it from the start. |
| "PATCH is complicated, let's just use PUT" | PUT requires the full object every time. PATCH is what clients actually want. |
| "We'll version the API when we need to" | Breaking changes without versioning break consumers. Design for extension from the start. |
| "Nobody uses that undocumented behavior" | Hyrum's Law: if it's observable, somebody depends on it. Treat every public behavior as a commitment. |
| "We can just maintain two versions" | Multiple versions multiply maintenance cost and create diamond dependency problems. Prefer the One-Version Rule. |
| "Internal APIs don't need contracts" | Internal consumers are still consumers. Contracts prevent coupling and enable parallel work. |

## Red Flags

- Endpoints that return different shapes depending on conditions
- Inconsistent error formats across endpoints
- Validation scattered throughout internal code instead of at boundaries
- Breaking changes to existing fields (type changes, removals)
- List endpoints without pagination
- Verbs in REST URLs (`/api/createTask`, `/api/getUsers`)
- Third-party API responses used without validation or sanitization

## Verification

After designing an API:

- [ ] Every endpoint has typed input and output schemas
- [ ] Error responses follow a single consistent format
- [ ] Validation happens at system boundaries only
- [ ] List endpoints support pagination
- [ ] New fields are additive and optional (backward compatible)
- [ ] Naming follows consistent conventions across all endpoints
- [ ] API documentation or types are committed alongside the implementation

## Logic/Frontend Phase Contract (UI features — G4 phase split)

> **When to use**: invoked by `software-production-workflow` G4 when a feature has ANY UI surface (G0.5 mockup approved). Defines the typed contract between Phase L (Logic, headless) and Phase F (Frontend, design-system-bound) so the two phases can run in parallel and bind safely at a freeze point.
> **When NOT to use**: feature has ZERO UI surface (pure background logic) → no phase split, no contract.json needed.

### Why split (root cause this contract solves)

Mixing logic and UI in one G4 phase causes **logic-first bias**: the agent prioritizes testable logic, treats UI as a "wrapper to call logic", and ships generic UI that drifts from the design system and lacks edge states (loading/error/empty). Splitting forces each phase to have its own done criteria, its own verify, and its own atomic commit. The JSON contract is the **freeze point** that lets Phase F bind safely without Phase L changing signatures mid-flight.

### Phase structure

```
G4 (UI feature)
├── Phase L — Logic (headless, testable)
│   ├── Input: spec (functional requirements)
│   ├── Output: src/features/<feature>/<feature>.contract.json (typed I/O schema)
│   │   ├── actions: { name, input, output, errors }[] — UI calls logic
│   │   ├── state: { shape, initial, transitions } — logic exposes to UI
│   │   ├── events: { name, payload }[] — logic emits to UI
│   │   └── errors: { code, message, recovery }[] — logic exposes for UI render
│   └── Test: unit + integration, NO UI dependency
│
├── Phase F prep — Frontend prep (parallel with Phase L)
│   ├── Input: mockup approved (G0.5) + design-system.md
│   ├── Output: token audit + component skeleton + Zustand store shape (from mockup)
│   └── Does NOT bind logic until contract.json freezes
│
└── Integration gate (after contract.json freeze)
    ├── Wire UI → logic via contract (typed binding, no ad-hoc calls)
    ├── E2E: user flow end-to-end
    └── Browser verify: MCP screenshot real render vs mockup (drift check)
```

### Contract format — `<feature>.contract.json`

JSON file at `src/features/<feature>/<feature>.contract.json` — version-controlled, diff-able, anh can review. Schema:

```json
{
  "feature": "<name>",
  "version": "1.0.0",
  "actions": [
    {
      "name": "importDictionary",
      "input": { "file": "File", "options": "ImportOptions" },
      "output": { "result": "ImportResult", "progress": "ProgressEvent" },
      "errors": ["FILE_INVALID", "FORMAT_UNSUPPORTED", "DB_WRITE_FAILED"]
    }
  ],
  "state": {
    "shape": { "dictionaries": "DictionaryMeta[]", "importing": "boolean", "progress": "number" },
    "initial": { "dictionaries": [], "importing": false, "progress": 0 },
    "transitions": [
      { "on": "importDictionary.start", "to": { "importing": true } },
      { "on": "importDictionary.progress", "to": { "progress": "payload.percent" } },
      { "on": "importDictionary.done", "to": { "importing": false, "dictionaries": "result.added" } }
    ]
  },
  "events": [
    { "name": "importProgress", "payload": { "percent": "number", "current": "string" } },
    { "name": "importError", "payload": { "code": "string", "message": "string" } }
  ],
  "errors": [
    { "code": "FILE_INVALID", "message": "File không hợp lệ", "recovery": "retry" },
    { "code": "DB_WRITE_FAILED", "message": "Lỗi ghi database", "recovery": "rollback" }
  ]
}
```

### Freeze point rule (Hyrum's Law applied)

Contract.json is the **freeze point**. After Phase L freezes it:
- Phase L must NOT change action/state/event **signatures** (additive-only extensions OK with Phase F ack — see "Prefer Addition Over Modification" principle above).
- Phase F binds against the frozen contract — typed binding, no ad-hoc calls bypassing the contract.
- Every observable behavior in the contract becomes a de facto commitment (Hyrum's Law) — be intentional about what `actions`, `state`, `events`, `errors` expose.

### Parallel execution (subagents)

Launch 2 background subagents:
- **Subagent L** — Phase L: logic + contract.json + unit/integration tests (no UI).
- **Subagent F** — Phase F prep: token audit + component skeleton + Zustand store shape from mockup (no logic binding until freeze).

After Subagent L freezes contract.json → Subagent F binds → integration gate runs in main session (wire + E2E + browser verify).

### Git — atomic commits separated

- `feat: Mx-L <feature> logic + contract` — Phase L output (logic + contract.json + unit/integration tests, NO UI).
- `feat: Mx-F <feature> UI` — Phase F output (components + store binding + browser verify, NO logic changes).
- `feat: Mx-I <feature> integration` — Integration gate (wire + E2E + drift check) — only if integration adds non-trivial glue beyond Phase F binding.

### Verification (phase-split specific)

- [ ] `src/features/<feature>/<feature>.contract.json` exists, valid JSON, version-controlled
- [ ] Contract covers all actions/state/events/errors from spec
- [ ] Phase L tests pass with NO UI dependency (headless)
- [ ] Phase F components render all states from mockup (default + loading + error + empty)
- [ ] Integration gate: E2E user flow passes
- [ ] Browser verify: MCP screenshot real render matches mockup (drift check)
- [ ] Commits separated: logic ≠ UI (atomic per phase)
