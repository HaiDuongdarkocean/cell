---
name: pre-commit-gate
description: Run deterministic local quality checks before any commit. Use when an agent is about to finish a task and needs to verify build, typecheck, tests, lint, and design-system compliance before the human reviews or before commit.
---

# Pre-Commit Gate

## Overview

Mỗi change trước khi commit phải pass một loạt kiểm tra tự động. Skill này là **local quality gate** — chạy ngay trong session, trước khi `git-workflow-and-versioning` cho phép commit. Nó bắt lỗi sớm, tránh đẩy broken code lên repo.

## When to Use

- Trước khi tuyên bố "xong" một task.
- Trước khi `git commit`.
- Sau khi refactor, fix bug, thêm feature.
- Sau bất kỳ thay đổi `.ts`/`.tsx`/`.css`/`.json` trong `src/`.
- Khi user nói "check trước khi commit", "verify", "chạy gate".

## When NOT to Use

- Chỉ sửa docs `.md` (không ảnh hưởng build).
- Config hoàn toàn tĩnh (`.gitignore`, `.editorconfig`).
- Đã có CI/CD pass rồi và không cần local check lại.

## The Gate Pipeline

```
Change ready
    │
    ▼
┌─────────────────────┐
│ 1. Detect scope     │ What files changed? What checks needed?
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 1.5 Debt smell      │ Large files, TODO/FIXME, 0% coverage?
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 2. Lint             │ npm run lint (if .ts/.tsx/.css changed)
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 3. Type check       │ npx tsc --noEmit (if .ts/.tsx changed)
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 4. Unit tests       │ npm run test:unit (if logic changed)
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 5. Build            │ npm run build (always for src/ changes)
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 6. UI audit         │ design-system-guardian (if .css/.module.css changed)
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 7. Report           │ PASS or FAIL with specific fixes
└─────────────────────┘
```

## Step 1: Detect Scope

**Purpose:** Biết file nào thay đổi để chọn đúng checks.

**Actions:**
```bash
cd "<repo-root>"
git status --short
```

**Classify files:**
| Pattern | Checks to run |
|---|---|
| `*.ts`, `*.tsx` in `src/` | lint, typecheck, unit test (if test exists), build |
| `*.css`, `*.module.css` in `src/` | build, design-system-guardian |
| `tokens.json` | build (regenerates tokens.css), typecheck |
| `package.json`, `*.config.*` | build, typecheck |
| `.md`, `.txt` | skip (no build impact) |

## Step 1.5: Debt Smell Check

**Purpose:** Catch new or worsening technical debt before it reaches the commit.

**Actions:**
- For every changed `*.ts`/`*.tsx` in `src/`, check line count (`wc -l`).
  - If a file is > 500 lines and you are adding behavior, stop and extract a small piece first (see `incremental-implementation` Rule 0.6).
- `grep` for new `TODO`/`FIXME`/`HACK`/`console.log` you introduced.
  - Each must have a ticket, an owner, or be removed before commit.
- Check whether changed files have any unit test coverage.
  - If a changed logic file has 0% coverage, add at least one test before commit (use `test-driven-development`).

**Guard:** No new behavior is added to files > 500 lines without a documented extraction plan; no new `TODO`/`FIXME` without a tracking item; no 0% coverage logic changes without a test.

**Loop back:** If a debt smell is found, re-route to `incremental-implementation` or `test-driven-development` before continuing the gate.

## Step 2: Lint

**Purpose:** Catch style issues.

**Command:**
```bash
npm run lint
```

**Guard:** Exit 0 → pass. Any output → FAIL.

**Fix loop:**
1. Read first error.
2. Fix in source.
3. Re-run `npm run lint`.
4. Repeat until pass.

## Step 3: Type Check

**Purpose:** Catch TypeScript errors.

**Command:**
```bash
npx tsc --noEmit
```

**Guard:** Exit 0 → pass.

**Fix loop:**
1. Read error file + line.
2. Fix type or import.
3. Re-run.

## Step 4: Unit Tests

**Purpose:** Catch logic regression.

**Command:**
```bash
npm run test:unit
```

**Scope optimization:** If a specific file's test exists, run only that test first for speed:
```bash
npx jest path/to/File.test.tsx
```
Then run full suite.

**Guard:** All pass → pass.

**Flaky test check:** After a full pass, run the changed file's test (if any) a second time with `--coverage`:
```bash
npx jest --selectProjects unit --coverage --testPathPattern "path/to/File" --passWithNoTests
```
- If it fails here but passes without `--coverage`, flag it as a timing/coverage-flaky test and fix before commit (or isolate it from coverage).

## Step 5: Build

**Purpose:** Catch Vite/rollup issues that tsc misses.

**Command:**
```bash
npm run build
```

**Guard:** Exit 0 + no error output → pass.

## Step 6: UI Audit (if CSS changed)

**Purpose:** Enforce design system.

**Actions:**
- Invoke `/design-system-guardian` on changed `.css`/`.module.css`/`.tsx` files.
- Or run the audit commands from `docs/design-system/DESIGN.md`.

## Step 7: Report

**Output format:**

```markdown
## Pre-Commit Gate Result: PASS

| Check | Status |
|---|---|
| Lint | ✅ pass |
| Type check | ✅ pass |
| Unit tests | ✅ pass |
| Build | ✅ pass |
| UI audit | ✅ pass (not needed) |

Ready for commit.
```

Or if FAIL:

```markdown
## Pre-Commit Gate Result: FAIL

| Check | Status |
|---|---|
| Lint | ✅ pass |
| Type check | ❌ fail |
| Unit tests | ⏸️ skipped |
| Build | ⏸️ skipped |
| UI audit | ⏸️ skipped |

### Failing detail
```
src/features/X.tsx:42:15 - error TS2345: ...
```

### Next step
Fix `src/features/X.tsx:42` then re-run pre-commit gate.
```

## Verification Checklist

- [ ] Scope detected from `git status`.
- [ ] Lint passes.
- [ ] Type check passes.
- [ ] Unit tests pass.
- [ ] Build passes.
- [ ] UI audit passes (if CSS/TSX UI changed).
- [ ] Report written with specific pass/fail status.

## Anti-patterns

| Anti-pattern | Why bad | Do instead |
|---|---|---|
| Skip lint for small changes | Small changes break lint too | Always run lint if TS/TSX changed |
| Skip build because typecheck passed | tsc ≠ Vite build | Always run build for src/ changes |
| Run only changed file's test | May miss integration issues | Run full suite after targeted test |
| Commit before gate | Broken code enters repo | Gate pass before `git commit` |
| Add behavior to large files | Inflates technical debt and makes review hard | Extract a small piece first per `incremental-implementation` |
| Leave new TODO/FIXME without tracking | Becomes forgotten debt | Add ticket/owner or remove before commit |
| Skip tests for 0% coverage files | Keeps coverage gap open | Add at least one test for changed logic |
| Ignore test that fails under coverage | Will break CI gate later | Fix or isolate the flaky test |

## Router boomerang

If gate fails and needs debugging → `/debugging-and-error-recovery`.
If gate passes and ready to commit → `/git-workflow-and-versioning`.
If gate reveals missing tests → `/test-driven-development`.
If gate reveals new debt smells → `/audit-technical-debt` (to re-score and plan) or `/incremental-implementation` (to slice a safe extraction).
