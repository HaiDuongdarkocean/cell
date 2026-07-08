# Governance — Cell Extension

> **Context**: 1-dev Chrome Extension project. Governance scaled to solo workflow — no committee, but explicit decision rights + lifecycle rules so the DS stays coherent as it grows. Ponytail: full governance (RFC board, multi-stakeholder review) is overkill for 1 dev; these rules are the minimum that prevents drift.

## 12.1 Ownership

| Role | Who | Decision rights |
|---|---|---|
| **DS Owner** | Anh yêu (sole developer) | Approve/reject any token, component, pattern, principle, guideline change. Final say on deprecation + versioning. |
| **DS Maintainer** | Em (Devin agent) | Propose changes via ADR + this doc update. Execute approved changes. Surface drift via audit. Cannot self-approve breaking changes. |
| **Consumers** | Code in `src/` that uses tokens/components | Consume only via documented API ([components/](components/) + [patterns/](patterns/)). Report drift via `docs/reviews/` or ADR. |

> **Rule**: No token/component/pattern enters `theme.css` or `src/shared/ui/` without DS Owner approval. Approval = ADR merged OR inline approval in PR review (1-dev project allows inline, but breaking changes still require ADR — see §12.3).

## 12.2 Contribution process

```
Propose (em or anh yêu)
  │
  ├── Token/component/pattern NEW (backward compatible)
  │     1. Draft ADR (docs/adr/NNN-<decision>.md) — WHY + alternatives considered
  │     2. Update this doc (relevant layer file) in same commit
  │     3. Update Update Protocol verify-by check passes (grep/ls)
  │     4. DS Owner approval (inline OK for non-breaking)
  │     5. Bump version per §12.3 + add changelog entry per §12.5
  │
  ├── Token/component RENAME or REMOVE (breaking)
  │     1. ADR required (no inline approval)
  │     2. Deprecation cycle per §12.4 (mark → migrate → remove)
  │     3. Major version bump per §12.3
  │
  └── Principle/guideline NEW or CHANGE
        1. ADR with source citation (research-backed, not opinion)
        2. Update [guidelines/](guidelines/) or [principles/](principles/) + [references.md](references.md)
        3. DS Owner approval
```

**Proposal template** (for new token — adapt for component/pattern):

```markdown
## Proposal: <token/component/pattern name>

**Type**: new | rename | remove | deprecate
**Breaking**: yes | no
**ADR**: docs/adr/NNN-<decision>.md

### Why
<problem statement — what's missing or broken>

### What
<concrete spec — token name + value, component API, pattern use-when/don't-use-when>

### Alternatives considered
<at least 1 alternative + why rejected>

### Impact
<files touched, components affected, migration needed?>

### Verify
<grep/ls command to confirm after merge>
```

## 12.3 Versioning policy

**DS version** is independent from extension version (`package.json` version). DS version lives in [README.md](README.md) header (`DS version: X.Y.Z`) + [CHANGELOG.md](CHANGELOG.md).

| Bump type | When | Examples |
|---|---|---|
| **Major (X)** | Breaking change — token rename/remove, component API change, pattern removed | Rename `--color-primary` → `--color-brand`; remove `IconButton.variant` prop |
| **Minor (Y)** | Backward-compatible addition — new token, new component, new pattern, new principle | Add `--color-info`; add `Modal` component; add "skeleton loading" pattern |
| **Patch (Z)** | Value tweak, doc clarification, a11y refinement — no API change | Adjust `--color-primary` default from `#2563eb` to `#1d4ed8`; clarify guideline wording |

**Rules**:
- Every bump = changelog entry (§12.5)
- Major bump = ADR required + deprecation cycle (§12.4)
- Minor bump = ADR recommended (inline approval OK if non-trivial)
- Patch bump = no ADR needed, commit message + changelog sufficient
- DS version does NOT track extension version — extension can ship at 1.5.0 while DS is at 2.3.1

## 12.4 Deprecation policy

```
Token/component/pattern marked deprecated
  │
  ├── Step 1: MARK (minor bump)
  │     • Add @deprecated JSDoc tag in code
  │     • Add "⚠️ Deprecated since DS X.Y" row in tokens/components/patterns file
  │     • Add "Replaced by: <new name>" if applicable
  │     • Add changelog entry
  │
  ├── Step 2: MIGRATE (next minor — same major)
  │     • Update all consumers in src/ to use replacement
  │     • Keep deprecated token working (alias or shim)
  │     • Verify: grep deprecated name → 0 hits in src/ (except the alias definition)
  │
  └── Step 3: REMOVE (next major)
        • Remove deprecated token/component from theme.css + themeTokens.ts
        • Remove from tokens/components/patterns file
        • Add migration guide to changelog (major version entry)
        • Verify: grep removed name → 0 hits anywhere
```

**Timebox**: Deprecation should not linger — target 1 minor cycle (≤ 1 month for solo project) between MARK and REMOVE. If migration blocked, document why in ADR + extend.

## 12.5 Changelog

> **Location**: [CHANGELOG.md](CHANGELOG.md) (separate file — keeps layer docs scannable).
> **Format**: Keep a Changelog 1.1.0 — https://keepachangelog.com/en/1.1.0/
> **Entry per DS version bump** (per §12.3).

**Entry template**:

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Added (minor)
- <token/component/pattern> — <ADR link>

### Changed (patch)
- <what> — <commit/PR>

### Deprecated (minor)
- <token/component> — replaced by <new>, remove in [X+1].0.0

### Removed (major)
- <token/component> — see migration guide below

### Migration guide (major only)
<step-by-step for consumers>
```

> **Ponytail ceiling**: If changelog grows unwieldy (>50 entries), consider auto-generation from git tags + conventional commits. For now, manual is cheaper than tooling setup.

---

## Update Protocol

| Trigger | Update file | Verify by |
|---|---|---|
| Add/remove/rename token in `theme.css` or `themeTokens.ts` | [tokens/](tokens/) + [runtime.md](runtime.md) (sync status) | `grep` token name in both files |
| Add/remove/rename component/factory/controller | [components/](components/) | `ls src/` |
| New ADR approves interaction pattern | [patterns/interaction.md](patterns/interaction.md) | ADR file exists in `docs/adr/` |
| New a11y convention adopted | [guidelines/accessibility.md](guidelines/accessibility.md) | WCAG reference cited |
| New runtime context (e.g. new sidepanel page) | [runtime.md](runtime.md) | `manifest.json` entry |
| Mirror file (`themeTokens.ts`) changed | [runtime.md](runtime.md) (last synced date) | sync test pass |
| New design principle adopted (YouTube/M3 research) | [principles/](principles/) + [references.md](references.md) | Source citation in references |
| New settings UI pattern adopted | [patterns/settings.md](patterns/settings.md) | Pattern documented with use-when/don't-use-when |
| Governance decision (ownership/contribution/versioning/deprecation) | [governance.md](governance.md) + [CHANGELOG.md](CHANGELOG.md) | Changelog entry exists |
| DS version bump (major/minor/patch per §12.3) | [CHANGELOG.md](CHANGELOG.md) + [README.md](README.md) header `DS version` field | Changelog entry + version field match |
| Quarterly audit (optional, G7) | Re-verify all files vs codebase | `grep` + `ls` toàn bộ |

> **Semi-living**: Update when design system changes (token/pattern/atom/convention), NOT every commit. Ponytail: living documentation tuyệt đối cần Storybook/CI — overkill cho 1 dev. Semi-living = trust + low cost.
