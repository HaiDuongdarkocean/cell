# TDD — testing patterns with code

Reference for `test-driven-development`.

## RED example

```typescript
// RED: fails because createTask doesn't exist yet
describe('TaskService', () => {
  it('creates a task with title and default status', async () => {
    const task = await taskService.createTask({ title: 'Buy groceries' });
    expect(task.id).toBeDefined();
    expect(task.title).toBe('Buy groceries');
    expect(task.status).toBe('pending');
    expect(task.createdAt).toBeInstanceOf(Date);
  });
});
```

## Prove-It example

```typescript
// Bug: "Completing a task doesn't update completedAt"
// Step 1: reproduction test (should FAIL)
it('sets completedAt when task is completed', async () => {
  const task = await taskService.createTask({ title: 'Test' });
  const completed = await taskService.completeTask(task.id);
  expect(completed.completedAt).toBeInstanceOf(Date); // fails → bug confirmed
});

// Step 2: fix
export async function completeTask(id: string): Promise<Task> {
  return db.tasks.update(id, { status: 'completed', completedAt: new Date() });
}
```

## Characterization test (legacy code)

```typescript
it('characterizes applySubtitleSync output', () => {
  const controller = createTestController();
  controller.applySubtitleSync({ offset: -200, speed: 1.2 });

  // Start with a deliberately wrong expectation;
  // run, let the failure tell you the real value, then lock it in
  expect(controller.targetHidden).toBe(false);
  expect(controller.video.playbackRate).toBe(1.2);
});
```

## Contract test (old vs new)

```typescript
it('new subtitle sync service matches legacy controller output', () => {
  const legacy = createLegacyController();
  const modern = createSubtitleSyncService();
  const input = { offset: -200, speed: 1.2, visible: 'both' };

  legacy.applySubtitleSync(input);
  modern.apply(input);

  expect(modern.targetHidden).toBe(legacy.targetHidden);
  expect(modern.nativeHidden).toBe(legacy.nativeHidden);
  expect(modern.playbackRate).toBe(legacy.video.playbackRate);
});
```

## State, not interactions

```typescript
// Good: tests what the function does
it('returns tasks sorted by creation date, newest first', async () => {
  const tasks = await listTasks({ sortBy: 'createdAt', sortOrder: 'desc' });
  expect(tasks[0].createdAt.getTime()).toBeGreaterThan(tasks[1].createdAt.getTime());
});

// Bad: tests how it works internally
it('calls db.query with ORDER BY created_at DESC', async () => {
  await listTasks({ sortBy: 'createdAt', sortOrder: 'desc' });
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY created_at DESC'));
});
```

## DAMP over DRY

```typescript
// DAMP: each test is self-contained
it('rejects tasks with empty titles', () => {
  expect(() => createTask({ title: '', assignee: 'user-1' })).toThrow('Title is required');
});

it('trims whitespace from titles', () => {
  const task = createTask({ title: '  Buy groceries  ', assignee: 'user-1' });
  expect(task.title).toBe('Buy groceries');
});
```

## Test doubles preference

```
1. Real implementation → highest confidence
2. Fake               → in-memory version of a dependency
3. Stub               → canned data, no behavior
4. Mock (interaction) → verifies calls — use sparingly
```

Mock only when the real implementation is too slow, non-deterministic, or has uncontrollable side effects (external APIs, email). Over-mocking creates tests that pass while production breaks.

## Arrange-Act-Assert + one assertion per concept

```typescript
it('marks overdue tasks when deadline has passed', () => {
  // Arrange
  const task = createTask({ title: 'Test', deadline: new Date('2025-01-01') });
  // Act
  const result = checkOverdue(task, new Date('2025-01-02'));
  // Assert
  expect(result.isOverdue).toBe(true);
});
```

Good: `it('rejects empty titles')`, `it('trims whitespace')`, `it('enforces max length')` — separate tests. Bad: one `it('validates titles correctly')` asserting everything.

## Descriptive names

```typescript
// Good
describe('TaskService.completeTask', () => {
  it('sets status to completed and records timestamp', ...);
  it('throws NotFoundError for non-existent task', ...);
  it('is idempotent — completing again is a no-op', ...);
});

// Bad
it('works', ...); it('handles errors', ...);
```

## Subagent for reproduction tests

For complex bugs, spawn a subagent to write the reproduction test so it isn't contaminated by fix-knowledge:

```
Main agent: "Spawn a subagent to write a test that reproduces this bug:
[bug description]. The test should fail with the current code."
→ subagent writes test → main verifies it fails → implements fix → verifies it passes
```

## DevTools debugging workflow (browser)

```
1. REPRODUCE — navigate, trigger the bug, screenshot
2. INSPECT — console errors, DOM, computed styles, network
3. DIAGNOSE — actual vs expected: HTML, CSS, JS, or data?
4. FIX — in source code
5. VERIFY — reload, screenshot, clean console, run tests
```

| Tool | When | Look for |
|---|---|---|
| Console | Always | zero errors/warnings |
| Network | API issues | status, payload shape, timing, CORS |
| DOM | UI bugs | structure, attributes, a11y tree |
| Styles | Layout | computed vs expected, specificity |
| Performance | Slow pages | LCP, CLS, INP, long tasks >50ms |
| Screenshots | Visual | before/after for CSS/layout |
