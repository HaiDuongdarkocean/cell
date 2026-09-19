---
name: git-workflow-and-versioning
description: Atomic commits, branch hygiene, versioning. Use when committing, branching, or preparing release history.
---

# Git Workflow and Versioning

## Overview

Commits are save points, branches are sandboxes, history is documentation. With agents generating code fast, disciplined version control keeps changes reviewable and reversible.

## When to Use

Always — every code change flows through git.

## Core principles

1. **Trunk-based:** `main` always deployable; short-lived feature branches merged in 1–3 days. Dev branches are costs — every day adds merge risk. Feature flags > long branches.
2. **Commit early, often:** each verified increment = one commit → never lose more than one increment; `git reset --hard HEAD` is the eject button.
3. **Atomic:** one logical thing per commit — no "add feature, fix sidebar, update deps" bundles.
4. **Separate concerns:** formatting ≠ behavior; refactor ≠ feature — separate commits, ideally separate PRs. Small cleanups may ride a feature commit at reviewer discretion.
5. **Sized:** ~100 lines ideal, ~300 acceptable for one logical change, ~1000 → split (strategies in `code-review-and-quality`).

## Commit messages

```text
<type>: <short description>

<body explaining WHY, not what>
```

Types: `feat` · `fix` · `refactor` · `debt` · `test` · `docs` · `chore`. The body explains intent and context; the diff already shows what changed.

## Branch naming

```text
feature/<desc>   fix/<desc>   chore/<desc>   refactor/<desc>   debt/<island-or-dep>
```

## Pre-commit hygiene

```bash
git diff --staged                                            # what am I committing?
git diff --staged | grep -i "password\|secret\|api_key\|token"  # no secrets
npm test && npm run lint && npx tsc --noEmit                 # gates
```

- Commit generated files only when the project expects them (`package-lock.json`, migrations).
- `.gitignore` must cover `node_modules/`, `dist/`, `.env`, `.env.local`, `*.pem`.

## Worktrees (parallel agent lanes)

```bash
git worktree add ../project-feature-a feature/task-creation   # isolated dir + branch
git worktree remove ../project-feature-a                      # cleanup after merge
```

Each worktree is a separate directory with its own branch — parallel agents without interference. For the full orchestration contract (provision/integrate/cleanup), see `autonomous-pipeline`.

**Ownership markers (multi-agent):** khi tạo worktree cho pipeline item, ghi `.cell-owner` (untracked) ở root — `{"agent":"<CELL_AGENT_ID>","slug":"<item>"}` — và `pipeline-state.mjs set <slug> worktree=<path>`. Trước khi viết bất kỳ file nào trong `cell-worktrees/*` hay `../project-*`, đọc `.cell-owner`: owner khác mình → không ghi, kể cả "chỉ thêm test" hay "chỉ sửa nhỏ"; cần đóng góp → worktree riêng hoặc `request-handoff`. Tương tự trong main tree: dirty/uncommitted files không phải mình tạo = in-flight của agent khác — không stash/commit/edit đè; shield merge chỉ qua stash tên `wip-shield:<agent-id>` của chính mình, không pop stash người khác.

## Versioning (for anything with consumers)

- **Semver is a promise:** MAJOR = breaking, MINOR = additive, PATCH = fix. A "patch" that changes behavior consumers relied on is a disguised major (Hyrum's Law). Unsure → assume breaking.
- **Tag is source of truth:** `git tag -a v1.4.0` — derive the version from the tag, never hand-edit scattered files into disagreement.
- **Changelog is for humans, not `git log`:** curated by impact (`Added/Changed/Fixed/Deprecated/Removed/Security`), newest first, written *with* the change — not reconstructed at release time. Breaking changes get a migration note (`deprecation-and-migration`); shipping is `shipping-and-launch`.

→ Debt-commit template, change-summary format, git debugging (bisect/blame), hooks, generated-file rules, full rationalizations: `references/git-detail.md`

## Red flags

- Accumulating uncommitted changes; messages like "fix"/"update"/"misc"
- Formatting mixed with behavior; missing `.gitignore`; committing `node_modules`/`.env`/`dist`
- Long-lived divergent branches; force-push to shared branches
- Breaking change under minor/patch; release with no tag; hand-edited version out of sync with tag; changelog that's dumped commit messages

## Verification

- [ ] Each commit does one logical thing; message explains why; type convention followed
- [ ] Tests/lint/typecheck pass before commit; no secrets in diff
- [ ] Release: bump matches change (breaking→major, additive→minor, fix→patch); tagged; curated changelog entry

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. Router protocol trong AGENTS.md (always-on).
